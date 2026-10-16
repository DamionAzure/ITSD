// Text formatting for the Source pane. Styling is stored in the .itsd file itself as an inline
// <span style="...">, which Markdown passes straight through, so the file stays plain text.

export interface Fmt {
  color?: string; bg?: string; family?: string; size?: string; weight?: string;
  italic?: boolean; underline?: boolean; strike?: boolean;
  spacing?: string;   // letter-spacing, in em
  lineHeight?: string; // unitless multiple
  casing?: "uppercase" | "lowercase" | "capitalize" | "small-caps";
  shadow?: keyof typeof SHADOWS;
  script?: "super" | "sub";            // raised / lowered, like x² and H₂O
  stroke?: string; strokeColor?: string; // outline round the letters: width in em, colour
  opacity?: string;                    // 0 to 1
  decoStyle?: "double" | "dotted" | "dashed" | "wavy"; decoColor?: string; // look of the underline / strikethrough
  wordSpacing?: string;                // in em
  chip?: boolean;                      // rounded box round the text (shows with a highlight colour)
  gradient?: keyof typeof GRADIENTS;   // colour fading across the text
  extra?: string; // declarations we don't edit, kept as they were
}

/** Text shadows the panel offers. Written out in full, so the deck doesn't depend on the panel to read them. */
export const SHADOWS = {
  soft: "0 .05em .15em rgba(0,0,0,.5)",
  glow: "0 0 .4em currentColor",
  hard: ".06em .06em 0 rgba(0,0,0,.6)",
  outline: "-.02em -.02em 0 #000,.02em -.02em 0 #000,-.02em .02em 0 #000,.02em .02em 0 #000",
} as const;
/** Gradient text the panel offers. Written out in full, like the shadows. */
export const GRADIENTS = {
  sunset: "linear-gradient(90deg,#ff7e5f,#feb47b)", ocean: "linear-gradient(90deg,#2193b0,#6dd5ed)", fire: "linear-gradient(90deg,#f12711,#f5af19)",
  mint: "linear-gradient(90deg,#11998e,#38ef7d)", violet: "linear-gradient(90deg,#8e2de2,#4a00e0)", rainbow: "linear-gradient(90deg,#ff5f6d,#ffc371,#47e1a8,#4facfe,#a770ef)",
} as const;
export const DECO_STYLES: { label: string; v: NonNullable<Fmt["decoStyle"]> | "" }[] = [
  { label: "Solid", v: "" }, { label: "Double", v: "double" }, { label: "Dotted", v: "dotted" }, { label: "Dashed", v: "dashed" }, { label: "Wavy", v: "wavy" },
];
const CHIP = { padding: ".05em .35em", "border-radius": ".3em", "box-decoration-break": "clone" } as const;
export const CASINGS: { label: string; v: Fmt["casing"] | "" }[] = [
  { label: "As typed", v: "" }, { label: "UPPERCASE", v: "uppercase" }, { label: "lowercase", v: "lowercase" }, { label: "Capitalize Words", v: "capitalize" }, { label: "Small caps", v: "small-caps" },
];
const squash = (v: string) => v.replace(/\s+/g, "").toLowerCase();

