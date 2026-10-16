import { useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { DeckCtx } from "./ctx";
import type { InputDef } from "./itsd";

// A text box on a slide. Its value is live: {{name}} in slide text and in runnable code follows it.
// `run=id` runs that block on Enter (and from the Run button); `live` also re-runs it shortly after each keystroke.
export function InputBox({ def, onRun }: { def: InputDef; onRun?: () => void }) {
  const api = useContext(DeckCtx);
  useSyncExternalStore(api.subscribe, api.snapshot);
  const value = api.input(def.name) ?? "";
  const first = useRef(true);
  const run = useRef(onRun); run.current = onRun;

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!def.live || !def.run) return;
    const t = setTimeout(() => run.current?.(), 450);
    return () => clearTimeout(t);
  }, [value, def.live, def.run]);

  return (
    <label className="ibox">
      <span>{def.label}</span>
      <div>
        <input type="text" value={value} spellCheck={false} placeholder={def.placeholder} data-input={def.name}
          onChange={(e) => api.setInput(def.name, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && onRun) { e.preventDefault(); onRun(); } }} />
        {onRun && <button className="ibtn" onClick={(e) => { e.preventDefault(); onRun(); }}>Run</button>}
      </div>
    </label>
  );
}
