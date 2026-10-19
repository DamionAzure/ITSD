import { useMemo, useState } from "react";
import { MODULES, findEffect } from "./registry";
import { addFx, patchFx, removeFx, scanFx, type FxRef } from "./fxEdit";
import type { PropDef } from "./types";

interface Props { src: string; id: number; edit: (fn: (t: string) => string) => void }

// One option of one effect. Text is committed on Enter/blur (not per keystroke) so each change is one Ctrl+Z.
function Field({ p, value, onSet }: { p: PropDef; value?: string; onSet: (v: string | null) => void }) {
  const shown = value ?? (p.def === undefined ? "" : Array.isArray(p.def) ? p.def.join(",") : String(p.def));
  const key = `${p.key}:${shown}`;
  const text = (type: string) => (
    <input key={key} type={type} defaultValue={shown} step={p.type === "number" ? "any" : undefined} spellCheck={false}
      onBlur={(e) => e.target.value !== shown && onSet(e.target.value || null)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
  );
  return (
    <label className="fxf">{p.key}
      {p.type === "boolean" ? <input key={key} type="checkbox" checked={shown === "true"} onChange={(e) => onSet(String(e.target.checked))} />
        : p.type === "select" ? <select key={key} value={shown} onChange={(e) => onSet(e.target.value)}>{p.options!.map((o) => <option key={o}>{o}</option>)}</select>
        : p.type === "color" ? <input key={key} type="color" value={/^#[0-9a-f]{6}$/i.test(shown) ? shown : "#ffffff"} onChange={(e) => onSet(e.target.value)} />
        : text(p.type === "number" ? "number" : "text")}
    </label>
  );
}

function Row({ r, n, id, edit }: { r: FxRef; n: number; id: number; edit: Props["edit"] }) {
  const [open, setOpen] = useState(false);
  const e = findEffect(r.id);
  return (
    <li className={open ? "on" : ""}>
      <div className="fxrow" onClick={() => e && setOpen(!open)}>
        <span title={r.id}>{e ? e.effect.label : r.id}</span>
        <small>{e ? e.effect.kind : "not installed"}</small>
        <button title="Remove" onClick={(ev) => { ev.stopPropagation(); edit((t) => removeFx(t, id, n)); }}>✕</button>
      </div>
      {open && e && (
        <div className="fxopts">
          {e.effect.props.map((p) => <Field key={p.key} p={p} value={r.attrs[p.key]} onSet={(v) => edit((t) => patchFx(t, id, n, { [p.key]: v }))} />)}
          {e.effect.props.length === 0 && <p className="hint">This effect has no options.</p>}
          <div className="btns"><button onClick={() => edit((t) => patchFx(t, id, n, {}, true))}>Reset to defaults</button></div>
        </div>
      )}
    </li>
  );
}

/** The Modules tab of the Visual view: add effects from whichever modules are installed, edit the ones on this slide. */
export function ModulesPanel({ src, id, edit }: Props) {
  const here = useMemo(() => scanFx(src), [src]);
  return (
    <>
      {MODULES.map((m) => (
        <section key={m.id}>
          <div className="ptitle">{m.name.toUpperCase()}</div>
          {m.effects.length === 0 ? <p className="hint">{m.hint ?? "This module has no effects yet."}</p> : (["background", "text", "wrap"] as const).map((k) => {
            const list = m.effects.filter((e) => e.kind === k);
            return list.length > 0 && (
              <div key={k}>
                <p className="hint fxk">{k === "background" ? "Backgrounds (fill the slide)" : k === "text" ? "Text (a block you can place)" : "Wrappers (go around content you write inside)"}</p>
                <div className="fxgrid">{list.map((e) => <button key={e.id} title={`Add ${e.label} to this slide`} onClick={() => edit((t) => addFx(t, id, `${m.id}.${e.id}`))}>{e.label}</button>)}</div>
              </div>
            );
          })}
        </section>
      ))}
      <section>
        <div className="ptitle">ON THIS SLIDE</div>
        {here.length ? <ul className="layers fxlist">{here.map((r, n) => <Row key={`${r.line}:${r.id}`} r={r} n={n} id={id} edit={edit} />)}</ul>
          : <p className="hint">No effects on this slide. Click one above, or right-click the slide &gt; Add &gt; Effect.</p>}
      </section>
    </>
  );
}
