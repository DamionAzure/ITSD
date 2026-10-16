import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { DeckCtx } from "./ctx";
import { SlideView, flowBlocks, toBlocks } from "./SlideView";
import { alignBlock, deleteBlock, placeBlock, unplaceBlock } from "./layout";
import { ALIGNS, type Align } from "./format";
import { useAssetUrl } from "./ImageLayer";
import { baseName, isImagePath } from "./assets";
import { addSlide, deleteSlide, duplicateSlide, setSlideOpt } from "./edit";
import { addImage, backdropOf, patchImage, removeImage, reorderImage, round2, scanImages, slideRange, type ImageDef } from "./images";
import type { Deck, Slide } from "./itsd";
import { ContextMenu, act, input, sub, swatches, SEP, type MenuItem } from "./ContextMenu";
import { addFlash, appendBlock, duplicateFlash, itemsText, patchFlash, removeFlash, scanFlashes, setFlashBody } from "./flashEdit";
import { parseTime, type Trigger } from "./flash";
import { AR } from "./aspect";
import { SNIPPETS } from "./snippets";
import { ModulesPanel } from "./modules/ModulesPanel";
import { addFx } from "./modules/fxEdit";
import { TraceFields, runIds } from "./TraceFields";
import { patchTraceLine, splitTraceBlock } from "./traceEdit";
import { MODULES, effectGroups, fromModule } from "./modules/registry";

type Corner = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w"; // a picture can be pulled from any corner or side
const SWATCHES = ["#151a2d", "#000000", "#ffffff", "#f2b84b", "#7fd6a4", "#ff8a8a", "#6cb6ff", "#c9a0ff"];
const SNAP = 1.2; // percent of the slide; snapping to the slide's edges and centre lines

interface Props {
  deck: Deck; slide: Slide; onSlide: (id: number) => void;
  text: string; commit: (next: string) => void; undo: () => void; redo: () => void;
  media: string[];
  importPaths: (paths: string[]) => Promise<string[]>; pickImages: () => Promise<string[]>;
  tools: Record<string, boolean>; edits: Map<string, string>;
}

type Rect = { x: number; y: number; w: number; h: number };
/** A text/code/button/input/flash block as it sits on the slide, measured from the page (percent of the slide). */
type Box = Rect & { i: number; kind: string; fl?: number; placed: boolean; rot: number };

// Where a moved box lands after snapping one axis, and the guide line that explains the snap.
// Targets are the slide's edges and centre plus the edges and centres of every other element.
function snapAxis(pos: number, size: number, targets: number[]): { shift: number; guide: number } | null {
  let best: { shift: number; guide: number } | null = null;
  for (const off of [0, size / 2, size]) for (const t of targets) {
    const d = t - (pos + off);
    if (Math.abs(d) < SNAP && (!best || Math.abs(d) < Math.abs(best.shift))) best = { shift: d, guide: t };
  }
  return best;
}
const norm = (a: number) => Math.round((((a + 180) % 360) + 360) % 360 * 10) / 10 - 180; // [-180, 180)
/** Resize a rotated box from a handle. The pointer movement is turned into the box's own (unrotated) axes and the box grows
 *  about its centre, so what you drag stays under the pointer's direction even when the box is tilted. */
function rotResize(s: Rect, c: string, dx: number, dy: number, rot: number, fr: { w: number; h: number }, lock: boolean, min = 2): Rect {
  const th = (rot * Math.PI) / 180, px = (dx / 100) * fr.w, py = (dy / 100) * fr.h;
  const ldx = ((px * Math.cos(th) + py * Math.sin(th)) / fr.w) * 100, ldy = ((-px * Math.sin(th) + py * Math.cos(th)) / fr.h) * 100;
  let w = s.w + (c.includes("e") ? 2 * ldx : c.includes("w") ? -2 * ldx : 0), h = s.h + (c.includes("s") ? 2 * ldy : c.includes("n") ? -2 * ldy : 0);
  w = Math.max(min, w); h = Math.max(min, h);
  if (lock && c.length === 2) { const k = Math.max(w / s.w, h / s.h); w = Math.max(min, s.w * k); h = Math.max(min, s.h * k); }
  return { x: s.x + s.w / 2 - w / 2, y: s.y + s.h / 2 - h / 2, w, h };
}
// Resize a picture from a corner or a side; the opposite edge stays put. Width and height are independent (the picture stretches);
// hold Shift on a corner to keep the proportions.
function resize(s: ImageDef, c: Corner, dx: number, dy: number, lock = false): ImageDef {
  let { x, y, w, h } = s;
  if (c.includes("e")) w = Math.max(2, s.w + dx); if (c.includes("w")) { w = Math.max(2, s.w - dx); x = s.x + s.w - w; }
  if (c.includes("s")) h = Math.max(2, s.h + dy); if (c.includes("n")) { h = Math.max(2, s.h - dy); y = s.y + s.h - h; }
  if (lock && c.length === 2) {
    const r = s.h / s.w, k = Math.max(w / s.w, h / s.h); w = Math.max(2, s.w * k); h = w * r;
    x = c.includes("w") ? s.x + s.w - w : s.x; y = c.includes("n") ? s.y + s.h - h : s.y;
  }
  return { ...s, w, h, x, y };
}
const aspectOf = (url: string) => new Promise<number>((res) => {
  const im = new Image();
  im.onload = () => res(im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1);
  im.onerror = () => res(1);
  im.src = url;
});

/** A number box that commits on Enter or blur, so typing "12" is one edit and one undo step. */
function Num({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const [v, setV] = useState(String(round2(value)));
  useEffect(() => setV(String(round2(value))), [value]);
  const done = () => {
    const n = parseFloat(v);
    if (Number.isFinite(n) && round2(n) !== round2(value)) onCommit(n); else setV(String(round2(value)));
  };
  return (
    <label className="num">{label}
      <input type="number" step="0.5" value={v} onChange={(e) => setV(e.target.value)} onBlur={done}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
    </label>
  );
}

/** Colour picker / slider that previews live while dragging and commits once, when released (one undo step). */
function Live({ type, value, onLive, onCommit, ...rest }: { type: "color" | "range"; value: string; onLive: (v: string | null) => void; onCommit: (v: string) => void } & Record<string, unknown>) {
  const ref = useRef<HTMLInputElement>(null), cur = useRef<string | null>(null), commit = useRef(onCommit); commit.current = onCommit;
  const [live, setLive] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current!;
    const done = () => { const v = cur.current; cur.current = null; setLive(null); onLive(null); if (v !== null) commit.current(v); };
    el.addEventListener("change", done);
    return () => el.removeEventListener("change", done);
  }, []);
  return <input ref={ref} type={type} value={live ?? value} {...rest}
    onChange={(e) => { cur.current = e.target.value; setLive(e.target.value); onLive(e.target.value); }} />;
}

function Tile({ ref_, onDown, onBg }: { ref_: string; onDown: (e: React.PointerEvent) => void; onBg: () => void }) {
  const url = useAssetUrl(ref_);
  return (
    <div className="tile" onPointerDown={onDown} title={`${ref_} — click to add, or drag onto the slide`}>
      {url ? <img src={url} alt="" draggable={false} /> : <span className="ph">…</span>}
      <em>{baseName(ref_)}</em>
      <button title="Use as this slide's background" onPointerDown={(e) => e.stopPropagation()} onClick={onBg}>BG</button>
    </div>
  );
}
function LayerRow({ d, n, last, sel, onSel, onUp, onDown, onDel }: { d: ImageDef; n: number; last: boolean; sel: boolean; onSel: () => void; onUp: () => void; onDown: () => void; onDel: () => void }) {
  const url = useAssetUrl(d.src);
  return (
    <li className={sel ? "on" : ""} onClick={onSel}>
      {url ? <img src={url} alt="" /> : <i />}
      <span>{baseName(d.src)}</span>
      <button title="Bring forward" disabled={last} onClick={(e) => { e.stopPropagation(); onUp(); }}>▲</button>
      <button title="Send backward" disabled={n === 0} onClick={(e) => { e.stopPropagation(); onDown(); }}>▼</button>
      <button title="Delete" onClick={(e) => { e.stopPropagation(); onDel(); }}>✕</button>
    </li>
  );
}

