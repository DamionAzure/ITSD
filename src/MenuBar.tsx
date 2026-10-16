import { useEffect, useState, type ReactNode } from "react";

export type Item = { label: string; hint?: string; checked?: boolean; run?: () => void; sub?: Item[]; scroll?: boolean } | "-";

const list = (items: Item[], close: () => void): ReactNode => items.map((it, k) => it === "-" ? <hr key={k} /> : it.sub ? (
  <div className="subwrap" key={k}>
    <button className="has-sub"><span />{it.label}<em>▸</em></button>
    <div className={it.scroll ? "drop sub scroll" : "drop sub"}>{list(it.sub, close)}</div>
  </div>
) : (
  <button key={k} onClick={() => { close(); it.run?.(); }}>
    <span>{it.checked ? "✓" : ""}</span>{it.label}<em>{it.hint}</em>
  </button>
));

export function MenuBar({ menus, right }: { menus: { name: string; items: Item[] }[]; right: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const close = () => setOpen(null);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="menubar">
      <strong className="brand">ITSD</strong>
      {menus.map((m, i) => (
        <div className="menu" key={m.name} onMouseDown={(e) => e.stopPropagation()} onMouseEnter={() => open !== null && setOpen(i)}>
          <button className={open === i ? "on" : ""} onClick={() => setOpen(open === i ? null : i)}>{m.name}</button>
          {open === i && <div className="drop">{list(m.items, () => setOpen(null))}</div>}
        </div>
      ))}
      <span className="grow" />
      {right}
    </div>
  );
}
