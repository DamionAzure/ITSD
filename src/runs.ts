// Recorded runs: what a `run` block printed (and the trace it made) is kept at the end of the .itsd file, so a device that has no compiler
// (a phone, a tablet, a computer without the language) can replay it instead of running the code. Plain text, one JSON record per line:
//
//   <!-- itsd-runs
//   {"lang":"python","tpl":"1f3a9c2b","in":{"n":"5"},"ev":[["o","5 squared is 25"]],"x":0}
//   -->
//
// `tpl` is a hash of the block's code before {{name}} is filled in, `in` is the input values it ran with, `ev` its output lines
// (o = stdout, e = stderr; `@itsd` trace lines are kept as they are, so the trace slide is rebuilt the same way), `x` the exit code.
// In `in`, a value written as /regex/ matches any input that fits it; edit the block by hand to use that.
import { useSyncExternalStore } from "react";

/** `pat`: an order record. It was run on the numbers 1..n in the order `perm` ("3,1,2") for input `name`, and the values in `ev` are written as {#1}..{#n}
 *  (the smallest, the next...). It replays for any input whose numbers are in that same relative order, with the real values put back (see orderOf / replayOrder). */
export interface Pat { name: string; perm: string }
export interface RunRec { lang: string; tpl: string; in: Record<string, string>; ev: [string, string][]; x: number; t?: number; pat?: Pat }

const OPEN = "<!-- itsd-runs";
const TAIL = /\n*<!-- itsd-runs\n([\s\S]*?)\n-->\s*$/;
export const MAX_RECORDS = 80, MAX_LINES = 500, MAX_LINE = 2000, MAX_ORDER_RECORDS = 2000, MAX_ORDER_N = 6;

/** Take the recorded runs off the end of a file; the rest is the deck. */
export function splitRuns(content: string): { text: string; runs: RunRec[] } {
  const m = TAIL.exec(content);
  if (!m) return { text: content, runs: [] };
  const runs: RunRec[] = [];
  for (const line of m[1].split("\n")) {
    try { const r = JSON.parse(line); if (r && typeof r.lang === "string" && typeof r.tpl === "string" && Array.isArray(r.ev)) runs.push({ lang: r.lang, tpl: r.tpl, in: r.in ?? {}, ev: r.ev, x: r.x ?? 0, pat: r.pat && typeof r.pat.name === "string" && typeof r.pat.perm === "string" ? r.pat : undefined, t: r.t }); } catch { /* a line someone broke by hand: skip it */ }
  }
  return { text: content.slice(0, m.index) + "\n", runs };
}

/** Put them back for saving. Nothing recorded: the file is the deck, untouched. */
export function joinRuns(text: string, runs: RunRec[]): string {
  if (!runs.length) return text;
  const lines = trim(runs).map((r) => JSON.stringify(r).replace(/>/g, "\\u003e")); // no `-->` can appear inside the comment
  return text.replace(/\s*$/, "\n") + `\n${OPEN}\n${lines.join("\n")}\n-->\n`;
}

/** FNV-1a: only used to tell one block's code from another's. */
export const hashCode = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };

const norm = (v: string) => v.trim().toLowerCase();
const fits = (want: string, got: string) => {
  const m = /^\/(.+)\/([a-z]*)$/.exec(want);
  if (m) { try { return new RegExp(m[1], m[2]).test(got.trim()); } catch { return false; } }
  return norm(want) === norm(got);
};

let recs: RunRec[] = [], rev = 0, savedRev = 0; const subs = new Set<() => void>();
const bump = () => { rev++; subs.forEach((f) => f()); };
export const loadRuns = (r: RunRec[]) => { recs = r; rev = 0; savedRev = 0; subs.forEach((f) => f()); };
export const runsSaved = () => { savedRev = rev; subs.forEach((f) => f()); };
export const allRuns = () => recs;

/** Keep the newest plain records and, separately, the newest order records (there can be hundreds of those). */
const trim = (l: RunRec[]) => { const plain = l.filter((r) => !r.pat).slice(-MAX_RECORDS), ord = l.filter((r) => r.pat).slice(-MAX_ORDER_RECORDS); return l.filter((r) => (r.pat ? ord : plain).includes(r)); };
const sameRec = (a: RunRec, b: RunRec) => a.lang === b.lang && a.tpl === b.tpl && JSON.stringify(a.in) === JSON.stringify(b.in) && JSON.stringify(a.pat) === JSON.stringify(b.pat);

/** Remember a run. The same code with the same inputs replaces the older record. */
export function addRun(r: RunRec) {
  const old = recs.find((o) => sameRec(o, r));
  if (old && JSON.stringify(old.ev) === JSON.stringify(r.ev) && old.x === r.x) return; // nothing new: do not make the deck look changed
  recs = trim([...recs.filter((o) => !sameRec(o, r)), { ...r, t: Date.now() }]);
  bump();
}
/** Several records at once (recording every order): one change notice, one trim. */
export function addRuns(list: RunRec[]) {
  let next = recs, changed = false;
  for (const r of list) { const old = next.find((o) => sameRec(o, r)); if (old && JSON.stringify(old.ev) === JSON.stringify(r.ev) && old.x === r.x) continue; next = [...next.filter((o) => !sameRec(o, r)), { ...r, t: Date.now() }]; changed = true; }
  if (changed) { recs = trim(next); bump(); }
}

