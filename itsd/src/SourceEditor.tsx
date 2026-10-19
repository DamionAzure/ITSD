import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { monaco, MONO } from "./monaco";
import type { Problem } from "./lint";
import { alignEdits, buildEdits, plan, planAlign, type Align, type AlignPlan, type Edit, type Fmt, type Plan } from "./format";
import { FormatPanel } from "./FormatPanel";
import { canInsertAt, fxSnippet } from "./modules/fxEdit";
import { findEffect } from "./modules/registry";

export interface EditorApi { insert(text: string): void; replaceAll(text: string): void; reveal(line: number): void; undo(): void; redo(): void }
interface Props { value: string; onChange: (v: string) => void; onCursor: (line: number, col: number) => void; onSave: () => void; problems: Problem[] }

export const SourceEditor = forwardRef<EditorApi, Props>((props, ref) => {
  const host = useRef<HTMLDivElement>(null);
  const ed = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const cb = useRef(props); cb.current = props;
  const [menu, setMenu] = useState<{ x: number; y: number; plan: Plan; align: AlignPlan; line: number; fxOk: boolean } | null>(null);

  useEffect(() => {
    const e = monaco.editor.create(host.current!, {
      value: cb.current.value, language: "markdown", theme: "itsd-chrome", fontFamily: MONO, fontSize: 14,
      minimap: { enabled: false }, contextmenu: false, wordWrap: "on", automaticLayout: true, scrollBeyondLastLine: false, padding: { top: 12 },
    });
    e.onDidChangeModelContent(() => cb.current.onChange(e.getValue()));
    e.onDidChangeCursorPosition((p) => cb.current.onCursor(p.position.lineNumber - 1, p.position.column));
    e.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => cb.current.onSave());
    ed.current = e;
    // Right-click opens the format panel instead of Monaco's own menu. Capture phase, so Monaco never sees the event.
    const el = host.current!;
    const onCtx = (ev: MouseEvent) => {
      ev.preventDefault(); ev.stopPropagation();
      const s = e.getSelection(), m = e.getModel();
      if (!s || !m) return;
      const lines = m.getLinesContent();
      const sel = { l1: s.startLineNumber, c1: s.startColumn, l2: s.endLineNumber, c2: s.endColumn };
      setMenu({ x: ev.clientX, y: ev.clientY, plan: plan(lines, sel), align: planAlign(lines, sel), line: s.startLineNumber, fxOk: canInsertAt(lines, s.startLineNumber - 1) });
    };
    el.addEventListener("contextmenu", onCtx, true);
    return () => { el.removeEventListener("contextmenu", onCtx, true); e.dispose(); };
  }, []);

  const apply = useCallback((f: Fmt | null, align?: Align | "") => {
    const e = ed.current, m = e?.getModel(), cur = menu;
    setMenu(null);
    if (!e || !m || !cur) return;
    const lines = m.getLinesContent();
    const edits: Edit[] = [];
    if (f) edits.push(...buildEdits(lines, cur.plan.ranges, f));
    if (align !== undefined) edits.push(...alignEdits(lines, cur.align.starts, align));
    const ops = edits.map((d) => ({ range: new monaco.Range(d.line, d.c1, d.endLine, d.c2), text: d.text }))
      .filter((o) => o.text !== m.getValueInRange(o.range)); // skip no-op edits so Apply never makes an empty undo step
    if (!ops.length) { e.focus(); return; }
    e.pushUndoStop(); e.executeEdits("format", ops); e.pushUndoStop(); e.focus();
  }, [menu]);
  const close = useCallback(() => { setMenu(null); ed.current?.focus(); }, []);
  // Effects go on their own line directly above the line that was right-clicked.
  const addFx = useCallback((full: string) => {
    const e = ed.current, cur = menu; setMenu(null);
    if (!e || !cur) return;
    // With lines selected, a wrapper goes around them instead of around sample text.
    const sel = e.getSelection(), eff = findEffect(full)?.effect;
    if (eff?.kind === "wrap" && sel && !sel.isEmpty()) {
      const last = sel.endColumn === 1 && sel.endLineNumber > sel.startLineNumber ? sel.endLineNumber - 1 : sel.endLineNumber;
      const head = fxSnippet(full).split("\n")[0];
      e.pushUndoStop();
      e.executeEdits("fx", [
        { range: new monaco.Range(last, e.getModel()!.getLineMaxColumn(last), last, e.getModel()!.getLineMaxColumn(last)), text: "\n:::" },
        { range: new monaco.Range(sel.startLineNumber, 1, sel.startLineNumber, 1), text: head + "\n" },
      ]);
      e.pushUndoStop(); e.focus(); return;
    }
    e.pushUndoStop(); e.executeEdits("fx", [{ range: new monaco.Range(cur.line, 1, cur.line, 1), text: fxSnippet(full) + "\n" }]); e.pushUndoStop();
    e.setPosition({ lineNumber: cur.line, column: 1 }); e.focus();
  }, [menu]);

  useEffect(() => {
    if (ed.current && ed.current.getValue() !== props.value) ed.current.setValue(props.value);
  }, [props.value]);

  useEffect(() => {
    const m = ed.current?.getModel(); if (!m) return;
    monaco.editor.setModelMarkers(m, "itsd", props.problems.filter((p) => p.line < m.getLineCount()).map((p) => ({
      startLineNumber: p.line + 1, startColumn: 1, endLineNumber: p.line + 1, endColumn: m.getLineMaxColumn(p.line + 1),
      message: p.message, severity: p.severity === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
    })));
  }, [props.problems]);

  useImperativeHandle(ref, () => ({
    insert: (t) => { const e = ed.current!; e.executeEdits("insert", [{ range: e.getSelection()!, text: t, forceMoveMarkers: true }]); e.focus(); },
    // Each call is its own undo step, so one drag or one button press is one Ctrl+Z.
    replaceAll: (t) => { const e = ed.current!; e.pushUndoStop(); e.executeEdits("ctx", [{ range: e.getModel()!.getFullModelRange(), text: t }]); e.pushUndoStop(); },
    undo: () => { ed.current?.trigger("app", "undo", null); },
    redo: () => { ed.current?.trigger("app", "redo", null); },
    reveal: (l) => { const e = ed.current!; e.setPosition({ lineNumber: l + 1, column: 1 }); e.revealLineInCenter(l + 1); },
  }), []);

  return (
    <>
      <div className="source" ref={host} />
      {menu && <FormatPanel key={`${menu.x},${menu.y}`} x={menu.x} y={menu.y} plan={menu.plan} align={menu.align} onApply={apply} onClose={close} fxOk={menu.fxOk} onFx={addFx} />}
    </>
  );
});
