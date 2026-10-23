import { useContext, useEffect, useRef, useState } from "react";
import { invoke, Channel } from "@tauri-apps/api/core";
import { monaco, monacoLang, MONO } from "./monaco";
/** The code font in force at this element: the deck's or slide's `codefont`, else the default monospace. */
const codeFont = (el: HTMLElement) => getComputedStyle(el).getPropertyValue("--code-font").trim() || MONO;
import { beautify } from "./beautify";
import { settings } from "./settings";
import { canon } from "./langs";
import { PLAYER } from "./player";
import { runJs } from "./jsRun";
import { MAX_LINE, MAX_LINES, MAX_ORDER_N, addRun, addRuns, findRun, recordedFor, hasRuns, hashCode, orderOf, canonicalInput, toPlaceholders, permutations, factorial, orderCoverage, type RunRec } from "./runs";
import { DeckCtx, FontCtx, RegCtx, type Frame } from "./ctx";

export type RunEvent = { kind: "Stdout" | "Stderr" | "Error"; data: string } | { kind: "Exit"; data: number };

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
  const [rec, setRec] = useState<{ done: number; total: number } | null>(null), stop = useRef(false); // "Record all orders" in progress
  const going = useRef(false), again = useRef(false); // a run requested mid-run (live inputs) goes after it, not on top of it

  const persist = () => edits.set(editKey, JSON.stringify({ code: latest.current, lang: lang.current }));

  const run = async () => {
    if (going.current) { again.current = true; return; }
    going.current = true; setOut([]); setBusy(true);
    const frames: Frame[] = []; let n = 0;
    const ran = { text: api.fill(latest.current), lang: lang.current }; // {{name}} -> the input boxes' current values
    const add = (t: string, c = "") => { if (++n <= 500) setOut((o) => [...o, { t, c }]); };
    const cl = canon(ran.lang), tpl = hashCode(latest.current);
    const inputs: Record<string, string> = {};
    for (const m of latest.current.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) inputs[m[1]] = api.input(m[1]) ?? "";
    const live = tools[cl] === true, ev: [string, string][] = [];
    const handle = (e: RunEvent) => {
      if (e.kind === "Stdout") {
        // Trace protocol: a line `@itsd {"op":"compare","a":[..],"hl":[..]}` becomes a step in the trace slide.
        if (e.data.startsWith("@itsd ")) { try { frames.push(JSON.parse(e.data.slice(6))); } catch { add(e.data); } }
        else add(e.data);
      } else if (e.kind === "Stderr" || e.kind === "Error") add(e.data, "err");
      else {
        add(`exit ${e.data}`, e.data === 0 ? "ok" : "err");
        const made = api.onTrace(srcId, name ?? "", frames, ran);
        const at = api.traceSlide(name ?? "");
        if (frames.length) add(`trace: ${frames.length} steps, ${made ?? (at ? `shown on slide ${at}` : "see the next slide")}`, "ok");
      }
    };
    const local = PLAYER && cl === "node"; // a phone has no Node: JavaScript runs in a worker
    const ch: { onmessage: (e: RunEvent) => void } = local ? { onmessage: () => {} } : new Channel<RunEvent>();
    ch.onmessage = (e) => {
      handle(e);
      if (!live || PLAYER || !settings().recordRuns) return;
      if (e.kind === "Stdout") ev.push(["o", e.data.slice(0, MAX_LINE)]); else if (e.kind === "Stderr") ev.push(["e", e.data.slice(0, MAX_LINE)]);
      else if (e.kind === "Exit" && e.data === 0 && ev.length <= MAX_LINES) addRun({ lang: cl, tpl, in: inputs, ev, x: 0 });
    };
    try {
      if (live && local) await runJs(ran.text, (e) => ch.onmessage(e));
      else if (live) await invoke("run_code", { lang: cl, code: ran.text, onEvent: ch as Channel<RunEvent>, langPaths: settings().langPaths });
      else { // no compiler here: show what was recorded for this code and these inputs
        const r = findRun(cl, tpl, inputs);
        if (r) { add("recorded run", "ok"); for (const [k, t] of r.ev) handle({ kind: k === "e" ? "Stderr" : "Stdout", data: t }); handle({ kind: "Exit", data: r.x }); }
        else {
          const have = recordedFor(cl, tpl), cover = orderCoverage(cl, tpl);
          const cov = cover.length ? ` Replayable by order (no repeated numbers): ${cover.join("; ")}.` : "";
          add(have.length || cover.length ? `Not recorded for these inputs.${have.length ? ` Recorded: ${have.map((h) => Object.entries(h.in).map(([k, v]) => `${k}=${v}`).join(", ") || "no inputs").join(" | ")}.` : ""}${cov}` : `This needs a computer: ${PLAYER ? "a phone can only run JavaScript" : `no ${label} here`}, and this run was never recorded. Run it on a computer that has ${label}, then save the deck.`, "err");
        }
      }
    }
    catch (err) { add(String(err), "err"); }
    going.current = false; setBusy(false);
    if (again.current) { again.current = false; runRef.current(); }
  };
  /** Run the code once for every order of 1..n numbers (n = how many numbers the first list input holds, up to MAX_ORDER_N) and keep each run as an order
   *  record, so a device with no compiler can replay it for any numbers in that order (runs.ts). */
  const recordOrders = async () => {
    if (rec) { stop.current = true; return; }
    const code = latest.current, names = [...new Set([...code.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((m) => m[1]))];
    const name = names.find((k) => orderOf(api.input(k) ?? ""));
    if (!name) { setOut([{ t: "Record all orders needs an input with 2 or more different numbers (like 6, 7, 3) used in the code as {{name}}.", c: "err" }]); return; }
    const value = api.input(name) ?? "", nums = [...value.matchAll(/-?\d+(?:\.\d+)?/g)], n = nums.length;
    if (n > MAX_ORDER_N) { setOut([{ t: `Record all orders handles up to ${MAX_ORDER_N} numbers (${factorial(MAX_ORDER_N)} runs); this input has ${n}. Shorten it.`, c: "err" }]); return; }
    const sizes = Array.from({ length: n - 1 }, (_, k) => k + 2), total = sizes.reduce((s, k) => s + factorial(k), 0);
    if (total > 24 && !window.confirm(`Run the code ${total} times to record every order of 2 to ${n} numbers? You can stop it at any time; it keeps what is done.`)) return;
    const tail = value.slice(nums[n - 1].index! + nums[n - 1][0].length), cl = canon(lang.current), tpl = hashCode(code);
    const others: Record<string, string> = {};
    for (const k of names) if (k !== name) others[k] = api.input(k) ?? "";
    const one = (text: string) => new Promise<{ ev: [string, string][]; x: number }>((resolve, reject) => {
      const ch = new Channel<RunEvent>(), ev: [string, string][] = [];
      ch.onmessage = (e) => {
        if (e.kind === "Stdout") ev.push(["o", e.data.slice(0, MAX_LINE)]); else if (e.kind === "Stderr") ev.push(["e", e.data.slice(0, MAX_LINE)]);
        else if (e.kind === "Exit") resolve({ ev, x: e.data });
      };
      invoke("run_code", { lang: cl, code: text, onEvent: ch, langPaths: settings().langPaths }).then(() => setTimeout(() => reject(new Error("the run gave no result")), 3000), reject);
    });
    stop.current = false; going.current = true; setBusy(true); setOut([]); let done = 0, batch: RunRec[] = [], failed = "";
    setRec({ done, total });
    try {
      outer: for (const k of sizes) {
        const text = value.slice(0, nums[k - 1].index! + nums[k - 1][0].length) + (k < n ? tail : "");
        for (const perm of permutations(k)) {
          if (stop.current) break outer;
          const canonText = canonicalInput(text, perm);
          const r = await one(code.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => (key === name ? canonText : api.input(key) ?? "")));
          if (r.x !== 0) { failed = `exit ${r.x}: ${r.ev.slice(-2).map((e) => e[1]).join(" ")}`; break outer; }
          if (r.ev.length <= MAX_LINES) batch.push({ lang: cl, tpl, in: others, ev: r.ev.map(([a, t]) => [a, toPlaceholders(t)] as [string, string]), x: 0, pat: { name, perm: perm.join(",") } });
          setRec({ done: ++done, total });
          if (batch.length >= 25) { addRuns(batch); batch = []; }
        }
      }
    } catch (err) { failed = String(err instanceof Error ? err.message : err); }
    if (batch.length) addRuns(batch);
    going.current = false; setBusy(false); setRec(null);
    setOut([{ t: failed ? `Stopped after ${done} of ${total} runs: ${failed}` : stop.current ? `Stopped after ${done} of ${total} runs (kept).` : `Recorded ${done} runs: every order of 2 to ${n} different numbers for {{${name}}}. Save the deck (Ctrl+S) to keep them.`, c: failed ? "err" : "ok" }]);
  };
  const format = async () => {
    const e = ed.current; if (!e) return;
    try {
      const r = await beautify(lang.current, e.getValue());
      if (r.text !== e.getValue()) e.executeEdits("format", [{ range: e.getModel()!.getFullModelRange(), text: r.text }]); // one undo step
      setOut([{ t: `formatted (${r.how})`, c: "ok" }]);
    } catch (err) { setOut([{ t: String(err instanceof Error ? err.message : err), c: "err" }]); }
  };
  const runRef = useRef(run); runRef.current = run;
  const fmtRef = useRef(format); fmtRef.current = format;

  useEffect(() => {
    const e = monaco.editor.create(host.current!, {
      value: latest.current, language: monacoLang(lang.current), theme: "itsd", fontFamily: codeFont(host.current!), fontSize: font,
      minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, lineNumbers: "off", folding: false,
      overviewRulerLanes: 0, renderLineHighlight: "none", padding: { top: 8, bottom: 8 },
      scrollbar: { vertical: "hidden", alwaysConsumeMouseWheel: false },
    });
    // follow the deck's code font (the --code-font variable) when it changes or its font file finishes loading
    const follow = () => { if (!host.current) return; const f = codeFont(host.current); if (f !== e.getOption(monaco.editor.EditorOption.fontFamily)) { e.updateOptions({ fontFamily: f }); monaco.editor.remeasureFonts(); } };
    const tick = setInterval(follow, 800); document.fonts?.addEventListener?.("loadingdone", follow);
    const fit = () => { if (!host.current) return; host.current.style.height = Math.min(e.getContentHeight(), Math.round(fontRef.current * 24)) + "px"; e.layout(); };
    e.onDidContentSizeChange(fit); fit();
    e.onDidChangeModelContent(() => { latest.current = e.getValue(); persist(); });
    e.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
    e.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => fmtRef.current());
    ed.current = e;
    return () => { clearInterval(tick); document.fonts?.removeEventListener?.("loadingdone", follow); e.dispose(); };
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

  const available = tools[canon(label)] === true;
  const replay = !available && hasRuns(canon(label), hashCode(latest.current));
  return (
    <div className="run" hidden={hidden}>
      <div className="rb">
        <span>{label}</span>
        <button title="Tidy this code (Shift+Alt+F)" onClick={format}>Format</button>
        {available && !PLAYER && settings().recordRuns && /\{\{/.test(latest.current) && <button className={rec ? "recording" : ""} onClick={() => void recordOrders()} title="Run this code for every order of 2 to N numbers in the input (up to 6), so a phone or a computer without the compiler can replay it for any numbers in those orders. Click again while recording to stop.">{rec ? `Stop (${rec.done}/${rec.total})` : "Record all orders"}</button>}
        <button className="go" disabled={(busy && !rec) || (rec !== null) || !(available || replay || PLAYER)} onClick={run}
          title={available ? "Run (Ctrl/Cmd+Enter)" : replay ? `No ${label} here: replay the recorded run` : `No ${label} found on this machine (set where it is in Settings > Languages), and nothing recorded`}>{available || (PLAYER && !replay) ? "Run" : "Replay"}</button>
      </div>
      <div ref={host} className="mon" />
      <pre className="out">{out.map((o, i) => <span key={i} className={o.c}>{o.t + "\n"}</span>)}</pre>
    </div>
  );
}
