// Text edits behind the Animations panel. Every animation is a `<!-- @on next|enter: anim <id> <effect> ... -->` line above its object.
// "On click" starts a new line (one Next press); "With previous" joins the step to the last line with `;`; "After previous" with `->`.
import { toBlocks } from "./SlideView";
import { slideRange } from "./images";
import { ON_LINE, ID_LINE, parseChain, type Step } from "./motion";
import { effectOf, type Dir } from "./anim";
import { plainText } from "./format";

export interface ObjInfo { index: number; label: string; id?: string; top: number }
export interface AnimLine { line: number; when: "next" | "enter" | "click"; owner: string; steps: Step[]; text: string; groups: Step[][] }
export type Start = "click" | "with" | "after" | "enter";

const fenceToggle = (l: string, fc: string | null) => { const f = l.match(/^\s*(`{3,}|~{3,})/); return f ? (fc ? (f[1][0] === fc ? null : fc) : f[1][0]) : fc; };

/** The objects (blocks and pictures) on a slide, in file order, with a short label for each. */
export function objects(text: string, id: number): ObjInfo[] {
  const r = slideRange(text, id); if (!r) return [];
  const src = r.lines.slice(r.start, r.end).join("\n");
  return toBlocks(src).map((b, index) => {
    const lab = b.kind === "html" ? plainText(b.html).replace(/\s+/g, " ").trim().slice(0, 34) || "Text"
      : b.kind === "run" ? `Code${b.name ? `: ${b.name}` : ""}` : b.kind === "btn" ? `Button: ${b.label}` : b.kind === "img" ? `Picture: ${b.def.src.split("/").pop()}`
      : b.kind === "input" ? "Input box" : b.kind === "media" ? "Video / audio" : b.kind === "show" ? "Slideshow" : b.kind === "flash" ? "Flash region" : b.kind === "trace" ? "Trace" : "Effect";
    return { index, label: lab, id: b.id, top: Math.min(b.marker ?? b.line, b.alignLine ?? b.line, b.dir ?? b.line, b.lookLine ?? b.line) };
  });
}
/** The object that contains (or is nearest above) a 0-based line of the whole deck, for "the block at the cursor". */
export function objectAt(text: string, id: number, line: number): number {
  const r = slideRange(text, id); if (!r) return 0;
  const objs = objects(text, id), rel = line - r.start; let at = 0;
  objs.forEach((o, k) => { if (o.top <= rel) at = k; });
  return at;
}

export function listAnims(text: string, id: number): AnimLine[] {
  const r = slideRange(text, id); if (!r) return [];
  const objs = objects(text, id), blocks = toBlocks(r.lines.slice(r.start, r.end).join("\n")), out: AnimLine[] = []; let fc: string | null = null;
  for (let n = r.start; n < r.end; n++) {
    const l = r.lines[n]; if (/^\s*(`{3,}|~{3,})/.test(l)) { fc = fenceToggle(l, fc); continue; } if (fc) continue;
    const m = l.match(ON_LINE); if (!m) continue;
    const rel = n - r.start, k = blocks.findIndex((b) => b.line >= rel);
    const { chain } = parseChain(m[2]);
    out.push({ line: n, when: m[1] as AnimLine["when"], owner: objs[k]?.label ?? "(object)", steps: chain.flat(), groups: chain, text: m[2] });
  }
  return out;
}

const uniq = (taken: Set<string>, base: string) => { let n = 1; while (taken.has(`${base}${n}`)) n++; return `${base}${n}`; };
export function stepText(target: string, effect: string, dir: Dir | "", dur: number, delay: number): string {
  const e = effectOf(effect)!;
  return `anim ${target} ${effect}${e.dirs && dir && dir !== e.defDir ? ` ${dir}` : ""}${Math.abs(dur - e.dur) > 0.001 && e.dur > 0 ? ` over ${+dur.toFixed(2)}s` : ""}${delay > 0 ? ` delay ${+delay.toFixed(2)}s` : ""}`;
}

/** Add an animation to object `index` of slide `id`. */
export function addAnim(text: string, id: number, index: number, o: { effect: string; dir?: Dir | ""; dur: number; delay: number; start: Start }): string {
  let r = slideRange(text, id); if (!r) return text;
  const objs = objects(text, id), ob = objs[index]; if (!ob) return text;
  let target = ob.id;
  if (!target) { // name the object so steps can point at it from any line
    const taken = new Set(r.lines.slice(r.start, r.end).map((l) => l.match(ID_LINE)?.[1]).filter(Boolean) as string[]);
    target = uniq(taken, "obj");
    r.lines.splice(r.start + ob.top, 0, `<!-- @id ${target} -->`);
    text = r.lines.join("\n"); r = slideRange(text, id)!;
  }
  const step = stepText(target, o.effect, o.dir ?? "", o.dur, o.delay);
  const prev = o.start === "with" || o.start === "after" ? listAnims(text, id).filter((a) => a.when === "next").pop() : undefined;
  if (prev) {
    const l = r.lines[prev.line].replace(/\s*-->\s*$/, "");
    r.lines[prev.line] = `${l} ${o.start === "with" ? ";" : "->"} ${step} -->`;
    return r.lines.join("\n");
  }
  const cur = objects(text, id)[index];
  r.lines.splice(r.start + cur.top, 0, `<!-- @on ${o.start === "enter" ? "enter" : "next"}: ${step} -->`);
  return r.lines.join("\n");
}
export function removeAnim(text: string, line: number): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n"); lines.splice(line, 1); return lines.join("\n");
}
/** Swap the actions of two `@on next` lines (their order is the order of Next presses). Steps address objects by name, so swapping text is safe when every target is an @id. */
export function swapAnim(text: string, a: number, b: number): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n"); [lines[a], lines[b]] = [lines[b], lines[a]]; return lines.join("\n");
}
