// Scripted actions: "when the audience presses Next, rotate this box 90 degrees, then fade the title".
//
//   <!-- @id title -->                              names the block below (a ```run id=x block is already named)
//   <!-- @on next: rotate this 90 -> fade title out -->
//   <!-- @on enter: fade this 0 ; move this by 0 -5 -->
//   <!-- @on click: rotate this 15 over 0.2s -->
//
// Lines go directly above the block (or picture) they belong to; `this` means that block. Triggers:
//   next   one Next press per line, in the order the lines appear (Next advances the slide once they are used up)
//   enter  when the slide appears (in Present only)
//   click  every click on the block
// A chain is steps joined by `->` (then: wait for the previous step to finish) and `;` (also: start together):
//   rotate <t> <deg>              turn by that many degrees      (`rotate <t> to <deg>` is absolute)
//   move <t> by <dx> <dy>         shift, in percent of the slide (`move <t> to <x> <y>` puts its top-left there)
//   scale <t> <k> [<ky>]          stretch to k times its size, on X and optionally Y separately
//   fade <t> in|out|<0..1>        opacity
//   show <t> | hide <t>           (a run block still works the old way too)
//   reset <t>                     back to where it started
//   anim <t> <effect> [left|right|up|down] PowerPoint-style effect: fade-in fly-in float-in wipe-in zoom-in bounce-in spin-in swivel-in drop-in split-in (entrance, hidden until their turn),
//                                 pulse grow spin shake wobble blink bounce flip heartbeat (emphasis), disappear fade-out fly-out float-out wipe-out zoom-out spin-out shrink-out (exit)
//   wait <time>
//   run <id> | start <id> | stop <id> | goto <n> | set <id> = <source>     the button actions
// Any animated step takes `over 1s` (default 0.5s) and `delay 0.2s`.

import { effectOf, isDir, isEntrance, playEffect, type Dir } from "./anim";
export interface Step { effect?: string; from?: Dir; verb: string; target: string; nums: number[]; word: string; to: boolean; by: boolean; dur: number; delay: number; raw: string }
export type Chain = Step[][]; // groups run one after another; the steps inside a group start together
export interface On { when: "next" | "enter" | "click"; chain: Chain; text: string }

export const ON_LINE = /^\s*<!--\s*@on\s+(next|enter|click)\s*:\s*(.*?)\s*-->\s*$/;
export const ID_LINE = /^\s*<!--\s*@id\s+([\w-]+)\s*-->\s*$/;
export const isActionLine = (l: string) => ON_LINE.test(l) || ID_LINE.test(l);

const TIME = /^(\d*\.?\d+)(ms|s)?$/;
export const seconds = (t: string) => { const m = t.match(TIME); return m ? (m[2] === "ms" ? +m[1] / 1000 : +m[1]) : NaN; };

const VERBS = new Set(["rotate", "move", "scale", "fade", "show", "hide", "reset", "wait", "anim"]);
export const ACTION_VERBS = new Set([...VERBS, "run", "start", "stop", "goto", "set"]);

