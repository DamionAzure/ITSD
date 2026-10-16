import type { FxEffect, FxKind, ItsdModule, PropDef } from "./types";

// Every src/modules/<id>/module.ts that exists. With no module folders this is simply empty and the app works as before.
const found = import.meta.glob<{ default: ItsdModule }>("./*/module.ts", { eager: true });
export const MODULES: ItsdModule[] = Object.values(found).map((m) => m.default).filter((m) => m?.id);

export interface FxEntry { full: string; module: ItsdModule; effect: FxEffect }
export const allEffects = (): FxEntry[] => MODULES.flatMap((module) => module.effects.map((effect) => ({ full: `${module.id}.${effect.id}`, module, effect })));
export const findEffect = (full: string): FxEntry | undefined => allEffects().find((e) => e.full === full);

/** Attribute text from the deck -> a typed prop value. Returns undefined when it doesn't fit, so the component keeps its own default. */
export function coerce(p: PropDef, raw: string): unknown {
  switch (p.type) {
    case "number": { const n = parseFloat(raw); return Number.isFinite(n) ? n : undefined; }
    case "boolean": return raw === "true" || raw === "1" || raw === "on" ? true : raw === "false" || raw === "0" || raw === "off" ? false : undefined;
    case "colors": return raw.split(",").map((s) => s.trim()).filter(Boolean);
    case "select": return !p.options || p.options.includes(raw) ? raw : undefined;
    default: return raw;
  }
}
export function fxProps(effect: FxEffect, attrs: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of effect.props) {
    const v = attrs[p.key] !== undefined ? coerce(p, attrs[p.key]) : undefined;
    if (v !== undefined) out[p.key] = v; else if (p.req && p.def !== undefined) out[p.key] = p.def; // required props always get a value
  }
  return out;
}
export const defaultText = "Your text";

/** Effects grouped by what they act on, for every "insert effect" menu. Empty groups are left out. */
export const FX_GROUPS: { kind: FxKind; label: string; about: string }[] = [
  { kind: "background", label: "Background", about: "fills the whole slide, behind the text" },
  { kind: "text", label: "Text", about: "animated words (takes text=)" },
  { kind: "wrap", label: "Around content", about: "frames and cards around what you write inside" },
];
export const effectGroups = () => {
  const all = allEffects();
  return FX_GROUPS.map((g) => ({ ...g, entries: all.filter((e) => e.effect.kind === g.kind) })).filter((g) => g.entries.length);
};
/** The module name is only worth showing when more than one module provides effects. */
export const fromModule = (e: FxEntry) => (MODULES.filter((m) => m.effects.length).length > 1 ? e.module.name : undefined);

// ---- effects downloaded while the app runs (src/vendor) are merged into the module with the same id ----
const own = new Map<string, FxEffect[]>(); // what each module itself ships, kept apart so downloaded ones can be swapped
const subs = new Set<() => void>();
let version = 0;
export const subscribeModules = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const modulesVersion = () => version;
export function setRuntimeEffects(v: { id: string; name: string; hint?: string }, effects: FxEffect[]) {
  let m = MODULES.find((x) => x.id === v.id);
  if (!m) { m = { id: v.id, name: v.name, effects: [] }; MODULES.push(m); }
  if (!own.has(m.id)) own.set(m.id, m.effects);
  const base = own.get(m.id)!;
  m.effects = [...base, ...effects.filter((e) => !base.some((o) => o.id === e.id))]; // an effect the module ships wins over a downloaded copy
  if (!m.hint) m.hint = v.hint;
  version++; subs.forEach((f) => f());
}
