import { slideRange } from "./images";

const FENCE = /^\s*(`{3,}|~{3,})/;
function blocks(lines: string[]): [number, number][] {
  const out: [number, number][] = [];
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].match(FENCE);
    if (f) { fence = fence ? (f[1][0] === fence ? null : fence) : f[1][0]; continue; }
    if (fence || !/^:::\s*notes\s*$/.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && !/^:::\s*$/.test(lines[j])) j++;
    out.push([i, Math.min(j, lines.length - 1)]);
    i = j;
  }
  return out;
}

export function notesOf(src: string): string {
  const lines = src.split("\n");
  return blocks(lines)
    .map(([a, b]) => lines.slice(a + 1, /^:::\s*$/.test(lines[b]) ? b : b + 1).join("\n").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function setNotes(text: string, id: number, notes: string): string {
  const r = slideRange(text, id);
  if (!r) return text;
  const slide = r.lines.slice(r.start, r.end);
  for (const [a, b] of blocks(slide).reverse()) slide.splice(a, b - a + 1);
  while (slide.length && !slide[slide.length - 1].trim()) slide.pop();
  const body = notes.replace(/\r\n?/g, "\n").trim();
  if (body) {
    slide.push("", "::: notes", ...body.split("\n").map((l) =>
      /^:::\s*$/.test(l) ? "::" : /^---+\s*$/.test(l) ? "- - -" : l), ":::");
  }
  slide.push("");
  r.lines.splice(r.start, r.end - r.start, ...slide);
  return r.lines.join("\n");
}
