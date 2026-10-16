// Look-and-feel options shared by every trace part (font, colours, border, shadow...), and the per-step names and colours.
// All of them are plain attributes on the part's line, e.g. `::: trace-bars from=sort font="Space Grotesk" fill=#101530 border=#3a4a8a round=2 shadow=glow`.
import type { CSSProperties } from "react";

const pos = (v: string | undefined, d: number) => { const n = parseFloat(v ?? ""); return Number.isFinite(n) && n >= 0 ? n : d; };
const U = (n: number) => `calc(var(--u) * ${n})`;
const family = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (/\s/.test(s) && !/^["']/.test(s) ? `"${s}"` : s)).join(", ");
const flag = (v: string | undefined) => v !== undefined && !["false", "0", "off", "no"].includes(v);

export const SHADOWS: Record<string, string> = {
  soft: `0 ${U(.6)} ${U(2)} rgba(0,0,0,.35)`, glow: `0 0 ${U(2.4)} var(--hot, var(--accent))`, hard: `${U(.6)} ${U(.6)} 0 rgba(0,0,0,.55)`, inset: `inset 0 0 ${U(2)} rgba(0,0,0,.45)`,
};
export const EASES = ["ease", "linear", "ease-in", "ease-out", "ease-in-out", "cubic-bezier(.34,1.56,.64,1)"];

/** The CSS for a part's own box and text: its look, not its data. */
export function boxStyle(a: Record<string, string>): CSSProperties {
  const s: Record<string, string | number> = {};
  if (a.font) s.fontFamily = family(a.font);
  if (a.weight) s.fontWeight = a.weight;
  if (flag(a.italic)) s.fontStyle = "italic";
  if (flag(a.caps)) s.textTransform = "uppercase";
  if (a.spacing) s.letterSpacing = `${pos(a.spacing, 0)}em`;
  if (a.color) s.color = a.color;
  if (a.fill) s.background = a.fill;
  if (a.border || a.borderw) { s.border = `${U(pos(a.borderw, .25))} solid ${a.border || "var(--line)"}`; s.boxSizing = "border-box"; }
  if (a.round) s.borderRadius = U(pos(a.round, 0));
  if (a.pad) { s.padding = U(pos(a.pad, 0)); s.boxSizing = "border-box"; }
  if (a.shadow && SHADOWS[a.shadow]) s.boxShadow = SHADOWS[a.shadow];
  if (a.opacity) s.opacity = Math.min(1, pos(a.opacity, 1));
  if (a.align && /^(left|center|right)$/.test(a.align)) s.textAlign = a.align;
  if (a.anim) s["--anim"] = `${pos(a.anim, .25)}s`;
  if (a.ease) s["--ease"] = a.ease;
  return s as CSSProperties;
}

/** `compare=Look swap=Exchange` (or comma separated) -> a lookup. */
export function pairs(v: string | undefined): Record<string, string> {
  const o: Record<string, string> = {};
  for (const m of (v ?? "").matchAll(/([\w-]+)\s*=\s*("[^"]*"|[^,\s]+)/g)) o[m[1]] = m[2].replace(/^"|"$/g, "");
  return o;
}
/** The name shown for a step kind: `names="swap=Exchange compare=Look"`, or `name-swap=Exchange`. */
export const opName = (a: Record<string, string>, op: string) => a[`name-${op}`] ?? pairs(a.names)[op] ?? op;
/** The colour for a step kind: `colors="swap=#f2b84b"`, or `color-swap=#f2b84b` (bars use `selected-<op>` too). */
export const opColor = (a: Record<string, string>, op: string): string | undefined => a[`color-${op}`] ?? pairs(a.colors)[op] ?? a[`selected-${op}`];
/** How a value is written on a bar or node: `prefix=$ suffix=ms`. */
export const fmtVal = (a: Record<string, string>, n: number) => `${a.prefix ?? ""}${n}${a.suffix ?? ""}`;
