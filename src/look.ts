// Looks: the styling any block can carry. One line above the block, like an alignment line:
//
//   <!-- @look neon font="Space Grotesk" round=2 pad=1.5 -->
//   ## A heading
//
// A bare word is a preset (card, glass, neon, ...); everything after it overrides the preset. Works on text, code, buttons, input boxes,
// pictures, video, slideshows, effects and trace parts. Trace parts keep taking the same keys straight on their own `:::` line.
import type { CSSProperties } from "react";
import { boxStyle, SHADOWS } from "./traceStyle";
import { slideRange } from "./images";

export type LookAttrs = Record<string, string>;
export const LOOK_LINE = /^\s*<!--\s*@look\b\s*(.*?)\s*-->\s*$/;
const DIRECTIVE = /^\s*<!--\s*(?:@|if:)/;

const pos = (v: string | undefined, d: number) => { const n = parseFloat(v ?? ""); return Number.isFinite(n) && n >= 0 ? n : d; };
const U = (n: number) => `calc(var(--u) * ${n})`;

/** Ready-made looks. Each is just attributes, so a preset can be tweaked: `neon round=3`. */
export const PRESETS: Record<string, LookAttrs> = {
  card: { fill: "#161a33", border: "#2a3160", round: "1.2", pad: "1.6", shadow: "soft" },
  glass: { fill: "rgba(255,255,255,.08)", border: "rgba(255,255,255,.28)", round: "1.4", pad: "1.6", blur: "1.6", shadow: "soft" },
  neon: { fill: "#06101a", color: "#e9fdff", border: "#7cf0ff", borderw: ".2", round: "1", pad: "1.4", glow: "#7cf0ff" },
  outline: { border: "#e8e9f5", borderw: ".2", round: ".8", pad: "1.2" },
  paper: { fill: "#f4efe4", color: "#2b2418", font: "Georgia, serif", round: ".4", pad: "1.8", shadow: "hard" },
  terminal: { fill: "#05100a", color: "#52f08a", font: "JetBrains Mono, monospace", border: "#1f5a36", round: ".6", pad: "1.4" },
  soft: { round: "1.6", shadow: "soft", pad: "1" },
  ghost: { opacity: ".6" },
  pill: { fill: "#6a7cff", color: "#ffffff", weight: "600", round: "99", pad: ".8", hover: "lift" },
  gradient: { gradient: "#6a7cff,#c06bff,135", color: "#ffffff", round: "1.2", pad: "1.4" },
  frame: { border: "#e8e9f5", borderw: ".5", pad: ".8", round: ".2", fill: "#10132a" },
  polaroid: { fill: "#fafafa", pad: "1", round: ".2", shadow: "soft" },
  label: { caps: "true", spacing: ".12", weight: "600", size: ".8", color: "#9aa3d8" },
  headline: { weight: "800", spacing: "-.02", line: "1.05", textgradient: "#ffd36b,#ff6b9d,90" },
  circle: { clip: "circle", border: "#e8e9f5", borderw: ".3" },
  mono: { font: "JetBrains Mono, monospace", color: "#d6dbea" },
};
export const PRESET_NAMES = Object.keys(PRESETS);

