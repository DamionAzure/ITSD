import { useContext, useEffect, useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { monaco, monacoLang, MONO } from "./monaco";
import { DeckCtx, type TraceData } from "./ctx";
import { SAMPLE_TRACE, parseTraceDef, type TraceDef } from "./traceBlock";
import { boxStyle, fmtVal, opColor, opName } from "./traceStyle";

// The trace's pieces. Each is its own slide element (placed, sized, rotated and styled on its own) and they stay in step through a shared player.
// `over` hands a part a run directly (the generated trace slide), instead of looking it up from `def.from`.
export interface Over { trace: TraceData; key: string }

const on = (v: string | undefined, d = true) => (v === undefined ? d : !["false", "0", "off", "no"].includes(v));
function useTraceView(def: TraceDef, over?: Over) {
  const api = useContext(DeckCtx);
  const real = over?.trace ?? api.trace(def.from) ?? null;
  const trace = real ?? SAMPLE_TRACE;
  const player = api.tracePlayer(over?.key ?? def.from);
  const st = useSyncExternalStore(player.subscribe, player.snapshot);
  useLayoutEffect(() => { player.bind(trace, !real, { sound: def.attrs.sound, vol: def.attrs.vol, pitch: def.attrs.pitch, autoplay: def.attrs.autoplay === undefined ? undefined : on(def.attrs.autoplay, false), loop: def.attrs.loop === undefined ? undefined : on(def.attrs.loop, false) }); }, [trace, real, def.attrs.sound, def.attrs.vol, def.attrs.pitch, def.attrs.autoplay, def.attrs.loop]);
  const last = trace.frames.length - 1, i = Math.min(st.i, last);
  return { api, player, real, sample: !real, trace, st, i, f: trace.frames[i], last, frames: trace.frames };
}
const num = (v: string | undefined, d: number) => { const n = parseFloat(v ?? ""); return Number.isFinite(n) && n > 0 ? n : d; };
const vars = (a: Record<string, string>, op?: string): CSSProperties => ({ ...boxStyle(a), "--ts": num(a.size, 1), ...((a.unsorted ?? a.bar) ? { "--bar": a.unsorted ?? a.bar } : null), ...((op && opColor(a, op)) ?? a.selected ?? a.hot ? { "--hot": (op && opColor(a, op)) ?? a.selected ?? a.hot } : null), ...(a.sorted ? { "--sorted": a.sorted } : null), ...(a.key ? { "--keyc": a.key } : null) } as CSSProperties);

type P = { def: TraceDef; over?: Over };

/** What every part's outer box carries, so a stylesheet can aim at it: `.tp`, `.tp-<part>`, `.itsd-trace`, your own `class=`, and data-part / data-op (the step now) / data-step / data-steps / data-playing / data-from. */
type View = ReturnType<typeof useTraceView>;
const hook = (part: string, def: TraceDef, v: View) => ({
  className: `tp tp-${part} itsd-trace${def.attrs.class ? " " + def.attrs.class : ""}`,
  "data-part": part, "data-op": v.f.op, "data-step": v.i + 1, "data-steps": v.frames.length, "data-playing": v.st.play ? "true" : "false", "data-from": def.from || undefined,
});

export function TitlePart({ def, over }: P) {
  const v = useTraceView(def, over);
  return (
    <div {...hook("title", def, v)} style={vars(def.attrs)}>
      <h2>{def.title}{on(def.attrs.steps) && <small>step {v.i + 1} of {v.frames.length}: {opName(def.attrs, v.f.op)}</small>}</h2>
    </div>
  );
}

const VIEWS = ["bars", "dots", "line", "numbers", "heat", "grid", "stack", "tree", "ring"];
export function BarsPart({ def, over }: P) {
  const v = useTraceView(def, over), { f, frames } = v, A = def.attrs;
  const max = Math.max(1, ...frames.flatMap((x) => [...x.a, x.key ?? 0].map(Math.abs)));
  const pct = (n: number) => Math.max(4, (Math.abs(n) / max) * 100);
  const h = (n: number) => `${pct(n)}%`;
  const labels = on(A.labels), index = on(A.index, false), pointers = on(A.pointers, false);
  const view = VIEWS.includes(A.view) ? A.view : "bars";
  const st = (k: number) => (f.sorted !== undefined && k < f.sorted ? " sorted" : "") + (f.hl?.includes(k) ? " hot" : "");
  const style: CSSProperties = { ...vars(A, f.op), ...(A.gap ? { "--gap": `calc(var(--u) * ${num(A.gap, 1.2)})` } : null), ...(A.radius ? { "--radius": `calc(var(--u) * ${num(A.radius, 0.4)})` } : null) };
  const sample = v.sample && <div className="sample">Sample. {def.from ? <>Run <code>{def.from}</code> to fill this.</> : "Run a block that prints @itsd lines to fill this."}</div>;
  const ptr = ["i", "j", "k", "l"], tag = (k: number) => { const at = f.hl?.indexOf(k) ?? -1; return pointers && at >= 0 ? <b className="ptr">{(A.pointer ?? ptr.join(" ")).split(/[\s,]+/)[at] ?? ""}</b> : null; };
  const idx = (k: number) => index ? <em className="ix">{k}</em> : null;
  const n = Math.max(1, f.a.length);
  if (view === "line") {
    const x = (k: number) => ((k + 0.5) / n) * 100;
    return (
      <div {...hook("bars", def, v)} data-view={view} style={style}>{sample}
        <div className="bars v-line">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={f.a.map((n2, k) => `${x(k)},${100 - pct(n2)}`).join(" ")} /></svg>
          {f.a.map((n2, k) => <div className={"pt" + st(k)} key={k} data-i={k} data-v={n2} style={{ left: `${x(k)}%`, bottom: `${pct(n2)}%` }}>{labels && <span>{fmtVal(A, n2)}</span>}{tag(k)}</div>)}
        </div>
      </div>
    );
  }
  if (view === "tree" || view === "ring") { // heap order (parent of k is (k-1)/2), or the values round a circle
    const lv = (k: number) => Math.floor(Math.log2(k + 1)), levels = lv(n - 1) + 1;
    const at = (k: number): [number, number] => {
      if (view === "ring") { const t = (k / n) * Math.PI * 2 - Math.PI / 2; return [50 + 38 * Math.cos(t), 50 + 36 * Math.sin(t)]; }
      const l = lv(k), p = k - (2 ** l - 1); return [((p + 0.5) / 2 ** l) * 100, ((l + 0.5) / levels) * 100];
    };
    return (
      <div {...hook("bars", def, v)} data-view={view} style={style}>{sample}
        <div className={`bars v-${view}`}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            {view === "tree" ? f.a.map((_, k) => { if (!k) return null; const [x1, y1] = at(k), [x2, y2] = at((k - 1) >> 1); return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} />; })
              : f.a.map((_, k) => { const [x1, y1] = at(k), [x2, y2] = at((k + 1) % n); return n > 1 ? <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} /> : null; })}
          </svg>
          {f.a.map((n2, k) => { const [x, y] = at(k); return <div className={"node" + st(k)} key={k} data-i={k} data-v={n2} style={{ left: `${x}%`, top: `${y}%` }}>{labels ? fmtVal(A, n2) : ""}{idx(k)}{tag(k)}</div>; })}
        </div>
      </div>
    );
  }
  if (view === "grid" || view === "stack") {
    const cols = view === "stack" ? 1 : Math.max(1, Math.round(num(A.cols, Math.ceil(Math.sqrt(n)))));
    const cells = view === "stack" ? [...f.a.keys()].reverse() : [...f.a.keys()]; // a stack grows upwards: the last value is on top
    return (
      <div {...hook("bars", def, v)} data-view={view} style={style}>{sample}
        <div className={`bars v-${view}`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {f.key !== undefined && view === "stack" && <div className="cell keyed">{labels && <span>key {fmtVal(A, f.key)}</span>}</div>}
          {cells.map((k) => <div className={"cell" + st(k)} key={k} data-i={k} data-v={f.a[k]}>{labels && <span>{fmtVal(A, f.a[k])}</span>}{idx(k)}{tag(k)}</div>)}
        </div>
      </div>
    );
  }
  return (
    <div {...hook("bars", def, v)} data-view={view} style={style}>{sample}
      <div className={`bars v-${view}`}>
        {f.key !== undefined && <div className="bar keyed">{labels && <span>key {fmtVal(A, f.key)}</span>}<i style={{ height: h(f.key) }} /></div>}
        {f.a.map((n2, k) => (
          <div className={"bar" + st(k)} key={k} data-i={k} data-v={n2} style={{ "--p": pct(n2) } as CSSProperties}>
            {tag(k)}{(labels || view === "numbers") && <span>{fmtVal(A, n2)}</span>}<i style={{ height: h(n2) }} />{idx(k)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CountsPart({ def, over }: P) {
  const v = useTraceView(def, over);
  const counts: Record<string, number> = {};
  for (const x of v.frames.slice(0, v.i + 1)) counts[x.op] = (counts[x.op] ?? 0) + 1;
  const kinds = [...new Set(v.frames.map((x) => x.op))].filter((o) => o !== "start" && o !== "done");
  return <div {...hook("counts", def, v)} style={vars(def.attrs)}><div className="counts">{kinds.map((k) => <span key={k} data-op={k} style={opColor(def.attrs, k) ? { borderColor: opColor(def.attrs, k), color: opColor(def.attrs, k) } : undefined}>{opName(def.attrs, k)} <b>{counts[k] ?? 0}</b></span>)}</div></div>;
}

export function ControlsPart({ def, over }: P) {
  const v = useTraceView(def, over), { player, st, i, last } = v;
  const speeds = (def.attrs.speeds ?? "0.5 1 2 4").split(/[\s,]+/).map(Number).filter((n) => n > 0);
  const start = useRef(true);
  useEffect(() => { if (start.current && def.attrs.speed) player.setSpeed(num(def.attrs.speed, 1)); start.current = false; }, []);
  const list = [...new Set([...speeds, st.speed])].sort((a, b) => a - b);
  return (
    <div {...hook("controls", def, v)} style={vars(def.attrs)}>
      <div className="ctl">
        <button onClick={() => player.step(-1)}>{def.attrs.back ?? "Back"}</button>
        <button onClick={() => player.toggle()}>{st.play ? def.attrs.pause ?? "Pause" : def.attrs.play ?? "Play"}</button>
        <button onClick={() => player.step(1)}>{def.attrs.next ?? "Step"}</button>
        {on(def.attrs.slider) && <input type="range" min={0} max={Math.max(1, last)} value={i} onChange={(e) => player.jump(+e.target.value)} />}
        <select value={st.speed} onChange={(e) => player.setSpeed(+e.target.value)}>{list.map((s) => <option key={s} value={s}>{s}x</option>)}</select>
      </div>
    </div>
  );
}

export function OpsPart({ def, over }: P) {
  const v = useTraceView(def, over), { player, i, frames } = v;
  const ol = useRef<HTMLOListElement>(null);
  useEffect(() => { // scroll the list inside itself only: scrollIntoView would also nudge the slide
    const li = ol.current?.querySelector<HTMLElement>(".cur");
    if (li && ol.current) ol.current.scrollTop = Math.min(li.offsetTop - ol.current.clientHeight / 2 + li.offsetHeight / 2, ol.current.scrollHeight);
  }, [i]);
  return (
    <div {...hook("ops", def, v)} style={vars(def.attrs)}>
      <ol className="ops" ref={ol}>
        {frames.map((x, k) => <li key={k} data-op={x.op} className={k === i ? "cur" : ""} style={opColor(def.attrs, x.op) ? { borderLeft: `calc(var(--u) * .5) solid ${opColor(def.attrs, x.op)}` } : undefined} onClick={() => player.jump(k)}>{on(def.attrs.numbers, false) ? `${k + 1}. ` : ""}{opName(def.attrs, x.op)}{x.hl?.length && on(def.attrs.args) ? `(${x.hl.join(", ")})` : ""}</li>)}
      </ol>
    </div>
  );
}

export function CodePart({ def, over }: P) {
  const v = useTraceView(def, over), { f, trace, i } = v;
  const root = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null);
  const ed = useRef<monaco.editor.IStandaloneCodeEditor | null>(null), marks = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const k = useRef(num(def.attrs.size, 1)); k.current = num(def.attrs.size, 1);
  useEffect(() => {
    const e = monaco.editor.create(host.current!, {
      value: trace.code, language: monacoLang(trace.lang), theme: "itsd", fontFamily: def.attrs.font ? def.attrs.font : MONO, lineNumbers: on(def.attrs.lines, true) ? "on" : "off", fontSize: 13, readOnly: true, domReadOnly: true,
      minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, folding: false,
      renderLineHighlight: "none", padding: { top: 6, bottom: 6 }, scrollbar: { alwaysConsumeMouseWheel: false },
    });
    ed.current = e; marks.current = e.createDecorationsCollection([]);
    // Sized from the slide's width (like every other slide text), not from this box, so a small code part still reads at the same size as the rest.
    const slideW = () => (root.current?.closest(".slide") as HTMLElement | null)?.clientWidth ?? (root.current?.clientWidth ?? 400) * 2.5;
    const size = () => root.current && e.updateOptions({ fontSize: Math.max(8, Math.round(slideW() * 0.0155 * k.current)) });
    const ro = new ResizeObserver(size); ro.observe(root.current!); const sl = root.current!.closest(".slide"); if (sl) ro.observe(sl); size();
    return () => { ro.disconnect(); e.dispose(); };
  }, []);
  useEffect(() => { // a re-run swaps the code
    if (ed.current) { ed.current.setValue(trace.code); monaco.editor.setModelLanguage(ed.current.getModel()!, monacoLang(trace.lang)); }
  }, [trace]);
  useEffect(() => { ed.current?.updateOptions({ fontFamily: def.attrs.font || MONO, lineNumbers: on(def.attrs.lines, true) ? "on" : "off" }); }, [def.attrs.font, def.attrs.lines]);
  useEffect(() => { const w = (root.current?.closest(".slide") as HTMLElement | null)?.clientWidth ?? 900; ed.current?.updateOptions({ fontSize: Math.max(8, Math.round(w * 0.0155 * num(def.attrs.size, 1))) }); }, [def.attrs.size]);
  useEffect(() => {
    const ln = f.line;
    if (!ln || !ed.current) { marks.current?.clear(); return; }
    marks.current!.set([{ range: new monaco.Range(ln, 1, ln, 1), options: { isWholeLine: true, className: "hl-line" } }]);
    ed.current.revealLineInCenterIfOutsideViewport(ln);
  }, [i, trace]);
  return <div {...hook("code", def, v)} ref={root} style={boxStyle(def.attrs)}><div className="codepane" ref={host} /></div>;
}

export const PART: Record<string, (p: P) => React.ReactElement> = { title: TitlePart, bars: BarsPart, counts: CountsPart, controls: ControlsPart, ops: OpsPart, code: CodePart };

/** The parts in one block: the generated trace slide, or a plain `::: trace`. `onSplit` (editing only) turns it into separate elements. */
export function TraceComposite({ def, over, onSplit, onMake }: { def: TraceDef; over?: Over; onSplit?: () => void; onMake?: () => void }) {
  const api = useContext(DeckCtx);
  const edit = !api.presenting();
  return (
    <div className={onMake ? "in trace" : "trace trace-box"}>
      <div className="tp-head">
        <TitlePart def={def} over={over} />
        {edit && onMake && <button className="mk" title="Make this a normal slide you can edit, move and decorate" onClick={onMake}>Make editable</button>}
        {edit && onSplit && <button className="mk" title="Replace this with separate elements you can place and style one by one" onClick={onSplit}>Split into parts</button>}
      </div>
      <div className="trace-body">
        <div className="tl"><BarsPart def={def} over={over} /><CountsPart def={def} over={over} /><ControlsPart def={def} over={over} /></div>
        <div className="tr"><CodePart def={def} over={over} /><OpsPart def={def} over={over} /></div>
      </div>
    </div>
  );
}
export { parseTraceDef };
