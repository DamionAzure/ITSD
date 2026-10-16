import { ALIGN_LINE } from "./format";
import { AR } from "./aspect";
// Text edits for flash regions and for appended blocks. Each returns the new deck text; the caller applies it
// through the editor so Ctrl+Z works (same pattern as the picture edits in images.ts).
import { fenceOf, round2, slideRange } from "./images";
import { parseAttrs, readFlash, type FlashItem, type FlashSpec, type Trigger } from "./flash";

const ORDER = ["id", "size", "h", "ratio", "mode", "time", "gap", "start", "font", "frame", "x", "y"];
const FLAG_ORDER = ["loop", "shuffle", "manual"];
const q = (v: string) => (/[\s"]/.test(v) ? `"${v.replace(/"/g, "'")}"` : v);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** A canonical `::: flash` header: known options in a fixed order, then any others, then the flags. */
export function flashHeader(attrs: Record<string, string>, flags: Iterable<string>): string {
  const keys = [...ORDER.filter((k) => k in attrs), ...Object.keys(attrs).filter((k) => !ORDER.includes(k))];
  const fl = [...flags], fs = [...FLAG_ORDER.filter((f) => fl.includes(f)), ...fl.filter((f) => !FLAG_ORDER.includes(f))];
  return ["::: flash", ...keys.map((k) => `${k}=${q(attrs[k])}`), ...fs].join(" ");
}

/** A new, ready-to-run block. With `at` (percent of the slide) it is placed so its centre sits there. */
export function flashBlock(o: { id?: string; start?: Trigger; at?: { x: number; y: number } }): string {
  const size = 26, hPct = size * AR; // a square box is this tall as a percentage of the slide's height
  const attrs: Record<string, string> = {};
  if (o.id) attrs.id = o.id;
  attrs.size = String(size); attrs.mode = "random"; attrs.time = "1.5s +-0.5s";
  if (o.start && o.start !== "new-slide") attrs.start = o.start;
  if (o.at) { attrs.x = String(round2(clamp(o.at.x - size / 2, 0, 100 - size))); attrs.y = String(round2(clamp(o.at.y - hPct / 2, 0, 100 - hPct))); }
  return `${flashHeader(attrs, [])}\n3 red, 2 green, 1 blue\n:::`;
}

/** The items as the one-line form people type: `3 red, "Hello there" blue`. */
export const itemsText = (items: FlashItem[]) =>
  items.map((i) => `${/[\s,"]/.test(i.text) ? `"${i.text}"` : i.text}${i.color ? ` ${i.color}` : ""}`).join(", ");

export interface FlashRef { line: number; close: number; spec: FlashSpec; attrs: Record<string, string>; flags: Set<string> }
/** Every flash block of one slide's source, in order (fenced code skipped). `line` is the header's 0-based line. */
export function scanFlashes(src: string): FlashRef[] {
  const lines = src.split("\n"), out: FlashRef[] = []; let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const was = fence; fence = fenceOf(lines[i], fence);
    if (was || fence) continue;
    const r = readFlash(lines, i);
    if (!r) continue;
    const { attrs, flags } = parseAttrs(lines[i].replace(/^:::\s*flash\b\s*/, ""));
    out.push({ line: i, close: r.close, spec: r.spec, attrs, flags });
    i = r.close;
  }
  return out;
}

function inSlide(text: string, id: number) {
  const r = slideRange(text, id); if (!r) return null;
  return { r, len: r.end - r.start, refs: scanFlashes(r.lines.slice(r.start, r.end).join("\n")) };
}
const uniqueId = (taken: Set<string>, base = "flash") => { let n = 1; while (taken.has(`${base}${n}`)) n++; return `${base}${n}`; };
const idsIn = (lines: string[]) => new Set([...lines.join("\n").matchAll(/\bid=([^\s"]+)/g)].map((m) => m[1]));

/** Change options (null removes one) and flags of the n-th flash region on slide `id`. The items are left alone. */
export function patchFlash(text: string, id: number, n: number, patch: { set?: Record<string, string | null>; flags?: Record<string, boolean> }): string {
  const s = inSlide(text, id), f = s?.refs[n]; if (!s || !f) return text;
  const attrs = { ...f.attrs }, flags = new Set(f.flags);
  for (const [k, v] of Object.entries(patch.set ?? {})) { if (v === null) delete attrs[k]; else attrs[k] = v; }
  for (const [k, on] of Object.entries(patch.flags ?? {})) { if (on) flags.add(k); else flags.delete(k); }
  s.r.lines[s.r.start + f.line] = flashHeader(attrs, flags);
  return s.r.lines.join("\n");
}

/** Replace the items of the n-th flash region with one line of text. */
export function setFlashBody(text: string, id: number, n: number, items: string): string {
  const s = inSlide(text, id), f = s?.refs[n]; if (!s || !f) return text;
  const missingClose = f.close >= s.len;
  s.r.lines.splice(s.r.start + f.line + 1, f.close - f.line - 1, ...[items.replace(/\s*\n\s*/g, " ").trim(), ...(missingClose ? [":::"] : [])]);
  return s.r.lines.join("\n");
}

export function removeFlash(text: string, id: number, n: number): string {
  const s = inSlide(text, id), f = s?.refs[n]; if (!s || !f) return text;
  const last = Math.min(f.close, s.len - 1);
  let first = f.line; while (first > 0 && ALIGN_LINE.test(s.r.lines[s.r.start + first - 1])) first--; // take its alignment line with it
  s.r.lines.splice(s.r.start + first, last - first + 1);
  return s.r.lines.join("\n");
}

/** Copy the n-th flash region just after itself, with a fresh id (and nudged a little if it is placed on the slide). */
export function duplicateFlash(text: string, id: number, n: number): string {
  const s = inSlide(text, id), f = s?.refs[n]; if (!s || !f) return text;
  const attrs = { ...f.attrs };
  if (attrs.id) attrs.id = uniqueId(idsIn(s.r.lines.slice(s.r.start, s.r.end)));
  if (attrs.x !== undefined && attrs.y !== undefined) { attrs.x = String(round2(+attrs.x + 3)); attrs.y = String(round2(+attrs.y + 3)); }
  const last = Math.min(f.close, s.len - 1);
  const body = s.r.lines.slice(s.r.start + f.line + 1, s.r.start + (f.close >= s.len ? s.len : f.close));
  s.r.lines.splice(s.r.start + last + 1, 0, "", flashHeader(attrs, f.flags), ...body, ":::");
  return s.r.lines.join("\n");
}

/** Add a new flash region at the end of slide `id`. */
export function addFlash(text: string, id: number, at?: { x: number; y: number }, start: Trigger = "when-next"): string {
  return appendBlock(text, id, flashBlock({ id: uniqueId(idsIn((() => { const r = slideRange(text, id); return r ? r.lines.slice(r.start, r.end) : []; })())), start, at }));
}

/** Append a block of text to the end of slide `id` (before its trailing blank lines). */
export function appendBlock(text: string, id: number, block: string): string {
  const r = slideRange(text, id); if (!r) return text;
  let end = r.end; while (end > r.start && !r.lines[end - 1].trim()) end--;
  r.lines.splice(end, 0, "", ...block.trimEnd().split("\n"));
  return r.lines.join("\n");
}