/** One step of a chain. Returns an error message instead when the text isn't understood. */
export function parseStep(text: string): Step | string {
  let raw = text.trim(), dur = 0.5, delay = 0;
  raw = raw.replace(/\s+over\s+(\S+)/i, (_, t) => { const s = seconds(t); if (Number.isFinite(s)) dur = s; return ""; });
  raw = raw.replace(/\s+delay\s+(\S+)/i, (_, t) => { const s = seconds(t); if (Number.isFinite(s)) delay = s; return ""; });
  const w = raw.trim().split(/\s+/), verb = (w[0] ?? "").toLowerCase();
  if (!verb) return "Empty step";
  if (!ACTION_VERBS.has(verb)) return `Unknown action "${verb}"`;
  if (!VERBS.has(verb)) return { verb, target: w[1] ?? "", nums: [], word: "", to: false, by: false, dur, delay, raw: raw.trim() }; // a button action: handled elsewhere
  if (verb === "wait") { const s = seconds(w[1] ?? ""); return Number.isFinite(s) ? { verb, target: "", nums: [], word: "", to: false, by: false, dur: s, delay: 0, raw: raw.trim() } : "wait needs a time, e.g. wait 1s"; }
  const target = w[1]; if (!target) return `${verb} needs a target (this, or an @id)`;
  if (verb === "anim") {
    const eff = (w[2] ?? "").toLowerCase(); if (!effectOf(eff)) return eff ? `Unknown effect "${eff}" (try fade-in, fly-in, zoom-in, pulse, fade-out ...)` : "anim needs an effect, e.g. anim this fly-in";
    const from = w.slice(3).map((x) => x.toLowerCase()).find(isDir);
    const e = effectOf(eff)!, given = /\sover\s/i.test(text);
    return { verb, target, nums: [], word: eff, effect: eff, from, to: false, by: false, dur: given ? dur : e.dur, delay, raw: raw.trim() };
  }
  const rest = w.slice(2), to = rest[0] === "to", by = rest[0] === "by", args = to || by ? rest.slice(1) : rest;
  const nums = args.map(parseFloat).filter((n) => Number.isFinite(n));
  const word = args.find((a) => /^[a-z]+$/i.test(a))?.toLowerCase() ?? "";
  if (verb === "rotate" && nums.length < 1) return "rotate needs degrees, e.g. rotate this 90";
  if (verb === "move" && nums.length < 2) return "move needs two numbers, e.g. move this by 10 0";
  if (verb === "scale" && nums.length < 1) return "scale needs a factor, e.g. scale this 1.5 (or 2 0.5 for X and Y)";
  if (verb === "fade" && !nums.length && word !== "in" && word !== "out") return "fade needs in, out or 0 to 1";
  return { verb, target, nums, word, to, by, dur, delay, raw: raw.trim() };
}

export function parseChain(text: string): { chain: Chain; errors: string[] } {
  const errors: string[] = [], chain: Chain = [];
  for (const seq of text.split("->")) {
    const group: Step[] = [];
    for (const part of seq.split(";")) {
      if (!part.trim()) continue;
      const s = parseStep(part);
      if (typeof s === "string") errors.push(s); else group.push(s);
    }
    if (group.length) chain.push(group);
  }
  return { chain, errors };
}
export function parseOn(when: string, text: string): On | null {
  const { chain } = parseChain(text);
  return chain.length ? { when: when as On["when"], chain, text } : null;
}

// ---- running ----

interface State { rot: number; tx: number; ty: number; sx: number; sy: number; op: number }
const states = new WeakMap<Element, State & { first: State }>();
function stateOf(el: HTMLElement): State & { first: State } {
  let s = states.get(el);
  if (!s) { const f = { rot: parseFloat(el.style.rotate) || 0, tx: 0, ty: 0, sx: 1, sy: 1, op: 1 }; s = { ...f, first: f }; states.set(el, s); }
  return s;
}
const PROP: Record<keyof State, string> = { rot: "rotate", tx: "translate", ty: "translate", sx: "scale", sy: "scale", op: "opacity" };
/** CSS for just the properties in `only`, so two steps running together on one element never overwrite each other's property. */
const css = (s: State, only: Set<string>) => {
  const all: Record<string, string> = { rotate: `${s.rot}deg`, translate: `${s.tx}px ${s.ty}px`, scale: `${s.sx} ${s.sy}`, opacity: String(s.op) };
  return Object.fromEntries(Object.entries(all).filter(([k]) => only.has(k)));
};

