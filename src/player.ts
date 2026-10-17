// The Player: ITSD on a phone or tablet. It opens a deck, swipes through it, runs what can run there and replays what was recorded.
// Editing stays on the desktop. This file holds what the Player needs that is not React: mode detection, the deck library, and bundles.
import { unzipSync, zipSync } from "fflate";

/** Player mode: on a phone/tablet, with ?player in the address, or when Settings (Phone player) says so. Fixed for the life of the page. */
function detect(): boolean {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has("player")) return q.get("player") !== "0";
    const s = JSON.parse(localStorage.getItem("itsd.settings") ?? "{}").player;
    if (s === "on") return true;
    if (s === "off") return false;
  } catch { /* storage may be unavailable */ }
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
export const PLAYER = detect();

// ---- bundles: a .zip with the deck and the files it names ----
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4", flac: "audio/flac", aac: "audio/aac", opus: "audio/ogg", mp4: "video/mp4", webm: "video/webm", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", css: "text/css" };
const extOf = (p: string) => (p.split(".").pop() ?? "").toLowerCase();
let files = new Map<string, Uint8Array>(), base = "";
const urls = new Map<string, string>();

/** `a/./b/../c` -> `a/c`, with / separators. */
export function norm(p: string): string {
  const out: string[] = [];
  for (const s of p.replace(/\\/g, "/").split("/")) { if (s === "..") out.pop(); else if (s && s !== ".") out.push(s); }
  return out.join("/");
}
export function setBundle(f: Map<string, Uint8Array>, deckDir: string) {
  urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear();
  files = f; base = deckDir;
}
export function bundleGet(ref: string): Uint8Array | undefined {
  const want = norm((base ? base + "/" : "") + ref), lc = want.toLowerCase();
  const direct = files.get(want) ?? files.get(norm(ref));
  if (direct) return direct;
  for (const [k, v] of files) if (k.toLowerCase() === lc) return v;
  const b = lc.split("/").pop();
  for (const [k, v] of files) if (k.toLowerCase().split("/").pop() === b) return v; // last resort: the bare file name
  return undefined;
}
export const bundleBuf = (ref: string): ArrayBuffer => {
  const u = bundleGet(ref);
  if (!u) throw new Error(`${ref} is not in this deck's bundle`);
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
};
export const bundleList = (ext: string[]): string[] => [...files.keys()].filter((k) => ext.includes(extOf(k))).map((k) => k.split("/").pop()!);
export function bundleUrl(ref: string): string {
  const u = bundleGet(ref);
  if (!u) throw new Error(`${ref} is not in this deck's bundle`);
  const hit = urls.get(ref); if (hit) return hit;
  const url = URL.createObjectURL(new Blob([u as BlobPart], { type: MIME[extOf(ref)] ?? "application/octet-stream" }));
  urls.set(ref, url); return url;
}
export const bundleText = (ref: string) => new TextDecoder().decode(bundleGet(ref) ?? new Uint8Array());

export interface Opened { name: string; text: string; files: Map<string, Uint8Array>; dir: string }
const isZip = (b: Uint8Array) => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b;
/** A .itsd text file, or a .zip that holds one (the shallowest) plus its files. */
export function openBytes(name: string, bytes: Uint8Array): Opened {
  if (!isZip(bytes)) return { name: name.replace(/\.(itsd|md|txt)$/i, ""), text: new TextDecoder().decode(bytes), files: new Map(), dir: "" };
  const all = unzipSync(bytes), map = new Map<string, Uint8Array>();
  for (const [k, v] of Object.entries(all)) if (!k.endsWith("/")) map.set(norm(k), v);
  const decks = [...map.keys()].filter((k) => /\.itsd$/i.test(k) && !k.startsWith("__MACOSX")).sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  if (!decks.length) throw new Error("This .zip has no .itsd deck in it.");
  const d = decks[0];
  return { name: d.split("/").pop()!.replace(/\.itsd$/i, ""), text: new TextDecoder().decode(map.get(d)!), files: map, dir: d.includes("/") ? d.slice(0, d.lastIndexOf("/")) : "" };
}

/** Desktop side: the deck plus every file it names, as one .zip. `read` returns a file's bytes or undefined. */
export async function packBundle(name: string, text: string, refs: string[], read: (ref: string) => Promise<Uint8Array | undefined>): Promise<{ zip: Uint8Array; missing: string[] }> {
  const out: Record<string, Uint8Array> = { [`${name}.itsd`]: new TextEncoder().encode(text) }, missing: string[] = [];
  for (const r of refs) {
    if (/^[a-z]+:\/\//i.test(r) || /^[A-Za-z]:[\\/]/.test(r) || r.startsWith("/")) { missing.push(r); continue; } // absolute paths don't travel
    const b = await read(r).catch(() => undefined);
    if (b) out[norm(r)] = b; else missing.push(r);
  }
  return { zip: zipSync(out, { level: 6 }), missing };
}
/** File names a deck's text points at (pictures, sounds, video, fonts, the deck's css). */
export function fileRefs(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(/[\w@%+~.\-/\\]+\.(?:png|jpe?g|gif|webp|svg|avif|mp3|wav|ogg|m4a|flac|aac|opus|mp4|webm|woff2?|ttf|otf|css)\b/gi)) set.add(m[0]);
  return [...set];
}

// ---- the library: decks kept on the phone (IndexedDB, so a bundle with pictures fits) ----
export interface Entry { id: string; name: string; at: number; size: number }
const DB = "itsd-player", ST = "decks";
const db = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: "id" });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const tx = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const d = await db();
  return new Promise<T>((res, rej) => { const r = f(d.transaction(ST, mode).objectStore(ST)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
};
export const library = {
  async list(): Promise<Entry[]> {
    try { const all = await tx<{ id: string; name: string; at: number; bytes: ArrayBuffer }[]>("readonly", (s) => s.getAll()); return all.map((e) => ({ id: e.id, name: e.name, at: e.at, size: e.bytes.byteLength })).sort((a, b) => b.at - a.at); } catch { return []; }
  },
  async put(name: string, bytes: Uint8Array): Promise<string> {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "deck"; // same name replaces the older copy
    try { await tx("readwrite", (s) => s.put({ id, name, at: Date.now(), bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) })); } catch { /* private mode: it still opens, it just isn't kept */ }
    return id;
  },
  async get(id: string): Promise<{ name: string; bytes: Uint8Array } | undefined> {
    try { const e = await tx<{ name: string; bytes: ArrayBuffer } | undefined>("readonly", (s) => s.get(id)); return e && { name: e.name, bytes: new Uint8Array(e.bytes) }; } catch { return undefined; }
  },
  async del(id: string) { try { await tx("readwrite", (s) => s.delete(id)); } catch { /* nothing to delete */ } },
};
const POS = "itsd.player.pos";
export const savedPos = (id: string): number => { try { return Number(JSON.parse(localStorage.getItem(POS) ?? "{}")[id]) || 0; } catch { return 0; } };
export const savePos = (id: string, k: number) => { try { const o = JSON.parse(localStorage.getItem(POS) ?? "{}"); o[id] = k; localStorage.setItem(POS, JSON.stringify(o)); } catch { /* storage may be unavailable */ } };
