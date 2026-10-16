// Slide operations behind the Slides panel's right-click menu. Pure text -> text, like edit.ts, so each one is a single undoable edit.
import { bnum, mother } from "./branch";
import { insertSlide, join, setSlideOpt, split, titleOf } from "./edit";
import { parseDeck, type Slide } from "./itsd";

const slides = (text: string) => parseDeck(text).slides;
const trimBlank = (l: string[]) => { let a = 0, b = l.length; while (a < b && !l[a].trim()) a++; while (b > a && !l[b - 1].trim()) b--; return l.slice(a, b); };

/** A main slide and the branch slides that belong to it: [mother, last branch]. */
export function groupOf(sl: Slide[], k: number): [number, number] {
  const m = mother(sl, k); let e = m;
  while (e + 1 < sl.length && bnum(sl[e + 1]) > 0) e++;
  return [m, e];
}
/** Which branch numbers this slide's mother already has, with how many slides in each. */
export function branchCounts(sl: Slide[], k: number): Record<number, number> {
  const [m, e] = groupOf(sl, k), out: Record<number, number> = {};
  for (let i = m + 1; i <= e; i++) out[bnum(sl[i])] = (out[bnum(sl[i])] ?? 0) + 1;
  return out;
}

// ---- copy, paste, duplicate ----
/** The slide's own text (what sits between its `---` lines), for Copy. */
export function slideSource(text: string, id: number): string { return trimBlank(split(text).chunks[id] ?? []).join("\n"); }
export function pasteSlide(text: string, after: number, src: string): string {
  const { header, chunks } = split(text); chunks.splice(after + 1, 0, ["", ...src.replace(/\r\n?/g, "\n").split("\n"), "", ""]); return join(header, chunks);
}
/** `n` copies right after the slide. */
export function duplicateSlides(text: string, id: number, n: number): string {
  const { header, chunks } = split(text); chunks.splice(id + 1, 0, ...Array.from({ length: Math.max(1, n) }, () => [...chunks[id]])); return join(header, chunks);
}
/** A main slide together with all its branch slides (a branch slide alone is just duplicated). */
export function duplicateGroup(text: string, id: number): string {
  const sl = slides(text), [m, e] = groupOf(sl, id), { header, chunks } = split(text);
  chunks.splice(e + 1, 0, ...chunks.slice(m, e + 1).map((c) => [...c])); return join(header, chunks);
}
export function insertBefore(text: string, id: number, lines: string[]): string { const { header, chunks } = split(text); chunks.splice(id, 0, lines); return join(header, chunks); }

// ---- moving: a main slide travels with its branches, a branch slide stays inside its own mother ----
export type Dir = "up" | "down" | "top" | "end";
export function canMove(text: string, id: number, dir: Dir): boolean { return moveSmart(text, id, dir) !== text; }
export function moveSmart(text: string, id: number, dir: Dir): string {
  const sl = slides(text);
  if (bnum(sl[id]) > 0) {
    const { header, chunks } = split(text); // inside the group: positions m+1..e
    const [m, e] = groupOf(sl, id), to = dir === "up" ? id - 1 : dir === "down" ? id + 1 : dir === "top" ? m + 1 : e;
    if (to < m + 1 || to > e || to === id) return text;
    const [c] = chunks.splice(id, 1); chunks.splice(to, 0, c); return join(header, chunks);
  }
  const [m] = groupOf(sl, id), blocks: [number, number][] = []; // every main slide's group, in order
  for (let k = 0; k < sl.length; k = groupOf(sl, k)[1] + 1) blocks.push(groupOf(sl, k));
  const at = blocks.findIndex(([a]) => a === m), to = dir === "up" ? at - 1 : dir === "down" ? at + 1 : dir === "top" ? 0 : blocks.length - 1;
  if (to < 0 || to >= blocks.length || to === at) return text;
  return reorder(text, blocks, at, to);
}
function reorder(text: string, blocks: [number, number][], at: number, to: number): string {
  const { header, chunks } = split(text), g = blocks.map(([a, b]) => chunks.slice(a, b + 1));
  const [x] = g.splice(at, 1); g.splice(to, 0, x); return join(header, g.flat());
}

// ---- deleting ----
export function deleteGroup(text: string, id: number): string {
  const sl = slides(text), [m, e] = groupOf(sl, id), { header, chunks } = split(text);
  if (e - m + 1 >= chunks.length) return text; // a deck always keeps one slide
  chunks.splice(m, e - m + 1); return join(header, chunks);
}

