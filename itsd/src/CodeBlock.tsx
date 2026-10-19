import { useContext, useEffect, useRef, useState } from "react";
import { invoke, Channel } from "@tauri-apps/api/core";
import { monaco, monacoLang, MONO } from "./monaco";
import { DeckCtx, FontCtx, RegCtx, type Frame } from "./ctx";

type RunEvent = { kind: "Stdout" | "Stderr" | "Error"; data: string } | { kind: "Exit"; data: number };

interface Props { editKey: string; name?: string; srcId: number; lang: string; code: string; tools: Record<string, boolean>; edits: Map<string, string> }

export function CodeBlock({ editKey, name, srcId, lang: lang0, code, tools, edits }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const ed = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const saved: { code: string; lang: string } = JSON.parse(edits.get(editKey) ?? "null") ?? { code, lang: lang0 };
  const lang = useRef(saved.lang);
  const latest = useRef(saved.code);
  const font = useContext(FontCtx), api = useContext(DeckCtx), reg = useContext(RegCtx);
  const fontRef = useRef(font); fontRef.current = font;
  const [label, setLabel] = useState(saved.lang);
  const [hidden, setHidden] = useState(false);
  const [out, setOut] = useState<{ t: string; c: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const going = useRef(false), again = useRef(false); // a run requested mid-run (live inputs) goes after it, not on top of it

  const persist = () => edits.set(editKey, JSON.stringify({ code: latest.current, lang: lang.current }));

  const run = async () => {
    if (going.current) { again.current = true; return; }
    going.current = true; setOut([]); setBusy(true);
    const frames: Frame[] = []; let n = 0;
    const ran = { text: api.fill(latest.current), lang: lang.current }; // {{name}} -> the input boxes' current values
    const add = (t: string, c = "") => { if (++n <= 500) setOut((o) => [...o, { t, c }]); };
    const ch = new Channel<RunEvent>();
    ch.onmessage = (e) => {
      if (e.kind === "Stdout") {
        // Trace protocol: a line `@itsd {"op":"compare","a":[..],"hl":[..]}` becomes a step in the trace slide.
        if (e.data.startsWith("@itsd ")) { try { frames.push(JSON.parse(e.data.slice(6))); } catch { add(e.data); } }
        else add(e.data);
      } else if (e.kind === "Stderr" || e.kind === "Error") add(e.data, "err");
      else {
        add(`exit ${e.data}`, e.data === 0 ? "ok" : "err");
        api.onTrace(srcId, frames, ran);
        if (frames.length) add(`trace: ${frames.length} steps, see the next slide`, "ok");
      }
    };
    try { await invoke("run_code", { lang: ran.lang, code: ran.text, onEvent: ch }); }
    catch (err) { add(String(err), "err"); }
    going.current = false; setBusy(false);
    if (again.current) { again.current = false; runRef.current(); }
  };
  const runRef = useRef(run); runRef.current = run;

  useEffect(() => {
    const e = monaco.editor.create(host.current!, {
      value: latest.current, language: monacoLang(lang.current), theme: "itsd", fontFamily: MONO, fontSize: font,
      minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, lineNumbers: "off", folding: false,
      overviewRulerLanes: 0, renderLineHighlight: "none", padding: { top: 8, bottom: 8 },
      scrollbar: { vertical: "hidden", alwaysConsumeMouseWheel: false },
    });
    const fit = () => { host.current!.style.height = Math.min(e.getContentHeight(), Math.round(fontRef.current * 24)) + "px"; e.layout(); };
    e.onDidContentSizeChange(fit); fit();
    e.onDidChangeModelContent(() => { latest.current = e.getValue(); persist(); });
    e.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
    ed.current = e;
    return () => e.dispose();
  }, []);

  // Let buttons drive this block by its id.
  useEffect(() => {
    if (!name) return;
    reg.set(name, {
      setCode: (text, l) => {
        lang.current = l; setLabel(l);
        monaco.editor.setModelLanguage(ed.current!.getModel()!, monacoLang(l));
        ed.current!.setValue(text);
      },
      run: () => runRef.current(),
      show: (v) => setHidden(!v),
      note: (t) => setOut([{ t, c: "err" }]),
    });
    return () => { reg.delete(name); };
  }, [name]);

  useEffect(() => { ed.current?.updateOptions({ fontSize: font }); }, [font]);

  const available = tools[label] === true;
  return (
    <div className="run" hidden={hidden}>
      <div className="rb">
        <span>{label}</span>
        <button className="go" disabled={busy || !available} onClick={run}
          title={available ? "Run (Ctrl/Cmd+Enter)" : `No ${label} toolchain found on this machine`}>Run</button>
      </div>
      <div ref={host} className="mon" />
      <pre className="out">{out.map((o, i) => <span key={i} className={o.c}>{o.t + "\n"}</span>)}</pre>
    </div>
  );
}
