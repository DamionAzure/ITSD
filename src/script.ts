// `::: script name` ... `:::`: JavaScript for the things the calculator and the action lines can't do (loops, lists, longer logic).
//
//   ::: script shuffle
//   let n = get("score");                 // read a deck variable (numbers and yes/no come back as numbers and booleans)
//   for (let i = 0; i < 3; i++) { add("score", i); await wait(300); }
//   if (get("score") > 10) { play("ding"); goto(4); }
//   :::
//
// Run it with the action `script shuffle 1 two` (arguments arrive in `args`), from a button, `::: on` rule, `::: when` rule or timer.
//
// What it can do: the functions below. What it can't: it runs in a separate Web Worker, so it has no page, no files and no app, and network access is switched off (best effort).
// It is not a hardened sandbox against a deliberately hostile script, so the app asks before running scripts in a deck, once per opened deck. A run is stopped
// if it spends more than a few seconds computing without a `wait`.
//
//   get(name) set(name, value) add(name, by = 1) vars      deck variables (vars is a snapshot taken when the script starts and kept up to date by set/add/wait)
//   goto(n) branch(n) proceed() back()                      navigation          play(name, { vol, pitch })   a sound
//   show(id) hide(id) start(id) stop(id) run(id)            blocks on this slide      call(macro, ...args)  script(name, ...args)   other macros / scripts
//   await wait(ms)                                          pause (refreshes vars)    random() randint(lo, hi) pick(a, b, c)  log(...)
//   args                                                    the arguments of the call
//
// Anything it throws, or any problem, is put in the variable `script_error` (show it with {{script_error}}).

const BOOT = String.raw`
const post = self.postMessage.bind(self);
let snap = {}, wid = 0; const waiting = new Map();
self.addEventListener("message", (e) => {
  const m = e.data;
  if (m.t === "start") go(m);
  else if (m.t === "woke") { for (const k of Object.keys(snap)) delete snap[k]; Object.assign(snap, m.vars); waiting.get(m.id)?.(); waiting.delete(m.id); }
});
const q = (v) => /[\s"]/.test(String(v)) ? '"' + String(v).replace(/"/g, "'") + '"' : String(v);
async function go(m) {
  snap = m.vars;
  const act = (line) => post({ t: "act", line });
  const set = (name, value) => { snap[name] = value; post({ t: "set", name, value: String(value) }); };
  const api = {
    get: (n) => snap[n], vars: snap, set,
    add: (n, by = 1) => set(n, (Number(snap[n]) || 0) + Number(by)),
    goto: (n) => act("goto " + (n | 0)), branch: (n) => act("branch " + (n | 0)), proceed: () => act("proceed"), back: () => act("back"),
    play: (name, o = {}) => act("play " + q(name) + (o.vol !== undefined ? " vol=" + o.vol : "") + (o.pitch !== undefined ? " pitch=" + o.pitch : "")),
    show: (id) => act("show " + id), hide: (id) => act("hide " + id), start: (id) => act("start " + id), stop: (id) => act("stop " + id), run: (id) => act("run " + id),
    call: (name, ...a) => act("call " + name + " " + a.map(q).join(" ")), script: (name, ...a) => act("script " + name + " " + a.map(q).join(" ")),
    wait: (ms) => new Promise((res) => { const id = ++wid; waiting.set(id, res); post({ t: "wait", id, ms: Math.max(0, Math.min(Number(ms) || 0, 600000)) }); }),
    random: Math.random, randint: (lo, hi) => { lo = Math.ceil(Math.min(lo, hi)); hi = Math.floor(Math.max(lo, hi)); return lo + Math.floor(Math.random() * (hi - lo + 1)); },
    pick: (...a) => a[Math.floor(Math.random() * a.length)], log: (...a) => post({ t: "log", text: a.map(String).join(" ") }),
    args: m.args,
  };
  // Switch off what a script has no business with. Best effort: it removes the usual routes out of the worker.
  const off = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "Worker", "SharedWorker", "BroadcastChannel", "postMessage", "close"];
  for (let o = self; o && o !== EventTarget.prototype; o = Object.getPrototypeOf(o)) for (const k of off) { try { Object.defineProperty(o, k, { value: undefined, writable: false, configurable: false }); } catch (_) {} }
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction(...Object.keys(api), '"use strict";\n' + m.code)(...Object.values(api));
    post({ t: "done" });
  } catch (e) { post({ t: "error", message: String((e && e.message) || e) }); }
}
`;

export interface ScriptHost {
  vars(): Record<string, string>; // every deck variable, as stored text
  set(name: string, value: string): void;
  act(line: string): Promise<void>; // perform one action line (the slide's `perform`)
  log(text: string): void;
}
const typed = (raw: string): number | boolean | string => (raw === "true" ? true : raw === "false" ? false : raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw);
const CPU_MS = 3000; // longest a script may compute between waits

/** Run a script. Resolves with an error message, or null when it finished cleanly. */
export function runScript(code: string, args: string[], host: ScriptHost): Promise<string | null> {
  return new Promise((resolve) => {
    if (/\bimport\s*\(|\bimport\s+[\w{*"']/.test(code)) { resolve("Scripts can't import anything"); return; }
    const url = URL.createObjectURL(new Blob([BOOT], { type: "text/javascript" }));
    const w = new Worker(url);
    const fresh = () => Object.fromEntries(Object.entries(host.vars()).map(([k, v]) => [k, typed(v)]));
    let queue: Promise<void> = Promise.resolve(), watchdog: ReturnType<typeof setTimeout> | undefined, over = false;
    const end = (err: string | null) => { if (over) return; over = true; clearTimeout(watchdog); w.terminate(); URL.revokeObjectURL(url); resolve(err); };
    const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => end("The script ran for more than a few seconds without a wait() and was stopped"), CPU_MS); };
    w.onmessage = (e) => {
      const m = e.data;
      if (m.t === "set") host.set(m.name, m.value);
      else if (m.t === "act") queue = queue.then(() => host.act(m.line)).catch(() => {});
      else if (m.t === "log") host.log(m.text);
      else if (m.t === "wait") { clearTimeout(watchdog); queue = queue.then(() => new Promise<void>((r) => setTimeout(r, m.ms))).then(() => { if (!over) { w.postMessage({ t: "woke", id: m.id, vars: fresh() }); arm(); } }); }
      else if (m.t === "done") queue.then(() => end(null));
      else if (m.t === "error") queue.then(() => end(m.message));
    };
    w.onerror = (e) => end(e.message || "The script failed");
    w.postMessage({ t: "start", code, args, vars: fresh() });
    arm();
  });
}