// ---- renaming: the slide's first heading, or a new one under its options comment ----
export function renameSlide(text: string, id: number, title: string): string {
  const t = title.trim().replace(/\s+/g, " "); if (!t) return text;
  const { header, chunks } = split(text), c = chunks[id]; let fence = false;
  for (let i = 0; i < c.length; i++) {
    if (/^\s*(`{3,}|~{3,})/.test(c[i])) fence = !fence;
    const h = !fence && c[i].match(/^(\s{0,3}#{1,6})\s+/); if (h) { c[i] = `${h[1]} ${t}`; return join(header, chunks); }
  }
  let at = 0; while (at < c.length && (!c[at].trim() || /^\s*<!--.*-->\s*$/.test(c[at]))) at++;
  c.splice(at, 0, `# ${t}`, ""); return join(header, chunks);
}

// ---- branches ----
/** Where a new slide of branch `n` goes: after that branch's last slide, else after the mother's last branch slide, else right after the mother. */
function branchSpot(sl: Slide[], id: number, n: number): number {
  const [m, e] = groupOf(sl, id); let last = m;
  for (let i = m + 1; i <= e; i++) if (bnum(sl[i]) === n) last = i;
  return last > m ? last : e;
}
const goButton = (n: number) => ["", `::: button "Branch ${n}"`, `branch ${n}`, ":::"];
/** A new branch-N slide off this slide's mother (with a Back button); `withButton` also puts a "Branch N" button on the mother. */
export function addBranchSlide(text: string, id: number, n: number, withButton = false): { text: string; at: number } {
  const sl = slides(text), spot = branchSpot(sl, id, n), { header, chunks } = split(text), m = mother(sl, id);
  const first = !sl.slice(m + 1, groupOf(sl, id)[1] + 1).some((s) => bnum(s) === n);
  const title = first ? `Branch ${n}` : `Branch ${n}, part ${sl.slice(m + 1, groupOf(sl, id)[1] + 1).filter((s) => bnum(s) === n).length + 1}`;
  chunks.splice(spot + 1, 0, ["", `<!-- branch: ${n} -->`, `# ${title}`, "", `Text about ${titleOf(sl[m])}.`, "", `::: button "Back"`, "back", ":::", "", ""]);
  if (withButton && first) { const c = chunks[m]; while (c.length && !c[c.length - 1].trim()) c.pop(); c.push(...goButton(n), "", ""); }
  return { text: join(header, chunks), at: spot + 1 };
}
/** A new slide of your own lines as a branch slide off this slide: in the slide's own branch when it is one already, else in the lowest free branch number.
 *  `button` also puts a "Show trace"-style button on the mother (only for a new branch). Returns the new text, the slide index and the branch number. */
export function addBranchLines(text: string, id: number, lines: string[], button?: string): { text: string; at: number; n: number } {
  const sl = slides(text), own = bnum(sl[id]), counts = branchCounts(sl, id);
  let n = own; if (!n) { n = 1; while (counts[n]) n++; }
  const spot = branchSpot(sl, id, n), { header, chunks } = split(text), m = mother(sl, id);
  chunks.splice(spot + 1, 0, ["", `<!-- branch: ${n} -->`, ...lines, "", ""]);
  if (button && !own) { const c = chunks[m]; while (c.length && !c[c.length - 1].trim()) c.pop(); c.push("", `::: button "${button}"`, `branch ${n}`, ":::", "", ""); }
  return { text: join(header, chunks), at: spot + 1, n };
}
/** A copy of this slide, placed as a branch-N slide of its mother. */
export function duplicateAsBranch(text: string, id: number, n: number): { text: string; at: number } {
  const sl = slides(text), spot = branchSpot(sl, id, n);
  const { header, chunks } = split(text), copy = [...chunks[id]]; chunks.splice(spot + 1, 0, copy);
  return { text: setSlideOpt(join(header, chunks), spot + 1, "branch", String(n)), at: spot + 1 };
}
/** Make a slide a branch of the slide above (n) or put it back on the main line (null). */
export function setBranch(text: string, id: number, n: number | null): string { return setSlideOpt(text, id, "branch", n ? String(n) : null); }

/** The line in the file where slide `k` starts (to move the Source pane there after an edit). */
export const slideLine = (text: string, k: number): number => slides(text)[k]?.line ?? 0;
/** Insert a slide made of these lines after slide `id`. */
export const insertAfterLines = insertSlide;
