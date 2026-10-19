import type { ComponentType } from "react";
import { setRuntimeEffects } from "../modules/registry";
import { instantiate } from "./compile";
import { all, put, remove } from "./store";
import { SOURCES } from "./sources";
import type { Stored, VendorSource } from "./types";

let rows: Stored[] = [];
const compiled = new Map<string, Promise<ComponentType<any>>>();
const componentOf = (s: Stored) => {
  let p = compiled.get(s.key);
  if (!p) { p = instantiate(s.id, s.js, s.css); compiled.set(s.key, p); p.catch(() => compiled.delete(s.key)); }
  return p;
};

/** Hand what is stored to the app's effect registry, where every menu and panel already looks. */
export function flush() {
  for (const s of SOURCES) {
    setRuntimeEffects(
      { id: s.id, name: s.name, hint: `No effects yet. Open Vendor > ${s.name} to download some.` },
      rows.filter((r) => r.vendor === s.id).map((r) => ({ ...r.meta, load: async () => ({ default: await componentOf(r) }) })),
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
  await put(s);
  compiled.delete(s.key);
  rows = [...rows.filter((r) => r.key !== s.key), s];
  if (!quiet) flush();
}
export async function uninstall(vendor: string, id: string, quiet = false) {
  await remove(`${vendor}/${id}`);
  compiled.delete(`${vendor}/${id}`);
  rows = rows.filter((r) => r.key !== `${vendor}/${id}`);
  if (!quiet) flush();
}
