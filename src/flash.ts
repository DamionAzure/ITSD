// Flash regions: a timed box that flashes text, one item at a time.
//
//   ::: flash id=react size=26 mode=random time="1.5s +-0.5s" loop manual
//   3 #002ed1, 6 green
//   2 red
//   :::
//
// Items are `text color` (the last word is the colour), one per line and/or comma-separated. Quote text that
// has spaces or no colour: "Hello there" blue. Text may use {{input}} references.
// Options: id, size (box width, % of slide width), h (box height, % of slide height; makes the box any shape),
// ratio (width/height when h is not given, default 1 = square), mode (linear|random),
// time, gap, font (size in % of slide width), frame=off, x/y (place absolutely, % of slide), start, flags: loop shuffle.
// start: new-slide (default: every time you arrive at the slide), at-start (only the first time in a presentation),
// when-next (waits; the next Next press starts it instead of advancing), manual (only a start button or a click).
// time: a base plus optional jitter. "1.5s" is exact; "1.5s +-0.5s" varies by up to half a second either way;
// "1.5s +0.3s -0.5s" varies from 1.0s to 1.8s. Units: s (default) or ms.

export type Trigger = "new-slide" | "at-start" | "when-next" | "manual";
export interface TimeSpec { base: number; plus: number; minus: number } // seconds
export interface FlashItem { text: string; color: string | null }
export interface FlashProblem { bodyLine: number; message: string; severity: "error" | "warning" } // bodyLine -1 = header
export interface FlashSpec {
  id?: string; x?: number; y?: number; size: number; h?: number; ratio: number; mode: "linear" | "random";
  time: TimeSpec; gap: TimeSpec | null; loop: boolean; shuffle: boolean; trigger: Trigger; frame: boolean; font?: number;
  items: FlashItem[]; problems: FlashProblem[];
}

/** Flashes shorter than this are stretched, so a "hectic" jitter can't strobe faster than ~5 per second. */
export const MIN_FLASH_MS = 200;
const ATTRS = new Set(["id", "size", "h", "ratio", "mode", "time", "gap", "font", "frame", "x", "y", "start"]);
const TRIGGERS: Record<string, Trigger> = {
  "new-slide": "new-slide", slide: "new-slide", newslide: "new-slide",
  "at-start": "at-start", first: "at-start",
  "when-next": "when-next", next: "when-next", "on-next": "when-next",
  manual: "manual", button: "manual",
};
const FLAGS = new Set(["loop", "shuffle", "manual"]);

export function parseAttrs(rest: string) {
  const attrs: Record<string, string> = {}; const flags = new Set<string>();
  for (const m of rest.matchAll(/([\w-]+)=("([^"]*)"|\S+)|([\w-]+)/g)) {
    if (m[1]) attrs[m[1]] = m[3] ?? m[2]; else flags.add(m[4]);
  }
  return { attrs, flags };
}

export function parseTime(s: string): TimeSpec | null {
  const m = s.trim().match(/^([\d.]+)\s*(ms|s)?/i);
  if (!m) return null;
  const unit = (u?: string) => (u?.toLowerCase() === "ms" ? 0.001 : 1);
  const t: TimeSpec = { base: parseFloat(m[1]) * unit(m[2]), plus: 0, minus: 0 };
  if (!Number.isFinite(t.base)) return null;
  for (const x of s.slice(m[0].length).matchAll(/(\+-|±|\+|-)\s*([\d.]+)\s*(ms|s)?/gi)) {
    const v = parseFloat(x[2]) * unit(x[3]);
    if (x[1] !== "-") t.plus = v;  // "+" and "+-" / "±"
    if (x[1] !== "+") t.minus = v; // "-" and "+-" / "±"
  }
  return t;
}

/** One random duration in ms: uniform between base-minus and base+plus (never below zero). */
export const dur = (t: TimeSpec, floor = 0) => {
  const minus = Math.min(t.minus, t.base);
  return Math.max(floor, (t.base - minus + Math.random() * (minus + t.plus)) * 1000);
};

export function shuffled<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

/** One pass through the sequence, with this pass's random durations and (if `shuffle`) order. */
export function plan(spec: FlashSpec): { item: FlashItem; ms: number; gap: number }[] {
  const items = spec.shuffle ? shuffled(spec.items) : spec.items;
  return items.map((item) => ({ item, ms: dur(spec.time, MIN_FLASH_MS), gap: spec.gap ? dur(spec.gap) : 0 }));
}

