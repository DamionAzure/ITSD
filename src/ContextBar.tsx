import type { Slide } from "./itsd";

export type Snippet = "slide" | "code" | "button" | "input" | "source" | "flash" | "sound" | "trace" | "traceOne" | "table" | "traceTable" | "macro" | "script" | "on" | "notes";
import { parseTransition } from "./transitions";
interface Props { onPanel: (k: "transitions" | "animations") => void; deckTransition?: string; slide: Slide; sounds: string[]; onPreview: (name: string) => void; onOpt: (key: string, value: string) => void; onInsert: (k: Snippet) => void; visual?: boolean; onUndo?: () => void; onRedo?: () => void }

// Affinity-style context toolbar: its controls follow whatever slide is selected.
export function ContextBar({ onPanel, deckTransition, slide, sounds, onPreview, onOpt, onInsert, visual, onUndo, onRedo }: Props) {
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
      <button className="pill" title="Open the Transitions gallery" onClick={() => onPanel("transitions")}>Transition: {parseTransition(slide.opts.transition ?? deckTransition).def.label}{slide.opts.transition ? "" : " (deck)"} ▾</button>
      <button className="pill" title="Open the Animations pane" onClick={() => onPanel("animations")}>Animations ▾</button>
      {sel("reveal", "Reveal", ["stagger", "none"])}
      {sel("align", "Align", ["left", "center", "right", "justify"])}
      <label title="Plays when this slide appears while presenting">Sound
        <select value={slide.opts.sound?.split(/\s+/)[0] ?? ""} onChange={(e) => onOpt("sound", e.target.value + (slide.opts.sound?.match(/\s.*$/)?.[0] ?? ""))}>
          <option value="">None</option>
          {slide.opts.sound && !sounds.includes(slide.opts.sound.split(/\s+/)[0]) && <option value={slide.opts.sound.split(/\s+/)[0]}>{slide.opts.sound.split(/\s+/)[0]} (not found)</option>}
          {sounds.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <button title="Hear it" disabled={!slide.opts.sound} onClick={() => onPreview(slide.opts.sound.split(/\s+/)[0])}>▶</button>
      </label>
      <span className="grow" />
      {visual && <><button title="Undo (Ctrl+Z)" onClick={onUndo}>↶ Undo</button><button title="Redo (Ctrl+Y)" onClick={onRedo}>↷ Redo</button></>}
      <button onClick={() => onInsert("slide")}>+ Slide</button>
      {!visual && <>
        <button onClick={() => onInsert("code")}>+ Code block</button>
        <button onClick={() => onInsert("button")}>+ Button</button>
        <button onClick={() => onInsert("input")}>+ Input</button>
        <button title="A trace of a run block, as an element on this slide" onClick={() => onInsert("trace")}>+ Trace</button>
        <button title="A styled table you write as plain rows" onClick={() => onInsert("table")}>+ Table</button>
        <button onClick={() => onInsert("source")}>+ Source</button>
        <button onClick={() => onInsert("notes")}>+ Speaker notes</button>
        <button title="Flash region that starts when you press Next" onClick={() => onInsert("flash")}>+ Flash</button>
      </>}
    </div>
  );
}
