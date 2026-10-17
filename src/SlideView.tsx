import { Fragment, memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { marked } from "marked";
import gsap from "gsap";
import { CodeBlock } from "./CodeBlock";
import { DeckCtx, FontCtx, RegCtx, type BlockHandle } from "./ctx";
import { parseAct, parseInfo, parseInput, parseOpts, scanKeys, scanOn, scanTimers, scanWhen, type Act, type InputDef, type Slide } from "./itsd";
import { fromStored, show, toNum, truthy } from "./expr";
import { InputBox } from "./InputBox";
import { Backdrop, ImageLayer } from "./ImageLayer";
import { parseImage, backdropOf, type ImageDef } from "./images";
import { FlashRegion } from "./FlashRegion";
import { flashBox, readFlash, type FlashSpec } from "./flash";
import { inkStyle } from "./ImageLayer";
import { parseMark, type Place } from "./layout";
import { resolveFamily } from "./format";
import { ID_LINE, ON_LINE, hideUntilEntrance, parseOn, runChain, type On, type Runner } from "./motion";
import { ALIGN_LINE } from "./format";
import { Fx } from "./modules/Fx";
import { findEffect } from "./modules/registry";
import { TraceComposite, PART } from "./TraceParts";
import { MediaBlock } from "./MediaBlock";
import { MEDIA_LINE, parseMedia, type MediaDef } from "./mediaDef";
import { TRACE_LINE, traceOf, type TraceDef } from "./traceBlock";
import { parseFx, readWrap, splitParts, type FxDef } from "./modules/fxEdit";

// `line`/`end` locate the block in the slide's source; `at` + `marker` are set when the author dragged it out of the text flow.
// `align`/`alignLine` come from a `<!-- @center -->` line above the block; `alignLine` lets the Visual view delete it with the block.
interface Meta { line: number; end: number; at?: Place; marker?: number; align?: string; alignLine?: number; id?: string; ons?: On[]; dir?: number; cond?: string }
export type Block = Meta & (
  | { kind: "html"; html: string }
  | { kind: "run"; lang: string; text: string; name?: string }
  | { kind: "btn"; label: string; cls?: string; acts: Act[] }
  | { kind: "input"; def: InputDef }
  | { kind: "img"; def: ImageDef }
  | { kind: "flash"; spec: FlashSpec }
  | { kind: "trace"; def: TraceDef }
  | { kind: "media"; def: MediaDef }
  | { kind: "fx"; fx: FxDef }
  | { kind: "wrap"; fx: FxDef; md: string });
type Raw = Block extends infer B ? (B extends Meta ? Omit<B, keyof Meta> : never) : never;

const extLang = (ref: string) =>
  ({ java: "java", py: "python", c: "c", cpp: "cpp", rs: "rust", go: "go", js: "node" } as Record<string, string>)[ref.split(".").pop() ?? ""] ?? "text";

function markdownBlocks(md: string, start: number): Block[] {
  const toks = marked.lexer(md) as any[];
  const links = (toks as any).links;
  const out: Block[] = [];
  let ln = start; // tokens tile the text exactly, so counting newlines gives each one's line
  for (const t of toks) {
    const line = ln, nl = (t.raw as string).split("\n").length - 1;
    ln += nl;
    const end = line + (nl > 0 && /\n$/.test(t.raw) ? nl - 1 : nl);
    if (t.type === "space" || (t.type === "html" && t.raw.trim().startsWith("<!--"))) continue;
    if (t.type === "code") {
      const { lang, flags, attrs } = parseInfo(t.lang ?? "");
      if (attrs.def) continue; // hidden named source
      if (flags.has("run")) { out.push({ kind: "run", lang, text: t.text, name: attrs.id, line, end }); continue; }
    }
    out.push({ kind: "html", html: marked.parser(Object.assign([t], { links }) as any), line, end });
  }
  return out;
}

export function toBlocks(src: string): Block[] {
  const out: Block[] = []; let md: string[] = [], mdStart = 0;
  let pending: { at: Place; marker: number } | null = null; // a `<!-- @ x= y= -->` marker waiting for the block under it
  let al: { v: string; line: number } | null = null; // a `<!-- @center -->` line waiting for the block under it
  let cond: string | null = null; // a `<!-- if: condition -->` line waiting for the block under it: the block is shown only while the condition holds
  const takeIf = (b: Block) => { if (cond) { b.cond = cond; cond = null; } return b; };
  let dr: { id?: string; ons: On[]; line: number } | null = null; // `<!-- @id x -->` / `<!-- @on next: ... -->` lines waiting for the block under them
  const takeDir = (b: Block) => { if (dr) { if (dr.id) b.id = dr.id; if (dr.ons.length) b.ons = dr.ons; b.dir = dr.line; dr = null; } return b; };
  const takeAlign = (b: Block) => { if (al) { b.align = al.v; b.alignLine = al.line; al = null; } return takeDir(b); };
  const take = (b: Block) => { if (pending) { b.at = pending.at; b.marker = pending.marker; pending = null; } return takeAlign(b); };
  const push = (b: Raw, line: number, end: number, own = false) => {
    const blk = takeIf({ ...b, line, end } as Block);
    if (!own) out.push(take(blk));
    else { out.push(b.kind === "flash" ? takeAlign(blk) : b.kind === "img" ? takeDir(blk) : blk); pending = null; if (b.kind === "img") al = null; }
  };
  const flush = () => {
    if (md.length) { const got = markdownBlocks(md.join("\n"), mdStart); if (got.length) { take(got[0]); takeIf(got[0]); } out.push(...got); }
    md = [];
  };
  const lines = src.split("\n"); let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].match(/^\s*(`{3,}|~{3,})/);
    if (f) fence = fence ? (f[1][0] === fence ? null : fence) : f[1][0];
    if (!fence && /^:::\s*notes\s*$/.test(lines[i])) { flush(); while (i + 1 < lines.length && !/^:::\s*$/.test(lines[i + 1])) i++; i++; continue; }
    const ifm = !fence && !f ? lines[i].match(/^\s*<!--\s*if:\s*(.+?)\s*-->\s*$/) : null;
    if (ifm) { flush(); cond = ifm[1]; continue; }
    const od = !fence && !f ? lines[i].match(ON_LINE) : null, idm = !fence && !f ? lines[i].match(ID_LINE) : null;
    if (od || idm) { flush(); dr ??= { ons: [], line: i }; if (idm) dr.id = idm[1]; if (od) { const on = parseOn(od[1], od[2]); if (on) dr.ons.push(on); } continue; }
    const am = !fence && !f ? lines[i].match(ALIGN_LINE) : null;
    if (am) { flush(); al = { v: am[1], line: i }; continue; }
    const mk = !fence && !f ? parseMark(lines[i]) : null;
    if (mk) { flush(); pending = { at: mk, marker: i }; continue; }
    // `::: fx module.Effect k=v`: a background effect is a layer like a picture; a text effect is a block that flows and can be placed.
    const wr = !fence && !f ? readWrap(lines, i) : null; // `::: wrap module.Effect` ... `:::` puts the markdown inside it into the effect
    if (wr) { flush(); push({ kind: "wrap", fx: wr.fx, md: wr.body.join("\n") }, i, wr.close); i = wr.close; continue; }
    const fxd = !fence && !f ? parseFx(lines[i]) : null;
    if (fxd) { flush(); push({ kind: "fx", fx: fxd }, i, i, findEffect(fxd.id)?.effect.kind !== "text"); continue; }
    const med = !fence && !f ? lines[i].match(MEDIA_LINE) : null;
    const mdef = med ? parseMedia(med[1] as "video", med[2]) : null;
    if (mdef) { flush(); push({ kind: "media", def: mdef }, i, i); continue; }
    const trc = !fence && !f ? lines[i].match(TRACE_LINE) : null;
    if (trc) { flush(); push({ kind: "trace", def: traceOf(trc) }, i, i); continue; }
    if (!fence && /^:::\s*(?:when|after|every|on|macro|script|key)\s+\S/.test(lines[i])) { flush(); while (i + 1 < lines.length && !/^:::\s*$/.test(lines[i + 1])) i++; i++; continue; } // a rule or timer draws nothing; scanWhen / scanTimers read it
    if (!fence && /^:::\s*var\s+\S/.test(lines[i])) { flush(); continue; } // a variable declaration draws nothing; its default is read by parseDeck
    const inp = !fence && lines[i].match(/^:::\s*input\s+(.*)$/);
    const def = inp ? parseInput(inp[1]) : null;
    if (def) { flush(); push({ kind: "input", def }, i, i); continue; }
    const im = !fence && lines[i].match(/^:::\s*image\s+(.*)$/);
    const pic = im ? parseImage(im[1]) : null;
    if (pic) { flush(); push({ kind: "img", def: pic }, i, i, true); continue; } // pictures and flash regions carry their own x/y
    const fl = !fence && readFlash(lines, i);
    if (fl) { flush(); push({ kind: "flash", spec: fl.spec }, i, fl.close, true); i = fl.close; continue; }
    const m = !fence && lines[i].match(/^:::\s*button\s+(.*)$/);
    if (!m) { if (!md.length) mdStart = i; md.push(lines[i]); continue; }
    flush();
    const body: string[] = [], head = i;
    for (i++; i < lines.length && !/^:::\s*$/.test(lines[i]); i++) body.push(lines[i]);
    push({ kind: "btn", label: m[1].match(/"([^"]*)"/)?.[1] ?? "Button", cls: m[1].match(/class=(\S+)/)?.[1], acts: body.map(parseAct).filter(Boolean) as Act[] }, head, Math.min(i, lines.length - 1));
  }
  flush();
  return out;
}

/** Background effects (and ones whose module is missing) are layers, not blocks. */
export const isBgFx = (b: Block) => b.kind === "fx" && findEffect(b.fx.id)?.effect.kind !== "text";
/** The blocks that flow or get placed, in the order SlideView draws them (the Visual view relies on this order). */
export const flowBlocks = (all: Block[]) => all.filter((b) => b.kind !== "img" && !isBgFx(b));

// `images` replaces the slide's own pictures (the Visual view passes its in-progress drag); `plain` makes the text layer
// inert so the Visual view can treat the slide as a layout surface.
interface Props { slide: Slide; slideKey: number; reveal: boolean; tools: Record<string, boolean>; edits: Map<string, string>; images?: ImageDef[]; plain?: boolean; align?: string }
/** A slide's own `font:`, `headingfont:` and `codefont:` options as CSS variables (the deck-wide ones come from :root). */
const fontVars = (o: Record<string, string>): React.CSSProperties => {
  const v: Record<string, string> = {};
  const b = resolveFamily(o.font), h = resolveFamily(o.headingfont), c = resolveFamily(o.codefont);
  if (b) v["--body-font"] = b; if (h) v["--head-font"] = h; if (c) v["--code-font"] = c;
  return v as React.CSSProperties;
};
const alignOf = (v?: string) => (v === "left" || v === "center" || v === "right" || v === "justify" ? v : undefined);
const ac = (b: { align?: string }) => (b.align ? " a-" + b.align : "");

/** `fit=scale`: the content is laid out `lw` percent of the slide wide, then stretched on X and Y to fill the box it sits in. */
function Scaled({ lw, children }: { lw: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!, box = el.parentElement!;
    const fit = () => { const nw = el.offsetWidth, nh = el.offsetHeight; if (nw && nh) el.style.scale = `${box.clientWidth / nw} ${box.clientHeight / nh}`; };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el); ro.observe(box);
    return () => ro.disconnect();
  }, [lw]);
  return <div ref={ref} className="sc" style={{ width: `${lw}cqw` }}>{children}</div>;
}

export function SlideView({ slide, slideKey, reveal, tools, edits, images, plain, align }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const api = useContext(DeckCtx);
  const reg = useMemo(() => new Map<string, BlockHandle>(), []);
  const all = useMemo(() => toBlocks(slide.src), [slide.src]);
  const blocks = useMemo(() => flowBlocks(all), [all]);
  const bgfx = useMemo(() => all.flatMap((b) => (isBgFx(b) && b.kind === "fx" ? [b.fx] : [])), [all]);
  const pics = useMemo(() => all.flatMap((b) => (b.kind === "img" ? [b.def] : [])), [all]);
  const picBlocks = useMemo(() => all.filter((b) => b.kind === "img"), [all]);
  const back = useMemo(() => backdropOf(slide.opts), [slide.opts]);
  const free = useRef<HTMLDivElement>(null);
  const al = alignOf(slide.opts.align ?? align); // slide-wide default; a block's own alignment overrides it
  useSyncExternalStore(api.subscribe, api.snapshot); // re-render when an input box changes, so {{name}} text follows it

  // Slides never scroll: if the flowing content is taller than the slide, everything in it (text, code, boxes) shrinks
  // together by `k` until it fits, and grows back when there is room again.
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useEffect(() => setK(1), [slide.id]);
  useLayoutEffect(() => {
    const el = root.current, bx = box.current; if (!el || !bx) return;
    const step = () => {
      const cs = getComputedStyle(el), avail = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), need = bx.offsetHeight;
      if (avail <= 0 || need <= 0) return;
      setK((cur) => {
        const want = Math.max(0.3, Math.min(1, (cur * avail * 0.995) / need));
        const next = want < cur || (want > cur && need < avail * 0.96) ? want : cur; // only grow when there is real slack
        return Math.abs(next - cur) < 0.01 ? cur : next;
      });
    };
    step();
    const ro = new ResizeObserver(step); ro.observe(el); ro.observe(bx);
    return () => ro.disconnect();
  }, [slide.id, slide.src]);

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(root.current!);
    return () => ro.disconnect();
  }, []);

  // GSAP: stagger the slide's blocks in once, when the slide is shown.
  useEffect(() => {
    if (!reveal) return;
    const ctx = gsap.context(() => {
      const els = [...(root.current?.parentElement?.querySelectorAll(".blk") ?? [])]; // flowing and placed blocks alike
      gsap.from(els, { y: 22, opacity: 0, duration: 0.5, stagger: 0.12, ease: "power2.out", delay: 0.12 });
    }, root);
    return () => ctx.revert();
  }, [slideKey, reveal]);

  const rules = useMemo(() => scanWhen(slide.src), [slide.src]);
  const latest = useRef<(acts: Act[]) => Promise<void>>(async () => {});
  // `::: when <condition>`: fires when the condition turns true while this slide is up (arriving with it already true does nothing, so Left never bounces you forward).
  useEffect(() => {
    if (!rules.length) return;
    const truth = () => rules.map((r) => { try { return api.holds(r.cond); } catch { return false; } });
    let was = truth();
    return api.subscribe(() => {
      const now = truth(), before = was; was = now;
      if (api.presenting()) now.forEach((v, i) => { if (v && !before[i]) void latest.current(rules[i].acts); });
    });
  }, [rules, api]);
  // Timers belong to this slide: they all stop when it is left or when a `cancel` action runs.
  const timers = useRef(new Set<number>());
  const stopTimers = () => { timers.current.forEach((id) => { clearTimeout(id); clearInterval(id); }); timers.current.clear(); };
  useEffect(() => stopTimers, []);
  const timed = useMemo(() => scanTimers(slide.src), [slide.src]);
  useEffect(() => { // `::: after 3s` / `::: every 1s` blocks start with the slide, but only while presenting (editing stays quiet)
    if (!timed.length || !api.presenting()) return;
    timed.forEach((t) => {
      const id = t.kind === "after" ? window.setTimeout(() => void latest.current(t.acts), t.ms) : window.setInterval(() => void latest.current(t.acts), t.ms);
      timers.current.add(id);
    });
    return stopTimers;
  }, [timed, api]);
  // `::: on ...` rules: enter / leave / key / change (all only while presenting).
  const ons = useMemo(() => scanOn(slide.src), [slide.src]);
  useEffect(() => {
    if (!ons.length || !api.presenting()) return;
    ons.forEach((o) => { if (o.event === "enter" && (!o.once || api.firstVisit(`on:${slide.id}:${o.line}`))) void latest.current(o.acts); });
    return () => { ons.forEach((o) => { if (o.event === "leave" && (!o.once || api.firstVisit(`off:${slide.id}:${o.line}`))) void latest.current(o.acts); }); };
  }, [ons, api, slide.id]);
  useEffect(() => {
    const keys = ons.filter((o) => o.event === "key");
    if (!keys.length) return;
    const h = (e: KeyboardEvent) => {
      if (!api.presenting() || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest?.("input, textarea, select, .monaco-editor")) return;
      const k = e.key === " " ? "space" : e.key.toLowerCase();
      keys.forEach((o) => { if (o.arg.toLowerCase().split(/[\s,]+/).includes(k)) { e.preventDefault(); void latest.current(o.acts); } });
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [ons, api]);
  useEffect(() => {
    const ch = ons.filter((o) => o.event === "change" && o.arg);
    if (!ch.length) return;
    const read = () => ch.map((o) => api.input(o.arg));
    let was = read(), busy = false; // changes made by the rule's own actions are ignored, so a rule can't trigger itself forever
    return api.subscribe(() => {
      const now = read(), before = was; was = now;
      if (busy || !api.presenting()) return;
      const hit = ch.filter((_, i) => now[i] !== before[i]);
      if (hit.length) { busy = true; void Promise.all(hit.map((o) => latest.current(o.acts))).finally(() => { busy = false; was = read(); }); }
    });
  }, [ons, api]);
  const keyed = useMemo(() => scanKeys(slide.src), [slide.src]);
  useEffect(() => { // `::: key a`: the key runs its actions while presenting (a key held down counts once)
    if (!keyed.length) return;
    const on = (e: KeyboardEvent) => {
      if (!api.presenting() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement).closest?.("input, select, textarea, .monaco-editor")) return;
      const hit = keyed.filter((k) => k.key === e.key.toLowerCase());
      if (hit.length) { e.preventDefault(); hit.forEach((k) => void latest.current(k.acts)); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [keyed, api]);
  const depth = useRef(0);
  const subst = (line: string, args: string[]) => line.replace(/\$(\*|\d)/g, (_, k) => (k === "*" ? args.join(" ") : args[+k - 1] ?? ""));
  const perform = async (acts: Act[]): Promise<void> => {
    for (const a of acts) {
      if (a.op === "wait") { await new Promise((r) => setTimeout(r, a.ms)); continue; }
      if (a.op === "if") { let ok = false; try { ok = truthy(api.calc(a.cond)); } catch { /* the editor flags a bad condition */ } await perform(ok ? [a.then] : a.else ? [a.else] : []); continue; }
      if (a.op === "repeat") { for (let k = 0; k < a.n; k++) await perform([a.act]); continue; }
      if (a.op === "toggle") { api.setInput(a.name, truthy(fromStored(api.input(a.name))) ? "false" : "true"); continue; }
      if (a.op === "random") {
        try { const lo = Math.round(toNum(api.calc(a.lo))), hi = Math.round(toNum(api.calc(a.hi))), [x, y] = lo <= hi ? [lo, hi] : [hi, lo]; api.setInput(a.name, String(x + Math.floor(Math.random() * (y - x + 1)))); } catch { /* flagged in the editor */ }
        continue;
      }
      if (a.op === "call") {
        const lines = api.macro(a.name);
        if (!lines || depth.current > 20) continue; // an unknown macro does nothing; a macro that keeps calling itself stops after 20 levels
        depth.current++;
        try { await perform(lines.map((l) => parseAct(subst(l, a.args).trim())).filter(Boolean) as Act[]); } finally { depth.current--; }
        continue;
      }
      if (a.op === "script") { await api.runScript(a.name, a.args, async (line) => { const x = parseAct(line.trim()); if (x) await perform([x]); }); continue; }
      if (a.op === "reset") { api.reset(a.name); continue; }
      if (a.op === "after") { const id = window.setTimeout(() => { timers.current.delete(id); void latest.current([a.act]); }, a.ms); timers.current.add(id); continue; }
      if (a.op === "every") { timers.current.add(window.setInterval(() => void latest.current([a.act]), a.ms)); continue; }
      if (a.op === "cancel") { stopTimers(); continue; }
      if (a.op === "goto") { api.goto(a.n); continue; }
      if (a.op === "play") { void api.sound.play(a.name, { vol: a.vol, pitch: a.pitch }); continue; }
      if (a.op === "add" || a.op === "sub") {
        try { const d = toNum(api.calc(a.v)); api.setInput(a.name, show(toNum(fromStored(api.input(a.name))) + (a.op === "add" ? d : -d))); } catch { /* the editor's checks flag a bad calculation */ }
        continue;
      }
      if (a.op === "put") { let v = a.v; if (a.calc) { try { v = show(api.calc(a.v)); } catch { /* not a calculation: store the text */ } } api.setInput(a.name, v); continue; }
      if (a.op === "branch") { api.branch(a.n); continue; }
      if (a.op === "proceed") { api.proceed(); continue; }
      if (a.op === "back") { api.back(); continue; }
      const h = reg.get(a.id);
      if (!h) continue;
      if (a.op === "set") {
        try {
          const src = api.getSource(a.ref);
          const text = src ? src.text : await api.readFile(a.ref);
          h.setCode(text, a.as ?? src?.lang ?? extLang(a.ref));
        } catch (e) { h.note(`Couldn't load ${a.ref}: ${e}`); }
      } else if (a.op === "run") await h.run();
      else if (a.op === "start") h.start?.();
      else if (a.op === "stop") h.stop?.();
      else h.show(a.op === "show");
    }
  };
  latest.current = perform;

  // Scripted actions (`<!-- @on next: ... -->`): armed when the slide is shown, never while the Visual view is laying it out.
  useEffect(() => {
    if (plain) return;
    const scope = root.current?.parentElement; if (!scope) return;
    let alive = true; const undo: (() => void)[] = [];
    const runner: Runner = {
      find: (t) => scope.querySelector<HTMLElement>(`[data-id="${t.replace(/"/g, "")}"]`),
      act: (line) => { const a = parseAct(line); return a ? perform([a]) : undefined; },
      still: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
      alive: () => alive,
    };
    const owners = [
      ...blocks.map((b, i) => ({ b, self: () => scope.querySelector<HTMLElement>(`[data-blk="${i}"]`) })),
      ...picBlocks.map((b, n) => ({ b, self: () => scope.querySelector<HTMLElement>(`[data-pn="${n}"]`) })),
    ].filter((o) => o.b.ons?.length).sort((a, b) => a.b.line - b.b.line); // Next presses use them in the order they appear in the file
    for (const { b, self } of owners) for (const on of b.ons!) {
      hideUntilEntrance(on.chain, self(), runner.find);
      const go = () => { runChain(on.chain, runner, self()); };
      if (on.when === "next") undo.push(api.armNext(go));
      else if (on.when === "enter") { if (api.presenting()) { const t = setTimeout(go, reveal ? 900 : 0); undo.push(() => clearTimeout(t)); } }
      else { const el = self(); if (el) { el.addEventListener("click", go); el.style.cursor = "pointer"; undo.push(() => el.removeEventListener("click", go)); } }
    }
    return () => { alive = false; undo.forEach((f) => f()); };
  }, [slide.src, plain, reveal]);

  // One block. `data-blk` lets the Visual view find it; a block with `at` is positioned on the slide instead of flowing.
  let flashes = 0;
  const flashAt = blocks.map((b) => (b.kind === "flash" ? flashes++ : -1));
  const node = (b: Block, i: number) => {
    if (b.cond && api.presenting()) { try { if (!api.holds(b.cond)) return null; } catch { /* a bad condition shows the block; the editor flags it */ } } // show-if: hidden while the condition is false (the editor always shows everything)
    const key = `${slide.id}:${i}`;
    const tag = { "data-blk": i, "data-kind": b.kind, "data-placed": b.at ? "1" : undefined, "data-rot": b.at?.rot ? "1" : undefined, "data-id": b.id ?? (b.kind === "run" ? b.name : undefined), ...(flashAt[i] >= 0 ? { "data-fl": flashAt[i] } : {}) };
    const place: React.CSSProperties | undefined = b.at ? { left: `${b.at.x}%`, top: `${b.at.y}%`, width: b.at.w !== undefined ? `${b.at.w}%` : undefined, height: b.at.h !== undefined ? `${b.at.h}%` : undefined, ...(b.at.z !== undefined ? { zIndex: 10 + b.at.z } : null), ...(b.at.rot ? { rotate: `${b.at.rot}deg` } : null) } : undefined;
    const cls = (c = "") => `blk ${c}${b.cond ? " cin" : ""}${b.at ? " abs" : ""}${b.at?.h !== undefined ? " hh" : ""}${b.at?.fit === "scale" ? " sx" : ""}${ac(b)}`.trim();
    const sc = (c: React.ReactNode) => (b.at?.fit === "scale" ? <Scaled lw={b.at.lw!}>{c}</Scaled> : c);
    if (b.kind === "run") return <div className={cls()} style={place} key={i} {...tag}>{sc(<CodeBlock editKey={`${slide.id}:${i}`} name={b.name} srcId={slide.id} lang={b.lang} code={b.text} tools={tools} edits={edits} />)}</div>;
    if (b.kind === "btn") { const acts = b.acts; return <div className={cls("btn")} style={place} key={i} {...tag}><button className={`ibtn ${b.cls ?? ""}`} onClick={() => perform(acts)}>{b.label}</button></div>; }
    if (b.kind === "input") { const d = b.def; return <div className={cls("inp")} style={place} key={i} {...tag}><InputBox def={d} onRun={d.run ? () => { reg.get(d.run!)?.run(); } : undefined} /></div>; }
    if (b.kind === "media") { const d = b.def; return <div className={cls("med")} style={place} key={i} {...tag}>{sc(<MediaBlock def={d} />)}</div>; }
    if (b.kind === "trace") {
      const d = b.def, Part = d.part ? PART[d.part] : null; // a part is one element; a plain `trace` is all of them in one box
      return <div className={cls("trc" + (d.part ? ` tpart-${d.part}` : ""))} style={place} key={i} {...tag}>{sc(Part ? <Part def={d} /> : <TraceComposite def={d} onSplit={() => api.splitTrace(slide.id, { line: b.line, marker: b.marker, at: b.at })} />)}</div>;
    }
    if (b.kind === "flash") {
      return b.spec.x !== undefined && b.spec.y !== undefined
        ? <FlashRegion key={i} spec={b.spec} paused={plain} runKey={key} tag={tag} /> // placed absolutely, so no animated wrapper around it
        : <div className={cls()} key={i}><FlashRegion spec={b.spec} paused={plain} runKey={key} tag={tag} /></div>;
    }
    if (b.kind === "wrap") {
      const ef = findEffect(b.fx.id)?.effect;
      const parts = splitParts(b.md);
      // The inside of a wrapper is made of real blocks, so a ```lang run fence is a live editor (with Run) and not just coloured text.
      // Text wrappers (GradientText...) only take the content's words, so they skip this.
      const body = (md: string, pi: number) => ef?.plain ? null : markdownBlocks(md, 0).map((w, n) => w.kind === "run"
        ? <CodeBlock key={n} editKey={`${slide.id}:${i}:${pi}.${n}`} name={w.name} srcId={slide.id} lang={w.lang} code={w.text} tools={tools} edits={edits} />
        : w.kind === "html" ? <div className="wh" key={n} dangerouslySetInnerHTML={{ __html: api.fill(w.html, true) }} /> : null);
      const kids = ef?.parts ? parts.map((p, pi) => <div className="wrapped" key={pi}>{body(p, pi)}</div>) : <div className="wrapped">{parts.map((p, pi) => <Fragment key={pi}>{body(p, pi)}</Fragment>)}</div>;
      const still = <div className="wrapped" dangerouslySetInnerHTML={{ __html: api.fill(parts.map((p) => marked.parse(p) as string).join(""), true) }} />; // shown for a moment while the effect loads
      return <div className={cls(`fx fxk-${b.fx.id.split(".").pop()}`)} style={place} key={i} {...tag}>{sc(<Fx id={b.fx.id} attrs={b.fx.attrs} plain={api.fill(parts.join(" ").replace(/[*_`#>]/g, "").trim())} fallback={still}>{kids}</Fx>)}</div>;
    }
    if (b.kind === "fx") { const filled = findEffect(b.fx.id)?.effect.fill; const a = b.fx.attrs.text !== undefined ? { ...b.fx.attrs, text: api.fill(b.fx.attrs.text) } : b.fx.attrs; return <div className={cls(`fx fxk-${b.fx.id.split(".").pop()}${filled ? " fill" : ""}`)} style={place} key={i} {...tag}>{sc(<Fx id={b.fx.id} attrs={a} />)}</div>; }
    if (b.kind === "html") return b.at?.fit === "scale"
      ? <div className={cls()} style={place} key={i} {...tag}>{sc(<div dangerouslySetInnerHTML={{ __html: api.fill(b.html, true) }} />)}</div>
      : <div className={cls()} style={place} key={i} {...tag} dangerouslySetInnerHTML={{ __html: api.fill(b.html, true) }} />;
    return null;
  };

  return (
    <FontCtx.Provider value={Math.max(7, Math.round(width * 0.018 * k))}>
      <RegCtx.Provider value={reg}>
        <>
        <Backdrop back={back} />
        {bgfx.length > 0 && <div className="fxbg">{bgfx.map((d, k) => <Fx key={k} id={d.id} attrs={d.attrs} />)}</div>}
        <div className={"in" + (plain ? " plain" : "") + (al ? " a-" + al : "")} ref={root} style={{ ...inkStyle(back), ...fontVars(slide.opts), "--k": k } as React.CSSProperties}>
          <div className="fitbox" ref={box}>{blocks.map((b, i) => (b.at ? null : node(b, i)))}</div>
        </div>
        {blocks.some((b) => b.at) && (
          <div className={"in free" + (plain ? " plain" : "") + (al ? " a-" + al : "")} ref={free} style={{ ...inkStyle(back), ...fontVars(slide.opts) }}>
            {blocks.map((b, i) => (b.at ? node(b, i) : null))}
          </div>
        )}
        <ImageLayer defs={images ?? pics} ids={picBlocks.map((b) => b.id)} />
        </>
      </RegCtx.Provider>
    </FontCtx.Provider>
  );
}

// Static, cheap rendering for the Slides panel. Memoised so only the slide being edited re-renders.
export const Thumb = memo(function Thumb({ src, align }: { src: string; align?: string }) {
  const api = useContext(DeckCtx);
  const all = useMemo(() => toBlocks(src), [src]);
  const blocks = useMemo(() => flowBlocks(all), [all]);
  const pics = useMemo(() => all.flatMap((b) => (b.kind === "img" ? [b.def] : [])), [all]);
  const opts = useMemo(() => parseOpts(src), [src]);
  const back = useMemo(() => backdropOf(opts), [opts]);
  const al = alignOf(opts.align ?? align);
  const thumbNode = (b: Block, i: number) => {
    const style: React.CSSProperties | undefined = b.at ? { left: `${b.at.x}%`, top: `${b.at.y}%`, width: b.at.w !== undefined ? `${b.at.w}%` : undefined, height: b.at.h !== undefined ? `${b.at.h}%` : undefined, ...(b.at.z !== undefined ? { zIndex: 10 + b.at.z } : null), ...(b.at.rot ? { rotate: `${b.at.rot}deg` } : null) } : undefined;
    const cls = (c = "") => `blk ${c}${b.at ? " abs" : ""}${b.at?.h !== undefined ? " hh" : ""}${b.at?.fit === "scale" ? " sx" : ""}${ac(b)}`.trim();
    return b.kind === "run" ? <pre className={cls()} style={style} key={i}><code>{b.text}</code></pre>
      : b.kind === "btn" ? <div className={cls("btn")} style={style} key={i}><span className="ibtn">{b.label}</span></div>
      : b.kind === "input" ? <div className={cls("inp")} style={style} key={i}><label className="ibox"><span>{b.def.label}</span><div><input readOnly value={b.def.def} /></div></label></div>
      : b.kind === "flash" ? <div className={cls()} key={i}><div className="flash framed" style={flashBox(b.spec)} /></div>
      : b.kind === "media" ? <div className={cls("med")} style={style} key={i}><div className="media thumbmedia">{b.def.kind === "video" ? "▶ " : "♪ "}{b.def.src.split(/[\\/]/).pop()}</div></div>
      : b.kind === "trace" ? <div className={cls("trc")} style={style} key={i}><div className="trace-box thumbtrace">{b.def.part ? `trace ${b.def.part}` : b.def.title}</div></div>
      : b.kind === "fx" ? <div className={cls()} style={style} key={i}>{b.fx.attrs.text}</div>
      : b.kind === "wrap" ? <div className={cls()} style={style} key={i} dangerouslySetInnerHTML={{ __html: splitParts(b.md).map((p) => marked.parse(p) as string).join("") }} />
      : b.kind === "html" ? <div className={cls()} style={style} key={i} dangerouslySetInnerHTML={{ __html: api.fill(b.html, true) }} /> : null;
  };
  return (
    <div className="slide thumb">
      <Backdrop back={back} />
      <div className={"in" + (al ? " a-" + al : "")} style={{ ...inkStyle(back), ...fontVars(opts) }}>{blocks.map((b, i) => (b.at ? null : thumbNode(b, i)))}</div>
      {blocks.some((b) => b.at) && <div className={"in free" + (al ? " a-" + al : "")} style={{ ...inkStyle(back), ...fontVars(opts) }}>{blocks.map((b, i) => (b.at ? thumbNode(b, i) : null))}</div>}
      <ImageLayer defs={pics} />
    </div>
  );
});
