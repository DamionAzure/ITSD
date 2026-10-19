import { parseExpr, ExprError } from "./expr";
import { parseDelay, parseKey, parseAct, type Act, parseInfo, scanInputs, type Deck } from "./itsd";
import { parseImage } from "./images";
import { readFlash } from "./flash";
import { scanTraces } from "./traceBlock";
import { parseFx } from "./modules/fxEdit";
import { findEffect } from "./modules/registry";
import { fontRefs, isFontPath } from "./fonts";
import { ID_LINE, ON_LINE, parseChain, ACTION_VERBS } from "./motion";

export interface Problem { line: number; message: string; severity: "error" | "warning" } // line is 0-based
const RUNNERS = new Set(["c", "cpp", "rust", "go", "python", "node", "java"]);

export function lint(text: string, deck: Deck): Problem[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: Problem[] = [];
  const seen = new Set<string>();
  const fl = lines.findIndex((l, i) => i < 40 && /^fonts\s*:/i.test(l));
  if (fl >= 0) {
    const refs = fontRefs(deck.meta);
    refs.forEach((r, i) => {
      if (!isFontPath(r)) out.push({ line: fl, message: `"${r}" in fonts: isn't a font file (.ttf, .otf, .woff, .woff2)`, severity: "error" });
      else if (refs.indexOf(r) !== i) out.push({ line: fl, message: `Font "${r}" is listed twice`, severity: "warning" });
    });
  }
  deck.slides.forEach((s) => scanInputs(s.src).forEach(({ line, def }) => {
    if (seen.has(def.name)) out.push({ line: s.line + line, message: `Input "${def.name}" is already defined; boxes with the same name share one value`, severity: "warning" });
    seen.add(def.name);
  }));
  let sawMain = false;
  deck.slides.forEach((s) => {
    const b = s.opts.branch;
    if (b === undefined) { sawMain = true; return; }
    if (!/^[1-9]\d*$/.test(b.trim())) out.push({ line: s.line, message: `branch: needs a number like 1, 2 or 3 (got "${b}")`, severity: "error" });
    else if (!sawMain) out.push({ line: s.line, message: "A branch slide needs a main slide before it to hang off", severity: "warning" });
  });
  const runIds = new Set(lines.flatMap((l) => { const m = l.match(/^\s*(?:`{3,}|~{3,})(.+)$/); return m && parseInfo(m[1]).flags.has("run") && parseInfo(m[1]).attrs.id ? [parseInfo(m[1]).attrs.id] : []; }));
  deck.slides.forEach((s) => scanTraces(s.src).forEach(({ line, def }) => {
    if (def.from && !runIds.has(def.from)) out.push({ line: s.line + line, message: `No run block with id "${def.from}" in the deck (add id=${def.from} to the fence of the block that prints @itsd lines)`, severity: "warning" });
  }));
  const calcOk = (src: string, n: number, what = "calculate") => { try { parseExpr(src); } catch (e) { out.push({ line: n, message: `Can't ${what} "${src}": ${e instanceof ExprError ? e.message : e}`, severity: "error" }); } };
  // One action (and, for if / repeat / after / every, the action inside it). `ids` is the current slide's block ids (set per slide below).
  let ids = new Set<string>();
  const checkAct = (a: NonNullable<ReturnType<typeof parseAct>>, n: number, t: string): void => {
    if (a.op === "after" || a.op === "every") return checkAct(a.act, n, t);
    if (a.op === "repeat") return checkAct(a.act, n, t);
    if (a.op === "if") { calcOk(a.cond, n, "read this condition"); checkAct(a.then, n, t); if (a.else) checkAct(a.else, n, t); return; }
    if (a.op === "goto") { if (a.n < 1 || a.n > deck.slides.length) out.push({ line: n, message: `There is no slide ${a.n}`, severity: "error" }); return; }
    if (a.op === "add" || a.op === "sub" || (a.op === "put" && a.calc)) return calcOk(a.v, n);
    if (a.op === "random") { calcOk(a.lo, n); calcOk(a.hi, n); return; }
    if (a.op === "call") { if (!deck.macros[a.name]) out.push({ line: n, message: `There is no macro called "${a.name}" (define it with ::: macro ${a.name})`, severity: "error" }); return; }
    if (a.op === "script") { if (deck.scripts[a.name] === undefined) out.push({ line: n, message: `There is no script called "${a.name}" (define it with ::: script ${a.name})`, severity: "error" }); return; }
    if (a.op === "play" || a.op === "cancel" || a.op === "put" || a.op === "branch" || a.op === "proceed" || a.op === "back" || a.op === "wait" || a.op === "toggle" || a.op === "reset") return;
    if (!ids.has(a.id)) out.push({ line: n, message: `No block with id "${a.id}" on this slide`, severity: "error" });
    if (a.op === "set" && !deck.sources[a.ref] && !a.ref.includes(".")) out.push({ line: n, message: `"${a.ref}" is neither a def= source nor a file`, severity: "warning" });
  };
  deck.slides.forEach((s, k) => {
    const end = k + 1 < deck.slides.length ? deck.slides[k + 1].line - 1 : lines.length;
    ids = new Set<string>();
    for (let n = s.line; n < end; n++) {
      const m = lines[n].match(/^\s*(?:`{3,}|~{3,})(.+)$/);
      if (!m) continue;
      const { lang, flags, attrs } = parseInfo(m[1]);
      if (attrs.id) {
        if (ids.has(attrs.id)) out.push({ line: n, message: `Duplicate block id "${attrs.id}" on this slide`, severity: "error" });
        ids.add(attrs.id);
      }
      if (flags.has("run") && !RUNNERS.has(lang)) out.push({ line: n, message: `No runner for "${lang}"`, severity: "warning" });
    }
    let fenceCh: string | null = null;
    for (let n = s.line; n < end; n++) { const mi = lines[n].match(/^:::\s*(video|audio|slideshow)\b.*\bid=(\w+)/); if (mi) ids.add(mi[2]); }
    for (let n = s.line; n < end; n++) {
      const f = lines[n].match(/^\s*(`{3,}|~{3,})/);
      if (f) { fenceCh = fenceCh ? (f[1][0] === fenceCh ? null : fenceCh) : f[1][0]; continue; }
      const m = !fenceCh && lines[n].match(/^:::\s*image\b\s*(.*)$/);
      if (m && !parseImage(m[1])) out.push({ line: n, message: 'Image needs a file: ::: image "assets/pic.png" x=10 y=10 w=30 h=30', severity: "error" });
      const fx = !fenceCh && parseFx(lines[n]);
      if (fx && !findEffect(fx.id)) out.push({ line: n, message: `Effect "${fx.id}" isn't available: its module isn't installed (see Modules in FORMAT.md). The deck still works without it.`, severity: "warning" });
      const fl = !fenceCh && readFlash(lines, n, end);
      if (fl) {
        const id = fl.spec.id;
        if (id) { if (ids.has(id)) out.push({ line: n, message: `Duplicate block id "${id}" on this slide`, severity: "error" }); ids.add(id); }
        fl.spec.problems.forEach((p) => out.push({ line: p.bodyLine < 0 ? n : n + 1 + p.bodyLine, message: p.message, severity: p.severity }));
        n = fl.close;
      }
    }
    for (const { line, def } of scanInputs(s.src)) {
      if (def.run && !ids.has(def.run)) out.push({ line: s.line + line, message: `No block with id "${def.run}" on this slide`, severity: "error" });
      if (def.live && !def.run) out.push({ line: s.line + line, message: '"live" needs run=<block id>', severity: "warning" });
    }
    const bad = (e: unknown) => (e instanceof ExprError ? e.message : String(e));
    for (let n = s.line; n < end; n++) {
      const cm = lines[n].match(/^:::\s*when\s+(.+)$/) ?? lines[n].match(/^\s*<!--\s*if:\s*(.+?)\s*-->\s*$/); // a when rule or a show-if marker
      if (cm) {
        try { if (parseExpr(cm[1].trim()).impure) out.push({ line: n, message: "random() and pick() can't be used in a condition (it would change on every look). Roll first: put roll = random(1, 6)", severity: "error" }); }
        catch (e) { out.push({ line: n, message: `Can't read this condition: ${bad(e)}`, severity: "error" }); }
      }
      const tm = lines[n].match(/^:::\s*(after|every)\s*(\S*)\s*$/);
      if (tm && parseDelay(tm[2]) === null) out.push({ line: n, message: `${tm[1]} needs a time like 3s, 1.5s or 500ms`, severity: "error" });
      const km = lines[n].match(/^:::\s*key\s*(\S*)\s*$/);
      if (km && !parseKey(km[1])) out.push({ line: n, message: "key needs a letter, a digit or one of enter, up, down (Space, Left, Right, PageUp, PageDown and Escape already move through the deck)", severity: "error" });
      const on = lines[n].match(/^:::\s*on\b\s*(\S*)\s*(.*)$/);
      if (on) {
        if (!["enter", "leave", "key", "change"].includes(on[1])) out.push({ line: n, message: `on needs an event: enter, leave, key or change (not "${on[1]}")`, severity: "error" });
        else if ((on[1] === "key" || on[1] === "change") && !on[2].trim()) out.push({ line: n, message: on[1] === "key" ? "on key needs the key(s), like: on key r space" : "on change needs a variable name", severity: "error" });
        else if (on[1] === "change" && deck.inputs[on[2].trim()] === undefined && !deck.slides.some((x) => new RegExp(`\\b(?:put|add|sub|toggle|random)\\s+${on[2].trim()}\\b`).test(x.src))) out.push({ line: n, message: `Nothing in the deck defines or changes "${on[2].trim()}"`, severity: "warning" });
      }
      const sc = lines[n].match(/^:::\s*script\s+\w+\s*$/);
      if (sc) { // a syntax check only: the code is compiled, never run
        const body: string[] = []; let k = n + 1; while (k < end && !/^:::\s*$/.test(lines[k])) body.push(lines[k++]);
        try { new (Object.getPrototypeOf(async function () {}).constructor)(body.join("\n")); } catch (e) { out.push({ line: n, message: `Script problem: ${e instanceof Error ? e.message : e}`, severity: "error" }); }
        n = k; continue;
      }
      if (!/^:::\s*(?:button|when|after|every|on|macro|key)\b/.test(lines[n])) continue;
      for (n++; n < end && !/^:::\s*$/.test(lines[n]); n++) {
        const t = lines[n].trim();
        if (!t) continue;
        const a = parseAct(t);
        if (!a) { out.push({ line: n, message: `Unknown action: ${t}`, severity: "error" }); continue; }
        checkAct(a, n, t);
      }
    }
    // scripted actions: `<!-- @on next: rotate this 90 -> fade title out -->`
    const named = new Set(ids); let fc: string | null = null;
    for (let n = s.line; n < end; n++) { const f = lines[n].match(/^\s*(`{3,}|~{3,})/); if (f) { fc = fc ? (f[1][0] === fc ? null : fc) : f[1][0]; continue; } const m = !fc && lines[n].match(ID_LINE); if (m) { if (named.has(m[1])) out.push({ line: n, message: `Duplicate block id "${m[1]}" on this slide`, severity: "error" }); named.add(m[1]); } }
    fc = null;
    for (let n = s.line; n < end; n++) {
      const f = lines[n].match(/^\s*(`{3,}|~{3,})/);
      if (f) { fc = fc ? (f[1][0] === fc ? null : fc) : f[1][0]; continue; }
      const m = !fc && lines[n].match(ON_LINE);
      if (!m) continue;
      const { chain, errors } = parseChain(m[2]);
      errors.forEach((e) => out.push({ line: n, message: e, severity: "error" }));
      for (const st of chain.flat()) {
        if (st.verb === "goto" || st.verb === "wait" || !ACTION_VERBS.has(st.verb)) continue;
        if (st.target && st.target !== "this" && !named.has(st.target)) out.push({ line: n, message: `Nothing named "${st.target}" on this slide: put <!-- @id ${st.target} --> above the block`, severity: "warning" });
      }
    }
  });
  return out;
}
