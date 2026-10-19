// Text edits for trace parts: laying a whole trace out as separate parts, and changing one part's options. Each returns the new deck text.
import { formatMark, type Place } from "./layout";
import { slideRange, round2 } from "./images";
import { TRACE_PARTS, TRACE_LINE, parseTraceDef, traceOf, type TraceDef, type TracePart } from "./traceBlock";

const q = (v: string) => (/[\s"]/.test(v) ? `"${v.replace(/"/g, "'")}"` : v);
export interface Rect { x: number; y: number; w: number; h: number }
/** Where a generated trace slide puts its parts (percent of the slide). */
export const DEFAULT_RECT: Rect = { x: 4, y: 6, w: 92, h: 84 };
/** Each part's place inside the trace's rectangle, as fractions of it: [x, y, w, h]. */
const LAYOUT: Record<TracePart, [number, number, number, number]> = {
  title: [0, 0, 0.62, 0.09], bars: [0, 0.11, 0.6, 0.56], counts: [0, 0.69, 0.6, 0.07], controls: [0, 0.78, 0.6, 0.1],
  code: [0.63, 0.11, 0.37, 0.45], ops: [0.63, 0.58, 0.37, 0.3],
};

export function traceLine(part: TracePart | "", attrs: Record<string, string>): string {
  const keys = Object.keys(attrs).filter((k) => attrs[k] !== "");
  keys.sort((a, b) => (a === "from" ? -1 : b === "from" ? 1 : 0));
  return `::: trace${part ? "-" + part : ""}${keys.map((k) => ` ${k}=${q(attrs[k])}`).join("")}`;
}

/** The lines (placement marker + part line, blank-separated) for a whole trace laid out in `r`. The whole block's heading text goes to the title part,
 *  and its sound options to the controls. */
export function partsLines(r: Rect, def: TraceDef): string[] {
  const out: string[] = [];
  for (const part of TRACE_PARTS) {
    const [fx, fy, fw, fh] = LAYOUT[part];
    const at: Place = { x: round2(r.x + fx * r.w), y: round2(r.y + fy * r.h), w: round2(fw * r.w), h: round2(fh * r.h) };
    const a: Record<string, string> = { from: def.from };
    if (part === "title" && def.attrs.title !== undefined) a.title = def.attrs.title;
    if (part === "controls") for (const k of ["sound", "vol", "pitch"]) if (def.attrs[k]) a[k] = def.attrs[k];
    out.push(formatMark(at), traceLine(part, a), "");
  }
  out.pop();
  return out;
}

/** Replace a whole `::: trace` block (and its placement marker) with separate parts laid out where it was. */
export function splitTraceBlock(text: string, id: number, blk: { line: number; marker?: number; at?: Place }): string {
  const r = slideRange(text, id); if (!r) return text;
  const m = r.lines[r.start + blk.line]?.match(TRACE_LINE); if (!m || m[1]) return text;
  const at = blk.at, rect: Rect = at ? { x: at.x, y: at.y, w: at.w ?? DEFAULT_RECT.w, h: at.h ?? 55 } : DEFAULT_RECT;
  const from = r.start + (blk.marker ?? blk.line);
  r.lines.splice(from, r.start + blk.line - from + 1, ...partsLines(rect, traceOf(m)));
  return r.lines.join("\n");
}

/** Change options on one trace line: a value sets the key, "" or null removes it. */
export function patchTraceLine(text: string, id: number, line: number, patch: Record<string, string | null>): string {
  const r = slideRange(text, id); if (!r) return text;
  const m = r.lines[r.start + line]?.match(TRACE_LINE); if (!m) return text;
  const d = traceOf(m), attrs = { ...d.attrs };
  for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") delete attrs[k]; else attrs[k] = v; }
  r.lines[r.start + line] = traceLine(d.part, attrs);
  return r.lines.join("\n");
}

/** The options each part understands, for the Inspector. t: text | num | bool | color. `d` is what applies when it is left out. */
export interface Field { k: string; label: string; t: "text" | "num" | "bool" | "color" | "select"; d?: string; hint?: string; opts?: string[] }
const FIELDS_ALL = {} as Record<TracePart | "all", Field[]>;
const BASE_FIELDS: Record<TracePart | "all", Field[]> = {
  title: [{ k: "title", label: "Heading", t: "text", d: "Trace" }, { k: "steps", label: "Show “step 3 of 9”", t: "bool", d: "true" }, { k: "size", label: "Text size ×", t: "num", d: "1" }],
  bars: [{ k: "view", label: "Look", t: "select", d: "bars", opts: ["bars", "dots", "line", "numbers", "heat", "grid", "stack", "tree", "ring"] }, { k: "gap", label: "Gap", t: "num", d: "1.2" }, { k: "radius", label: "Rounding", t: "num", d: "0.4" }, { k: "labels", label: "Show values", t: "bool", d: "true" }, { k: "unsorted", label: "Unsorted bars", t: "color", d: "#323b6b" }, { k: "sorted", label: "Sorted bars", t: "color", d: "#3f7a63" },
    { k: "selected", label: "Selected bars", t: "color", d: "#f2b84b" }, { k: "selected-compare", label: "Selected, comparing", t: "color", d: "#f2b84b" },
    { k: "selected-swap", label: "Selected, swapping", t: "color", d: "#f2b84b" }, { k: "key", label: "Held key", t: "color", d: "#7fd6a4" }, { k: "size", label: "Text size ×", t: "num", d: "1" }],
  code: [{ k: "size", label: "Text size ×", t: "num", d: "1" }],
  ops: [{ k: "size", label: "Text size ×", t: "num", d: "1" }],
  counts: [{ k: "size", label: "Text size ×", t: "num", d: "1" }],
  controls: [{ k: "autoplay", label: "Start playing", t: "bool", d: "false" }, { k: "loop", label: "Loop", t: "bool", d: "false" }, { k: "speed", label: "Start speed", t: "num", d: "1" }, { k: "slider", label: "Show scrubber", t: "bool", d: "true" }, { k: "speeds", label: "Speed choices", t: "text", d: "0.5 1 2 4" },
    { k: "sound", label: "Sound per step", t: "text", hint: "swap:pop compare:tick" }, { k: "vol", label: "Volume", t: "text", hint: "0.8" }, { k: "pitch", label: "Pitch", t: "text", hint: "+-0.1" }],
  all: [{ k: "title", label: "Heading", t: "text", d: "Trace" }, { k: "sound", label: "Sound per step", t: "text", hint: "swap:pop compare:tick" }, { k: "vol", label: "Volume", t: "text" }, { k: "pitch", label: "Pitch", t: "text" }],
};

/** Layout and type: the same for every part, so each one can look different. */
import { LOOK_FIELDS, LOOK_EXTRA_KEYS } from "./look";
const LOOK: Field[] = [
  { k: "class", label: "CSS class", t: "text", hint: "fancy (for your stylesheet)" },
  { k: "font", label: "Font", t: "text", hint: "Space Grotesk" }, { k: "weight", label: "Weight", t: "select", opts: ["", "300", "400", "500", "600", "700", "800", "900"] },
  { k: "italic", label: "Italic", t: "bool", d: "false" }, { k: "caps", label: "Capitals", t: "bool", d: "false" }, { k: "spacing", label: "Letter spacing (em)", t: "num", hint: "0.05" },
  { k: "color", label: "Text colour", t: "color", d: "#e8e9f5" }, { k: "fill", label: "Box colour", t: "color", d: "#141833" },
  { k: "border", label: "Border colour", t: "color", d: "#2a3160" }, { k: "borderw", label: "Border width", t: "num", d: "0.25" },
  { k: "round", label: "Box rounding", t: "num", hint: "1.5" }, { k: "pad", label: "Padding", t: "num", hint: "1" },
  { k: "shadow", label: "Shadow", t: "select", opts: ["", "soft", "glow", "hard", "inset"] }, { k: "opacity", label: "Opacity (0 to 1)", t: "num", hint: "1" },
  { k: "align", label: "Text align", t: "select", opts: ["", "left", "center", "right"] },
  ...(LOOK_FIELDS.filter((f) => LOOK_EXTRA_KEYS.includes(f.k) && f.k !== "size") as Field[]),
];
const ANIM: Field[] = [{ k: "anim", label: "Change speed (s)", t: "num", d: "0.25" }, { k: "ease", label: "Easing", t: "select", opts: ["", "ease", "linear", "ease-in", "ease-out", "ease-in-out", "cubic-bezier(.34,1.56,.64,1)"] }];
const STEPS: Field[] = [
  { k: "names", label: "Step names", t: "text", hint: "swap=Exchange compare=Look" }, { k: "colors", label: "Step colours", t: "text", hint: "swap=#ff6188 compare=#f2b84b" },
];
const EXTRA: Partial<Record<TracePart | "all", Field[]>> = {
  title: STEPS.slice(0, 1),
  bars: [...STEPS, { k: "index", label: "Show positions 0, 1, 2…", t: "bool", d: "false" }, { k: "pointers", label: "Pointer names (i, j) on lit values", t: "bool", d: "false" }, { k: "pointer", label: "Pointer names", t: "text", hint: "i j k l" },
    { k: "cols", label: "Columns (grid)", t: "num", hint: "auto" }, { k: "prefix", label: "Before each value", t: "text", hint: "$" }, { k: "suffix", label: "After each value", t: "text", hint: "ms" }, ...ANIM],
  counts: STEPS,
  ops: [...STEPS, { k: "numbers", label: "Number the steps", t: "bool", d: "false" }, { k: "args", label: "Show positions after the name", t: "bool", d: "true" }],
  controls: [{ k: "back", label: "Back button text", t: "text", hint: "Back" }, { k: "play", label: "Play button text", t: "text", hint: "Play" }, { k: "pause", label: "Pause button text", t: "text", hint: "Pause" }, { k: "next", label: "Step button text", t: "text", hint: "Step" }],
  code: [{ k: "lines", label: "Line numbers", t: "bool", d: "true" }],
  all: STEPS.slice(0, 1),
};
for (const k of Object.keys(BASE_FIELDS) as (TracePart | "all")[]) {
  const have = new Set(BASE_FIELDS[k].map((f) => f.k));
  FIELDS_ALL[k] = [...BASE_FIELDS[k], ...(EXTRA[k] ?? []).filter((f) => !have.has(f.k)), ...(k === "all" ? [] : LOOK.filter((f) => !have.has(f.k)))];
}
export const FIELDS = FIELDS_ALL;
export { parseTraceDef };
