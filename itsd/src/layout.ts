// Free placement for any block. A block that has been dragged gets a one-line marker just above it:
//
//   <!-- @ x=10 y=20 w=45 h=30 rot=-5 z=2 -->   (h, rot and z are optional; `fit=scale lw=40` stretches the text to fill w x h)
//   ## A heading
//
// x/y are the block's top-left corner, w its width and h (optional) its height, all as a percentage of the slide (so layouts scale), and the
// block leaves the normal text flow. Delete the marker line and it flows again. Pictures and flash regions carry their
// own x/y (see images.ts and flash.ts), so they never use markers.
import { round2, slideRange } from "./images";
import type { Align } from "./format";

/** x/y/w/h: position and size (percent). rot: degrees clockwise. z: stacking (0 = default; higher is in front).
 *  fit=scale with lw: the content is laid out `lw` percent wide and then stretched to fill the w x h box. */
export interface Place { x: number; y: number; w?: number; h?: number; rot?: number; z?: number; fit?: "scale"; lw?: number }
/** What the layout needs to know about one block: its first/last line within the slide and the marker above it, if any. */
export interface BlockRef { line: number; end: number; marker?: number; alignLine?: number; dir?: number }

const MARK = /^\s*<!--\s*@\s*(.*?)\s*-->\s*$/;
export const isMarker = (line: string) => MARK.test(line);

export function parseMark(line: string): Place | null {
  const m = line.match(MARK);
  if (!m) return null;
  const a: Record<string, number> = {};
  for (const [, k, v] of m[1].matchAll(/(\w+)=(-?[\d.]+)/g)) a[k] = parseFloat(v);
  if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return null;
  const pos = (n: number | undefined) => (Number.isFinite(n) && n! > 0 ? n : undefined);
  const scale = /\bfit=scale\b/.test(m[1]) && pos(a.w) !== undefined && pos(a.h) !== undefined && pos(a.lw) !== undefined;
  return {
    x: a.x, y: a.y, w: pos(a.w), h: pos(a.h),
    rot: Number.isFinite(a.rot) && a.rot !== 0 ? a.rot : undefined,
    z: Number.isFinite(a.z) && a.z !== 0 ? Math.round(a.z) : undefined,
    ...(scale ? { fit: "scale" as const, lw: a.lw } : {}),
  };
}
export const formatMark = (p: Place) =>
  `<!-- @ x=${round2(p.x)} y=${round2(p.y)}${p.w !== undefined ? ` w=${round2(p.w)}` : ""}${p.h !== undefined ? ` h=${round2(p.h)}` : ""}` +
  `${p.rot ? ` rot=${round2(p.rot)}` : ""}${p.z ? ` z=${Math.round(p.z)}` : ""}${p.fit === "scale" && p.lw ? ` fit=scale lw=${round2(p.lw)}` : ""} -->`;

/** Put the block at `p`: rewrites its marker, or adds one right above the block. */
export function placeBlock(text: string, id: number, b: BlockRef, p: Place): string {
  const r = slideRange(text, id); if (!r) return text;
  if (b.marker !== undefined) r.lines[r.start + b.marker] = formatMark(p);
  else r.lines.splice(r.start + b.line, 0, formatMark(p));
  return r.lines.join("\n");
}
/** Put the block back into the text flow. */
export function unplaceBlock(text: string, id: number, b: BlockRef): string {
  const r = slideRange(text, id); if (!r || b.marker === undefined) return text;
  r.lines.splice(r.start + b.marker, 1);
  return r.lines.join("\n");
}
/** Remove the block (and its marker) from the slide. */
export function deleteBlock(text: string, id: number, b: BlockRef): string {
  const r = slideRange(text, id); if (!r) return text;
  const from = r.start + Math.min(b.marker ?? b.line, b.alignLine ?? b.line, b.dir ?? b.line), to = r.start + b.end; // alignment, position, @id and @on lines above the block go with it
  let n = to - from + 1;
  if (!r.lines[to + 1]?.trim() && to + 1 < r.end) n++; // take one blank line with it, so deleting doesn't leave a gap in the source
  r.lines.splice(from, n);
  return r.lines.join("\n");
}

/** Set the alignment of a block (the `<!-- @center -->` line above it), or clear it with "". */
export function alignBlock(text: string, id: number, b: BlockRef, a: Align | ""): string {
  const r = slideRange(text, id); if (!r) return text;
  if (b.alignLine !== undefined) {
    if (a) r.lines[r.start + b.alignLine] = `<!-- @${a} -->`; else r.lines.splice(r.start + b.alignLine, 1);
  } else if (a) r.lines.splice(r.start + (b.marker ?? b.line), 0, `<!-- @${a} -->`);
  return r.lines.join("\n");
}