/** Everything the Inspector offers (the trace's own Look fields are these plus the trace-only ones). */
export interface LookField { k: string; label: string; t: "text" | "num" | "bool" | "color" | "select"; d?: string; hint?: string; opts?: string[] }
export const LOOK_FIELDS: LookField[] = [
  { k: "look", label: "Preset", t: "select", opts: ["", ...PRESET_NAMES] },
  { k: "font", label: "Font", t: "text", hint: "Space Grotesk" }, { k: "size", label: "Text size ×", t: "num", hint: "1" }, { k: "weight", label: "Weight", t: "select", opts: ["", "300", "400", "500", "600", "700", "800", "900"] },
  { k: "italic", label: "Italic", t: "bool", d: "false" }, { k: "caps", label: "Capitals", t: "bool", d: "false" }, { k: "spacing", label: "Letter spacing (em)", t: "num", hint: "0.05" }, { k: "line", label: "Line height", t: "num", hint: "1.5" },
  { k: "color", label: "Text colour", t: "color", d: "#e8e9f5" }, { k: "textgradient", label: "Text gradient", t: "text", hint: "#ffd36b,#ff6b9d,90" },
  { k: "stroke", label: "Text outline colour", t: "color", d: "#000000" }, { k: "textshadow", label: "Text shadow", t: "select", opts: ["", "soft", "glow", "hard"] },
  { k: "fill", label: "Box colour", t: "color", d: "#141833" }, { k: "gradient", label: "Box gradient", t: "text", hint: "#6a7cff,#c06bff,135" },
  { k: "border", label: "Border colour", t: "color", d: "#2a3160" }, { k: "borderw", label: "Border width", t: "num", d: "0.25" },
  { k: "round", label: "Box rounding", t: "num", hint: "1.5" }, { k: "pad", label: "Padding", t: "num", hint: "1" },
  { k: "shadow", label: "Shadow", t: "select", opts: ["", "soft", "glow", "hard", "inset"] }, { k: "glow", label: "Glow colour", t: "color", d: "#7cf0ff" },
  { k: "blur", label: "Glass blur", t: "num", hint: "1.6" }, { k: "opacity", label: "Opacity (0 to 1)", t: "num", hint: "1" },
  { k: "clip", label: "Shape", t: "select", opts: ["", "circle", "ellipse", "diamond", "hex", "triangle"] }, { k: "fit", label: "Picture fit", t: "select", opts: ["", "contain", "cover", "fill"] },
  { k: "gray", label: "Grayscale (0 to 1)", t: "num", hint: "1" }, { k: "sepia", label: "Sepia (0 to 1)", t: "num", hint: "0.6" }, { k: "bright", label: "Brightness ×", t: "num", hint: "1.2" },
  { k: "contrast", label: "Contrast ×", t: "num", hint: "1.1" }, { k: "saturate", label: "Saturation ×", t: "num", hint: "1.3" }, { k: "hue", label: "Hue turn (deg)", t: "num", hint: "40" }, { k: "soften", label: "Soften (blur)", t: "num", hint: "0.4" },
  { k: "hover", label: "On hover", t: "select", opts: ["", "lift", "grow", "glow"] },
  { k: "align", label: "Text align", t: "select", opts: ["", "left", "center", "right"] }, { k: "class", label: "CSS class", t: "text", hint: "fancy (for your stylesheet)" },
];
/** The keys the trace's Inspector didn't have before this file. */
export const LOOK_EXTRA_KEYS = ["size", "line", "textgradient", "stroke", "textshadow", "gradient", "glow", "blur", "clip", "gray", "sepia", "bright", "contrast", "saturate", "hue", "soften", "hover"];

const CLIPS: Record<string, string> = {
  circle: "circle(50% at 50% 50%)", ellipse: "ellipse(50% 50% at 50% 50%)", diamond: "polygon(50% 0,100% 50%,50% 100%,0 50%)",
  hex: "polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)", triangle: "polygon(50% 0,100% 100%,0 100%)",
};
const TEXT_SHADOWS: Record<string, string> = { soft: `0 ${U(.2)} ${U(.8)} rgba(0,0,0,.5)`, glow: `0 0 ${U(1.2)} currentColor`, hard: `${U(.25)} ${U(.25)} 0 rgba(0,0,0,.6)` };
const flag = (v: string | undefined) => v !== undefined && !["false", "0", "off", "no"].includes(v);

/** `#a,#b,135` -> `linear-gradient(135deg, #a, #b)` (a trailing number is the angle). */
function gradientOf(v: string): string {
  const parts = v.split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
  let ang = 135; if (parts.length > 2 && /^-?\d+(\.\d+)?$/.test(parts[parts.length - 1])) ang = parseFloat(parts.pop()!);
  return `linear-gradient(${ang}deg, ${parts.join(", ")})`;
}

/** Resolve a preset, then the line's own values on top. */
export function withPreset(a: LookAttrs): LookAttrs { const p = a.look && PRESETS[a.look]; return p ? { ...p, ...a } : a; }

/** The CSS for a block's look. Works in slide units (--u), so it scales with the slide. */
export function lookStyle(raw: LookAttrs | undefined, o: { size?: boolean } = {}): CSSProperties {
  if (!raw) return {};
  const a = withPreset(raw);
  const s: Record<string, string | number> = { ...(boxStyle(a) as Record<string, string | number>) };
  if (a.size && o.size !== false) s.fontSize = `${pos(a.size, 1)}em`;
  if (a.line) s.lineHeight = pos(a.line, 1.5);
  if (a.gradient) s.background = gradientOf(a.gradient);
  if (a.textgradient) { s.backgroundImage = gradientOf(a.textgradient); s.WebkitBackgroundClip = "text"; s.backgroundClip = "text"; s.color = "transparent"; s.WebkitTextFillColor = "transparent"; }
  if (a.stroke) s.WebkitTextStroke = `${U(pos(a.strokew, .12))} ${a.stroke}`;
  if (a.textshadow && TEXT_SHADOWS[a.textshadow]) s.textShadow = TEXT_SHADOWS[a.textshadow];
  const shadows: string[] = [];
  if (a.shadow && SHADOWS[a.shadow]) shadows.push(SHADOWS[a.shadow]);
  if (a.glow) shadows.push(`0 0 ${U(2.4)} ${a.glow}`);
  if (shadows.length) s.boxShadow = shadows.join(", ");
  if (a.outline) { s.outline = `${U(pos(a.outlinew, .25))} solid ${a.outline}`; s.outlineOffset = U(.4); }
  if (a.blur) { s.backdropFilter = `blur(${U(pos(a.blur, 1))})`; (s as any).WebkitBackdropFilter = s.backdropFilter; }
  if (a.clip && CLIPS[a.clip]) { s.clipPath = CLIPS[a.clip]; s.overflow = "hidden"; }
  if (a.round) s.overflow = "hidden";
  const f: string[] = [];
  if (a.gray) f.push(`grayscale(${pos(a.gray, 1)})`); if (a.sepia) f.push(`sepia(${pos(a.sepia, 1)})`);
  if (a.bright) f.push(`brightness(${pos(a.bright, 1)})`); if (a.contrast) f.push(`contrast(${pos(a.contrast, 1)})`);
  if (a.saturate) f.push(`saturate(${pos(a.saturate, 1)})`); if (a.hue) f.push(`hue-rotate(${parseFloat(a.hue) || 0}deg)`);
  if (a.soften) f.push(`blur(${U(pos(a.soften, 0))})`);
  if (f.length) s.filter = f.join(" ");
  return s as CSSProperties;
}

