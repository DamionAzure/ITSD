// Live values for `::: input` boxes. One small store for the whole deck so typing in a box on one slide
// is visible to {{name}} references and runnable code anywhere.
export function createInputs() {
  let vals: Record<string, string> = {};
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());
  return {
    get: (n: string) => vals[n],
    set: (n: string, v: string) => { if (vals[n] !== v) { vals = { ...vals, [n]: v }; emit(); } },
    clear: () => { vals = {}; emit(); },
    unset: (n: string) => { if (n in vals) { const { [n]: _gone, ...rest } = vals; vals = rest; emit(); } }, // back to the deck's default
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
    snapshot: () => vals, // a new object whenever something changes, as useSyncExternalStore wants
  };
}
export type InputStore = ReturnType<typeof createInputs>;

import { parseExpr, show } from "./expr";

const REF = /\{\{([^{}\n]+)\}\}/g;
const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const unesc = (v: string) => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
/** Replace {{name}} with the variable's value, and {{score * 2}} with the result of the calculation (see expr.ts).
 *  Anything that isn't a known variable, or a calculation whose every name is known, is left as written, so `{{1}}` or `{{a: 1}}` in code is untouched. */
export function fillRefs(text: string, lookup: (n: string) => string | undefined, html = false): string {
  return text.replace(REF, (all, inner: string) => {
    const s = (html ? unesc(inner) : inner).trim();
    let v: string | undefined;
    if (/^[A-Za-z_]\w*$/.test(s)) v = lookup(s);
    else {
      try { const e = parseExpr(s); if (!e.impure && e.names.length && e.names.every((n) => lookup(n) !== undefined)) v = show(e.eval(lookup)); } catch { /* not a calculation: leave it as written */ }
    }
    return v === undefined ? all : html ? esc(v) : v;
  });
}
