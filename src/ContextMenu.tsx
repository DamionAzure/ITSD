import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type MenuItem =
  | { kind: "item"; label: string; run: () => void | Promise<void>; hint?: string; checked?: boolean; disabled?: boolean; danger?: boolean }
  | { kind: "sub"; label: string; items: MenuItem[]; disabled?: boolean }
  | { kind: "input"; label: string; value: string; placeholder?: string; onCommit: (v: string) => void }
  | { kind: "swatches"; colors: string[]; onPick: (c: string) => void }
  | { kind: "sep" };

export const SEP: MenuItem = { kind: "sep" };
export const act = (label: string, run: () => void | Promise<void>, o: { hint?: string; checked?: boolean; disabled?: boolean; danger?: boolean } = {}): MenuItem => ({ kind: "item", label, run, ...o });
export const sub = (label: string, items: MenuItem[], disabled = false): MenuItem => ({ kind: "sub", label, items, disabled });
export const input = (label: string, value: string, onCommit: (v: string) => void, placeholder?: string): MenuItem => ({ kind: "input", label, value, onCommit, placeholder });
export const swatches = (colors: string[], onPick: (c: string) => void): MenuItem => ({ kind: "swatches", colors, onPick });

function Level({ items, close, focusFirst, onBack }: { items: MenuItem[]; close: () => void; focusFirst?: boolean; onBack?: () => void }) {
  const [open, setOpen] = useState<{ i: number; kb: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const buttons = () => Array.from(box.current!.querySelectorAll<HTMLButtonElement>(":scope > button:not(:disabled), :scope > .subwrap > button:not(:disabled)"));
  useEffect(() => { if (focusFirst) buttons()[0]?.focus(); }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const b = buttons(), cur = document.activeElement as HTMLElement | null, i = b.indexOf(cur as HTMLButtonElement);
    const eat = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === "ArrowDown") { eat(); b[(i + 1) % b.length]?.focus(); }
    else if (e.key === "ArrowUp") { eat(); b[(i - 1 + b.length) % b.length]?.focus(); }
    else if (e.key === "ArrowRight" && cur?.dataset.sub !== undefined) { eat(); setOpen({ i: +cur.dataset.sub, kb: true }); }
    else if (e.key === "ArrowLeft" && onBack) { eat(); onBack(); }
  };

  return (
    <div className="cm-list" ref={box} tabIndex={-1} onKeyDown={onKey}>
      {items.map((it, i) => {
        if (it.kind === "sep") return <hr key={i} />;
        if (it.kind === "swatches") return (
          <div className="cm-sw" key={i} onMouseEnter={() => setOpen(null)}>
            {it.colors.map((c) => <button key={c} title={c} style={{ background: c }} onClick={() => { it.onPick(c); close(); }} />)}
          </div>);
        if (it.kind === "input") return (
          <label className="cm-in" key={i} onMouseEnter={() => setOpen(null)}>{it.label}
            <input defaultValue={it.value} placeholder={it.placeholder} spellCheck={false}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { it.onCommit((e.target as HTMLInputElement).value); close(); } }} />
          </label>);
        if (it.kind === "sub") return (
          <div className="subwrap" key={i} onMouseEnter={() => !it.disabled && setOpen({ i, kb: false })}>
            <button role="menuitem" data-sub={i} disabled={it.disabled} onClick={() => setOpen({ i, kb: false })}><span />{it.label}<em>▸</em></button>
            {open?.i === i && (
              <div className="cmenu subm">
                <Level items={it.items} close={close} focusFirst={open.kb}
                  onBack={() => { setOpen(null); box.current?.querySelector<HTMLElement>(`[data-sub="${i}"]`)?.focus(); }} />
              </div>)}
          </div>);
        return (
          <button key={i} role="menuitem" className={it.danger ? "danger" : ""} disabled={it.disabled} onMouseEnter={() => setOpen(null)}
            onClick={async () => { close(); await it.run(); }}>
            <span>{it.checked ? "✓" : ""}</span>{it.label}<em>{it.hint}</em>
          </button>);
      })}
    </div>
  );
}

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ x, y, flip: false });

  // Keep the menu on screen, and open submenus to the left when there is no room on the right.
  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect();
    setAt({ x: Math.max(4, Math.min(x, innerWidth - r.width - 4)), y: Math.max(4, Math.min(y, innerHeight - r.height - 4)), flip: x + r.width + 230 > innerWidth });
  }, [x, y]);

  useEffect(() => {
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    const passive = { passive: true } as AddEventListenerOptions;
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("contextmenu", away, true); // right-clicking elsewhere closes this one; the new menu opens after
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", onClose); window.addEventListener("resize", onClose); window.addEventListener("wheel", onClose, passive);
    ref.current?.querySelector<HTMLElement>(".cm-list")?.focus();
    return () => {
      window.removeEventListener("pointerdown", away, true); window.removeEventListener("contextmenu", away, true);
      window.removeEventListener("keydown", key, true); window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose); window.removeEventListener("wheel", onClose);
    };
  }, []);

  return (
    <div ref={ref} className={"cmenu" + (at.flip ? " flip" : "")} style={{ left: at.x, top: at.y }} role="menu" onContextMenu={(e) => e.preventDefault()}>
      <Level items={items} close={onClose} />
    </div>
  );
}
