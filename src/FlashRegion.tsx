import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DeckCtx, RegCtx } from "./ctx";
import { flashBox, plan, type FlashItem, type FlashSpec } from "./flash";
import { AR } from "./aspect";

const colorOf = (c: string | null) => (c && typeof CSS !== "undefined" && CSS.supports("color", c) ? c : undefined);

// `paused` is for the Visual view, where the slide is a layout surface and nothing should animate.
// `runKey` identifies this block, so at-start can tell whether it has already run in this presentation.
export function FlashRegion({ spec, paused, runKey, tag }: { spec: FlashSpec; paused?: boolean; runKey: string; tag?: Record<string, unknown> }) {
  const api = useContext(DeckCtx), reg = useContext(RegCtx);
  const [running, setRunning] = useState(() =>
    !paused && (spec.trigger === "new-slide" || (spec.trigger === "at-start" && api.firstVisit(runKey))));
  const [armed, setArmed] = useState(false); // waiting for Next (when-next)
  const [run, setRun] = useState(0); // bumping it restarts the sequence
  const [shown, setShown] = useState<{ item: FlashItem; n: number } | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hidden, setHidden] = useState(false);
  const box = useRef<HTMLDivElement>(null), txt = useRef<HTMLSpanElement>(null);

  const start = () => { setRun((r) => r + 1); setRunning(true); };
  const stop = () => { setRunning(false); setShown(null); };
  const startRef = useRef(start), stopRef = useRef(stop); startRef.current = start; stopRef.current = stop;

  // when-next: register with the deck; the next Next press starts the sequence instead of advancing the slide.
  useEffect(() => {
    if (spec.trigger !== "when-next" || paused) { setArmed(false); return; }
    setArmed(true);
    return api.armNext(() => { setArmed(false); startRef.current(); });
  }, [spec, paused]);

  useEffect(() => {
    if (!running || paused || !spec.items.length) return;
    let alive = true, timer = 0, i = 0, n = 0, steps = plan(spec);
    const next = () => {
      if (!alive) return;
      if (i >= steps.length) {
        if (!spec.loop) { setShown(null); setRunning(false); return; }
        steps = plan(spec); i = 0; // a new pass draws new random durations (and a new order if shuffled)
      }
      const s = steps[i++];
      setShown({ item: s.item, n: ++n });
      timer = window.setTimeout(() => {
        if (!s.gap) { next(); return; }
        setShown(null);
        timer = window.setTimeout(next, s.gap);
      }, s.ms);
    };
    next();
    return () => { alive = false; clearTimeout(timer); };
  }, [running, run, spec, paused]);

  useEffect(() => {
    if (!spec.id) return;
    reg.set(spec.id, {
      setCode: () => {}, note: () => {}, show: (v) => setHidden(!v),
      run: async () => startRef.current(), start: () => startRef.current(), stop: () => stopRef.current(),
    });
    return () => { reg.delete(spec.id!); };
  }, [spec.id]);

  // Random mode: pick a spot anywhere inside the box once the text has been measured, before it is painted.
  useLayoutEffect(() => {
    if (!shown || spec.mode !== "random" || !box.current || !txt.current) return;
    const W = box.current.clientWidth - txt.current.offsetWidth, H = box.current.clientHeight - txt.current.offsetHeight;
    setPos({ x: Math.random() * Math.max(0, W), y: Math.random() * Math.max(0, H) });
  }, [shown]);

  const abs = spec.x !== undefined && spec.y !== undefined;
  const rnd = spec.mode === "random";
  const clickable = spec.trigger === "manual" && !paused;
  const hc = spec.h !== undefined ? spec.h / AR : spec.size / spec.ratio; // height in units of slide width, for the text size
  return (
    <div ref={box} hidden={hidden} {...tag} className={"flash" + (spec.frame ? " framed" : "") + (abs ? " abs" : "") + (clickable ? " click" : "")}
      style={{ ...flashBox(spec), ...(abs ? { left: `${spec.x}%`, top: `${spec.y}%` } : {}) }}
      onClick={clickable ? () => (running ? stopRef.current() : startRef.current()) : undefined}>
      {/* a reminder for the author only: the audience never sees it */}
      {armed && !shown && !api.presenting() && <span className="flash-hint">waits for Next</span>}
      {shown && (
        <span key={shown.n} ref={txt} className={"flash-text" + (rnd ? " rnd" : "")}
          style={{ color: colorOf(shown.item.color), fontSize: `calc(var(--u, 1cqw) * ${spec.font ?? Math.min(spec.size, hc) * 0.22})`, ...(rnd ? { left: pos.x, top: pos.y } : {}) }}>
          {api.fill(shown.item.text)}
        </span>
      )}
    </div>
  );
}
