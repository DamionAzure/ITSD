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
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
    snapshot: () => vals, // a new object whenever something changes, as useSyncExternalStore wants
  };
}
export type InputStore = ReturnType<typeof createInputs>;

const REF = /\{\{([A-Za-z_]\w*)\}\}/g;
const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
/** Replace {{name}} with the input's value. Unknown names are left as written, so `{{1}}` in code is untouched. */
export function fillRefs(text: string, lookup: (n: string) => string | undefined, html = false): string {
  return text.replace(REF, (all, n) => { const v = lookup(n); return v === undefined ? all : html ? esc(v) : v; });
}
