// Beautifier for the .itsd FILE (the Markdown-plus-:::-blocks document), as opposed to beautify.ts, which formats the code inside a code block.
//
// It only tidies; it never reflows, reorders or rewrites what you wrote:
//  - line endings, trailing spaces (a Markdown hard break, exactly two spaces before more text, is kept), and runs of blank lines;
//  - frontmatter lines (`key: value`), and `---` slide separators (one blank line either side);
//  - `::: kind attributes` lines (one space after `:::`, single spaces between attributes, quoted text untouched) and closing `:::` lines;
//  - one-line `<!-- key: value; key: value -->` slide options and `<!-- if: ... -->`, and `#   Heading` spacing.
// It never ADDS a blank line inside a slide: a placement marker (`<!-- @... -->`) belongs to the line right below it, and adding one would detach it.
// Fenced code, and the bodies of `::: script`, are copied exactly. Every result is checked: the deck is parsed again and must have the same slides,
// options and settings (whitespace aside), otherwise nothing is changed and `safe` is false.
import { parseDeck, parseOpts } from "./itsd";

export interface Beautified { text: string; changed: boolean; safe: boolean; summary: string; counts: Record<string, number> }

const FENCE = /^\s*(`{3,}|~{3,})/;
const SEP = /^---\s*$/;
const KEYED = /^[\w-]+\s*:\s*\S/;

/** Collapse runs of spaces outside double quotes, and trim: `text="a  b"   size=2` -> `text="a  b" size=2`. */
export function tidyAttrs(rest: string): string {
  let out = "", q = false, sp = false;
  for (const c of rest.trim()) {
    if (c === '"') q = !q;
    if (!q && /\s/.test(c)) { sp = true; continue; }
    if (sp && out) out += " ";
    sp = false; out += c;
  }
  return out;
}

/** `<!--branch:1;transition:zoom-->` -> `<!-- branch: 1; transition: zoom -->`. Placement markers and action comments (`<!-- @... -->`) are left alone. */
export function tidyComment(line: string): string {
  const m = line.match(/^(\s*)<!--([\s\S]*?)-->\s*$/);
  if (!m || /^\s*@/.test(m[2]) || m[2].includes("-->")) return line;
  const inner = m[2].trim();
  if (!inner) return line;
  const segs = inner.split(";").map((s) => s.trim()).filter(Boolean);
  const keyed = segs.length > 0 && segs.every((s) => /^[\w-]+\s*:/.test(s)) && !/^if\s*:/.test(inner);
  if (keyed) return `${m[1]}<!-- ${segs.map((s) => { const [k, ...v] = s.split(":"); return `${k.trim()}: ${v.join(":").trim()}`; }).join("; ")} -->`;
  return `${m[1]}<!-- ${/^if\s*:/.test(inner) ? inner.replace(/^if\s*:\s*/, "if: ") : inner} -->`;
}

function run(text: string, only?: [number, number]): { out: string[]; counts: Record<string, number> } {
  const src = text.replace(/\r\n?/g, "\n").split("\n");
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => { counts[k] = (counts[k] ?? 0) + n; };
  const out: string[] = [];
  let fence: string | null = null, script = false, skipBlank = false, i = 0;
  const inRange = (k: number) => !only || (k >= only[0] && k < only[1]);

  // frontmatter
  if (!only && src[0]?.trim() === "---") {
    const end = src.findIndex((l, k) => k > 0 && l.trim() === "---");
    if (end > 0) {
      out.push("---");
      for (const l of src.slice(1, end)) {
        if (!l.trim()) { bump("blank lines"); continue; }
        const m = l.match(/^(\w[\w-]*):[ \t]*(.*?)\s*$/);
        const t = m ? `${m[1]}: ${m[2]}` : l.replace(/\s+$/, "");
        if (t !== l) bump("settings lines");
        out.push(t);
      }
      out.push("---", ""); skipBlank = true; i = end + 1;
    }
  }

  for (; i < src.length; i++) {
    const raw = src[i];
    const f = raw.match(FENCE);
    if (!inRange(i)) { // outside the slide being tidied: copied, but fences are still tracked so the range sees the right state
      if (f) fence = fence ? (f[1][0] === fence ? null : fence) : f[1][0];
      out.push(raw); continue;
    }
    if (f) { fence = fence ? (f[1][0] === fence ? null : fence) : f[1][0]; out.push(raw.replace(/[ \t]+$/, "")); if (out[out.length - 1] !== raw) bump("trailing spaces"); skipBlank = false; continue; }
    if (fence) { out.push(raw); continue; } // code is copied exactly
    if (script) { // a ::: script body is JavaScript: copied exactly, up to its closing :::
      if (/^:::\s*$/.test(raw)) { script = false; out.push(":::"); } else out.push(raw);
      continue;
    }
    if (!only && SEP.test(raw)) {
      while (out.length && out[out.length - 1] === "") out.pop();
      if (out.length) out.push("");
      out.push("---", ""); skipBlank = true; bump("separators"); continue;
    }
    let line = raw;
    const hard = /\S {2,}$/.test(line) && i + 1 < src.length && src[i + 1].trim() !== "" && !FENCE.test(src[i + 1]) && !SEP.test(src[i + 1]);
    line = line.replace(/\s+$/, "");
    if (hard) line += "  ";
    if (line !== raw && !(hard && raw.replace(/\s+$/, "") + "  " === raw)) bump("trailing spaces");

    if (!line.trim()) { // blank: at most one, and none right after a separator
      if (skipBlank || (out.length && out[out.length - 1] === "")) { if (!skipBlank || raw !== "") bump("blank lines"); continue; }
      out.push(""); continue;
    }
    skipBlank = false;

    const d = line.match(/^(\s*):::[ \t]*(.*)$/);
    if (d) {
      const rest = d[2].trim();
      const t = rest ? `${d[1]}::: ${tidyAttrs(rest)}` : `${d[1]}:::`;
      if (t !== line) bump("block lines");
      line = t;
      if (/^script\b/.test(rest)) script = true;
    } else if (/^\s*<!--/.test(line)) {
      const t = tidyComment(line); if (t !== line) bump("comments"); line = t;
    } else {
      const h = line.match(/^(\s{0,3}#{1,6})[ \t]{2,}(\S.*)$/);
      if (h) { line = `${h[1]} ${h[2]}`; bump("headings"); }
    }
    out.push(line);
  }

  if (!only) { while (out.length && out[out.length - 1] === "") out.pop(); out.push(""); }
  else while (out.length && out[out.length - 1] === "" && src[src.length - 1] !== "") out.pop(), out.push("");
  return { out, counts };
}

/** The same deck? Same settings, same number of slides, same options, and the same text on every slide once whitespace is ignored. */
export function sameDeck(a: string, b: string): boolean {
  const x = parseDeck(a), y = parseDeck(b);
  const flat = (s: string) => s.replace(/\s+/g, "");
  const meta = (d: ReturnType<typeof parseDeck>) => JSON.stringify(Object.entries(d.meta).map(([k, v]) => [k, String(v).trim()])); // trailing spaces in a setting mean nothing
  return x.slides.length === y.slides.length && meta(x) === meta(y)
    && x.slides.every((s, k) => flat(s.src) === flat(y.slides[k].src) && JSON.stringify(s.opts) === JSON.stringify(y.slides[k].opts));
}

function finish(before: string, out: string[], counts: Record<string, number>): Beautified {
  const text = out.join("\n");
  const same = text === before.replace(/\r\n?/g, "\n");
  if (same) return { text: before, changed: false, safe: true, summary: "Already tidy", counts: {} };
  if (!sameDeck(before, text)) return { text: before, changed: false, safe: false, summary: "Not changed: the tidied deck would not match the original", counts };
  const bits = Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
  return { text, changed: true, safe: true, summary: bits.length ? `Tidied: ${bits.join(", ")}` : "Tidied", counts };
}

/** Tidy a whole deck. */
export function beautifyDeck(text: string): Beautified { const { out, counts } = run(text); return finish(text, out, counts); }

/** Tidy one slide (by its position) and leave the rest of the file exactly as it is. */
export function beautifySlide(text: string, id: number): Beautified {
  const sl = parseDeck(text).slides, s = sl[id];
  if (!s) return { text, changed: false, safe: true, summary: "No such slide", counts: {} };
  const total = text.replace(/\r\n?/g, "\n").split("\n").length;
  const { out, counts } = run(text, [s.line, id + 1 < sl.length ? sl[id + 1].line - 1 : total]);
  return finish(text, out, counts);
}