/** Animate `el` to the state it would have after `change`. Resolves when done. */
function tween(el: HTMLElement, change: (s: State, slide: DOMRect) => Partial<State>, dur: number, delay: number, still: boolean): Promise<void> {
  const cur = stateOf(el), slide = (el.closest(".slide") ?? el.parentElement!).getBoundingClientRect();
  const from: State = { rot: cur.rot, tx: cur.tx, ty: cur.ty, sx: cur.sx, sy: cur.sy, op: cur.op };
  const to: State = { ...from, ...change(from, slide) };
  const only = new Set((Object.keys(to) as (keyof State)[]).filter((k) => to[k] !== from[k]).map((k) => PROP[k]));
  Object.assign(cur, to);
  const fin = () => Object.assign(el.style, css(cur, only));
  if (!only.size) return new Promise((res) => setTimeout(res, (dur + delay) * 1000));
  if (still || dur <= 0) { return new Promise((res) => setTimeout(() => { fin(); res(); }, delay * 1000)); }
  const a = el.animate([css(from, only), css(to, only)], { duration: dur * 1000, delay: delay * 1000, easing: "ease-in-out", fill: "both" });
  return a.finished.then(() => { fin(); a.cancel(); }, () => { fin(); });
}

export interface Runner {
  /** The element a name stands for (`this` already resolved by the caller). */
  find(target: string): HTMLElement | null;
  /** The button actions (run, start, stop, goto, set, and show/hide of code blocks). */
  act(line: string): Promise<void> | void;
  /** Reduced motion: jump instead of animating. */
  still: boolean;
  alive(): boolean;
}

async function step(s: Step, r: Runner, self: HTMLElement | null): Promise<void> {
  if (s.verb === "wait") { await new Promise((res) => setTimeout(res, r.still ? 0 : s.dur * 1000)); return; }
  const el = s.target === "this" ? self : r.find(s.target);
  const buttonish = !VERBS.has(s.verb) || ((s.verb === "show" || s.verb === "hide") && (!el || el.dataset.kind === "run")); // show/hide of a code block keeps its old meaning
  if (buttonish) { await r.act(s.raw); return; }
  if (!el) return; // an unknown target just does nothing (the editor warns about it)
  const d = s.dur, dl = s.delay, st = r.still, n = s.nums;
  switch (s.verb) {
    case "rotate": await tween(el, (c) => ({ rot: s.to ? n[0] : c.rot + n[0] }), d, dl, st); break;
    case "move": await tween(el, (c, sl) => {
      const dx = (n[0] / 100) * sl.width, dy = (n[1] / 100) * sl.height;
      if (!s.to) return { tx: c.tx + dx, ty: c.ty + dy };
      const r0 = el.getBoundingClientRect(), left = r0.left - sl.left - c.tx, top = r0.top - sl.top - c.ty; // where it is without our own shift
      return { tx: dx - left, ty: dy - top };
    }, d, dl, st); break;
    case "scale": await tween(el, () => ({ sx: n[0], sy: n[1] ?? n[0] }), d, dl, st); break;
    case "fade": await tween(el, () => ({ op: n.length ? Math.max(0, Math.min(1, n[0])) : s.word === "in" ? 1 : 0 }), d, dl, st); break;
    case "show": await tween(el, () => ({ op: 1 }), 0, dl, true); break;
    case "hide": await tween(el, () => ({ op: 0 }), 0, dl, true); break;
    case "reset": await tween(el, () => ({ ...stateOf(el).first }), d, dl, st); break;
    case "anim": { const cur = stateOf(el); await playEffect(el, s.effect!, s.from ?? "", d, dl, st, (v) => { cur.op = v; el.style.opacity = String(v); }); break; }
  }
}

export async function runChain(chain: Chain, r: Runner, self: HTMLElement | null) {
  for (const group of chain) {
    if (!r.alive()) return;
    await Promise.all(group.map((s) => step(s, r, self)));
  }
}

/** Entrance effects keep their object hidden until their turn: called once when the slide is armed. */
export function hideUntilEntrance(chain: Chain, self: HTMLElement | null, find: (t: string) => HTMLElement | null) {
  const seen = new Set<HTMLElement>();
  for (const st of chain.flat()) {
    if (st.verb !== "anim") continue;
    const el = st.target === "this" ? self : find(st.target);
    if (!el || seen.has(el)) continue; seen.add(el);
    if (isEntrance(st.effect!)) { stateOf(el).op = 0; el.style.opacity = "0"; }
  }
}
