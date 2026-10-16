// The trace is a set of separate slide elements that share one playback state, so each can be placed, resized, rotated, layered and styled on its own:
//
//   ::: trace-bars from=sort bar=#4466ff labels=false     the bars          ::: trace-code from=sort size=1.2   the run's code, current line lit
//   ::: trace-ops from=sort                               the operation list  ::: trace-controls from=sort speed=2 sound="swap:pop"
//   ::: trace-counts from=sort                            running counts      ::: trace-title from=sort title="Sorting" steps=false
//
// and `::: trace from=sort` is the whole thing in one block (Visual view: right-click > Split into parts turns it into the separate ones).
import type { TraceData } from "./ctx";
import { slideRange } from "./images";
import { parseInfo } from "./itsd";
import { insertSlide } from "./edit";
import { addBranchLines } from "./slideOps";
import { partsLines, DEFAULT_RECT } from "./traceEdit";
import { formatMark } from "./layout";

export const TRACE_PARTS = ["title", "bars", "code", "ops", "controls", "counts"] as const;
export type TracePart = (typeof TRACE_PARTS)[number];
export interface TraceDef { part: TracePart | ""; from: string; title: string; sound: string; vol: string; pitch: string; attrs: Record<string, string> }
export function parseTraceDef(rest: string, part: TracePart | "" = ""): TraceDef {
  const a: Record<string, string> = {};
  rest.replace(/([\w-]+)=("([^"]*)"|\S+)/g, (_, k, v, q) => { a[k] = q ?? v; return ""; });
  return { part, from: a.from ?? "", title: a.title ?? "Trace", sound: a.sound ?? "", vol: a.vol ?? "", pitch: a.pitch ?? "", attrs: a };
}
/** `::: trace ...` (whole) or `::: trace-bars ...` (a part). Group 1 = the part, 2 = the options. */
export const TRACE_LINE = /^:::\s*trace(?:-(title|bars|code|ops|controls|counts))?(?:\s+(.*))?$/;
export const traceOf = (m: RegExpMatchArray) => parseTraceDef(m[2] ?? "", (m[1] ?? "") as TracePart | "");

/** Every trace block of a slide's source (whole or part; fence-aware, so manual pages can show examples). */
export function scanTraces(src: string): { line: number; def: TraceDef }[] {
  const out: { line: number; def: TraceDef }[] = []; let fence: string | null = null;
  src.split("\n").forEach((l, i) => {
    const f = l.match(/^\s*(`{3,}|~{3,})/);
    if (f) { fence = fence ? (f[1][0] === fence ? null : fence) : f[1][0]; return; }
    const m = !fence && l.match(TRACE_LINE);
    if (m) out.push({ line: i, def: traceOf(m) });
  });
  return out;
}

export const SAMPLE_TRACE: TraceData = {
  lang: "text", code: "// sample: run the block this trace reads from\nfor i in 1..n:\n  compare(a[i-1], a[i])\n  swap if out of order",
  frames: [
    { op: "start", a: [5, 2, 4, 1] },
    { op: "compare", a: [5, 2, 4, 1], hl: [0, 1], line: 3 },
    { op: "swap", a: [2, 5, 4, 1], hl: [0, 1], line: 4 },
    { op: "compare", a: [2, 5, 4, 1], hl: [1, 2], line: 3 },
    { op: "swap", a: [2, 4, 5, 1], hl: [1, 2], line: 4 },
    { op: "done", a: [1, 2, 4, 5], sorted: 4 },
  ],
};

/** The id of the slide that holds the run block `id=name` (the trace's home), or -1. */
export function homeOf(slides: { src: string; id: number }[], name: string): number {
  const re = new RegExp("^\\s*(?:`{3,}|~{3,})[^\\n]*\\bid=" + name.replace(/[^\w]/g, "\\$&") + "(?:\\s|$)", "m");
  return slides.find((s) => re.test(s.src))?.id ?? -1;
}

/** Make a real slide of separate trace parts for the run block `name`. If that run block has no id yet (`name` empty), the first unnamed run block on the slide gets one.
 *  `mode` "branch" (default) hangs it off `srcId` as a branch slide (own Back button; `button` puts a "Show trace" button on the slide that ran), "next" puts it right after.
 *  Returns the new text, the id used and the index of the new slide. */
export function makeTraceSlide(text: string, srcId: number, name: string, taken: Set<string>, mode: "branch" | "next" = "next", button = true): { text: string; name: string; at: number } {
  if (!name) {
    const r = slideRange(text, srcId);
    if (r) {
      let id = "trace", n = 1; while (taken.has(id)) id = `trace${++n}`;
      for (let i = r.start; i < r.end; i++) {
        const m = r.lines[i].match(/^(\s*(?:`{3,}|~{3,}))(.+)$/);
        if (m && parseInfo(m[2]).flags.has("run") && !parseInfo(m[2]).attrs.id) { r.lines[i] = `${r.lines[i].trimEnd()} id=${id}`; name = id; break; }
      }
      if (name) text = r.lines.join("\n");
    }
  }
  const def = parseTraceDef(`from=${name}`);
  if (mode === "next") return { text: insertSlide(text, srcId, ["", ...partsLines(DEFAULT_RECT, def), ""]), name, at: srcId + 1 };
  // A branch slide leaves a strip along the bottom for its Back button.
  const lines = [...partsLines({ ...DEFAULT_RECT, h: 78 }, def), "", formatMark({ x: 4, y: 88, w: 14, h: 8 }), `::: button "Return"`, "back", ":::"];
  const r = addBranchLines(text, srcId, lines, button ? "Show trace" : undefined);
  return { text: r.text, name, at: r.at };
}
