import { parseAct, parseInfo, scanInputs, type Deck } from "./itsd";
import { parseImage } from "./images";
import { readFlash } from "./flash";
import { parseFx } from "./modules/fxEdit";
import { findEffect } from "./modules/registry";
import { ID_LINE, ON_LINE, parseChain, ACTION_VERBS } from "./motion";

export interface Problem { line: number; message: string; severity: "error" | "warning" } // line is 0-based
const RUNNERS = new Set(["c", "cpp", "rust", "go", "python", "node", "java"]);

export function lint(text: string, deck: Deck): Problem[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: Problem[] = [];
  const seen = new Set<string>();
  deck.slides.forEach((s) => scanInputs(s.src).forEach(({ line, def }) => {
    if (seen.has(def.name)) out.push({ line: s.line + line, message: `Input "${def.name}" is already defined; boxes with the same name share one value`, severity: "warning" });
    seen.add(def.name);
  }));
  deck.slides.forEach((s, k) => {
    const end = k + 1 < deck.slides.length ? deck.slides[k + 1].line - 1 : lines.length;
    const ids = new Set<string>();
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
    for (let n = s.line; n < end; n++) {
      if (!/^:::\s*button\b/.test(lines[n])) continue;
      for (n++; n < end && !/^:::\s*$/.test(lines[n]); n++) {
        const t = lines[n].trim();
        if (!t) continue;
        const a = parseAct(t);
        if (!a) { out.push({ line: n, message: `Unknown action: ${t}`, severity: "error" }); continue; }
        if (a.op === "goto") {
          if (a.n < 1 || a.n > deck.slides.length) out.push({ line: n, message: `There is no slide ${a.n}`, severity: "error" });
          continue;
        }
        if (!ids.has(a.id)) out.push({ line: n, message: `No block with id "${a.id}" on this slide`, severity: "error" });
        if (a.op === "set" && !deck.sources[a.ref] && !a.ref.includes("."))
          out.push({ line: n, message: `"${a.ref}" is neither a def= source nor a file`, severity: "warning" });
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
