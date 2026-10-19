import type { Slide } from "./itsd";

export type Snippet = "slide" | "code" | "button" | "input" | "source" | "flash";
interface Props { slide: Slide; onOpt: (key: string, value: string) => void; onInsert: (k: Snippet) => void; visual?: boolean; onUndo?: () => void; onRedo?: () => void }

// Affinity-style context toolbar: its controls follow whatever slide is selected.
export function ContextBar({ slide, onOpt, onInsert, visual, onUndo, onRedo }: Props) {
  const sel = (key: string, label: string, opts: string[]) => (
    <label>{label}
      <select value={slide.opts[key] ?? ""} onChange={(e) => onOpt(key, e.target.value)}>
        <option value="">Deck default</option>
        {opts.map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
      </select>
    </label>
  );
  return (
    <div className="ctxbar">
      <span className="lbl">Slide {slide.id + 1}</span>
      {sel("transition", "Transition", ["fade", "slide", "zoom", "none"])}
      {sel("reveal", "Reveal", ["stagger", "none"])}
      {sel("align", "Align", ["left", "center", "right", "justify"])}
      <span className="grow" />
      {visual && <><button title="Undo (Ctrl+Z)" onClick={onUndo}>↶ Undo</button><button title="Redo (Ctrl+Y)" onClick={onRedo}>↷ Redo</button></>}
      <button onClick={() => onInsert("slide")}>+ Slide</button>
      {!visual && <>
        <button onClick={() => onInsert("code")}>+ Code block</button>
        <button onClick={() => onInsert("button")}>+ Button</button>
        <button onClick={() => onInsert("input")}>+ Input</button>
        <button onClick={() => onInsert("source")}>+ Source</button>
        <button title="Flash region that starts when you press Next" onClick={() => onInsert("flash")}>+ Flash</button>
      </>}
    </div>
  );
}
