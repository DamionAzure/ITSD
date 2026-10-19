import { useEffect, useRef, useState } from "react";
import { monaco, monacoLang, MONO } from "./monaco";
import type { TraceData } from "./ctx";

const SPEEDS = [0.5, 1, 2, 4];

// The slide generated after a run: bars, sorted region, held key, a read-only copy of the code with the
// current line lit, a scrubber, play controls, running counts and the list of operations.
export function TraceView({ trace }: { trace: TraceData }) {
  const { frames, code, lang } = trace;
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(false);
  const [speed, setSpeed] = useState(1);
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const ed = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const marks = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const last = frames.length - 1;
  const f = frames[Math.min(i, last)];

  useEffect(() => {
    const e = monaco.editor.create(host.current!, {
      value: code, language: monacoLang(lang), theme: "itsd", fontFamily: MONO, fontSize: 13, readOnly: true, domReadOnly: true,
      minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, folding: false,
      renderLineHighlight: "none", padding: { top: 6, bottom: 6 }, scrollbar: { alwaysConsumeMouseWheel: false },
    });
    ed.current = e; marks.current = e.createDecorationsCollection([]);
    const ro = new ResizeObserver(([r]) => e.updateOptions({ fontSize: Math.max(10, Math.round(r.contentRect.width * 0.0155)) }));
    ro.observe(root.current!);
    return () => { ro.disconnect(); e.dispose(); };
  }, []);

  // A re-run produces a new trace: reset playback and swap the code.
  useEffect(() => {
    setI(0); setPlay(false);
    if (ed.current) { ed.current.setValue(code); monaco.editor.setModelLanguage(ed.current.getModel()!, monacoLang(lang)); }
  }, [trace]);

  useEffect(() => {
    const ln = f.line;
    if (!ln || !ed.current) { marks.current?.clear(); return; }
    marks.current!.set([{ range: new monaco.Range(ln, 1, ln, 1), options: { isWholeLine: true, className: "hl-line" } }]);
    ed.current.revealLineInCenterIfOutsideViewport(ln);
  }, [i, trace]);

  useEffect(() => {
    if (!play) return;
    const t = setInterval(() => setI((x) => { if (x >= last) { setPlay(false); return x; } return x + 1; }), 700 / speed);
    return () => clearInterval(t);
  }, [play, speed, last]);
  useEffect(() => { document.querySelector(".ops .cur")?.scrollIntoView({ block: "nearest" }); }, [i]);

  const counts: Record<string, number> = {};
  for (const x of frames.slice(0, i + 1)) counts[x.op] = (counts[x.op] ?? 0) + 1;
  const kinds = [...new Set(frames.map((x) => x.op))].filter((o) => o !== "start" && o !== "done");
  const max = Math.max(1, ...frames.flatMap((x) => [...x.a, x.key ?? 0].map(Math.abs)));
  const h = (v: number) => `${Math.max(4, (Math.abs(v) / max) * 100)}%`;

  return (
    <div className="in trace" ref={root}>
      <h2>Trace <small>step {Math.min(i, last) + 1} of {frames.length}: {f.op}</small></h2>
      <div className="trace-body">
        <div className="tl">
          <div className="bars">
            {f.key !== undefined && <div className="bar keyed"><span>key {f.key}</span><i style={{ height: h(f.key) }} /></div>}
            {f.a.map((v, k) => (
              <div className={"bar" + (f.sorted !== undefined && k < f.sorted ? " sorted" : "") + (f.hl?.includes(k) ? " hot" : "")} key={k}>
                <span>{v}</span><i style={{ height: h(v) }} />
              </div>
            ))}
          </div>
          <div className="counts">{kinds.map((k) => <span key={k}>{k} <b>{counts[k] ?? 0}</b></span>)}</div>
          <div className="ctl">
            <button onClick={() => { setPlay(false); setI(Math.max(0, i - 1)); }}>Back</button>
            <button onClick={() => { if (i >= last) setI(0); setPlay((p) => !p); }}>{play ? "Pause" : "Play"}</button>
            <button onClick={() => { setPlay(false); setI(Math.min(last, i + 1)); }}>Step</button>
            <input type="range" min={0} max={last} value={Math.min(i, last)} onChange={(e) => { setPlay(false); setI(+e.target.value); }} />
            <select value={speed} onChange={(e) => setSpeed(+e.target.value)}>
              {SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
            </select>
          </div>
        </div>
        <div className="tr">
          <div className="codepane" ref={host} />
          <ol className="ops">
            {frames.map((x, k) => (
              <li key={k} className={k === i ? "cur" : ""} onClick={() => { setPlay(false); setI(k); }}>
                {x.op}{x.hl?.length ? `(${x.hl.join(", ")})` : ""}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
