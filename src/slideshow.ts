// Media transitioning: a block that shows pictures one after another.
//
//   ::: slideshow "assets/a.jpg" "assets/b.jpg" "assets/c.jpg" mode=loop every=3 effect=fade fade=0.8 fit=cover id=gallery
//
// One line, no closing `:::`. Pictures are the quoted (or bare) file names; `images="a.jpg, b.jpg"` also works.
//   mode=loop       pic 1, then 2, then 3, then back to 1 (default)
//   mode=random     a random picture each time, never the one already showing
//   mode=staggered  several frames (cells=3) showing different pictures; one frame changes every `every` seconds, left to right, forever
//   mode=once       plays through and stops on the last picture
//   every=3         seconds between changes (staggered: between one frame's change and the next one's)
//   effect=fade     fade, slide, slideup, zoom, blur, flip, wipe, iris, none, or random (a different one each change)
//   fade=0.8        seconds a change takes
//   fit=cover       cover (fill the frame) or contain (show it all)
//   cells=3 cols=3 gap=1   staggered layout: how many frames, how many columns, space between (slide units)
//   shuffle         start in a random order      paused  don't start until a button runs `start <id>`
// A `start id` / `stop id` button action plays and pauses it. A look line above it (`<!-- @look polaroid -->`) styles the frame.
import { IMG_EXT } from "./assets";
import { slideRange } from "./images";

export type ShowMode = "loop" | "random" | "staggered" | "once";
export const SHOW_EFFECTS = ["fade", "slide", "slideup", "zoom", "blur", "flip", "wipe", "iris", "none", "random"] as const;
export const SHOW_MODES: ShowMode[] = ["loop", "random", "staggered", "once"];
export interface ShowDef {
  srcs: string[]; mode: ShowMode; every: number; fade: number; effect: string; fit: "cover" | "contain"; cells: number; cols: number; gap: number;
  autoplay: boolean; shuffle: boolean; id?: string; ratio?: string; attrs: Record<string, string>;
}
export const SHOW_LINE = /^:::\s*slideshow\s+(.*)$/;
const isPic = (s: string) => IMG_EXT.includes((s.split(".").pop() ?? "").toLowerCase());

export function parseShow(rest: string): ShowDef | null {
  const srcs: string[] = [], a: Record<string, string> = {}, flags = new Set<string>();
  for (const m of rest.matchAll(/"([^"]*)"|([\w-]+)=("[^"]*"|\S+)|(\S+)/g)) {
    if (m[2]) a[m[2]] = m[3].replace(/^"|"$/g, "");
    else { const t = m[1] ?? m[4]; if (isPic(t)) srcs.push(t); else if (m[4]) flags.add(m[4]); }
  }
  if (a.images) srcs.push(...a.images.split(",").map((s) => s.trim()).filter(Boolean));
  delete a.images;
  const num = (k: string, d: number) => { const n = parseFloat(a[k]); return Number.isFinite(n) ? n : d; };
  const mode = ((a.mode ?? "loop").replace(/-?loop$/, "") === "staggered" ? "staggered" : a.mode) as ShowMode;
  const m: ShowMode = SHOW_MODES.includes(mode) ? mode : "loop";
  const cells = Math.max(1, Math.min(9, Math.round(num("cells", 3))));
  const on = (k: string, d: boolean) => (a[k] !== undefined ? !["false", "0", "off", "no"].includes(a[k]) : flags.has(k) ? true : d);
  return {
    srcs, mode: m, every: Math.max(0.2, num("every", m === "staggered" ? 1.2 : 3)), fade: Math.max(0, num("fade", 0.8)),
    effect: (SHOW_EFFECTS as readonly string[]).includes(a.effect) ? a.effect : "fade", fit: a.fit === "contain" ? "contain" : "cover",
    cells, cols: Math.max(1, Math.round(num("cols", cells > 4 ? Math.ceil(Math.sqrt(cells)) : cells))), gap: Math.max(0, num("gap", 1)),
    autoplay: on("autoplay", true) && !flags.has("paused"), shuffle: on("shuffle", false), id: a.id, ratio: a.ratio, attrs: a,
  };
}
const q = (s: string) => (/\s/.test(s) ? `"${s}"` : `"${s}"`);
/** One slideshow line from its pictures and options (a null/"" option is left out). */
export function showLine(srcs: string[], attrs: Record<string, string | null | undefined>): string {
  const kv = Object.entries(attrs).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (v === "true" && ["shuffle", "paused"].includes(k) ? k : `${k}=${/\s/.test(String(v)) ? `"${v}"` : v}`));
  return `::: slideshow ${srcs.map(q).join(" ")}${kv.length ? " " + kv.join(" ") : ""}`;
}
/** Change the slideshow on line `line` of slide `id`: new options (null removes one) and/or a new list of pictures. */
export function patchShow(text: string, id: number, line: number, patch: Record<string, string | null>, srcs?: string[]): string {
  const r = slideRange(text, id); if (!r) return text;
  const at = r.start + line, m = r.lines[at]?.match(SHOW_LINE), def = m && parseShow(m[1]); if (!def) return text;
  const attrs: Record<string, string | null> = { ...def.attrs };
  if (def.shuffle && attrs.shuffle === undefined) attrs.shuffle = "true";
  if (!def.autoplay && attrs.autoplay === undefined && attrs.paused === undefined) attrs.paused = "true";
  for (const [k, v] of Object.entries(patch)) attrs[k] = v;
  r.lines[at] = showLine(srcs ?? def.srcs, attrs);
  return r.lines.join("\n");
}
export function newShow(srcs: string[]): string { return showLine(srcs, { mode: "loop", every: "3", effect: "fade" }) + "\n\n"; }
