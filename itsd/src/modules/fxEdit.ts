// `::: fx <module>.<Effect> key=value ...` is one line, no closing `:::`. These helpers read and rewrite those lines;
// like images.ts / flashEdit.ts each returns the new deck text so the caller can apply it as one undo step.
import { parseAttrs } from "../flash";
import { fenceOf, slideRange } from "../images";
import { deleteBlock, formatMark, isMarker } from "../layout";
import { ALIGN_LINE } from "../format";
import { isActionLine } from "../motion";
import { defaultText, findEffect } from "./registry";

const FX = /^:::\s*(fx|wrap)\s+([\w.-]+)\s*(.*)$/;
const q = (v: string) => (/[\s"]/.test(v) ? `"${v.replace(/"/g, "'")}"` : v);

export interface FxDef { id: string; attrs: Record<string, string>; wrap?: boolean }
export interface FxRef extends FxDef { line: number; close: number } // 0-based lines within the slide; close = last line of the effect
export function parseFx(line: string): FxDef | null {
  const m = line.match(FX);
  return m ? { id: m[2], attrs: parseAttrs(m[3]).attrs, wrap: m[1] === "wrap" } : null;
}
export const fxLine = (id: string, attrs: Record<string, string>, wrap = false) =>
  `::: ${wrap ? "wrap" : "fx"} ${id}${Object.entries(attrs).map(([k, v]) => ` ${k}=${q(v)}`).join("")}`;

/** A `::: wrap` block: the header, the markdown inside, and the line of its closing `:::` (the last line if it was never closed).
 *  A `:::` inside a fenced code block belongs to the code, not to the wrapper, so fences are skipped when looking for the close. */
export function readWrap(lines: string[], i: number): { fx: FxDef; body: string[]; close: number } | null {
  const fx = parseFx(lines[i]); if (!fx?.wrap) return null;
  let c = i + 1, fence: string | null = null;
  for (; c < lines.length; c++) {
    fence = fenceOf(lines[c], fence);
    if (!fence && !/^\s*(`{3,}|~{3,})/.test(lines[c]) && /^:::\s*$/.test(lines[c])) break;
  }
  return { fx, body: lines.slice(i + 1, c), close: Math.min(c, lines.length - 1) };
}

/** A `+++` line on its own (outside a code fence) splits a wrap's content into parts, e.g. the two faces of a FlipCard. */
export function splitParts(md: string): string[] {
  const parts: string[][] = [[]]; let fence: string | null = null;
  for (const l of md.split("\n")) {
    const was = fence; fence = fenceOf(l, fence);
    if (!was && !fence && /^\+{3}\s*$/.test(l)) parts.push([]); else parts[parts.length - 1].push(l);
  }
  return parts.map((p) => p.join("\n"));
}

export function scanFx(src: string): FxRef[] {
  const out: FxRef[] = []; let fence: string | null = null;
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const was = fence; fence = fenceOf(lines[i], fence);
    if (was || fence) continue;
    const w = readWrap(lines, i);
    if (w) { out.push({ ...w.fx, line: i, close: w.close }); i = w.close; continue; }
    const d = parseFx(lines[i]); if (d) out.push({ ...d, line: i, close: i });
  }
  return out;
}

/** The line to insert for a new effect (text effects get sample text). */
export function fxSnippet(full: string): string {
  const e = findEffect(full);
  if (e?.effect.kind === "wrap" && e.effect.parts) return `${fxLine(full, {}, true)}\n## Front\n\nClick the card to flip it.\n+++\n## Back\n\nThe other side. Code blocks work here too.\n:::`;
  if (e?.effect.kind === "wrap") return `${fxLine(full, {}, true)}\n## ${defaultText}\n\nWrite anything here.\n:::`;
  return fxLine(full, e?.effect.kind === "text" ? { text: defaultText } : {});
}

/** Add an effect at the end of slide `id`. A text or wrap effect given `at` is placed there. */
export function addFx(text: string, id: number, full: string, at?: { x: number; y: number }): string {
  const r = slideRange(text, id); if (!r) return text;
  let end = r.end; while (end > r.start && !r.lines[end - 1].trim()) end--;
  const e = findEffect(full);
  const add = [...(at && e?.effect.kind !== "background" ? [formatMark({ x: Math.max(0, Math.min(at.x, 90)), y: Math.max(0, Math.min(at.y, 90)), w: 40 })] : []), fxSnippet(full)];
  r.lines.splice(end, 0, "", ...add);
  return r.lines.join("\n");
}

/** Change options of the n-th effect on slide `id`; null removes one. */
export function patchFx(text: string, id: number, n: number, set: Record<string, string | null>, reset = false): string {
  const r = slideRange(text, id); if (!r) return text;
  const ref = scanFx(r.lines.slice(r.start, r.end).join("\n"))[n]; if (!ref) return text;
  const attrs: Record<string, string> = reset ? (ref.attrs.text !== undefined ? { text: ref.attrs.text } : {}) : { ...ref.attrs };
  for (const [k, v] of Object.entries(set)) { if (v === null || v === "") delete attrs[k]; else attrs[k] = v; }
  r.lines[r.start + ref.line] = fxLine(ref.id, attrs, ref.wrap);
  return r.lines.join("\n");
}
export function removeFx(text: string, id: number, n: number): string {
  const r = slideRange(text, id); if (!r) return text;
  const ref = scanFx(r.lines.slice(r.start, r.end).join("\n"))[n]; if (!ref) return text;
  // a position or alignment line directly above belongs to this effect and goes with it
  const above = r.lines.slice(r.start, r.start + ref.line);
  let marker: number | undefined, alignLine: number | undefined, dir: number | undefined;
  for (let k = ref.line - 1; k >= Math.max(0, ref.line - 6); k--) {
    if (isMarker(above[k])) marker = k; else if (ALIGN_LINE.test(above[k])) alignLine = k; else if (isActionLine(above[k])) dir = k; else break;
  }
  return deleteBlock(text, id, { line: ref.line, end: ref.close, marker, alignLine, dir });
}

/** True when a new block line may go above 0-based line `at` of the whole text: not in a code fence or the frontmatter. */
export function canInsertAt(lines: string[], at: number): boolean {
  let fence: string | null = null, i = 0;
  if (lines[0]?.trim() === "---") { const end = lines.findIndex((l, k) => k > 0 && l.trim() === "---"); if (end > 0) { if (at <= end) return false; i = end + 1; } }
  for (; i < at && i < lines.length; i++) fence = fenceOf(lines[i], fence);
  return !fence;
}
