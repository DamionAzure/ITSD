// React Bits (https://reactbits.dev) as an itsd module. Nothing here is a hand-written effect: the components are
// downloaded from React Bits' own registry by add.mjs, which also writes a Name.meta.json next to each one
// describing its props. This file only joins the two, so any component you add shows up automatically.
import type { ComponentType } from "react";
import type { FxEffect, FxKind, ItsdModule, PropDef } from "../types";

interface Meta { id: string; label: string; kind: FxKind; props: PropDef[]; plain?: boolean; parts?: boolean }
const metas = import.meta.glob<Meta>("./components/*.meta.json", { eager: true, import: "default" });
const loaders: Record<string, (() => Promise<{ default: ComponentType<any> }>) | undefined> = import.meta.glob<{ default: ComponentType<any> }>("./components/*.tsx");

const effects: FxEffect[] = Object.values(metas).flatMap((m) => {
  if (!m?.id) return []; // a damaged meta file must not take the whole module down
  const load = loaders[`./components/${m.id}.tsx`];
  return load ? [{ ...m, load }] : []; // a meta file without its component is ignored
});

const mod: ItsdModule = {
  id: "reactbits", name: "React Bits", effects,
  hint: "No effects yet. Open Vendor > React Bits to download some, or in a terminal: npm run module:reactbits -- add Aurora BlurText",
};
export default mod;
