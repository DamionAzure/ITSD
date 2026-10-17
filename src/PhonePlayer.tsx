// The Player screen: what ITSD shows on a phone or tablet. A library of decks, then the deck full screen with swipe / tap navigation.
// App.tsx owns the deck state and passes it in; this file is only the phone-shaped interface around Stage.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Deck } from "./itsd";
import { Stage } from "./Stage";
import { titleOf } from "./edit";
import { notesOf } from "./notes";
import { bnum, branchEntry, labels } from "./branch";
import { library, type Entry } from "./player";

interface DeckProps {
  view: Deck; cur: number; dir: number; tools: Record<string, boolean>; edits: Map<string, string>;
  name: string; next(): void; prev(): void; go(n: number): void; branch(n: number): void; back(): void; proceed(): void; close(): void;
}
interface Props { deck: DeckProps | null; openFile(name: string, bytes: Uint8Array): Promise<void>; openId(id: string): Promise<void>; openDemo(): Promise<void>; error: string; busy: boolean }

const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
/** Things a tap or swipe must leave alone: they do something themselves. */
const OWN = "button,input,textarea,select,a,pre,video,audio,label,[contenteditable],.monaco-editor,[data-noswipe]";
const scrollsSideways = (el: Element | null) => { for (; el && el !== document.body; el = el.parentElement) { const h = el as HTMLElement; if (h.scrollWidth > h.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(h).overflowX)) return true; } return false; };

export function Player(p: Props) {
  return p.deck ? <DeckView {...p.deck} /> : <Library {...p} />;
}

function Library({ openFile, openId, openDemo, error, busy }: Props) {
  const [list, setList] = useState<Entry[] | null>(null), [over, setOver] = useState(false);
  const refresh = () => void library.list().then(setList);
  useEffect(refresh, []);
  const pick = (f?: File | null) => { if (f) void f.arrayBuffer().then((b) => openFile(f.name, new Uint8Array(b))).then(refresh); };
  return (
    <div className={`pl-lib${over ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}>
      <header><h1>ITSD <span>Player</span></h1><p>Open a deck, swipe through it, tap its buttons. Edit on a computer.</p></header>
      <label className="pl-open">{busy ? "Opening…" : "Open a deck…"}
        <input type="file" accept="*/*" disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <p className="pl-hint">A <b>.itsd</b> file, or a <b>.zip</b> made with <i>File → Package for phone</i> (it carries the pictures and sounds).</p>
      {error && <p className="pl-err" role="alert">{error}</p>}
      <h2>On this device</h2>
      {list === null ? <p className="pl-dim">…</p> : list.length === 0 ? <p className="pl-dim">Nothing yet.</p> : (
        <ul className="pl-list">{list.map((e) => (
          <li key={e.id}>
            <button className="pl-item" onClick={() => void openId(e.id)}><b>{e.name}</b><span>{ago(e.at)} · {kb(e.size)}</span></button>
            <button className="pl-del" aria-label={`Remove ${e.name}`} onClick={() => void library.del(e.id).then(refresh)}>✕</button>
          </li>))}</ul>)}
      <button className="pl-demo" onClick={() => void openDemo().then(refresh)}>Try the demo deck</button>
    </div>
  );
}

function DeckView(d: DeckProps) {
  const { view, cur } = d, slide = view.slides[cur];
  const [bar, setBar] = useState(true), [sheet, setSheet] = useState(false), [notes, setNotes] = useState(false);
  const timer = useRef(0), down = useRef<{ x: number; y: number; t: number; own: boolean; side: boolean } | null>(null);
  const poke = () => { setBar(true); clearTimeout(timer.current); timer.current = window.setTimeout(() => setBar(false), 3500); };
  useEffect(() => { poke(); return () => clearTimeout(timer.current); }, [cur]);
  // keep the screen awake while a deck is open
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const get = () => { void (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {}); };
    get(); const vis = () => { if (document.visibilityState === "visible") get(); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); void lock?.release(); };
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") d.next(); else if (e.key === "ArrowLeft" || e.key === "PageUp") d.prev(); else if (e.key === "Escape") setSheet(false); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });

  const lab = labels(view.slides), here = lab[cur] ?? String(cur + 1);
  const mine = (e: React.PointerEvent) => { const t = e.target as Element; return { own: !!t.closest(OWN), side: scrollsSideways(t) }; };
  const onDown = (e: React.PointerEvent) => { down.current = { x: e.clientX, y: e.clientY, t: Date.now(), ...mine(e) }; };
  const onUp = (e: React.PointerEvent) => {
    const s = down.current; down.current = null;
    if (!s || s.own) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - s.t < 800) { if (!s.side) (dx < 0 ? d.next : d.prev)(); return; }
    if (Math.hypot(dx, dy) < 10) {
      const w = (e.currentTarget as HTMLElement).clientWidth, f = e.clientX / w;
      if (f < 0.25) d.prev(); else if (f > 0.75) d.next(); else if (bar) setBar(false); else poke();
    }
  };
  const nBranches = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => branchEntry(view.slides, cur, n) !== undefined);
  const inBranch = slide && bnum(slide) > 0;
  const full = () => { const el = document.documentElement; try { if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.(); } catch { /* not supported */ } };

  return (
    <div className="pl-deck">
      <div id="stage" className="pl-stage" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { down.current = null; }}>
        <Stage deck={view} idx={cur} dir={d.dir} tools={d.tools} edits={d.edits} />
      </div>
      <div className={`pl-bar${bar && !sheet ? "" : " hide"}`} role="toolbar" aria-label="Deck controls">
        <button aria-label="Menu" onClick={() => { setSheet(true); }}>☰</button>
        <button aria-label="Previous slide" onClick={() => { d.prev(); poke(); }} disabled={cur === 0}>‹</button>
        <span className="pl-count" aria-live="polite">{here} / {view.slides.filter((s) => !bnum(s)).length || view.slides.length}</span>
        <button aria-label="Next slide" onClick={() => { d.next(); poke(); }}>›</button>
        {inBranch ? <button className="pl-chip" onClick={d.back}>Back to main</button> : nBranches.map((n) => <button key={n} className="pl-chip" onClick={() => d.branch(n)}>Branch {n}</button>)}
      </div>
      {notes && slide && !slide.virtual && notesOf(slide.src) && <div className="pl-notes" data-noswipe>{notesOf(slide.src)}</div>}
      {sheet && (
        <div className="pl-sheet" role="dialog" aria-label="Slides" onClick={() => setSheet(false)}>
          <div className="pl-panel" data-noswipe onClick={(e) => e.stopPropagation()}>
            <div className="pl-top"><b>{d.name}</b><button aria-label="Close menu" onClick={() => setSheet(false)}>✕</button></div>
            <div className="pl-acts">
              <button onClick={() => setNotes((v) => !v)}>{notes ? "Hide notes" : "Show notes"}</button>
              <button onClick={full}>Full screen</button>
              <button onClick={d.close}>Close deck</button>
            </div>
            <ol className="pl-slides">{view.slides.map((s, k) => (
              <li key={k}><button className={`${k === cur ? "cur" : ""}${bnum(s) > 0 ? " br" : ""}`} onClick={() => { d.go(k); setSheet(false); }}>
                <i>{lab[k]}</i><span>{s.virtual ? "Trace" : titleOf(s) || "(untitled)"}</span></button></li>))}</ol>
            <Tip>Swipe or tap the screen edges to move. Turn the phone sideways for a bigger slide.</Tip>
          </div>
        </div>)}
    </div>
  );
}
const Tip = ({ children }: { children: ReactNode }) => <p className="pl-tip">{children}</p>;
