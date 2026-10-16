import { useEffect, useMemo, useState } from "react";
import { EFFECTS, DIRS, effectOf, type Dir, type Kind } from "./anim";
import { listAnims, objects, type Start } from "./animOps";

interface Props {
  text: string; slideId: number; slideNo: number; cursorLine: number; // 0-based line of the cursor in the deck
  onAdd: (index: number, o: { effect: string; dir: Dir | ""; dur: number; delay: number; start: Start }) => void;
  onRemove: (line: number) => void; onSwap: (a: number, b: number) => void; onJump: (line: number) => void; onClose: () => void;
}
const ARROW: Record<Dir, string> = { left: "←", right: "→", up: "↑", down: "↓" };
const KINDS: { k: Kind; label: string; dot: string }[] = [{ k: "entrance", label: "Entrance", dot: "#4caf7d" }, { k: "emphasis", label: "Emphasis", dot: "#e8b84a" }, { k: "exit", label: "Exit", dot: "#e5645e" }];
const START: { v: Start; label: string }[] = [{ v: "click", label: "On click" }, { v: "with", label: "With previous" }, { v: "after", label: "After previous" }, { v: "enter", label: "When the slide appears" }];

export function AnimationsPanel({ text, slideId, slideNo, cursorLine, onAdd, onRemove, onSwap, onJump, onClose }: Props) {
  const objs = useMemo(() => objects(text, slideId), [text, slideId]);
  const anims = useMemo(() => listAnims(text, slideId), [text, slideId]);
  const [sel, setSel] = useState(0), [start, setStart] = useState<Start>("click"), [dir, setDir] = useState<Dir | "">(""), [dur, setDur] = useState(""), [delay, setDelay] = useState(0);
  useEffect(() => { setSel((s) => Math.min(s, Math.max(objs.length - 1, 0))); }, [objs.length]);
  const add = (effect: string) => { const e = effectOf(effect)!; onAdd(sel, { effect, dir: e.dirs ? dir || e.defDir! : "", dur: dur === "" ? e.dur : +dur, delay, start }); };
  const nexts = anims.filter((a) => a.when === "next");
  const dirsOn = EFFECTS.some((e) => e.dirs);
  return (
    <aside className="sidepanel">
      <div className="sp-head"><b>Animations</b><span className="grow" /><button title="Close" onClick={onClose}>✕</button></div>
      <div className="sp-body">
        <p className="sp-note">Slide {slideNo}. Pick an object, then click an effect to add it.</p>
        <label className="opt"><span>Object</span>
          <select value={sel} onChange={(e) => setSel(+e.target.value)}>{objs.map((o) => <option key={o.index} value={o.index}>{o.index + 1}. {o.label}</option>)}</select>
        </label>
        <button className="wide" onClick={() => setSel(objs.findIndex((_, k) => k === Math.max(0, objs.filter((o) => o.top <= cursorLine).length - 1)))} title="Choose the object the cursor is in">Use the object at the cursor</button>
        <div className="opt"><span>Start</span>
          <select value={start} onChange={(e) => setStart(e.target.value as Start)}>{START.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</select></div>
        {dirsOn && <div className="opt"><span>Direction</span>
          <div className="dirs"><button className={dir === "" ? "on" : ""} title="Each effect's own default" onClick={() => setDir("")}>auto</button>{DIRS.map((d) => <button key={d} className={dir === d ? "on" : ""} title={`From the ${d}`} onClick={() => setDir(d)}>{ARROW[d]}</button>)}</div></div>}
        <div className="opt"><span>Duration</span><input type="number" min={0} max={10} step={0.1} placeholder="auto" value={dur} onChange={(e) => setDur(e.target.value)} /><em>s</em>
          <span style={{ marginLeft: 10 }}>Delay</span><input type="number" min={0} max={10} step={0.1} value={delay} onChange={(e) => setDelay(+e.target.value || 0)} /><em>s</em></div>
        {KINDS.map((g) => (
          <section key={g.k}>
            <h4><i className="kdot" style={{ background: g.dot }} />{g.label}</h4>
            <div className="chips">{EFFECTS.filter((e) => e.kind === g.k).map((e) => <button key={e.id} className="chip" disabled={!objs.length} onClick={() => add(e.id)}>{e.label}</button>)}</div>
          </section>
        ))}
        <section>
          <h4>Animation pane</h4>
          {!anims.length && <p className="sp-note">Nothing animated on this slide yet. While presenting, each “On click” effect plays on one press of Next.</p>}
          <ol className="apane">
            {anims.map((a) => {
              const k = nexts.indexOf(a);
              return (
                <li key={a.line}>
                  <span className="num" title={a.when === "enter" ? "Plays when the slide appears" : "One press of Next"}>{a.when === "enter" ? "▶" : k + 1}</span>
                  <div className="what" onClick={() => onJump(a.line)} title="Show in the source">
                    <b>{a.owner}</b>
                    <small>{a.groups.map((g) => g.map((s) => s.verb === "anim" ? `${effectOf(s.effect!)?.label ?? s.effect}` : s.raw).join(" + ")).join("  →  ")}</small>
                  </div>
                  <span className="mv">
                    <button disabled={a.when !== "next" || k < 1} title="Earlier" onClick={() => onSwap(a.line, nexts[k - 1].line)}>▲</button>
                    <button disabled={a.when !== "next" || k < 0 || k >= nexts.length - 1} title="Later" onClick={() => onSwap(a.line, nexts[k + 1].line)}>▼</button>
                    <button title="Remove" onClick={() => onRemove(a.line)}>✕</button>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </aside>
  );
}
