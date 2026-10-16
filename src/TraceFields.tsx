import { useState } from "react";
import { FIELDS } from "./traceEdit";
import type { TraceDef } from "./traceBlock";
import { parseInfo } from "./itsd";

/** Ids of the run blocks in the deck, for the "Reads from" list. */
export function runIds(slides: { src: string }[]): string[] {
  const ids = new Set<string>();
  for (const s of slides) for (const l of s.src.split("\n")) {
    const m = l.match(/^\s*(?:`{3,}|~{3,})(.+)$/);
    if (m) { const i = parseInfo(m[1]); if (i.flags.has("run") && i.attrs.id) ids.add(i.attrs.id); }
  }
  return [...ids];
}

// The options of one trace part, edited in the Inspector. Each change rewrites that part's own line, so every part is styled on its own.
export function TraceFields({ def, runs, onPatch, onSplit }: { def: TraceDef; runs: string[]; onPatch: (p: Record<string, string | null>) => void; onSplit?: () => void }) {
  const fields = FIELDS[def.part || "all"];
  const a = def.attrs;
  return (
    <div className="tf">
      <label>Reads from
        <select value={a.from ?? ""} onChange={(e) => onPatch({ from: e.target.value || null })}>
          <option value="">The latest run</option>
          {a.from && !runs.includes(a.from) && <option value={a.from}>{a.from} (not found)</option>}
          {runs.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      {fields.map((f) => f.t === "bool" ? (
        <label className="chk" key={f.k}><input type="checkbox" checked={!["false", "0", "off", "no"].includes(a[f.k] ?? f.d ?? "true")} onChange={(e) => onPatch({ [f.k]: e.target.checked ? null : "false" })} /> {f.label}</label>
      ) : f.t === "color" ? (
        <label key={f.k}>{f.label}
          <span className="sw"><input type="color" value={/^#[0-9a-f]{6}$/i.test(a[f.k] ?? "") ? a[f.k] : f.d} onChange={(e) => onPatch({ [f.k]: e.target.value })} />
            <button disabled={a[f.k] === undefined} onClick={() => onPatch({ [f.k]: null })}>Reset</button></span>
        </label>
      ) : f.t === "select" ? (
        <label key={f.k}>{f.label}
          <select value={a[f.k] ?? f.d ?? ""} onChange={(e) => onPatch({ [f.k]: e.target.value || null })}>{(f.opts ?? []).map((o) => <option key={o} value={o}>{o || "default"}</option>)}</select>
        </label>
      ) : <Text key={f.k} label={f.label} value={a[f.k] ?? ""} ph={f.hint ?? f.d ?? ""} num={f.t === "num"} onCommit={(v) => onPatch({ [f.k]: v || null })} />)}
      {onSplit && <button onClick={onSplit} title="Replace this with separate elements: title, bars, counts, controls, code and operations">Split into parts</button>}
    </div>
  );
}
function Text({ label, value, ph, num, onCommit }: { label: string; value: string; ph: string; num: boolean; onCommit: (v: string) => void }) {
  const [v, setV] = useState<string | null>(null);
  const done = () => { if (v !== null && v !== value) onCommit(v.trim()); setV(null); };
  return <label>{label}<input type={num ? "number" : "text"} step={num ? 0.1 : undefined} min={num ? 0.1 : undefined} placeholder={ph} value={v ?? value} onChange={(e) => setV(e.target.value)} onBlur={done} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></label>;
}
