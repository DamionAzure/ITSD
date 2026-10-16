// Branch slides: a slide whose comment says `<!-- branch: 1 -->` is off the main line. Ctrl+Right, Ctrl+Enter and Ctrl+Space (branch 1, 2, 3)
// enter it from the slide it hangs off (its "mother": the nearest main slide above it). The ordinary arrows never enter a branch from a main slide, and
// from inside one, Right walks through the branch's own slides and then rejoins the main line (the slide after the mother); Left walks back and ends at the mother.
// Everything here works on a slide list (the presentation view: source slides plus generated trace slides) and an index into it.
import type { Slide } from "./itsd";

/** The branch number of a slide (0 = a main slide). A generated trace slide copies its source slide's number, so it stays in that branch. */
export const bnum = (s: Pick<Slide, "opts">): number => { const n = parseInt(s.opts.branch ?? "", 10); return Number.isFinite(n) && n > 0 ? n : 0; };

/** Index of the mother of slide k: k itself for a main slide, otherwise the nearest main slide above it (-1 if the deck starts with a branch). */
export function mother(slides: Slide[], k: number): number {
  let j = k;
  while (j >= 0 && (bnum(slides[j]) > 0)) j--;
  return j;
}
/** Where a Right press goes: inside a branch, the next slide of that branch, and after its last one the next main slide after the mother. Stays put at the end of the deck. */
export function mainNext(slides: Slide[], k: number): number {
  const inside = branchNext(slides, k); if (inside !== undefined) return inside;
  let j = Math.max(bnum(slides[k]) > 0 ? mother(slides, k) : k, -1) + 1;
  while (j < slides.length && bnum(slides[j]) > 0) j++;
  return j < slides.length ? j : k;
}
/** Where a Left press goes: inside a branch, the previous slide of the same branch, or its mother from the first one; from a main slide, the previous main slide (branches are skipped). */
export function mainPrev(slides: Slide[], k: number): number {
  const n = bnum(slides[k]);
  if (n > 0) { if (k > 0 && bnum(slides[k - 1]) === n) return k - 1; const m = mother(slides, k); return m >= 0 ? m : k; }
  let j = k - 1;
  while (j >= 0 && bnum(slides[j]) > 0) j--;
  return j >= 0 ? j : k;
}
/** The first slide of branch n hanging off the current slide's mother (undefined when there is none). */
export function branchEntry(slides: Slide[], k: number, n: number): number | undefined {
  const m = bnum(slides[k]) > 0 ? mother(slides, k) : k;
  if (m < 0) return undefined;
  let j = m + 1;
  while (j < slides.length && slides[j].virtual && bnum(slides[j]) === 0) j++; // a trace slide generated for the mother sits between it and its branches
  for (; j < slides.length && bnum(slides[j]) > 0; j++) if (bnum(slides[j]) === n) return j;
  return undefined;
}
/** The next slide inside the same branch (several slides in a row with the same branch number form one branch). */
export function branchNext(slides: Slide[], k: number): number | undefined {
  const n = bnum(slides[k]);
  return n > 0 && k + 1 < slides.length && bnum(slides[k + 1]) === n ? k + 1 : undefined;
}

/** Display labels for slides, e.g. "30", "30-1", "30-1.2" (a second slide in the same branch). Branch slides don't use up a main number. */
export function labels(slides: Slide[]): string[] {
  let main = 0, run = 0, last = 0;
  return slides.map((s) => {
    const n = bnum(s);
    if (!n) { main++; run = 0; last = 0; return String(main); }
    run = n === last ? run + 1 : 1; last = n;
    return `${Math.max(main, 1)}-${n}${run > 1 ? "." + run : ""}`;
  });
}
/** "12 / 40" for a main slide (counting main slides only), "12-1" for a branch slide. */
export function where(slides: Slide[], k: number): string {
  const l = labels(slides)[k] ?? "";
  return bnum(slides[k]) > 0 ? l : `${l} / ${slides.filter((s) => !bnum(s)).length}`;
}
