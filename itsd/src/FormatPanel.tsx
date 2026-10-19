import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MODULES, effectGroups, fromModule } from "./modules/registry";
import { ALIGNS, FAMILIES, SWATCHES, WEIGHTS, isEmpty, toStyle, type Align, type AlignPlan, type Fmt, type Plan } from "./format";

interface Props { x: number; y: number; plan: Plan; align: AlignPlan; onApply: (f: Fmt | null, align?: Align | "") => void; onClose: () => void; fxOk?: boolean; onFx?: (full: string) => void }

const HIGHLIGHTS = ["rgba(242,184,75,.35)", "rgba(127,214,164,.3)", "rgba(108,182,255,.3)", "rgba(255,138,138,.3)", "rgba(201,160,255,.3)"];
const ICON: Record<Align, number[][]> = { // line [x1, x2] per row, in a 14px-wide icon
  left: [[1, 13], [1, 9], [1, 12], [1, 7]], center: [[1, 13], [3, 11], [2, 12], [4, 10]],
  right: [[1, 13], [5, 13], [2, 13], [7, 13]], justify: [[1, 13], [1, 13], [1, 13], [1, 9]],
};
const hex = (c?: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : "#ffffff");

// Right-click formatting panel for the Source pane. Nothing is written until Apply, so it is one Ctrl+Z.
export function FormatPanel({ x, y, plan, align: ap, onApply, onClose, fxOk, onFx }: Props) {
  const [fxOpen, setFxOpen] = useState<string | null>(null); // which effect group is dropped down
  const box = useRef<HTMLDivElement>(null);
  const [f, setF] = useState<Fmt>(plan.fmt);
  const [al, setAl] = useState<Align | "">(ap.current);
  const hasText = plan.ranges.length > 0, hasAlign = ap.starts.length > 0;
  const alignChanged = hasAlign && al !== ap.current;
  const go = () => onApply(hasText ? f : null, alignChanged ? al : undefined);
  const [at, setAt] = useState({ left: x, top: y });
  const set = (p: Partial<Fmt>) => setF((o) => ({ ...o, ...p }));
  const known = FAMILIES.some((o) => o.css === (f.family ?? ""));
  const hadStyle = !!plan.ranges.some((r) => r.span);

  useLayoutEffect(() => {
    const r = box.current!.getBoundingClientRect();
    setAt({ left: Math.max(8, Math.min(x, innerWidth - r.width - 8)), top: Math.max(8, Math.min(y, innerHeight - r.height - 8)) });
    box.current!.focus();
  }, [x, y]);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (!box.current!.contains(e.target as Node)) onClose(); };
    window.addEventListener("mousedown", away, true);
    return () => window.removeEventListener("mousedown", away, true);
  }, [onClose]);

  const size = f.size ? parseFloat(f.size) : 1;
  const bump = (d: number) => set({ size: String(Math.max(0.3, Math.min(6, Math.round((size + d) * 100) / 100))) });
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "Enter" && !(e.target as HTMLElement).closest("select, textarea")) { e.preventDefault(); go(); }
  };
  const sw = (c: string, cur: string | undefined, pick: (c: string) => void) => (
    <button key={c} className={"sw" + (cur === c ? " on" : "")} style={{ background: c }} title={c} onClick={() => pick(c)} />
  );
  const preview: React.CSSProperties = {
    color: f.color, backgroundColor: f.bg, fontFamily: f.family, fontWeight: f.weight as any,
    fontStyle: f.italic ? "italic" : undefined, textDecoration: f.underline ? "underline" : undefined,
    fontSize: `${Math.min(size, 2.2)}em`,
  };

  return (
    <div className="fmt" ref={box} tabIndex={-1} style={at} onKeyDown={onKey} onContextMenu={(e) => e.preventDefault()}>
      <div className="fh"><strong>Format text</strong><span>{plan.label}</span></div>
      {hasText && (
        <>
          <div className="row">
            <div className="tg">
              <button className={f.weight && +f.weight >= 600 ? "on" : ""} title="Bold" style={{ fontWeight: 700 }} onClick={() => set({ weight: f.weight && +f.weight >= 600 ? undefined : "700" })}>B</button>
              <button className={f.italic ? "on" : ""} title="Italic" style={{ fontStyle: "italic" }} onClick={() => set({ italic: !f.italic || undefined })}>I</button>
              <button className={f.underline ? "on" : ""} title="Underline" style={{ textDecoration: "underline" }} onClick={() => set({ underline: !f.underline || undefined })}>U</button>
            </div>
            <div className="sz">
              <button title="Smaller" onClick={() => bump(-0.1)}>A−</button>
              <input type="number" step={0.1} min={0.3} max={6} value={f.size ?? ""} placeholder="1" aria-label="Size (× current)"
                onChange={(e) => set({ size: e.target.value || undefined })} /><i>×</i>
              <button title="Larger" onClick={() => bump(0.1)}>A+</button>
            </div>
          </div>
          <label className="fld">Typeface
            <select value={known ? f.family ?? "" : "custom"} onChange={(e) => set({ family: e.target.value || undefined })}>
              {FAMILIES.map((o) => <option key={o.label} value={o.css}>{o.label}</option>)}
              {!known && <option value="custom">Custom</option>}
            </select>
          </label>
          <label className="fld">Weight
            <select value={f.weight ?? ""} onChange={(e) => set({ weight: e.target.value || undefined })}>
              {WEIGHTS.map((o) => <option key={o.label} value={o.v}>{o.label}{o.v && ` (${o.v})`}</option>)}
            </select>
          </label>
          <div className="fld">Color
            <div className="sws">
              <button className={"sw none" + (!f.color ? " on" : "")} title="Default color" onClick={() => set({ color: undefined })}>∅</button>
              {SWATCHES.map((c) => sw(c, f.color, (v) => set({ color: v })))}
              <input type="color" value={hex(f.color)} title="Custom color" onChange={(e) => set({ color: e.target.value })} />
            </div>
          </div>
          <div className="fld">Highlight
            <div className="sws">
              <button className={"sw none" + (!f.bg ? " on" : "")} title="No highlight" onClick={() => set({ bg: undefined })}>∅</button>
              {HIGHLIGHTS.map((c) => sw(c, f.bg, (v) => set({ bg: v })))}
              <input type="color" value={hex(f.bg)} title="Custom highlight" onChange={(e) => set({ bg: e.target.value })} />
            </div>
          </div>
        </>
      )}
      {hasAlign && (
        <div className="fld">Align
          <div className="tg al">
            {ALIGNS.map((a) => (
              <button key={a} className={al === a ? "on" : ""} title={a[0].toUpperCase() + a.slice(1) + (al === a ? " (click again for default)" : "")} onClick={() => setAl(al === a ? "" : a)}>
                <svg width="14" height="12" viewBox="0 0 14 12" stroke="currentColor" strokeWidth="1.4">{ICON[a].map(([x1, x2], k) => <line key={k} x1={x1} x2={x2} y1={1.5 + k * 3} y2={1.5 + k * 3} />)}</svg>
              </button>
            ))}
            <em>{ap.starts.length > 1 ? `${ap.starts.length} blocks` : "this block"}</em>
          </div>
        </div>
      )}
      {onFx && MODULES.some((m) => m.effects.length) && (
        <div className="fxins">
          <div className="fh"><strong>Insert effect</strong><span>{fxOk ? "above this line" : "not here"}</span></div>
          {fxOk ? effectGroups().map((g) => (
            <div className={"fxgroup" + (fxOpen === g.kind ? " open" : "")} key={g.kind}>
              <button className="fxhead" aria-expanded={fxOpen === g.kind} title={g.about} onClick={() => setFxOpen(fxOpen === g.kind ? null : g.kind)}>
                <span>{g.label}</span><i>{g.about}</i><em>{g.entries.length}</em><b>{fxOpen === g.kind ? "▾" : "▸"}</b>
              </button>
              {fxOpen === g.kind && (
                <div className="fxgrid">
                  {g.entries.map((e) => <button key={e.full} title={`${e.module.name}: ${e.effect.label}`} onClick={() => onFx(e.full)}>{e.effect.label}</button>)}
                </div>)}
            </div>
          )) : <p className="why">Effects can't go inside a code block or the settings at the top.</p>}
        </div>
      )}
      {!hasText && <p className="why">{hasAlign ? "Code, buttons and settings can't take text styling, but they can be aligned." : plan.reason}</p>}
      {hasText && <div className="pv"><span style={preview}>Aa Sample text</span></div>}
      {(hasText || hasAlign) && (
        <div className="fa">
          <button disabled={!hadStyle && isEmpty(f)} hidden={!hasText} onClick={() => onApply({}, alignChanged ? al : undefined)} title="Remove all styling from this text">Clear style</button>
          <span className="grow" />
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!alignChanged && !(hasText && (hadStyle || !isEmpty(f)))} onClick={go} title={toStyle(f) || "No style"}>Apply</button>
        </div>
      )}
    </div>
  );
}
