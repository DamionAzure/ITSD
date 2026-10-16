// Picture elements and slide backgrounds, stored as plain text in the .itsd file.
//
//   ::: image "assets/cat.png" x=10 y=20 w=40 h=35.5 alt="A cat"
//
// One line, no closing `:::`. x/w are percentages of the slide's width, y/h of its height (so the layout
// scales with the slide). Order in the file is stacking order: later lines are drawn on top.
// Backgrounds live in the slide's leading comment: `<!-- bg: #1b3a4b; bgimage: assets/sky.jpg; bgdim: 30 -->`.
import { parseDeck } from "./itsd";

export interface ImageDef { src: string; x: number; y: number; w: number; h: number; alt: string; rot?: number; z?: number }

export const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: string | undefined) => { const n = parseFloat(v ?? ""); return Number.isFinite(n) ? n : undefined; };

export function parseImage(rest: string): ImageDef | null {
  const m = rest.trim().match(/^(?:"([^"]+)"|(\S+))\s*(.*)$/);
  if (!m) return null;
  const a: Record<string, string> = {};
  m[3].replace(/(\w+)=("([^"]*)"|\S+)/g, (_, k, v, q) => { a[k] = q ?? v; return ""; });
  const w = num(a.w) ?? 30, h = num(a.h) ?? w;
  if (w <= 0 || h <= 0) return null;
  const rot = num(a.rot), z = num(a.z);
  return { src: m[1] ?? m[2], x: num(a.x) ?? 0, y: num(a.y) ?? 0, w, h, alt: a.alt ?? "", rot: rot ? rot : undefined, z: z !== undefined ? Math.round(z) : undefined };
}

export function formatImage(d: ImageDef): string {
  const alt = d.alt ? ` alt="${d.alt.replace(/"/g, "'")}"` : "";
  return `::: image "${d.src}" x=${round2(d.x)} y=${round2(d.y)} w=${round2(d.w)} h=${round2(d.h)}${d.rot ? ` rot=${round2(d.rot)}` : ""}${d.z !== undefined ? ` z=${Math.round(d.z)}` : ""}${alt}`;
}

const IMG_LINE = /^:::\s*image\s+(.*)$/;
export const fenceOf = (l: string, fence: string | null) => {
  const f = l.match(/^\s*(`{3,}|~{3,})/);
  return f ? (fence ? (f[1][0] === fence ? null : fence) : f[1][0]) : fence;
};

/** Every well-formed image line of one slide's source (fenced code is skipped). `line` is 0-based within `src`. */
export function scanImages(src: string): { line: number; def: ImageDef }[] {
  const out: { line: number; def: ImageDef }[] = []; let fence: string | null = null;
  src.split("\n").forEach((l, i) => {
    const was = fence; fence = fenceOf(l, fence);
    if (was || fence) return;
    const m = l.match(IMG_LINE), def = m && parseImage(m[1]);
    if (def) out.push({ line: i, def });
  });
  return out;
}

// ---- text edits (each returns the new deck text; the caller applies it through the editor so Ctrl+Z works) ----

export function slideRange(text: string, id: number) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sl = parseDeck(text).slides, s = sl[id];
  if (!s) return null;
  return { lines, start: s.line, end: id + 1 < sl.length ? sl[id + 1].line - 1 : lines.length };
}
function imageLines(lines: string[], start: number, end: number): number[] {
  const out: number[] = []; let fence: string | null = null;
  for (let i = start; i < end; i++) {
    const was = fence; fence = fenceOf(lines[i], fence);
    if (was || fence) continue;
    const m = lines[i].match(IMG_LINE);
    if (m && parseImage(m[1])) out.push(i);
  }
  return out;
}

/** Append a picture to slide `id` (it lands on top). */
export function addImage(text: string, id: number, def: ImageDef): string {
  const r = slideRange(text, id); if (!r) return text;
  let at = r.end; while (at > r.start && !r.lines[at - 1].trim()) at--;
  r.lines.splice(at, 0, formatImage(def));
  return r.lines.join("\n");
}
/** Change the n-th picture of slide `id`. */
export function patchImage(text: string, id: number, n: number, patch: Partial<ImageDef>): string {
  const r = slideRange(text, id); if (!r) return text;
  const at = imageLines(r.lines, r.start, r.end)[n]; if (at === undefined) return text;
  const cur = parseImage(r.lines[at].replace(IMG_LINE, "$1"))!;
  r.lines[at] = formatImage({ ...cur, ...patch });
  return r.lines.join("\n");
}
export function removeImage(text: string, id: number, n: number): string {
  const r = slideRange(text, id); if (!r) return text;
  const at = imageLines(r.lines, r.start, r.end)[n]; if (at === undefined) return text;
  r.lines.splice(at, 1);
  return r.lines.join("\n");
}
/** Move the n-th picture to stacking position `to` (0 = back). The other pictures keep their relative order. */
export function reorderImage(text: string, id: number, n: number, to: number): string {
  const r = slideRange(text, id); if (!r) return text;
  const at = imageLines(r.lines, r.start, r.end);
  if (n < 0 || n >= at.length) return text;
  to = Math.max(0, Math.min(to, at.length - 1));
  const mine = at.map((i) => r.lines[i]);
  const [it] = mine.splice(n, 1); mine.splice(to, 0, it);
  at.forEach((i, k) => { r.lines[i] = mine[k]; });
  return r.lines.join("\n");
}

// ---- backgrounds ----

const COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d\s.,%/-]+\))$/i;
/** Only plain CSS colours are accepted, so a hand-edited value can never smuggle other CSS in. */
export const safeColor = (v?: string) => (v && COLOR.test(v.trim()) ? v.trim() : undefined);

/** Perceived brightness of a #rgb / #rrggbb colour, 0..1 (undefined for anything else). */
export function lightness(c?: string): number | undefined {
  const m = c?.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return undefined;
  const h = m[1].length === 3 ? m[1].replace(/./g, (x) => x + x) : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
export interface Backdrop { color?: string; image?: string; dim: number }
export function backdropOf(opts: Record<string, string>): Backdrop {
  const dim = Math.max(0, Math.min(80, parseFloat(opts.bgdim ?? "") || 0));
  return { color: safeColor(opts.bg), image: opts.bgimage || undefined, dim };
}
