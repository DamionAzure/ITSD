// The Table element: a real, styled table you write as plain rows.
//
//   ::: table style=zebra sort=2 dir=desc
//   Name | Score | Rank
//   Ada | 91 | 1
//   Bo | 78 | 2
//   :::
//
// Rows are split on `|` (or tabs, or commas when there is no `|`). The first row is the header unless `header=false`. `sort=` orders the rows
// (a column number, from 1, or a header name) so a table can be written in any order and still read sorted. The trace has a clone of this
// element (`::: trace-table`, see TraceParts.tsx) that takes the same `style=` looks and re-sorts itself as a run plays.
import { slideRange } from "./images";

export const TABLE_STYLES = ["plain", "zebra", "grid", "lines", "bold", "card", "neon"] as const;
export type TableStyle = (typeof TABLE_STYLES)[number];
export const TABLE_OPEN = /^:::\s*table(?:\s+(.*))?$/;
const CLOSE = /^:::\s*$/;

export interface TableDef { attrs: Record<string, string>; rows: string[][]; raw: string[] }

const flag = (v: string | undefined, d: boolean) => (v === undefined ? d : ![ "false", "0", "off", "no" ].includes(v));
export const tableFlag = flag;

export function parseAttrs(rest: string): Record<string, string> {
  const a: Record<string, string> = {};
  rest.replace(/([\w-]+)=("([^"]*)"|\S+)/g, (_, k, v, q) => { a[k] = q ?? v; return ""; });
  return a;
}
const q = (v: string) => (/[\s"]/.test(v) ? `"${v.replace(/"/g, "'")}"` : v);
export const tableLine = (attrs: Record<string, string>) => `::: table${Object.keys(attrs).filter((k) => attrs[k] !== "").map((k) => ` ${k}=${q(attrs[k])}`).join("")}`;

/** One body line -> its cells. `|` wins, then a tab, then commas (with "quoted, commas" kept whole). */
export function splitRow(l: string): string[] {
  if (l.includes("|")) return l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  if (l.includes("\t")) return l.split("\t").map((c) => c.trim());
  const out: string[] = []; let cur = "", inQ = false;
  for (const ch of l) { if (ch === '"') inQ = !inQ; else if (ch === "," && !inQ) { out.push(cur.trim()); cur = ""; } else cur += ch; }
  out.push(cur.trim());
  return out;
}
const isRule = (cells: string[]) => cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c)); // a markdown `---|---` line is skipped

/** Read a `::: table` block starting at line `i`. Returns the block and the index of its closing `:::` (or the last line when it is never closed). */
export function readTable(lines: string[], i: number): { def: TableDef; close: number; closed: boolean } | null {
  const m = lines[i].match(TABLE_OPEN); if (!m) return null;
  const raw: string[] = []; let j = i + 1;
  while (j < lines.length && !CLOSE.test(lines[j])) raw.push(lines[j++]);
  const rows = raw.filter((l) => l.trim()).map(splitRow).filter((r) => !isRule(r));
  return { def: { attrs: parseAttrs(m[1] ?? ""), rows, raw }, close: Math.min(j, lines.length - 1), closed: j < lines.length };
}

const num = (s: string) => { const n = parseFloat(s.replace(/[^\d.+-eE]/g, "")); return /\d/.test(s) && Number.isFinite(n) ? n : NaN; };
export const isNumeric = (s: string) => s.trim() !== "" && Number.isFinite(num(s)) && /^[\s$€£¥+-]*[\d.,]+\s*[%a-zA-Z]{0,3}$/.test(s.trim());

/** Which column `sort=` means (0-based), or -1. A number counts from 1; otherwise a header name. */
export function sortColumn(def: TableDef): number {
  const s = def.attrs.sort; if (!s) return -1;
  if (/^\d+$/.test(s)) { const c = parseInt(s, 10) - 1; return c >= 0 ? c : -1; }
  const head = def.rows[0] ?? []; const c = head.findIndex((h) => h.toLowerCase() === s.toLowerCase()); return c;
}

/** The header, the body rows in display order (after `sort=` / `dir=`), and which source row (0-based, header excluded) each one came from. */
export function tableView(def: TableDef): { head: string[] | null; body: string[][]; from: number[]; numeric: boolean[]; cols: number } {
  const hasHead = flag(def.attrs.header, true);
  const head = hasHead && def.rows.length ? def.rows[0] : null;
  const body = hasHead ? def.rows.slice(1) : def.rows;
  const cols = Math.max(head?.length ?? 0, ...body.map((r) => r.length), 0);
  const numeric = Array.from({ length: cols }, (_, c) => body.length > 0 && body.every((r) => (r[c] ?? "") === "" || isNumeric(r[c])));
  let order = body.map((_, k) => k);
  const sc = sortColumn(hasHead ? def : { ...def, rows: [[], ...def.rows] });
  if (sc >= 0 && sc < cols) {
    const dir = (def.attrs.dir ?? "asc").toLowerCase().startsWith("d") ? -1 : 1;
    order.sort((x, y) => {
      const a = body[x][sc] ?? "", b = body[y][sc] ?? "";
      const c = numeric[sc] ? num(a) - num(b) : a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
      return (c || x - y) * dir;
    });
  }
  return { head, body: order.map((k) => body[k]), from: order, numeric, cols };
}

/** The rows to highlight: `hl=2,4` (1-based, header excluded). */
export const highlighted = (a: Record<string, string>) => new Set((a.hl ?? "").split(/[\s,]+/).map((s) => parseInt(s, 10) - 1).filter((n) => n >= 0));

// ---- text edits (each returns the new deck text) ----

/** Where the table block that starts at `line` of slide `id` is: [open, close] as indices into the slide's lines (absolute in `r.lines`). */
function span(text: string, id: number, line: number) {
  const r = slideRange(text, id); if (!r) return null;
  const open = r.start + line; if (!TABLE_OPEN.test(r.lines[open] ?? "")) return null;
  let close = open + 1; while (close < r.lines.length && !CLOSE.test(r.lines[close])) close++;
  return { r, open, close };
}
/** Change options on a table's own line (null or "" removes one) and/or replace its rows. */
export function patchTable(text: string, id: number, line: number, patch: Record<string, string | null>, body?: string[]): string {
  const s = span(text, id, line); if (!s) return text;
  const attrs = parseAttrs(s.r.lines[s.open].match(TABLE_OPEN)![1] ?? "");
  for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") delete attrs[k]; else attrs[k] = v; }
  s.r.lines[s.open] = tableLine(attrs);
  if (body) s.r.lines.splice(s.open + 1, s.close - s.open - 1, ...body);
  return s.r.lines.join("\n");
}
/** Sort a table's own rows in the file (not just in the picture): rewrites the body in display order. Needs a `|` table; header stays first. */
export function sortTableInFile(text: string, id: number, line: number, col: number, dir: "asc" | "desc"): string {
  const s = span(text, id, line); if (!s) return text;
  const body = s.r.lines.slice(s.open + 1, s.close);
  const def: TableDef = { attrs: { ...parseAttrs(s.r.lines[s.open].match(TABLE_OPEN)![1] ?? ""), sort: String(col + 1), dir }, rows: [], raw: body };
  const keep = body.filter((l) => l.trim());
  def.rows = keep.map(splitRow);
  const hasHead = flag(def.attrs.header, true), v = tableView({ ...def, rows: def.rows.filter((r) => !isRule(r)) });
  const lines = keep.filter((l) => !isRule(splitRow(l)));
  const head = hasHead ? lines.slice(0, 1) : [], rest = hasHead ? lines.slice(1) : lines;
  s.r.lines.splice(s.open + 1, s.close - s.open - 1, ...head, ...v.from.map((k) => rest[k]));
  return s.r.lines.join("\n");
}

export const SAMPLE_TABLE = ["::: table style=zebra", "Language | Year | Speed", "Rust | 2015 | fast", "Go | 2009 | fast", "Python | 1991 | slow", ":::"].join("\n");

/** Every `::: table` of a slide's source (fence-aware, so a manual page can show an example). `line` is 0-based within the slide. */
export function scanTables(src: string): { line: number; def: TableDef; closed: boolean }[] {
  const out: { line: number; def: TableDef; closed: boolean }[] = []; const lines = src.split("\n"); let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].match(/^\s*(`{3,}|~{3,})/);
    if (f) { fence = fence ? (f[1][0] === fence ? null : fence) : f[1][0]; continue; }
    if (fence) continue;
    const t = readTable(lines, i); if (t) { out.push({ line: i, def: t.def, closed: t.closed }); i = t.close; }
  }
  return out;
}