// ---- order records: the same steps for any numbers that are in the same relative order ----
// A comparison sort (or search) does exactly the same thing for 6,7,3 and for 60,70,30 or 5,9,1: only the values differ. So the code is run once for every
// order of 1..n (on a computer, "Record all orders"), and on a phone the input is reduced to its order (3,1,2 ... ) and the real numbers are put back into the
// recorded output. Only for code that just compares and moves the numbers it was given: a sum, a difference or a count in the output is not a value from
// the input and would be wrong. Repeated numbers are not supported (their order is a tie).
const NUM = /-?\d+(?:\.\d+)?/g;
const CANON = 1000000; // the stand-in values while recording: far from any index or count, so only real values are swapped back
/** The numbers in an input text, with where they are. */
export const numbersIn = (text: string) => [...text.matchAll(NUM)].map((m) => ({ s: m[0], v: parseFloat(m[0]), at: m.index! }));
/** The order of an input's numbers: ranks 1..n by position (`perm`) and the number texts from smallest to largest; null unless 2+ numbers, all different. */
export function orderOf(text: string): { perm: number[]; values: string[] } | null {
  const nums = numbersIn(text); if (nums.length < 2 || new Set(nums.map((x) => x.v)).size !== nums.length) return null;
  const sorted = [...nums].sort((a, b) => a.v - b.v), rank = new Map(sorted.map((x, k) => [x, k + 1]));
  return { perm: nums.map((x) => rank.get(x)!), values: sorted.map((x) => x.s) };
}
/** The same text with its numbers replaced by CANON + rank for the order `perm` (so separators, brackets and spacing stay as the author wrote them). */
export function canonicalInput(text: string, perm: number[]): string {
  let k = 0; return text.replace(NUM, () => String(CANON + perm[k++]));
}
/** The recorded output of a canonical run, with the stand-in values written as {#rank}. */
export const toPlaceholders = (line: string) => line.replace(new RegExp(`(?<![\\d.])${CANON / 10}[1-9](?!\\d|\\.\\d)`, "g"), (m) => `{#${+m - CANON}}`);
/** Put the real values back. */
export const fromPlaceholders = (line: string, values: string[]) => line.replace(/\{#(\d+)\}/g, (m, r) => values[+r - 1] ?? m);
/** Every order of 1..n. */
export function* permutations(n: number): Generator<number[]> {
  const a = Array.from({ length: n }, (_, k) => k + 1);
  const rec = function* (i: number): Generator<number[]> { if (i === n) { yield [...a]; return; } for (let j = i; j < n; j++) { [a[i], a[j]] = [a[j], a[i]]; yield* rec(i + 1); [a[i], a[j]] = [a[j], a[i]]; } };
  yield* rec(0);
}
export const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

/** An order record that fits these inputs (the numbers of one input in a recorded order, the other inputs as in `findRun`), with the real values put back. */
export function findOrder(lang: string, tpl: string, inputs: Record<string, string>): RunRec | undefined {
  const mine = recs.filter((r) => r.lang === lang && r.tpl === tpl && r.pat);
  for (const [name, value] of Object.entries(inputs)) {
    const o = orderOf(value); if (!o) continue;
    const r = [...mine].reverse().find((x) => x.pat!.name === name && x.pat!.perm === o.perm.join(",") && Object.entries(x.in).every(([k, v]) => k in inputs && fits(v, inputs[k])));
    if (r) return { ...r, ev: r.ev.map(([k, t]) => [k, fromPlaceholders(t, o.values)] as [string, string]) };
  }
  return undefined;
}
/** A short description of what the order records cover, for messages: `data: any order of 2 to 5 different numbers`. */
export function orderCoverage(lang: string, tpl: string): string[] {
  const by = new Map<string, Set<number>>();
  for (const r of recs) if (r.lang === lang && r.tpl === tpl && r.pat) { const set = by.get(r.pat.name) ?? new Set<number>(); set.add(r.pat.perm.split(",").length); by.set(r.pat.name, set); }
  return [...by].map(([k, set]) => { const n = [...set].sort((a, b) => a - b); return `${k}: any order of ${n[0]} to ${n[n.length - 1]} different numbers`; });
}

/** The record for this code with these inputs, if there is one (an exact record first, then an order record). */
export function findRun(lang: string, tpl: string, inputs: Record<string, string>): RunRec | undefined {
  const mine = recs.filter((r) => r.lang === lang && r.tpl === tpl && !r.pat);
  return [...mine].reverse().find((r) => Object.entries(r.in).every(([k, v]) => k in inputs && fits(v, inputs[k]))) ?? findOrder(lang, tpl, inputs);
}
/** Which inputs this code has recordings for, for the message when there is none. */
export const recordedFor = (lang: string, tpl: string) => recs.filter((r) => r.lang === lang && r.tpl === tpl && !r.pat);
export const hasRuns = (lang: string, tpl: string) => recs.some((r) => r.lang === lang && r.tpl === tpl);

const snap = () => rev * 2 + (rev !== savedRev ? 1 : 0);
/** True when runs were recorded since the file was last saved (so the deck counts as changed). */
export const useRunsDirty = (): boolean => (useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, snap) & 1) === 1;
