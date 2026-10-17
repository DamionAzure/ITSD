// JavaScript run blocks on a phone: there is no Node there, so the code runs in a throw-away Web Worker (no page, no storage, a time limit).
// console.log -> output, errors -> error text, `@itsd {...}` lines -> trace frames, exactly like the desktop runner.
import type { RunEvent } from "./CodeBlock";

const BOOT = `
const send = (kind, data) => postMessage({ kind, data });
const fmt = (a) => a.map((x) => typeof x === "string" ? x : (() => { try { return typeof x === "object" && x !== null ? JSON.stringify(x) : String(x); } catch { return String(x); } })()).join(" ");
const emit = (s) => { for (const l of String(s).split("\\n")) send("Stdout", l); };
console.log = console.info = console.debug = (...a) => emit(fmt(a));
console.warn = console.error = (...a) => send("Stderr", fmt(a));
let buf = "";
const out = { write: (s) => { buf += String(s); let i; while ((i = buf.indexOf("\\n")) >= 0) { send("Stdout", buf.slice(0, i)); buf = buf.slice(i + 1); } return true; } };
const proc = { stdout: out, stderr: { write: (s) => { send("Stderr", String(s).replace(/\\n$/, "")); return true; } }, argv: ["node", "main.js"], env: {}, platform: "browser", exit: (c) => { throw { __exit: c | 0 }; }, hrtime: Object.assign(() => [0, 0], { bigint: () => BigInt(Math.round(performance.now() * 1e6)) }) };
onmessage = async (e) => {
  let code = 0;
  try {
    const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
    const req = (m) => { if (m === "util") return { inspect: fmt, format: (...a) => fmt(a) }; if (m === "perf_hooks") return { performance }; throw new Error("require('" + m + "') is not available on a phone"); };
    await new AsyncFn("process", "require", "module", "exports", e.data)(proc, req, { exports: {} }, {});
  } catch (x) {
    if (x && typeof x === "object" && "__exit" in x) code = x.__exit; else { send("Stderr", (x && x.stack) ? String(x.stack).split("\\n").slice(0, 4).join("\\n") : String(x)); code = 1; }
  }
  if (buf) send("Stdout", buf);
  send("Exit", code);
};
`;

/** Runs JavaScript; `on` gets Stdout / Stderr events and finally Exit. Resolves when the run is over (also after a timeout). */
export function runJs(code: string, on: (e: RunEvent) => void, ms = 4000): Promise<void> {
  return new Promise((done) => {
    const url = URL.createObjectURL(new Blob([BOOT], { type: "text/javascript" }));
    const w = new Worker(url);
    let over = false;
    const end = () => { if (over) return; over = true; clearTimeout(t); w.terminate(); URL.revokeObjectURL(url); done(); };
    const t = setTimeout(() => { on({ kind: "Stderr", data: `Stopped after ${ms / 1000} s (still running).` } as RunEvent); on({ kind: "Exit", data: 1 } as RunEvent); end(); }, ms);
    w.onmessage = (m) => { on(m.data as RunEvent); if (m.data.kind === "Exit") end(); };
    w.onerror = (m) => { on({ kind: "Stderr", data: m.message } as RunEvent); on({ kind: "Exit", data: 1 } as RunEvent); end(); };
    w.postMessage(code);
  });
}
