import type { ComponentType } from "react";
import { setRuntimeEffects } from "../modules/registry";
import { dropCss, instantiate } from "./compile";
import { probe } from "./probe";
import { adapt, hasSample } from "./samples";
import { all, put, remove } from "./store";
import { SOURCES } from "./sources";
import type { Stored, VendorSource } from "./types";

let rows: Stored[] = [];
const compiled = new Map<string, Promise<ComponentType<any>>>();
const componentOf = (s: Stored) => {
  let p = compiled.get(s.key);
  if (!p) { p = instantiate(s.key, s.js, s.css, { files: s.files, tw: s.tw, main: s.main }).then((C) => adapt(s.id, C, s.vendor)); compiled.set(s.key, p); p.catch(() => compiled.delete(s.key)); }
  return p;
};

// One loader per stored row, so the app's effect cache keeps its component when the list is refreshed (a new function would remount every effect).
const loaders = new WeakMap<Stored, () => Promise<{ default: ComponentType<any> }>>();
const loaderOf = (r: Stored) => { let f = loaders.get(r); if (!f) { f = async () => ({ default: await componentOf(r) }); loaders.set(r, f); } return f; };

/** Hand what is stored to the app's effect registry, where every menu and panel already looks. */
export function flush() {
  for (const s of SOURCES) {
    setRuntimeEffects(
      { id: s.id, name: s.name, hint: `No effects yet. Open Vendor > ${s.name} to download some.` },
      rows.filter((r) => r.vendor === s.id).map((r) => ({ ...r.meta, load: loaderOf(r) })),
    );
  }
}
export const installed = (vendor: string) => new Set(rows.filter((r) => r.vendor === vendor).map((r) => r.id));

/** Call once at startup: loads whatever was downloaded before. */
export async function initVendors() {
  try { rows = await all(); } catch { rows = []; }
  flush();
}
/** Download one component and store it. Pass quiet to batch many, then call flush() yourself. */
export async function install(src: VendorSource, id: string, quiet = false) {
  const s = await src.fetchOne(id);
  if (s.meta.unusable && !hasSample(s.id, s.vendor)) throw new Error(s.meta.unusable);
  // Try it before keeping it, so a component that can't run here is refused now instead of showing "couldn't start" on a slide.
  compiled.delete(s.key); dropCss(s.key);
  try {
    const p = instantiate(s.key, s.js, s.css, { files: s.files, tw: s.tw, main: s.main }).then((C) => adapt(s.id, C, s.vendor)); compiled.set(s.key, p);
    const C = await p;
    // The shadcn-style vendors are plain DOM, so a throw on first mount is the component's own doing (it needs a provider or data). Not done for React Bits: there "can't start" can just mean this computer has no WebGL.
    const why = s.tw ? probe(C, s.meta) : null; if (why) throw new Error(`it fails when shown on its own (${why})`);
  } catch (e) { compiled.delete(s.key); dropCss(s.key); throw new Error(`doesn't run here: ${(e as Error)?.message ?? e}`); }
  await put(s);
  rows = [...rows.filter((r) => r.key !== s.key), s];
  if (!quiet) flush();
}
export async function uninstall(vendor: string, id: string, quiet = false) {
  await remove(`${vendor}/${id}`);
  compiled.delete(`${vendor}/${id}`); dropCss(`${vendor}/${id}`);
  rows = rows.filter((r) => r.key !== `${vendor}/${id}`);
  if (!quiet) flush();
}
