import { useState } from "react";
import { LOOK_FIELDS, PRESET_NAMES, type LookAttrs, type LookField, withPreset } from "./look";
import { SHOW_EFFECTS, SHOW_MODES, type ShowDef } from "./slideshow";

const off = (v: string | undefined) => v === undefined || ["false", "0", "off", "no"].includes(v);

function Text({ label, value, ph, num, onCommit }: { label: string; value: string; ph: string; num: boolean; onCommit: (v: string) => void }) {
  const [v, setV] = useState<string | null>(null);
  const done = () => { if (v !== null && v !== value) onCommit(v.trim()); setV(null); };
  return <label>{label}<input type={num ? "number" : "text"} step={num ? 0.1 : undefined} placeholder={ph} value={v ?? value} onChange={(e) => setV(e.target.value)} onBlur={done} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></label>;
}

/** A list of options, edited as attributes. `fields` say what each one is; onPatch gets `{key: value | null}`. */
export function FieldList({ fields, a, onPatch }: { fields: LookField[]; a: LookAttrs; onPatch: (p: Record<string, string | null>) => void }) {
  return <>{fields.map((f) => f.t === "bool" ? (
    <label className="chk" key={f.k}><input type="checkbox" checked={a[f.k] !== undefined ? !off(a[f.k]) : f.d === "true"} onChange={(e) => onPatch({ [f.k]: e.target.checked ? (f.d === "true" ? null : "true") : (f.d === "true" ? "false" : null) })} /> {f.label}</label>
  ) : f.t === "color" ? (
    <label key={f.k}>{f.label}
      <span className="sw"><input type="color" value={/^#[0-9a-f]{6}$/i.test(a[f.k] ?? "") ? a[f.k] : f.d ?? "#888888"} onChange={(e) => onPatch({ [f.k]: e.target.value })} />
        <button disabled={a[f.k] === undefined} onClick={() => onPatch({ [f.k]: null })}>Reset</button></span>
    </label>
  ) : f.t === "select" ? (
    <label key={f.k}>{f.label}
      <select value={a[f.k] ?? f.d ?? ""} onChange={(e) => onPatch({ [f.k]: e.target.value || null })}>{(f.opts ?? []).map((o) => <option key={o} value={o}>{o || "default"}</option>)}</select>
    </label>
  ) : <Text key={f.k} label={f.label} value={a[f.k] ?? ""} ph={f.hint ?? f.d ?? ""} num={f.t === "num"} onCommit={(v) => onPatch({ [f.k]: v || null })} />)}</>;
}

/** The Look of any block: a row of presets, then every option. Each change rewrites the block's own `<!-- @look -->` line. */
export function LookPanel({ look, kind, onPatch, onPreset }: { look: LookAttrs; kind: string; onPatch: (p: Record<string, string | null>) => void; onPreset: (name: string) => void }) {
  const eff = withPreset(look);
  const fields = LOOK_FIELDS.filter((f) => f.k !== "look" && (kind === "img" || kind === "media" || kind === "show" || !["fit"].includes(f.k)));
  const has = Object.keys(look).length > 0;
  return (
    <details className="lookp" open={has}>
      <summary>Look{look.look ? ` · ${look.look}` : has ? " · custom" : ""}</summary>
      <div className="presets">
        {PRESET_NAMES.map((n) => <button key={n} className={look.look === n ? "on" : ""} onClick={() => onPreset(n)}>{n}</button>)}
      </div>
      <div className="tf"><FieldList fields={fields} a={eff} onPatch={onPatch} /></div>
      <div className="btns"><button disabled={!has} onClick={() => onPreset("")}>Clear look</button></div>
    </details>
  );
}

const MODE_HINT: Record<string, string> = { loop: "pic 1, then 2, then 3, then round again", random: "a random picture each time", staggered: "several frames, one changing after another", once: "plays through, stops on the last" };
/** The options of a slideshow block. */
export function ShowFields({ def, onPatch, onPictures, onAdd }: { def: ShowDef; onPatch: (p: Record<string, string | null>) => void; onPictures: (srcs: string[]) => void; onAdd?: () => void }) {
  const a: LookAttrs = { ...def.attrs, mode: def.mode, effect: def.effect, fit: def.fit };
  const [list, setList] = useState<string | null>(null);
  const done = () => { if (list !== null) onPictures(list.split("\n").map((s) => s.trim()).filter(Boolean)); setList(null); };
  const f = (k: string, label: string, t: LookField["t"], extra: Partial<LookField> = {}): LookField => ({ k, label, t, ...extra });
  return (
    <div className="tf">
      <label>Pictures (one per line)
        <textarea rows={Math.min(7, Math.max(3, def.srcs.length))} value={list ?? def.srcs.join("\n")} onChange={(e) => setList(e.target.value)} onBlur={done} spellCheck={false} />
      </label>
      {onAdd && <button onClick={onAdd}>Add pictures…</button>}
      <FieldList a={a} onPatch={onPatch} fields={[
        f("mode", "How it plays", "select", { opts: SHOW_MODES as unknown as string[], d: "loop" }),
        f("every", "Seconds between changes", "num", { hint: def.mode === "staggered" ? "1.2" : "3" }),
        f("effect", "Change effect", "select", { opts: SHOW_EFFECTS as unknown as string[], d: "fade" }), f("fade", "Change takes (s)", "num", { hint: "0.8" }),
        f("fit", "Picture fit", "select", { opts: ["cover", "contain"], d: "cover" }),
        ...(def.mode === "staggered" ? [f("cells", "Frames", "num", { hint: "3" }), f("cols", "Columns", "num", { hint: String(def.cols) }), f("gap", "Gap", "num", { hint: "1" })] : []),
        f("ratio", "Shape (when flowing)", "text", { hint: "16/9" }),
        f("shuffle", "Start in a random order", "bool", { d: "false" }), f("id", "Name (for buttons)", "text", { hint: "gallery" }),
      ]} />
      <label className="chk"><input type="checkbox" checked={def.autoplay} onChange={(e) => onPatch({ paused: e.target.checked ? null : "true", autoplay: null })} /> Start by itself</label>
      <p className="hint">{MODE_HINT[def.mode]}.</p>
    </div>
  );
}
