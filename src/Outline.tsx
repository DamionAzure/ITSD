import { useRef, useState } from "react";
import { titleOf } from "./edit";
import { Thumb } from "./SlideView";
import type { Deck, Slide } from "./itsd";

interface Props {
  deck: Deck; labels: string[]; activeId: number; traced: Record<number, unknown>;
  onSelect: (s: Slide) => void; onMove: (from: number, to: number) => void;
  onAdd: () => void; onDup: (id: number) => void; onDel: (id: number) => void;
  /** Right-click on a slide (its id) or on the empty part of the panel (null). */
  onMenu?: (e: React.MouseEvent, id: number | null) => void;
}

export function Outline({ deck, labels, activeId, traced, onSelect, onMove, onAdd, onDup, onDel, onMenu }: Props) {
  const drag = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const act = (f: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); f(); };
  return (
    <aside className="slidepanel" onContextMenu={(e) => { if (!onMenu) return; e.preventDefault(); onMenu(e, null); }}>
      <div className="ptitle">SLIDES<span className="grow" /><button title="New slide after the current one" onClick={onAdd}>+</button></div>
      <ol>
        {deck.slides.map((s, k) => (
          <li key={k} draggable className={(s.id === activeId ? "active " : "") + (over === k ? "over " : "") + (s.opts.branch ? "branch" : "")}
            onClick={() => onSelect(s)} onContextMenu={(e) => { if (!onMenu) return; e.preventDefault(); e.stopPropagation(); onMenu(e, s.id); }} onDragStart={() => { drag.current = k; }}
            onDragOver={(e) => { e.preventDefault(); setOver(k); }} onDragLeave={() => setOver(null)}
            onDrop={() => { setOver(null); if (drag.current !== null && drag.current !== k) onMove(drag.current, k); drag.current = null; }}>
            <span className="n">{labels[k] ?? k + 1}</span>
            <div className="card">
              <Thumb src={s.src} align={deck.meta.align} />
              <div className="cap">
                <span className="t">{titleOf(s)}</span>{traced[s.id] ? <span className="badge">trace</span> : null}{s.opts.branch ? <span className="badge">branch</span> : null}
                <span className="acts">
                  <button title="Duplicate slide" onClick={act(() => onDup(s.id))}>⧉</button>
                  <button title="Delete slide (Ctrl+Z undoes)" disabled={deck.slides.length < 2} onClick={act(() => onDel(s.id))}>✕</button>
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