export function parseFlash(rest: string, body: string[]): FlashSpec {
  const { attrs, flags } = parseAttrs(rest);
  const problems: FlashProblem[] = [];
  const warn = (message: string, bodyLine = -1, severity: FlashProblem["severity"] = "warning") => problems.push({ bodyLine, message, severity });
  for (const k of Object.keys(attrs)) if (!ATTRS.has(k)) warn(`Unknown option "${k}="`);
  for (const f of flags) if (!FLAGS.has(f)) warn(`Unknown option "${f}" (quote values that contain spaces: time="1.5s +-0.5s")`);
  const num = (k: string, d: number | undefined): number | undefined => {
    if (attrs[k] === undefined) return d;
    const v = parseFloat(attrs[k]);
    if (Number.isFinite(v) && v > 0) return v;
    warn(`"${k}=${attrs[k]}" is not a positive number`); return d;
  };
  let ratio = 1;
  if (attrs.ratio !== undefined) {
    const [a, b] = attrs.ratio.split("/").map(parseFloat);
    const r = b === undefined ? a : a / b;
    if (Number.isFinite(r) && r > 0) ratio = r; else warn(`"ratio=${attrs.ratio}" should be a number like 1 or 16/9`);
  }
  let mode: FlashSpec["mode"] = "linear";
  if (attrs.mode === "random" || attrs.mode === "linear") mode = attrs.mode;
  else if (attrs.mode !== undefined) warn(`mode must be linear or random, not "${attrs.mode}"`);
  let time = parseTime(attrs.time ?? "1.5s");
  if (!time) { warn(`Can't read time="${attrs.time}". Try time="1.5s +-0.5s"`, -1, "error"); time = { base: 1.5, plus: 0, minus: 0 }; }
  let gap: TimeSpec | null = null;
  if (attrs.gap !== undefined) { gap = parseTime(attrs.gap); if (!gap) warn(`Can't read gap="${attrs.gap}"`, -1, "error"); }
  // Positions may be 0 (the slide's left/top edge), unlike sizes, which must be positive.
  const coord = (k: string): number | undefined => {
    if (attrs[k] === undefined) return undefined;
    const v = parseFloat(attrs[k]);
    if (Number.isFinite(v)) return v;
    warn(`"${k}=${attrs[k]}" is not a number (percent of the slide)`); return undefined;
  };
  const x = coord("x"), y = coord("y");
  if ((attrs.x !== undefined) !== (attrs.y !== undefined)) warn("x and y go together (percent of the slide)");

  let trigger: Trigger = flags.has("manual") ? "manual" : "new-slide";
  if (attrs.start !== undefined) {
    const t = TRIGGERS[attrs.start.toLowerCase().replace(/[_\s]+/g, "-")];
    if (t) { if (flags.has("manual") && t !== "manual") warn(`"manual" and start=${attrs.start} disagree; using start=${attrs.start}`); trigger = t; }
    else warn(`start must be new-slide, at-start, when-next or manual, not "${attrs.start}"`);
  }

  const items: FlashItem[] = [];
  body.forEach((line, bi) => {
    for (const part of line.split(",")) {
      const p = part.trim(); if (!p) continue;
      let text: string, color: string | null;
      const q = p.match(/^"([^"]*)"\s*(\S+)?$/);
      if (q) { text = q[1]; color = q[2] ?? null; }
      else { const t = p.split(/\s+/); if (t.length === 1) { text = t[0]; color = null; } else { color = t[t.length - 1]; text = t.slice(0, -1).join(" "); } }
      if (color && color.startsWith("#") && !/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) {
        warn(`"${color}" is not a valid hex colour (hex digits are 0-9 and a-f)`, bi); color = null;
      }
      items.push({ text, color });
    }
  });
  if (!items.length) warn("Flash region has no items. One per line or comma-separated, like: 3 red, 6 green");

  return {
    id: attrs.id, x: x !== undefined && y !== undefined ? x : undefined, y: x !== undefined && y !== undefined ? y : undefined,
    size: num("size", 28)!, h: num("h", undefined), ratio, mode, time, gap, loop: flags.has("loop"), shuffle: flags.has("shuffle"), trigger,
    frame: attrs.frame !== "off", font: num("font", undefined), items, problems,
  };
}

/** If line `i` opens a `::: flash` block, parse it. `close` is the index of the closing `:::` (or `end` if missing). */
export function readFlash(lines: string[], i: number, end = lines.length): { spec: FlashSpec; close: number } | null {
  const m = lines[i].match(/^:::\s*flash\b\s*(.*)$/);
  if (!m) return null;
  const body: string[] = []; let j = i + 1;
  while (j < end && !/^:::\s*$/.test(lines[j])) body.push(lines[j++]);
  return { spec: parseFlash(m[1], body), close: j };
}

/** CSS size of a flash box. Width is `size`% of the slide's width, height is `h`% of its height (or width / ratio). */
export const flashBox = (s: FlashSpec) => ({
  width: `calc(var(--u, 1cqw) * ${s.size})`,
  height: s.h !== undefined ? `calc(var(--uh, 1cqh) * ${s.h})` : `calc(var(--u, 1cqw) * ${s.size / s.ratio})`,
});