/** Class names a look adds: hooks for the stylesheet (`lk-box` removes the inner panel's own colours, `lk-cover` sets picture fit, ...). */
export function lookClass(raw: LookAttrs | undefined): string {
  if (!raw) return "";
  const a = withPreset(raw), c = ["lk"];
  if (a.fill || a.gradient || a.border || a.round || a.shadow || a.glow || a.blur || a.clip) c.push("lk-box");
  if (a.fit && /^(contain|cover|fill)$/.test(a.fit)) c.push(`lk-fit-${a.fit}`);
  if (a.hover && /^(lift|grow|glow)$/.test(a.hover)) c.push(`lk-h-${a.hover}`);
  if (a.class) c.push(...a.class.split(/\s+/).filter((x) => /^[\w-]+$/.test(x)));
  return c.join(" ");
}

// ---- reading and writing the `<!-- @look ... -->` line ----

export function parseLook(line: string): LookAttrs | null {
  const m = line.match(LOOK_LINE); if (!m) return null;
  const a: LookAttrs = {}; let rest = m[1];
  rest = rest.replace(/([\w-]+)=("([^"]*)"|\S+)/g, (_, k, v, q) => { a[k] = q ?? v; return " "; });
  const bare = rest.trim().split(/\s+/).filter(Boolean)[0];
  if (bare && !a.look && PRESETS[bare]) a.look = bare;
  return a;
}
export function formatLook(a: LookAttrs): string {
  const keys = Object.keys(a).filter((k) => a[k] !== "" && a[k] !== undefined);
  if (!keys.length) return "";
  const first = a.look ? [a.look] : [];
  const rest = keys.filter((k) => k !== "look").map((k) => `${k}=${/[\s"]/.test(a[k]) ? `"${a[k].replace(/"/g, "'")}"` : a[k]}`);
  return `<!-- @look ${[...first, ...rest].join(" ")} -->`;
}
/** First line of the block's header (position / alignment / @on / if / @look lines stacked above it), 0-based within `lines`. */
function headerTop(lines: string[], line: number): number { let t = line; while (t > 0 && DIRECTIVE.test(lines[t - 1])) t--; return t; }
/** The look above the block that starts at `line` of a slide's source, and where its line is. */
export function lookIn(src: string, line: number): { attrs: LookAttrs; at?: number } {
  const lines = src.split("\n");
  for (let i = headerTop(lines, line); i < line; i++) { const a = parseLook(lines[i]); if (a) return { attrs: a, at: i }; }
  return { attrs: {} };
}
/** Change some look options of the block at `line` of slide `id` (null/"" removes one). Removing the last one removes the line. */
export function patchLook(text: string, id: number, line: number, patch: Record<string, string | null>): string {
  const r = slideRange(text, id); if (!r) return text;
  const abs = r.start + line, cur = lookIn(r.lines.slice(r.start, r.end + 1).join("\n"), line);
  const next: LookAttrs = { ...cur.attrs };
  for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") delete next[k]; else next[k] = v; }
  const out = formatLook(next);
  if (cur.at !== undefined) { if (out) r.lines[r.start + cur.at] = out; else r.lines.splice(r.start + cur.at, 1); }
  else if (out) r.lines.splice(headerTop(r.lines, abs), 0, out);
  return r.lines.join("\n");
}
/** Replace a block's whole look with a preset (keeps nothing else), or clear it. */
export function setLookPreset(text: string, id: number, line: number, preset: string): string {
  const r = slideRange(text, id); if (!r) return text;
  const cur = lookIn(r.lines.slice(r.start, r.end + 1).join("\n"), line);
  const patch: Record<string, string | null> = {}; for (const k of Object.keys(cur.attrs)) patch[k] = null;
  if (preset) patch.look = preset;
  return patchLook(text, id, line, patch);
}