export function VisualView(p: Props) {
  const { assets } = useContext(DeckCtx);
  const frame = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ n: number; def: ImageDef } | null>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [ghost, setGhost] = useState<{ ref: string; x: number; y: number } | null>(null);
  const [over, setOver] = useState(false);
  const [liveBg, setLiveBg] = useState<string | null>(null);
  const [liveDim, setLiveDim] = useState<string | null>(null);
  const [tab, setTab] = useState<"inspect" | "modules">("inspect");

  const defs = useMemo(() => scanImages(p.slide.src).map((x) => x.def), [p.slide.src]);
  const flashes = useMemo(() => scanFlashes(p.slide.src), [p.slide.src]);
  const blks = useMemo(() => flowBlocks(toBlocks(p.slide.src)), [p.slide.src]); // same list, same order as SlideView draws
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [bsel, setBsel] = useState<number | null>(null); // selected block (never together with a picture)
  const [multi, setMulti] = useState<string[]>([]); // Shift+click selection: "p<n>" pictures and "b<i>" blocks
  const [liveRot, setLiveRot] = useState<{ key: string; rot: number } | null>(null);
  const [dragBlk, setDragBlk] = useState<{ i: number; r: Rect } | null>(null);
  const dragging = useRef(false);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const shown = draft ? defs.map((d, i) => (i === draft.n ? draft.def : d)) : defs;
  const back = backdropOf(p.slide.opts);
  const L = useRef({ ...p, defs, sel, blks, boxes, bsel }); L.current = { ...p, defs, sel, blks, boxes, bsel };
  const id = p.slide.id;

  useEffect(() => { setSel(null); setBsel(null); setDraft(null); setMulti([]); }, [id]);
  useEffect(() => { if (bsel !== null && bsel >= blks.length) setBsel(null); }, [blks.length, bsel]);
  useEffect(() => { if (sel !== null && sel >= defs.length) setSel(null); }, [defs.length, sel]);

  // Where every block sits on the slide, so it can be picked up even though the slide's own layer is inert here.
  // Text blocks are measured by their text, not their full-width container, so the box hugs what you see.
  useLayoutEffect(() => {
    const f = frame.current; if (!f) return;
    const measure = () => {
      if (dragging.current) return;
      const fr = f.getBoundingClientRect(); if (!fr.width) return;
      const out: Box[] = [];
      f.querySelectorAll<HTMLElement>("[data-blk]").forEach((el) => {
        const kind = el.dataset.kind!, placed = el.dataset.placed === "1";
        const r = el.getBoundingClientRect();
        let left = r.left, top = r.top, width = r.width, height = r.height;
        const rot = parseFloat(el.style.rotate) || 0;
        if (rot && el.offsetParent) { // a rotated block's bounding rect is its rotated outline: use the unrotated box instead
          const op = el.offsetParent as HTMLElement, o = op.getBoundingClientRect();
          left = o.left + el.offsetLeft * (o.width / op.offsetWidth); top = o.top + el.offsetTop * (o.height / op.offsetHeight);
          width = el.offsetWidth * (o.width / op.offsetWidth); height = el.offsetHeight * (o.height / op.offsetHeight);
        }
        if (kind === "html" && !placed) {
          const c = (el.firstElementChild as HTMLElement | null) ?? el, cr = c.getBoundingClientRect(), rg = document.createRange();
          rg.selectNodeContents(c);
          left = cr.left; top = cr.top; height = cr.height; width = Math.max(8, Math.min(cr.width, rg.getBoundingClientRect().right - cr.left));
        }
        if (!width || !height) return;
        out.push({ i: +el.dataset.blk!, kind, placed, rot, fl: el.dataset.fl !== undefined ? +el.dataset.fl : undefined,
          x: ((left - fr.left) / fr.width) * 100, y: ((top - fr.top) / fr.height) * 100, w: (width / fr.width) * 100, h: (height / fr.height) * 100 });
      });
      const key = (a: Box[]) => JSON.stringify(a.map((b) => [b.i, round2(b.x), round2(b.y), round2(b.w), round2(b.h), b.rot]));
      setBoxes((prev) => (key(prev) === key(out) ? prev : out));
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(f);
    f.querySelectorAll("[data-blk]").forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  });

  const edit = (fn: (t: string) => string) => L.current.commit(fn(L.current.text));
  const setOpts = (kv: Record<string, string | null>) => edit((t) => Object.entries(kv).reduce((s, [k, v]) => setSlideOpt(s, L.current.slide.id, k, v), t));
  const inFrame = (x: number, y: number) => { const r = frame.current?.getBoundingClientRect(); return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
  const toPct = (x: number, y: number) => { const r = frame.current!.getBoundingClientRect(); return { x: ((x - r.left) / r.width) * 100, y: ((y - r.top) / r.height) * 100 }; };

  // Add pictures to the slide: centred, or around a drop point. One edit, so one Ctrl+Z.
  const place = async (refs: string[], at?: { x: number; y: number }) => {
    let t = L.current.text; const first = L.current.defs.length;
    for (let i = 0; i < refs.length; i++) {
      const url = await assets.ready(refs[i]);
      const a = url ? await aspectOf(url) : 1;
      let w = 40, h = (w * 16) / (9 * a);
      if (h > 80) { h = 80; w = (h * 9 * a) / 16; }
      const o = i * 3;
      t = addImage(t, L.current.slide.id, { src: refs[i], w, h, alt: "", x: at ? at.x - w / 2 + o : (100 - w) / 2 + o, y: at ? at.y - h / 2 + o : (100 - h) / 2 + o });
    }
    if (refs.length) { L.current.commit(t); setSel(first + refs.length - 1); }
  };
  const importAndPlace = async () => { const refs = await p.pickImages(); await place(refs); };

  // Move / resize an existing picture. The text file is only touched on release.
  const begin = (e: React.PointerEvent, n: number, mode: "move" | Corner) => {
    if (e.button !== 0) return;
    if (e.shiftKey && mode === "move") { e.preventDefault(); e.stopPropagation(); toggleMulti(`p${n}`); return; }
    e.preventDefault(); e.stopPropagation(); setSel(n); setBsel(null); setMulti([]);
    const { xs, ys } = targetsFor({ pic: n });
    const start = L.current.defs[n], sx = e.clientX, sy = e.clientY, r = frame.current!.getBoundingClientRect();
    let last = start, moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
      moved = true;
      const dx = ((ev.clientX - sx) / r.width) * 100, dy = ((ev.clientY - sy) / r.height) * 100;
      if (mode === "move") {
        let x = start.x + dx, y = start.y + dy; const g: { x?: number; y?: number } = {};
        if (!ev.altKey) {
          const a = snapAxis(x, start.w, xs), b = snapAxis(y, start.h, ys);
          if (a) { x += a.shift; g.x = a.guide; } if (b) { y += b.shift; g.y = b.guide; }
        }
        last = { ...start, x, y }; setGuides(g);
      } else if (start.rot) { const q = rotResize(start, mode, dx, dy, start.rot, { w: r.width, h: r.height }, ev.shiftKey); last = { ...start, ...q }; }
      else last = resize(start, mode, dx, dy, ev.shiftKey);
      setDraft({ n, def: last });
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      setGuides({});
      if (moved) edit((t) => patchImage(t, L.current.slide.id, n, last));
      setDraft(null);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };

  // Smart guides: the slide's edges and centre, plus the edges and centres of every other picture and block.
  const targetsFor = (skip: { pic?: number; blk?: number }) => {
    const xs = [0, 50, 100], ys = [0, 50, 100];
    const add = (r: Rect) => { xs.push(r.x, r.x + r.w / 2, r.x + r.w); ys.push(r.y, r.y + r.h / 2, r.y + r.h); };
    L.current.defs.forEach((d, k) => { if (k !== skip.pic) add(d); });
    L.current.boxes.forEach((b) => { if (b.i !== skip.blk) add(b); });
    return { xs, ys };
  };

  // Write a dragged block's new place into the file. Text blocks get a `<!-- @ x= y= w= -->` marker above them;
  // flash regions already have x/y/size of their own.
  const commitBlock = (b: Box, r: Rect, resized: boolean, vert = false) => {
    const blk = L.current.blks[b.i]; if (!blk) return;
    if (blk.kind === "flash") {
      const set: Record<string, string> = { x: String(round2(r.x)), y: String(round2(r.y)) };
      if (resized) { set.size = String(round2(r.w)); set.h = String(round2(r.h)); } // both axes, so the box can be any shape
      edit((t) => patchFlash(t, L.current.slide.id, b.fl!, { set }));
      return;
    }
    const sized = blk.kind === "html" || blk.kind === "run" || blk.kind === "fx" || blk.kind === "wrap" || blk.kind === "trace" || blk.kind === "media";
    const w = resized ? r.w : blk.at?.w ?? (sized ? Math.min(100 - Math.max(0, r.x), r.w + 1.5) : undefined); // keep the wrapping it had in the flow
    const h = vert ? r.h : blk.at?.h; // a height is only written once it has been pulled; otherwise the block stays as tall as its content
    edit((t) => placeBlock(t, L.current.slide.id, blk, { ...blk.at, x: r.x, y: r.y, w, h })); // keep rot, z and fit that were already there
  };

  // Move / resize any block. The page is moved with a CSS transform while dragging; the file is written once, on release.
  const beginBlock = (e: React.PointerEvent, b: Box, mode: "move" | "e" | "w" | "n" | "s" | "ne" | "nw" | "se" | "sw") => {
    if (e.button !== 0) return;
    if (e.shiftKey && mode === "move") { e.preventDefault(); e.stopPropagation(); toggleMulti(`b${b.i}`); return; }
    e.preventDefault(); e.stopPropagation(); setBsel(b.i); setSel(null); setMulti([]);
    const f = frame.current!, fr = f.getBoundingClientRect();
    const el = f.querySelector<HTMLElement>(`[data-blk="${b.i}"]`); if (!el) return;
    const css = el.style.cssText, start: Rect = { x: b.x, y: b.y, w: b.w, h: b.h }, sx = e.clientX, sy = e.clientY;
    const { xs, ys } = targetsFor({ blk: b.i });
    let last = start, moved = false, resized = false, vert = false; dragging.current = true;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
      moved = true;
      const dx = ((ev.clientX - sx) / fr.width) * 100, dy = ((ev.clientY - sy) / fr.height) * 100;
      if (mode === "move") {
        let x = start.x + dx, y = start.y + dy; const g: { x?: number; y?: number } = {};
        if (!ev.altKey) {
          const a = snapAxis(x, start.w, xs), c = snapAxis(y, start.h, ys);
          if (a) { x += a.shift; g.x = a.guide; } if (c) { y += c.shift; g.y = c.guide; }
        }
        last = { ...start, x, y }; setGuides(g);
        el.style.transform = `translate(${((x - start.x) / 100) * fr.width}px, ${((y - start.y) / 100) * fr.height}px)`;
      } else {
        resized = true; if (mode.includes("n") || mode.includes("s")) vert = true;
        const flash = L.current.blks[b.i]?.kind === "flash", gx = mode.includes("e"), gw = mode.includes("w"), gn = mode.includes("n"), gs = mode.includes("s");
        let { x, y, w, h } = start;
        const rot = L.current.blks[b.i]?.at?.rot;
        if (rot && !flash) { // tilted: grow about the centre along the box's own axes
          const q = rotResize(start, mode, dx, dy, rot, { w: fr.width, h: fr.height }, ev.shiftKey, 5);
          ({ x, y, w, h } = q); if (!gn && !gs) h = start.h, y = start.y;
          last = { x, y, w, h }; el.style.width = `${(w / 100) * fr.width}px`; if (gn || gs) el.style.height = `${(h / 100) * fr.height}px`;
          el.style.transform = `translate(${((x - start.x) / 100) * fr.width}px, ${((y - start.y) / 100) * fr.height}px)`;
          setDragBlk({ i: b.i, r: last }); return;
        }
        if (gx) w = Math.max(5, start.w + dx); if (gw) { w = Math.max(5, start.w - dx); x = start.x + start.w - w; }
        if (gs) h = Math.max(5, start.h + dy); if (gn) { h = Math.max(5, start.h - dy); y = start.y + start.h - h; }
        if (ev.shiftKey && mode.length === 2) { // Shift on a corner keeps the proportions
          const k = Math.max(w / start.w, h / start.h); w = Math.max(5, start.w * k); h = Math.max(5, start.h * k);
          if (gw) x = start.x + start.w - w; if (gn) y = start.y + start.h - h;
        }
        if (!gn && !gs && !flash) h = start.h; // a side handle changes the width only: the text reflows and keeps its height
        last = { x, y, w, h };
        el.style.width = `${(w / 100) * fr.width}px`;
        if (gn || gs || flash) el.style.height = `${(h / 100) * fr.height}px`;
        el.style.transform = `translate(${((x - start.x) / 100) * fr.width}px, ${((y - start.y) / 100) * fr.height}px)`;
      }
      setDragBlk({ i: b.i, r: last });
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      el.style.cssText = css; dragging.current = false; setGuides({}); setDragBlk(null);
      if (moved) commitBlock(b, last, resized, vert);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };

  // Drag a tile from the media bin onto the slide (a plain click adds it in the middle).
  const tileDown = (e: React.PointerEvent, ref: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY; let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      moved = true; setGhost({ ref, x: ev.clientX, y: ev.clientY }); setOver(inFrame(ev.clientX, ev.clientY));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      setGhost(null); setOver(false);
      if (!moved) void place([ref]);
      else if (inFrame(ev.clientX, ev.clientY)) void place([ref], toPct(ev.clientX, ev.clientY));
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  // Image files dragged in from the operating system (the webview reports them, with paths, through Tauri).
  useEffect(() => {
    let off: (() => void) | undefined, dead = false;
    (async () => {
      try {
        const u = await getCurrentWebview().onDragDropEvent(async (ev) => {
          const d = ev.payload, dpr = window.devicePixelRatio || 1;
          if (d.type === "leave") { setOver(false); return; }
          const at = { x: d.position.x / dpr, y: d.position.y / dpr };
          if (d.type !== "drop") { setOver(inFrame(at.x, at.y)); return; }
          setOver(false);
          const files = d.paths.filter(isImagePath);
          if (!files.length) return;
          const refs = await L.current.importPaths(files);
          await place(refs, inFrame(at.x, at.y) ? toPct(at.x, at.y) : undefined);
        });
        if (dead) u(); else off = u;
      } catch { /* not running inside Tauri */ }
    })();
    return () => { dead = true; off?.(); };
  }, []);

  const select = (n: number | null) => { setSel(n); setBsel(null); setMulti([]); };
  const remove = (n: number) => { edit((t) => removeImage(t, id, n)); setSel(null); };
  const dup = (n: number) => { const d = defs[n]; edit((t) => addImage(t, id, { ...d, x: d.x + 3, y: d.y + 3 })); setSel(defs.length); };
  const restack = (n: number, to: number) => { edit((t) => reorderImage(t, id, n, to)); setSel(Math.max(0, Math.min(to, defs.length - 1))); };
  // ---- layering (z), rotation, stretch-to-box, and multi-select align / distribute ----
  const rotShown = (key: string, rot: number) => (liveRot?.key === key ? liveRot.rot : rot);
  const sizedKind = (k: string) => k === "html" || k === "run" || k === "fx" || k === "wrap" || k === "trace" || k === "media";
  const layerList = () => [
    ...blks.flatMap((b, i) => (b.at && b.kind !== "flash" ? [{ key: `b${i}`, z: b.at.z ?? 0 }] : [])),
    ...defs.map((d, n) => ({ key: `p${n}`, z: d.z ?? 10 })), // a picture with no z sits in front of text (z 10), as it always did
  ].sort((a, b) => a.z - b.z); // stable: on a tie blocks stay behind pictures, then file order
  const setZ = (t: string, key: string, z: number) => {
    const i = +key.slice(1);
    if (key[0] === "p") return patchImage(t, id, i, { z });
    const blk = blks[i]; return blk?.at ? placeBlock(t, id, blk, { ...blk.at, z }) : t;
  };
  const canStack = (key: string, dir: "up" | "down") => { const ls = layerList(), at = ls.findIndex((l) => l.key === key); return at >= 0 && (dir === "up" ? at < ls.length - 1 : at > 0); };
  const stack = (key: string, how: "front" | "forward" | "backward" | "back") => {
    const ls = layerList(), at = ls.findIndex((l) => l.key === key); if (at < 0) return;
    const me = ls[at], hi = Math.max(...ls.map((l) => l.z)), lo = Math.min(...ls.map((l) => l.z));
    const z = how === "front" ? hi + 1 : how === "back" ? Math.max(-9, lo - 1)
      : how === "forward" ? (ls[at + 1] ? ls[at + 1].z + 1 : me.z) : (ls[at - 1] ? Math.max(-9, ls[at - 1].z - 1) : me.z);
    if (z !== me.z) edit((t) => setZ(t, key, z));
  };
  const rotOf = (key: string) => (key[0] === "p" ? defs[+key.slice(1)]?.rot : blks[+key.slice(1)]?.at?.rot) ?? 0;
  const setRot = (key: string, rot: number) => {
    const r = norm(rot) || 0, i = +key.slice(1);
    if (key[0] === "p") { edit((t) => patchImage(t, id, i, { rot: r || undefined })); return; }
    const blk = blks[i], bx = boxes.find((q) => q.i === i); if (!blk || !bx || blk.kind === "flash") return;
    const at = blk.at ?? { x: bx.x, y: bx.y, w: sizedKind(blk.kind) ? bx.w : undefined };
    edit((t) => placeBlock(t, id, blk, { ...at, rot: r || undefined }));
  };
  /** Stretch the block's text/code/effect to fill its box on both axes (fit=scale), or go back to clipping. */
  const setStretch = (i: number, on: boolean) => {
    const blk = blks[i], bx = boxes.find((q) => q.i === i); if (!blk || !bx) return;
    const at = blk.at ?? { x: bx.x, y: bx.y };
    edit((t) => placeBlock(t, id, blk, on ? { ...at, w: bx.w, h: bx.h, fit: "scale", lw: bx.w } : { ...at, fit: undefined, lw: undefined }));
  };
  const toggleMulti = (key: string) => {
    const cur = multi.length ? multi : sel !== null ? [`p${sel}`] : bsel !== null ? [`b${bsel}`] : [];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    setMulti(next.length >= 2 ? next : []);
    if (next.length >= 2) { setSel(null); setBsel(null); }
    else if (next.length === 1) { next[0][0] === "p" ? (setSel(+next[0].slice(1)), setBsel(null)) : (setBsel(+next[0].slice(1)), setSel(null)); }
    else { setSel(null); setBsel(null); }
  };
  type Arrange = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom" | "hdist" | "vdist";
  const arrange = (how: Arrange) => {
    const it = multi.flatMap((k) => {
      const i = +k.slice(1);
      if (k[0] === "p") { const d = defs[i]; return d ? [{ key: k, x: d.x, y: d.y, w: d.w, h: d.h }] : []; }
      const q = boxes.find((bx) => bx.i === i); return q ? [{ key: k, x: q.x, y: q.y, w: q.w, h: q.h }] : [];
    });
    if (it.length < 2) return;
    const minX = Math.min(...it.map((a) => a.x)), maxX = Math.max(...it.map((a) => a.x + a.w)), minY = Math.min(...it.map((a) => a.y)), maxY = Math.max(...it.map((a) => a.y + a.h));
    const pos = new Map(it.map((a) => [a.key, { x: a.x, y: a.y }]));
    if (how === "hdist" || how === "vdist") {
      const h = how === "hdist", sorted = [...it].sort((a, b) => (h ? a.x - b.x : a.y - b.y));
      const total = sorted.reduce((n, a) => n + (h ? a.w : a.h), 0), gap = ((h ? maxX - minX : maxY - minY) - total) / (sorted.length - 1);
      let at = h ? minX : minY;
      for (const a of sorted) { pos.set(a.key, h ? { x: at, y: a.y } : { x: a.x, y: at }); at += (h ? a.w : a.h) + gap; }
    } else for (const a of it) {
      pos.set(a.key, { x: how === "left" ? minX : how === "right" ? maxX - a.w : how === "hcenter" ? (minX + maxX) / 2 - a.w / 2 : a.x,
        y: how === "top" ? minY : how === "bottom" ? maxY - a.h : how === "vcenter" ? (minY + maxY) / 2 - a.h / 2 : a.y });
    }
    edit((t) => {
      for (const a of it) if (a.key[0] === "p") t = patchImage(t, id, +a.key.slice(1), pos.get(a.key)!);
      // blocks last-to-first, so a marker inserted above one block doesn't move the line numbers of the ones still to do
      const bl = it.filter((a) => a.key[0] === "b").flatMap((a) => { const blk = blks[+a.key.slice(1)], bx = boxes.find((q) => q.i === +a.key.slice(1)); return blk && bx ? [{ a, blk, bx }] : []; }).sort((m, n) => n.blk.line - m.blk.line);
      for (const { a, blk, bx } of bl) {
        const q = pos.get(a.key)!;
        if (blk.kind === "flash") { t = patchFlash(t, id, bx.fl!, { set: { x: String(round2(q.x)), y: String(round2(q.y)) } }); continue; }
        t = placeBlock(t, id, blk, { ...blk.at, x: q.x, y: q.y, w: blk.at?.w ?? (sizedKind(blk.kind) ? Math.min(100 - Math.max(0, q.x), bx.w + 1.5) : undefined) });
      }
      return t;
    });
  };
  const beginRotate = (e: React.PointerEvent, key: string) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const f = frame.current!, ob = f.querySelector<HTMLElement>(key[0] === "p" ? `[data-pic="${key.slice(1)}"]` : `[data-bbox="${key.slice(1)}"]`); if (!ob) return;
    const r = ob.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const live = key[0] === "b" ? f.querySelector<HTMLElement>(`[data-blk="${key.slice(1)}"]`) : null, was = live?.style.rotate ?? "";
    let last = rotOf(key), moved = false; dragging.current = true;
    const move = (ev: PointerEvent) => {
      moved = true;
      let a = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
      if (ev.shiftKey) a = Math.round(a / 15) * 15;
      last = norm(a); setLiveRot({ key, rot: last });
      if (live) live.style.rotate = `${last}deg`; else setDraft({ n: +key.slice(1), def: { ...defs[+key.slice(1)], rot: last } });
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      dragging.current = false; setLiveRot(null); setDraft(null); if (live) live.style.rotate = was;
      if (moved) setRot(key, last);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };
  const fit = (n: number) => {
    const d = defs[n], k = Math.min(100 / d.w, 100 / d.h), w = d.w * k, h = d.h * k;
    edit((t) => patchImage(t, id, n, { x: (100 - w) / 2, y: (100 - h) / 2, w, h }));
  };
  const resizeTo = (n: number, w: number) => { const d = defs[n], nw = Math.max(1, w); edit((t) => patchImage(t, id, n, { w: nw, h: (nw * d.h) / d.w })); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input, select, textarea, .monaco-editor")) return;
      const bi = L.current.bsel, mod = e.ctrlKey || e.metaKey;
      const bb = bi !== null ? L.current.boxes.find((x) => x.i === bi) : undefined;
      if (bi !== null && bb && !mod) {
        const step = e.shiftKey ? 5 : 1;
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeBlock(bi); }
        else if (e.key === "Escape") setBsel(null);
        else if (e.key.startsWith("Arrow")) {
          e.preventDefault();
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          commitBlock(bb, { ...bb, x: bb.x + dx, y: bb.y + dy }, false);
        }
        return;
      }
      const n = L.current.sel;
      if (n === null || mod && e.key.toLowerCase() !== "d") return;
      const d = L.current.defs[n]; if (!d) return;
      const step = e.shiftKey ? 5 : 1;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(n); }
      else if (e.key === "Escape") setSel(null);
      else if (mod) { e.preventDefault(); dup(n); }
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        edit((t) => patchImage(t, L.current.slide.id, n, { x: d.x + dx, y: d.y + dy }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- right-click menus: on a picture, on a flash region, or on the empty slide ----
  const fillPic = (n: number) => { const d = defs[n], k = Math.max(100 / d.w, 100 / d.h), w = d.w * k, h = d.h * k; edit((t) => patchImage(t, id, n, { x: (100 - w) / 2, y: (100 - h) / 2, w, h })); };
  const later = (f: () => void) => setTimeout(f, 80); // lets the edit land before the view follows it
  const applyBgToAll = () => {
    const o = { bg: back.color ?? null, bgimage: back.image ?? null, bgdim: back.dim ? String(back.dim) : null };
    edit((t) => p.deck.slides.reduce((s, sl) => Object.entries(o).reduce((a, [k, v]) => setSlideOpt(a, sl.id, k, v), s), t));
  };

  const removeBlock = (i: number) => {
    const blk = L.current.blks[i]; if (!blk) return;
    edit((t) => blk.kind === "flash" ? removeFlash(t, id, L.current.boxes.find((b) => b.i === i)!.fl!) : deleteBlock(t, id, blk));
    setBsel(null);
  };
  const KIND: Record<string, string> = { html: "Text", run: "Code block", btn: "Button", input: "Input box", flash: "Flash region", fx: "Effect", wrap: "Effect box", trace: "Trace", media: "Video / audio" };
  const blockMenu = (b: Box): MenuItem[] => {
    const blk = blks[b.i]; if (!blk) return [];
    const sized = blk.kind === "html" || blk.kind === "run" || blk.kind === "fx" || blk.kind === "wrap" || blk.kind === "trace" || blk.kind === "media";
    const put = (patch: Partial<Rect>) => commitBlock(b, { ...b, ...patch }, patch.w !== undefined || patch.h !== undefined, patch.h !== undefined);
    return [
      act("Return to text flow", () => edit((t) => unplaceBlock(t, id, blk)), { disabled: !blk.at }),
      ...(blk.kind === "flash" ? [] : [sub("Arrange", arrangeItems(`b${b.i}`), !blk.at), sub("Rotate", rotateItems(`b${b.i}`))]),
      ...(blk.kind === "flash" ? [] : [sub("Add action", actionItems(Math.min(blk.marker ?? blk.line, blk.alignLine ?? blk.line, blk.dir ?? blk.line)))]),
      ...(blk.kind === "trace" && !blk.def.part ? [act("Split into parts", () => edit((t) => splitTraceBlock(t, id, blk)))] : []),
      ...(sized ? [act("Stretch to box (X and Y)", () => setStretch(b.i, blk.at?.fit !== "scale"), { checked: blk.at?.fit === "scale" })] : []),
      sub("Align to slide", [
        act("Left", () => put({ x: 0 })), act("Centre", () => put({ x: (100 - b.w) / 2 })), act("Right", () => put({ x: 100 - b.w })), SEP,
        act("Top", () => put({ y: 0 })), act("Middle", () => put({ y: (100 - b.h) / 2 })), act("Bottom", () => put({ y: 100 - b.h })),
      ]),
      sub("Text alignment", [
        ...ALIGNS.map((a) => act(a[0].toUpperCase() + a.slice(1), () => edit((t) => alignBlock(t, id, blk, a)), { checked: blk.align === a })), SEP,
        act("Default", () => edit((t) => alignBlock(t, id, blk, "")), { disabled: !blk.align }),
      ], blk.kind === "flash" && blk.spec.x !== undefined),
      sub("Width", [act("Full width", () => put({ x: 0, w: 100 })), act("Two thirds", () => put({ w: 66 })), act("Half", () => put({ w: 50 })), act("One third", () => put({ w: 33 }))], !sized),
      SEP,
      act("Delete " + KIND[blk.kind].toLowerCase(), () => removeBlock(b.i), { hint: "Del", danger: true }),
    ];
  };

  // Scripted actions: a preset line goes at the top of the block's directive lines (the stack of `<!-- @... -->` lines above it).
  const addAction = (top: number, text: string) => edit((t) => { const r = slideRange(t, id); if (!r) return t; r.lines.splice(r.start + top, 0, text); return r.lines.join("\n"); });
  const actionItems = (top: number): MenuItem[] => [
    act("On Next: rotate 90°", () => addAction(top, "<!-- @on next: rotate this 90 -->")),
    act("On Next: fade out", () => addAction(top, "<!-- @on next: fade this out -->")),
    act("On Next: appear (fade in)", () => addAction(top, "<!-- @on next: fade this in -->")),
    act("On Next: grow 1.5×", () => addAction(top, "<!-- @on next: scale this 1.5 -->")),
    act("On Next: slide right 10%", () => addAction(top, "<!-- @on next: move this by 10 0 -->")),
    act("On Click: spin 15°", () => addAction(top, "<!-- @on click: rotate this 15 over 0.2s -->")),
    act("On Enter: fade in after 1s", () => addAction(top, "<!-- @on enter: fade this out over 0s -> wait 1s -> fade this in -->")),
  ];
  const arrangeItems = (key: string): MenuItem[] => [
    act("Bring to front", () => stack(key, "front"), { disabled: !canStack(key, "up") }), act("Bring forward", () => stack(key, "forward"), { disabled: !canStack(key, "up") }),
    act("Send backward", () => stack(key, "backward"), { disabled: !canStack(key, "down") }), act("Send to back", () => stack(key, "back"), { disabled: !canStack(key, "down") }),
  ];
  const rotateItems = (key: string): MenuItem[] => [
    act("Rotate 90° clockwise", () => setRot(key, rotOf(key) + 90)), act("Rotate 90° anticlockwise", () => setRot(key, rotOf(key) - 90)), act("Rotate 180°", () => setRot(key, rotOf(key) + 180)),
    SEP, act("Reset rotation", () => setRot(key, 0), { disabled: !rotOf(key) }),
  ];
  const multiMenu = (): MenuItem[] => [
    sub("Align", [act("Left edges", () => arrange("left")), act("Centres (horizontal)", () => arrange("hcenter")), act("Right edges", () => arrange("right")), SEP,
      act("Top edges", () => arrange("top")), act("Centres (vertical)", () => arrange("vcenter")), act("Bottom edges", () => arrange("bottom"))]),
    sub("Distribute", [act("Horizontally", () => arrange("hdist"), { disabled: multi.length < 3 }), act("Vertically", () => arrange("vdist"), { disabled: multi.length < 3 })]),
  ];
  const picMenu = (n: number): MenuItem[] => {
    const d = defs[n], top = defs.length - 1;
    const put = (patch: Partial<ImageDef>) => edit((t) => patchImage(t, id, n, patch));
    return [
      sub("Arrange", arrangeItems(`p${n}`)),
      sub("Rotate", rotateItems(`p${n}`)),
      SEP,
      act("Duplicate", () => dup(n), { hint: "Ctrl+D" }),
      sub("Align to slide", [
        act("Left", () => put({ x: 0 })), act("Centre", () => put({ x: (100 - d.w) / 2 })), act("Right", () => put({ x: 100 - d.w })), SEP,
        act("Top", () => put({ y: 0 })), act("Middle", () => put({ y: (100 - d.h) / 2 })), act("Bottom", () => put({ y: 100 - d.h })),
      ]),
      sub("Size", [act("Fit to slide", () => fit(n)), act("Fill slide", () => fillPic(n)), act("Full width", () => resizeTo(n, 100)), act("Half width", () => resizeTo(n, 50))]),
      input("Alt text", d.alt, (v) => put({ alt: v }), "Describe the picture"),
      act("Use as slide background", () => { edit((t) => setSlideOpt(removeImage(t, id, n), id, "bgimage", d.src)); setSel(null); }),
      SEP,
      act("Delete", () => remove(n), { hint: "Del", danger: true }),
    ];
  };

  const flashMenu = (n: number): MenuItem[] => {
    const f = flashes[n]; if (!f) return [];
    const { spec, attrs } = f;
    const setF = (set: Record<string, string | null>, flags?: Record<string, boolean>) => edit((t) => patchFlash(t, id, n, { set, flags }));
    const trig = (label: string, v: Trigger) => act(label, () => setF({ start: v === "new-slide" ? null : v }, { manual: false }), { checked: spec.trigger === v });
    const time = (label: string, v: string) => act(label, () => setF({ time: v }), { checked: (attrs.time ?? "1.5s") === v });
    const size = (label: string, v: number) => act(label, () => setF({ size: String(v), ...(spec.h !== undefined ? { h: String(round2(Math.min(100, (spec.h * v) / spec.size))) } : {}) }), { checked: spec.size === v });
    const shape = (label: string, k: number) => act(label, () => setF({ h: String(round2(Math.min(100, spec.size * AR * k))) }), { checked: spec.h !== undefined && Math.abs(spec.h - spec.size * AR * k) < 0.5 });
    const hPct = spec.h ?? (spec.size / spec.ratio) * AR, placed = spec.x !== undefined;
    return [
      sub("Starts when…", [trig("Every time I arrive", "new-slide"), trig("First time only", "at-start"), trig("I press Next", "when-next"), trig("Only from a button or click", "manual")]),
      sub("Text appears", [
        act("In the centre, in order", () => setF({ mode: null }), { checked: spec.mode === "linear" }),
        act("At random spots", () => setF({ mode: "random" }), { checked: spec.mode === "random" }),
      ]),
      sub("Time per item", [
        time("0.5 s", "0.5s"), time("1 s", "1s"), time("1.5 s", "1.5s"), time("2 s", "2s"), time("3 s", "3s"), SEP,
        time("Hectic: 1.5 s ± 0.5", "1.5s +-0.5s"), time("Very hectic: 1 s ± 0.5", "1s +-0.5s"), SEP,
        input("Custom, like 2s +-0.3s", attrs.time ?? "1.5s", (v) => { if (parseTime(v)) setF({ time: v }); }),
      ]),
      act("Loop", () => setF({}, { loop: !spec.loop }), { checked: spec.loop }),
      act("Shuffle the order", () => setF({}, { shuffle: !spec.shuffle }), { checked: spec.shuffle }),
      sub("Size", [size("Small", 18), size("Medium", 26), size("Large", 36), size("Extra large", 46)]),
      sub("Shape", [shape("Square", 1), shape("Wide", 9 / 16), shape("Very wide", 0.4), shape("Tall", 16 / 9)]),
      act("Show outline", () => setF({ frame: spec.frame ? "off" : null }), { checked: spec.frame }),
      sub("Position", [
        act("Centre on slide", () => setF({ x: String(round2((100 - spec.size) / 2)), y: String(round2((100 - hPct) / 2)) })),
        act("Fix at its current spot", () => { const r = boxes.find((b) => b.fl === n); if (r) setF({ x: String(round2(r.x)), y: String(round2(r.y)) }); }, { disabled: placed || !boxes.some((b) => b.fl === n) }),
        act("Let it flow with the text", () => setF({ x: null, y: null }), { disabled: !placed }),
      ]),
      SEP,
      input("Items: text then colour", itemsText(spec.items), (v) => edit((t) => setFlashBody(t, id, n, v)), "3 red, 6 green"),
      SEP,
      act("Duplicate region", () => edit((t) => duplicateFlash(t, id, n))),
      act("Delete region", () => edit((t) => removeFlash(t, id, n)), { danger: true }),
    ];
  };

  const slideMenu = (at?: { x: number; y: number }): MenuItem[] => {
    const count = p.deck.slides.length;
    const flashAt = (label: string, v: Trigger) => act(label, () => edit((t) => addFlash(t, id, at, v)));
    const block = (label: string, k: "code" | "button" | "input" | "source") => act(label, () => edit((t) => appendBlock(t, id, SNIPPETS[k])));
    const opt = (key: string, label: string, v: string | null) => act(label, () => setOpts({ [key]: v }), { checked: (p.slide.opts[key] ?? null) === v });
    return [
      sub(at ? "Add here" : "Add", [
        sub("Flash region", [
          flashAt("Starts every time I arrive", "new-slide"), flashAt("Starts the first time only", "at-start"),
          flashAt("Starts when I press Next", "when-next"), flashAt("Starts from a button or click", "manual"),
        ]),
        act("Picture…", async () => { const refs = await p.pickImages(); await place(refs, at); }),
        ...(effectGroups().length ? [sub("Effect", effectGroups().map((g) => sub(g.label, g.entries.map((e) => act(e.effect.label, () => edit((t) => addFx(t, id, e.full, at)), { hint: fromModule(e) })))))] : []),
        SEP,
        block("Code block", "code"), block("Button", "button"), block("Input box", "input"), block("Hidden source", "source"),
      ]),
      sub("Background", [
        swatches(SWATCHES, (c) => setOpts({ bg: c })), SEP,
        act("Photo…", async () => { const r = await p.pickImages(); if (r[0]) setOpts({ bgimage: r[0] }); }),
        act("Remove photo", () => setOpts({ bgimage: null, bgdim: null }), { disabled: !back.image }),
        act("Clear background", () => setOpts({ bg: null, bgimage: null, bgdim: null }), { disabled: !back.color && !back.image }),
        act("Apply to all slides", applyBgToAll, { disabled: !back.color && !back.image }),
      ]),
      sub("Slide", [
        act("New slide after this", () => { edit((t) => addSlide(t, id)); later(() => L.current.onSlide(id + 1)); }),
        act("Duplicate slide", () => { edit((t) => duplicateSlide(t, id)); later(() => L.current.onSlide(id + 1)); }),
        act("Delete slide", () => { edit((t) => deleteSlide(t, id)); later(() => L.current.onSlide(Math.min(id, L.current.deck.slides.length - 1))); }, { disabled: count < 2, danger: true }),
        SEP,
        sub("Transition", [opt("transition", "Deck default", null), ...["fade", "slide", "zoom", "none"].map((v) => opt("transition", v, v))]),
        sub("Reveal", [opt("reveal", "Deck default", null), ...["stagger", "none"].map((v) => opt("reveal", v, v))]),
      ]),
    ];
  };

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = e.target as HTMLElement;
    const pic = el.closest<HTMLElement>("[data-pic]"), bx = el.closest<HTMLElement>("[data-bbox]");
    let items: MenuItem[];
    const hit = pic ? `p${pic.dataset.pic}` : bx ? `b${bx.dataset.bbox}` : "";
    if (hit && multi.includes(hit)) items = multiMenu();
    else if (pic) { const n = +pic.dataset.pic!; select(n); items = picMenu(n); }
    else if (bx) {
      const b = boxes.find((x) => x.i === +bx.dataset.bbox!)!; setBsel(b.i); setSel(null); setMulti([]);
      items = b.fl !== undefined ? flashMenu(b.fl) : blockMenu(b);
    }
    else items = slideMenu(inFrame(e.clientX, e.clientY) ? toPct(e.clientX, e.clientY) : undefined);
    setMenu({ x: e.clientX, y: e.clientY, items });
  };

  const slideNow = liveBg !== null || liveDim !== null
    ? { ...p.slide, opts: { ...p.slide.opts, ...(liveBg !== null ? { bg: liveBg } : {}), ...(liveDim !== null ? { bgdim: liveDim } : {}) } }
    : p.slide;
  const cur = sel !== null ? defs[sel] : undefined;
  const hex = /^#[0-9a-f]{6}$/i.test(back.color ?? "") ? back.color! : "#151a2d";
  const all = p.deck.slides;

  return (
    <div className="vis">
      <div className="pane canvas visual" onPointerDown={() => select(null)} onContextMenu={onContext}>
        <div className="fit">
          <div className={"frame" + (over ? " dropping" : "")} ref={frame}>
            <div className="slide"><SlideView slide={slideNow} slideKey={id} reveal={false} tools={p.tools} edits={p.edits} images={shown} plain align={p.deck.meta.align} /></div>
            <div className="ovl">
              {boxes.map((b) => {
                const r = dragBlk?.i === b.i ? dragBlk.r : b, on = bsel === b.i, sized = b.kind === "html" || b.kind === "run" || b.kind === "flash" || b.kind === "fx" || b.kind === "wrap" || b.kind === "trace" || b.kind === "media";
                return (
                  <div key={`b${b.i}`} data-bbox={b.i} {...(b.fl !== undefined ? { "data-fl": b.fl } : {})} className={"box dom" + (on || multi.includes(`b${b.i}`) ? " sel" : "") + (multi.includes(`b${b.i}`) ? " multi" : "") + (b.placed || b.fl !== undefined && flashes[b.fl]?.spec.x !== undefined ? " placed" : "")}
                    title={b.fl !== undefined ? "Flash region: drag to place it, right-click for options" : "Drag to place anywhere; Shift+click to select several; right-click for options"}
                    style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`, ...(rotShown(`b${b.i}`, b.rot) ? { rotate: `${rotShown(`b${b.i}`, b.rot)}deg` } : null) }} onPointerDown={(e) => beginBlock(e, b, "move")}>
                    {on && b.fl === undefined && <b className="h rot" title="Rotate (Shift snaps to 15°)" onPointerDown={(e) => beginRotate(e, `b${b.i}`)} />}
                    {on && sized && (["w", "e", "n", "s", "nw", "ne", "sw", "se"] as const).map((m) => <b key={m} className={`h ${m.length === 1 ? "side " : ""}${m}`} onPointerDown={(e) => beginBlock(e, b, m)} />)}
                  </div>
                );
              })}
              {shown.map((d, i) => (
                <div key={i} data-pic={i} className={"box" + (sel === i || multi.includes(`p${i}`) ? " sel" : "") + (multi.includes(`p${i}`) ? " multi" : "")} style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%`, ...(d.rot ? { rotate: `${d.rot}deg` } : null) }}
                  onPointerDown={(e) => begin(e, i, "move")}>
                  {sel === i && <b className="h rot" title="Rotate (Shift snaps to 15°)" onPointerDown={(e) => beginRotate(e, `p${i}`)} />}
                  {sel === i && (["nw", "ne", "sw", "se", "n", "s", "e", "w"] as Corner[]).map((c) => <b key={c} className={`h ${c.length === 1 ? "edge " : ""}${c}`} onPointerDown={(e) => begin(e, i, c)} />)}
                </div>
              ))}
              {guides.x !== undefined && <i className="guide v" style={{ left: `${guides.x}%` }} />}
              {guides.y !== undefined && <i className="guide hz" style={{ top: `${guides.y}%` }} />}
            </div>
          </div>
          <div className="nav" onPointerDown={(e) => e.stopPropagation()}>
            <button disabled={id === 0} onClick={() => p.onSlide(id - 1)}>Previous</button>
            <span>{id + 1} / {all.length}</span>
            <button disabled={id >= all.length - 1} onClick={() => p.onSlide(id + 1)}>Next</button>
          </div>
        </div>
      </div>

      <aside className="insp">
        {MODULES.length > 0 && (
          <div className="itabs">
            <button className={tab === "inspect" ? "on" : ""} onClick={() => setTab("inspect")}>Inspector</button>
            <button className={tab === "modules" ? "on" : ""} onClick={() => setTab("modules")}>Modules</button>
          </div>
        )}
        {tab === "modules" && MODULES.length > 0 ? <ModulesPanel src={p.slide.src} id={id} edit={edit} /> : <>
        <section>
          <div className="ptitle">MEDIA<span className="grow" /><button onClick={importAndPlace} title="Choose image files">Import…</button></div>
          {p.media.length
            ? <div className="tiles">{p.media.map((m) => <Tile key={m} ref_={m} onDown={(e) => tileDown(e, m)} onBg={() => setOpts({ bgimage: m })} />)}</div>
            : <p className="hint">No images yet. Click Import, or drop image files onto the slide.</p>}
        </section>

        {defs.length > 0 && (
          <section>
            <div className="ptitle">LAYERS <small>top first</small></div>
            <ul className="layers">
              {defs.map((d, n) => ({ d, n })).reverse().map(({ d, n }) => (
                <LayerRow key={n} d={d} n={n} last={n === defs.length - 1} sel={sel === n} onSel={() => select(n)}
                  onUp={() => restack(n, n + 1)} onDown={() => restack(n, n - 1)} onDel={() => remove(n)} />
              ))}
            </ul>
          </section>
        )}

        {bsel !== null && boxes.find((b) => b.i === bsel) && (() => {
          const b = boxes.find((x) => x.i === bsel)!, blk = blks[b.i];
          const put = (patch: Partial<Rect>) => commitBlock(b, { ...b, ...patch }, patch.w !== undefined || patch.h !== undefined, patch.h !== undefined);
          const placed = blk?.at || (b.fl !== undefined && flashes[b.fl]?.spec.x !== undefined);
          const sized = b.kind === "html" || b.kind === "run" || b.kind === "flash" || b.kind === "fx" || b.kind === "wrap" || b.kind === "trace" || b.kind === "media";
          return (
            <section>
              <div className="ptitle">{(blk?.kind === "trace" && blk.def.part ? `Trace ${blk.def.part}` : KIND[b.kind] ?? "Block").toUpperCase()}</div>
              <div className="nums">
                <Num label="X %" value={b.x} onCommit={(x) => put({ x })} />
                <Num label="Y %" value={b.y} onCommit={(y) => put({ y })} />
                {sized && <Num label="Width %" value={b.w} onCommit={(w) => put({ w: Math.max(5, w) })} />}
                {sized && <Num label="Height %" value={b.h} onCommit={(h) => put({ h: Math.max(5, h) })} />}
              </div>
              {b.fl === undefined && <div className="nums"><Num label="Rotate °" value={rotOf(`b${b.i}`)} onCommit={(r) => setRot(`b${b.i}`, r)} /></div>}
              {sized && b.fl === undefined && <label className="chk"><input type="checkbox" checked={blk?.at?.fit === "scale"} onChange={(e) => setStretch(b.i, e.target.checked)} /> Stretch text to the box (X and Y)</label>}
              {placed && b.fl === undefined && <div className="btns arr"><button title="Bring to front" disabled={!canStack(`b${b.i}`, "up")} onClick={() => stack(`b${b.i}`, "front")}>⤒ Front</button><button title="Bring forward" disabled={!canStack(`b${b.i}`, "up")} onClick={() => stack(`b${b.i}`, "forward")}>↑</button><button title="Send backward" disabled={!canStack(`b${b.i}`, "down")} onClick={() => stack(`b${b.i}`, "backward")}>↓</button><button title="Send to back" disabled={!canStack(`b${b.i}`, "down")} onClick={() => stack(`b${b.i}`, "back")}>⤓ Back</button></div>}
              {blk?.kind === "trace" && <TraceFields def={blk.def} runs={runIds(p.deck.slides)} onPatch={(patch) => edit((t) => patchTraceLine(t, id, blk.line, patch))} onSplit={!blk.def.part ? () => edit((t) => splitTraceBlock(t, id, blk)) : undefined} />}
              <p className="hint">{placed ? "Placed on the slide." : "In the text flow. Drag it, or type a position, to place it."}</p>
              <div className="btns">
                {blk?.at?.h !== undefined && <button onClick={() => edit((t) => placeBlock(t, id, blk, { x: blk.at!.x, y: blk.at!.y, w: blk.at!.w }))}>Auto height</button>}
                {placed && <button onClick={() => b.fl !== undefined ? edit((t) => patchFlash(t, id, b.fl!, { set: { x: null, y: null } })) : edit((t) => unplaceBlock(t, id, blk))}>Return to flow</button>}
                <button onClick={() => removeBlock(b.i)}>Delete</button>
              </div>
            </section>
          );
        })()}

        {multi.length >= 2 && (
          <section>
            <div className="ptitle">{multi.length} SELECTED</div>
            <p className="hint">Align lines the selection up with its own edges. Shift+click adds or removes one.</p>
            <div className="btns arr">
              <button title="Align left edges" onClick={() => arrange("left")}>⇤</button><button title="Centre horizontally" onClick={() => arrange("hcenter")}>↔</button><button title="Align right edges" onClick={() => arrange("right")}>⇥</button>
              <button title="Align top edges" onClick={() => arrange("top")}>⤒</button><button title="Centre vertically" onClick={() => arrange("vcenter")}>↕</button><button title="Align bottom edges" onClick={() => arrange("bottom")}>⤓</button>
            </div>
            <div className="btns">
              <button disabled={multi.length < 3} onClick={() => arrange("hdist")}>Distribute across</button>
              <button disabled={multi.length < 3} onClick={() => arrange("vdist")}>Distribute down</button>
            </div>
          </section>
        )}

        {cur && sel !== null && (
          <section>
            <div className="ptitle">PICTURE</div>
            <div className="nums">
              <Num label="X %" value={cur.x} onCommit={(x) => edit((t) => patchImage(t, id, sel, { x }))} />
              <Num label="Y %" value={cur.y} onCommit={(y) => edit((t) => patchImage(t, id, sel, { y }))} />
              <Num label="Width %" value={cur.w} onCommit={(w) => edit((t) => patchImage(t, id, sel, { w: Math.max(1, w) }))} />
              <Num label="Height %" value={cur.h} onCommit={(h) => edit((t) => patchImage(t, id, sel, { h: Math.max(1, h) }))} />
              <Num label="Rotate °" value={cur.rot ?? 0} onCommit={(r) => setRot(`p${sel}`, r)} />
            </div>
            <div className="btns arr"><button title="Bring to front" disabled={!canStack(`p${sel}`, "up")} onClick={() => stack(`p${sel}`, "front")}>⤒ Front</button><button title="Bring forward" disabled={!canStack(`p${sel}`, "up")} onClick={() => stack(`p${sel}`, "forward")}>↑</button><button title="Send backward" disabled={!canStack(`p${sel}`, "down")} onClick={() => stack(`p${sel}`, "backward")}>↓</button><button title="Send to back" disabled={!canStack(`p${sel}`, "down")} onClick={() => stack(`p${sel}`, "back")}>⤓ Back</button></div>
            <div className="btns">
              <button onClick={() => fit(sel)}>Fit to slide</button>
              <button onClick={() => dup(sel)}>Duplicate</button>
              <button onClick={() => remove(sel)}>Delete</button>
            </div>
          </section>
        )}

        <section>
          <div className="ptitle">SLIDE BACKGROUND</div>
          <div className="row">
            <Live type="color" value={hex} onLive={setLiveBg} onCommit={(v) => setOpts({ bg: v })} />
            <div className="sws">
              {SWATCHES.map((c) => <button key={c} className="sw" title={c} style={{ background: c }} onClick={() => setOpts({ bg: c })} />)}
              <button className="sw none" title="Default colour" onClick={() => setOpts({ bg: null })}>×</button>
            </div>
          </div>
          <div className="btns">
            <button onClick={async () => { const r = await p.pickImages(); if (r[0]) setOpts({ bgimage: r[0] }); }}>{back.image ? "Replace photo…" : "Photo…"}</button>
            {back.image && <button onClick={() => setOpts({ bgimage: null, bgdim: null })}>Remove photo</button>}
          </div>
          {back.image && (
            <label className="dim">Dim photo
              <Live type="range" min={0} max={80} value={String(back.dim)} onLive={setLiveDim} onCommit={(v) => setOpts({ bgdim: +v ? v : null })} />
            </label>
          )}
          {(back.color || back.image) && (
            <div className="btns">
              <button title="Copy this slide's background to every slide" onClick={() => edit((t) => all.reduce((s, sl) => Object.entries({ bg: back.color ?? null, bgimage: back.image ?? null, bgdim: back.dim ? String(back.dim) : null }).reduce((a, [k, v]) => setSlideOpt(a, sl.id, k, v), s), t))}>Apply to all slides</button>
              <button onClick={() => setOpts({ bg: null, bgimage: null, bgdim: null })}>Clear</button>
            </div>
          )}
        </section>
        </>}
      </aside>

      {ghost && <MediaGhost g={ghost} />}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}

function MediaGhost({ g }: { g: { ref: string; x: number; y: number } }) {
  const url = useAssetUrl(g.ref);
  return <div className="ghost" style={{ left: g.x, top: g.y }}>{url && <img src={url} alt="" />}</div>;
}
