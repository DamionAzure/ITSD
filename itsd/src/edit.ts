import { parseDeck, parseOpts, type Slide } from "./itsd";
import { plainText } from "./format";
import { isMarker } from "./layout";

function split(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sl = parseDeck(text).slides;
  return {
    header: lines.slice(0, sl[0].line),
    chunks: sl.map((s, k) => lines.slice(s.line, k + 1 < sl.length ? sl[k + 1].line - 1 : lines.length)),
  };
}
function join(header: string[], chunks: string[][]): string {
  const out = [...header];
  chunks.forEach((c, k) => { if (k > 0) out.push("---"); out.push(...c); });
  return out.join("\n");
}

/** Move slide `from` to position `to`, keeping the frontmatter and every slide's text intact. */
export function moveSlide(text: string, from: number, to: number): string {
  const { header, chunks } = split(text);
  const [c] = chunks.splice(from, 1);
  chunks.splice(to, 0, c);
  return join(header, chunks);
}
/** Insert a fresh slide after slide `after`. */
export function addSlide(text: string, after: number): string {
  const { header, chunks } = split(text);
  chunks.splice(after + 1, 0, ["", "# New slide", "", ""]);
  return join(header, chunks);
}
export function duplicateSlide(text: string, id: number): string {
  const { header, chunks } = split(text);
  chunks.splice(id + 1, 0, [...chunks[id]]);
  return join(header, chunks);
}
export function deleteSlide(text: string, id: number): string {
  const { header, chunks } = split(text);
  if (chunks.length <= 1) return text; // a deck always keeps one slide
  chunks.splice(id, 1);
  return join(header, chunks);
}

/** Set (or remove, with null) one key of a slide's leading `<!-- key: value; ... -->` comment. */
export function setSlideOpt(text: string, id: number, key: string, value: string | null): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sl = parseDeck(text).slides;
  const s = sl[id]; if (!s) return text;
  const end = id + 1 < sl.length ? sl[id + 1].line - 1 : lines.length;
  let at = s.line; while (at < end && !lines[at].trim()) at++;
  const mark = at < end && isMarker(lines[at]); // a layout marker above the first block is not the options comment
  const has = at < end && !mark && /^\s*<!--.*-->\s*$/.test(lines[at]);
  if (at < end && !mark && lines[at].trim().startsWith("<!--") && !has) return text; // multi-line comment: leave alone
  const opts = has ? parseOpts(lines[at]) : {};
  if (value === null) delete opts[key]; else opts[key] = value;
  const body = Object.entries(opts).map(([k, v]) => `${k}: ${v}`).join("; ");
  if (has) lines.splice(at, 1, ...(body ? [`<!-- ${body} -->`] : []));
  else if (body) lines.splice(s.line, 0, `<!-- ${body} -->`);
  return lines.join("\n");
}

export function titleOf(s: Slide): string {
  for (const l of s.src.split("\n")) {
    const t = l.trim();
    if (!t || t.startsWith("<!--") || /^:::\s*image\b/.test(t)) continue;
    const m = t.match(/^#{1,6}\s+(.*)$/);
    return plainText(m ? m[1] : t).slice(0, 48) || "(empty)";
  }
  return "(empty)";
}