/** A font choice as stored in a deck (`serif`, `mono`, `Inter-Bold`, or a full CSS family list) -> a CSS font-family value. */
export function resolveFamily(v?: string): string | undefined {
  const t = v?.trim(); if (!t) return undefined;
  const k = FAMILIES.find((o) => o.label.toLowerCase() === t.toLowerCase());
  if (k) return k.css || undefined;
  if (/[,'"]/.test(t)) return t; // already a CSS family list
  return `"${t}", system-ui, sans-serif`; // a font name: an imported font file, or one installed on this computer
}

export const FAMILIES: { label: string; css: string }[] = [
  { label: "Default", css: "" },
  { label: "Serif", css: "Georgia, 'Times New Roman', serif" },
  { label: "Sans", css: "system-ui, 'Segoe UI', Helvetica, Arial, sans-serif" },
  { label: "Mono", css: "ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace" },
  { label: "Elegant", css: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif" },
  { label: "Display", css: "Impact, 'Arial Black', sans-serif" },
  { label: "Handwritten", css: "'Segoe Print', 'Comic Sans MS', cursive" },
];
export const WEIGHTS: { label: string; v: string }[] = [
  { label: "Default", v: "" }, { label: "Light", v: "300" }, { label: "Regular", v: "400" }, { label: "Medium", v: "500" },
  { label: "Semibold", v: "600" }, { label: "Bold", v: "700" }, { label: "Extra bold", v: "800" }, { label: "Black", v: "900" },
];
export const SWATCHES = ["#ffffff", "#f2b84b", "#7fd6a4", "#ff8a8a", "#6cb6ff", "#c9a0ff", "#ff9ecb", "#8e94b8"];

export const isEmpty = (f: Fmt) => !toStyle(f);

export function toStyle(f: Fmt): string {
  const d: string[] = [];
  if (f.color) d.push(`color:${f.color}`);
  if (f.bg) d.push(`background-color:${f.bg}`);
  if (f.family) d.push(`font-family:${f.family}`);
  if (f.size) d.push(`font-size:${f.size}em`);
  if (f.weight) d.push(`font-weight:${f.weight}`);
  if (f.italic) d.push("font-style:italic");
  if (f.underline || f.strike) d.push(`text-decoration:${[f.underline && "underline", f.strike && "line-through"].filter(Boolean).join(" ")}`);
  if (f.spacing) d.push(`letter-spacing:${f.spacing}em`);
  if (f.lineHeight) d.push(`line-height:${f.lineHeight}`);
  if (f.casing === "small-caps") d.push("font-variant:small-caps"); else if (f.casing) d.push(`text-transform:${f.casing}`);
  if (f.shadow) d.push(`text-shadow:${SHADOWS[f.shadow]}`);
  if ((f.underline || f.strike) && f.decoStyle) d.push(`text-decoration-style:${f.decoStyle}`);
  if ((f.underline || f.strike) && f.decoColor) d.push(`text-decoration-color:${f.decoColor}`);
  if (f.script) d.push(`vertical-align:${f.script}`);
  if (f.stroke) d.push(`-webkit-text-stroke:${f.stroke}em ${f.strokeColor || "#000000"}`);
  if (f.opacity) d.push(`opacity:${f.opacity}`);
  if (f.wordSpacing) d.push(`word-spacing:${f.wordSpacing}em`);
  if (f.chip) d.push(...Object.entries(CHIP).map(([k, v]) => `${k}:${v}`));
  if (f.gradient) d.push(`background-image:${GRADIENTS[f.gradient]}`, "-webkit-background-clip:text", "background-clip:text", "-webkit-text-fill-color:transparent");
  if (f.extra) d.push(f.extra);
  return d.join(";");
}

export function fromStyle(style: string): Fmt {
  const f: Fmt = {}; const extra: string[] = [];
  const held: { chip: [string, string][]; grad: string[] } = { chip: [], grad: [] }; // parts of a preset: kept only if the whole preset is there
  for (const raw of style.split(";")) {
    const i = raw.indexOf(":"); if (i < 0) continue;
    const k = raw.slice(0, i).trim().toLowerCase(), v = raw.slice(i + 1).trim();
    if (!v) continue;
    if (k === "color") f.color = v;
    else if (k === "background-color") f.bg = v;
    else if (k === "font-family") f.family = v;
    else if (k === "font-size" && /^[\d.]+em$/.test(v)) f.size = v.slice(0, -2);
    else if (k === "font-weight") f.weight = v === "bold" ? "700" : v;
    else if (k === "font-style" && v === "italic") f.italic = true;
    else if (k === "text-decoration" && /^(underline|line-through)( (underline|line-through))*$/.test(v)) { if (v.includes("underline")) f.underline = true; if (v.includes("line-through")) f.strike = true; }
    else if (k === "letter-spacing" && /^-?[\d.]+em$/.test(v)) f.spacing = v.slice(0, -2);
    else if (k === "line-height" && /^[\d.]+$/.test(v)) f.lineHeight = v;
    else if (k === "text-transform" && /^(uppercase|lowercase|capitalize)$/.test(v)) f.casing = v as Fmt["casing"];
    else if (k === "font-variant" && v === "small-caps") f.casing = "small-caps";
    else if (k === "text-shadow" && Object.entries(SHADOWS).some(([n, c]) => squash(c) === squash(v) && (f.shadow = n as keyof typeof SHADOWS))) { /* a known preset */ }
    else if (k === "vertical-align" && (v === "super" || v === "sub")) f.script = v;
    else if (k === "-webkit-text-stroke" && /^[\d.]+em\s+\S.*$/.test(v)) { const m = v.match(/^([\d.]+)em\s+(.+)$/)!; f.stroke = m[1]; f.strokeColor = m[2]; }
    else if (k === "opacity" && /^(0|1|0?\.\d+|1\.0+)$/.test(v)) f.opacity = v;
    else if (k === "text-decoration-style" && /^(double|dotted|dashed|wavy)$/.test(v)) f.decoStyle = v as Fmt["decoStyle"];
    else if (k === "text-decoration-color") f.decoColor = v;
    else if (k === "word-spacing" && /^-?[\d.]+em$/.test(v)) f.wordSpacing = v.slice(0, -2);
    else if ((k in CHIP) && CHIP[k as keyof typeof CHIP] === v) held.chip.push([k, v]);
    else if (k === "background-image" && Object.entries(GRADIENTS).some(([n, c]) => squash(c) === squash(v) && (f.gradient = n as keyof typeof GRADIENTS))) { /* a known gradient */ }
    else if ((k === "-webkit-background-clip" || k === "background-clip") && v === "text") held.grad.push(`${k}:${v}`);
    else if (k === "-webkit-text-fill-color" && v === "transparent") held.grad.push(`${k}:${v}`);
    else extra.push(`${k}:${v}`);
  }
  if (held.chip.length === Object.keys(CHIP).length) f.chip = true; else extra.push(...held.chip.map(([k, v]) => `${k}:${v}`));
  if (!f.gradient) extra.push(...held.grad); // the clip and transparent fill only mean something together with a gradient we know
  if (extra.length) f.extra = extra.join(";");
  return f;
}

/** A 1-based, end-exclusive column range on one line. `span` is set when it is an existing styled span. */
export interface Range { line: number; c1: number; c2: number; span?: { open: number; inner1: number; inner2: number; fmt: Fmt } }
export interface Sel { l1: number; c1: number; l2: number; c2: number } // 1-based, start <= end
export interface Plan { ranges: Range[]; fmt: Fmt; label: string; reason?: string }
export interface Edit { line: number; c1: number; endLine: number; c2: number; text: string }

const SPAN = /<span style="([^"]*)">([\s\S]*?)<\/span>/g;
const PREFIX = /^\s*(?:(?:#{1,6}|[-*+]|\d+[.)]|>)\s+(?:\[[ xX]\]\s+)?)*/;

/** Lines where formatting makes no sense: frontmatter, code fences, button bodies, directives, slide separators, comments. */
function skipMap(lines: string[], upto: number): boolean[] {
  const skip: boolean[] = []; let fence: string | null = null, btn = false, front = -1;
  if (lines[0]?.trim() === "---") { front = lines.findIndex((l, k) => k > 0 && l.trim() === "---"); }
  for (let i = 0; i <= upto && i < lines.length; i++) {
    const l = lines[i]; let s = false;
    if (i <= front) s = true;
    else {
      const f = l.match(/^\s*(`{3,}|~{3,})/);
      if (f) { fence = fence ? (f[1][0] === fence ? null : fence) : f[1][0]; s = true; }
      else if (fence) s = true;
      else if (btn) { s = true; if (/^:::\s*$/.test(l)) btn = false; }
      else if (/^:::/.test(l)) { s = true; if (/^:::\s*(button|flash)\b/.test(l)) btn = true; }
      else if (/^---\s*$/.test(l) || /^\s*<!--/.test(l) || !l.trim()) s = true;
    }
    skip.push(s);
  }
  return skip;
}

function spanAt(text: string, a: number, b: number): (NonNullable<Range["span"]> & { c1: number; c2: number }) | undefined {
  // a, b are 1-based columns of the selection start/end within `text` (b === a for a bare cursor)
  for (const m of text.matchAll(SPAN)) {
    const s = m.index!, e = s + m[0].length, open = m[0].length - m[2].length - "</span>".length;
    const i1 = s + open, i2 = i1 + m[2].length;
    const whole = a - 1 === s && b - 1 === e, inner = a - 1 === i1 && b - 1 === i2;
    const caret = a === b && a - 1 >= s && a - 1 <= e;
    if (whole || inner || caret) return { c1: s + 1, c2: e + 1, open, inner1: i1 + 1, inner2: i2 + 1, fmt: fromStyle(m[1]) };
  }
  return undefined;
}

/** Work out what a right-click at this selection would format, and the style it starts from. */
export function plan(lines: string[], sel: Sel): Plan {
  const skip = skipMap(lines, sel.l2 - 1);
  const ranges: Range[] = [];
  const one = sel.l1 === sel.l2;
  for (let n = sel.l1; n <= sel.l2; n++) {
    if (skip[n - 1]) continue;
    const text = lines[n - 1];
    let a = n === sel.l1 ? sel.c1 : 1, b = n === sel.l2 ? sel.c2 : text.length + 1;
    if (one) {
      const sp = spanAt(text, a, b);
      if (sp) { ranges.push({ line: n, c1: sp.c1, c2: sp.c2, span: sp }); continue; }
    }
    const pre = text.match(PREFIX)![0].length;
    if (a === b && one) { a = pre + 1; b = text.trimEnd().length + 1; } // bare cursor: the whole line, after its Markdown marker
    a = Math.max(a, pre + 1); b = Math.min(b, text.trimEnd().length + 1);
    if (b > a) ranges.push({ line: n, c1: a, c2: b });
  }
  const bare = sel.l1 === sel.l2 && sel.c1 === sel.c2;
  if (!ranges.length) return { ranges, fmt: {}, label: "", reason: "Nothing to format here. Styles apply to slide text, not to code blocks, buttons or settings." };
  const label = ranges[0].span ? "Existing style" : ranges.length > 1 ? `${ranges.length} lines` : bare ? "This line" : "Selection";
  return { ranges, fmt: ranges[0].span?.fmt ?? {}, label };
}

const unwrap = (t: string) => { let prev; do { prev = t; t = t.replace(SPAN, "$2"); } while (t !== prev); return t; };

/** Build the edits that apply `fmt` to every range. An empty `fmt` removes the styling. Edits are bottom-up safe. */
export function buildEdits(lines: string[], ranges: Range[], fmt: Fmt): Edit[] {
  const style = toStyle(fmt);
  const edits: Edit[] = [];
  for (const r of ranges) {
    const text = lines[r.line - 1];
    if (r.span) {
      const inner = text.slice(r.span.inner1 - 1, r.span.inner2 - 1);
      edits.push({ line: r.line, c1: r.c1, endLine: r.line, c2: r.c2, text: style ? `<span style="${style}">${inner}</span>` : inner });
    } else {
      const body = unwrap(text.slice(r.c1 - 1, r.c2 - 1));
      edits.push({ line: r.line, c1: r.c1, endLine: r.line, c2: r.c2, text: style ? `<span style="${style}">${body}</span>` : body });
    }
  }
  return edits;
}

/** Strip every <span style> from a string; used for outline titles. */
export const plainText = (t: string) => t.replace(/<[^>]+>/g, "");

// ---- block alignment ----------------------------------------------------------------------------------------
// Alignment is a line `<!-- @center -->` directly above a block (paragraph, heading, list, quote, static code, button,
// input, flash box). It is a Markdown comment, so the deck stays plain text and other Markdown tools ignore it.
export type Align = "left" | "center" | "right" | "justify";
export const ALIGNS: Align[] = ["left", "center", "right", "justify"];
export const ALIGN_LINE = /^\s*<!--\s*@(left|center|right|justify)\s*-->\s*$/;
const LAYOUT_MARK = /^\s*<!--\s*@\s*\w+=/; // a Visual-view placement marker: `<!-- @ x=10 y=20 -->`
/** Index (0-based) of the alignment line belonging to the block starting at 1-based line `s`, looking past a placement marker. */
function alignLineOf(lines: string[], s: number): number {
  let i = s - 2;
  while (i >= 0 && LAYOUT_MARK.test(lines[i])) i--;
  return i >= 0 && ALIGN_LINE.test(lines[i]) ? i : -1;
}
export interface AlignPlan { starts: number[]; current: Align | "" } // starts: 1-based first line of each block to align

type Kind = "skip" | "head" | "text" | "input" | "block" | "fence" | "runfence" | "directive";

function classify(lines: string[], upto: number): { kind: Kind; start: number }[] {
  const out: { kind: Kind; start: number }[] = [];
  let fence: { ch: string; start: number; run: boolean } | null = null, blk: { start: number; kind: Kind } | null = null, front = -1;
  if (lines[0]?.trim() === "---") front = lines.findIndex((l, k) => k > 0 && l.trim() === "---");
  for (let i = 0; i <= upto && i < lines.length; i++) {
    const l = lines[i]; let r: { kind: Kind; start: number } = { kind: "skip", start: i };
    const f = l.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (i <= front) r = { kind: "skip", start: i };
    else if (fence) {
      r = { kind: fence.run ? "runfence" : "fence", start: fence.start };
      if (f && f[1][0] === fence.ch) fence = null;
    } else if (f) {
      fence = { ch: f[1][0], start: i, run: /\brun\b/.test(f[2]) };
      r = { kind: fence.run ? "runfence" : "fence", start: i };
    } else if (blk) { r = { kind: blk.kind, start: blk.start }; if (/^:::\s*$/.test(l)) blk = null; }
    else if (/^:::\s*(button|flash)\b/.test(l)) {
      // a flash box placed with x= and y= is absolutely positioned, so alignment doesn't apply to it
      const abs = /^:::\s*flash\b/.test(l) && /\bx=/.test(l) && /\by=/.test(l);
      blk = { start: i, kind: abs ? "skip" : "block" }; r = { kind: blk.kind, start: i };
    }
    else if (/^:::\s*input\b/.test(l)) r = { kind: "input", start: i };
    else if (ALIGN_LINE.test(l)) r = { kind: "directive", start: i };
    else if (!l.trim() || /^---\s*$/.test(l) || /^\s*<!--/.test(l) || /^:::/.test(l)) r = { kind: "skip", start: i };
    else if (/^\s{0,3}#{1,6}\s/.test(l)) r = { kind: "head", start: i };
    else { let s = i; while (s > 0 && out[s - 1]?.kind === "text") s--; r = { kind: "text", start: s }; }
    out.push(r);
  }
  return out;
}

/** The blocks a right-click at this selection would align, and the alignment of the first. */
export function planAlign(lines: string[], sel: Sel): AlignPlan {
  const ks = classify(lines, sel.l2); // one extra line, so a cursor on a directive can find the block below it
  const starts = new Set<number>();
  for (let n = sel.l1 - 1; n <= sel.l2 - 1 && n < lines.length; n++) {
    let k = ks[n]; if (!k) continue;
    if (k.kind === "directive") { const nx = classify(lines, n + 1)[n + 1]; if (!nx) continue; k = nx; }
    if (k.kind === "skip" || k.kind === "runfence" || k.kind === "directive") continue;
    starts.add(k.start + 1);
  }
  const list = [...starts].sort((a, b) => a - b);
  const at = list.length ? alignLineOf(lines, list[0]) : -1;
  return { starts: list, current: at >= 0 ? (lines[at].match(ALIGN_LINE)![1] as Align) : "" };
}

/** Edits that set the alignment of each block, or clear it with "". */
export function alignEdits(lines: string[], starts: number[], a: Align | ""): Edit[] {
  const out: Edit[] = [];
  for (const s of starts) {
    const at = alignLineOf(lines, s); // 0-based
    if (at >= 0) out.push(a
      ? { line: at + 1, c1: 1, endLine: at + 1, c2: lines[at].length + 1, text: `<!-- @${a} -->` }
      : { line: at + 1, c1: 1, endLine: at + 2, c2: 1, text: "" });
    else if (a) out.push({ line: s, c1: 1, endLine: s, c2: 1, text: `<!-- @${a} -->\n` });
  }
  return out;
}
