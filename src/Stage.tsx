import { useContext, useEffect, useLayoutEffect, useRef } from "react";
import { parseSoundSpec } from "./sound";
import { DeckCtx } from "./ctx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SlideView } from "./SlideView";
import { TraceView } from "./TraceView";
import { parseTransition } from "./transitions";
import type { Dir } from "./anim";
import type { Deck } from "./itsd";

// Motion handles slide-to-slide transitions; GSAP (in SlideView) handles reveals inside a slide.
const FROM: Record<Dir, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
export interface Cust { d: number; dir?: Dir; dur: number }
const side = (c: Cust): [number, number] => (c.dir ? FROM[c.dir] : [c.d >= 0 ? 1 : -1, 0]); // where the new slide comes from
const pc = (n: number) => `${n * 100}%`;
const tr = (c: Cust, o: object = {}) => ({ duration: c.dur, ease: [0.4, 0, 0.2, 1], ...o });
const clip = (c: Cust) => { const [x, y] = side(c); return [x > 0 ? "inset(0 0 0 100%)" : x < 0 ? "inset(0 100% 0 0)" : y > 0 ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)", "inset(0 0 0 0)"]; };

/** Variants per transition: `enter` is where the new slide starts, `exit` where the old one ends up. */
export const TRANS_VARIANTS: Record<string, any> = {
  none: { enter: {}, center: {}, exit: {} },
  fade: { enter: { opacity: 0 }, center: (c: Cust) => ({ opacity: 1, transition: tr(c) }), exit: (c: Cust) => ({ opacity: 0, transition: tr(c) }) },
  dissolve: { enter: { opacity: 0, filter: "blur(10px)" }, center: (c: Cust) => ({ opacity: 1, filter: "blur(0px)", transition: tr(c) }), exit: (c: Cust) => ({ opacity: 0, filter: "blur(10px)", transition: tr(c) }) },
  slide: { enter: (c: Cust) => ({ x: side(c)[0] * 70, y: side(c)[1] * 40, opacity: 0 }), center: (c: Cust) => ({ x: 0, y: 0, opacity: 1, transition: tr(c) }), exit: (c: Cust) => ({ x: -side(c)[0] * 70, y: -side(c)[1] * 40, opacity: 0, transition: tr(c) }) },
  push: { enter: (c: Cust) => ({ x: pc(side(c)[0]), y: pc(side(c)[1]) }), center: (c: Cust) => ({ x: 0, y: 0, transition: tr(c) }), exit: (c: Cust) => ({ x: pc(-side(c)[0]), y: pc(-side(c)[1]), transition: tr(c) }) },
  cover: { enter: (c: Cust) => ({ x: pc(side(c)[0]), y: pc(side(c)[1]), zIndex: 2 }), center: (c: Cust) => ({ x: 0, y: 0, zIndex: 2, transition: tr(c) }), exit: (c: Cust) => ({ x: pc(-side(c)[0] * 0.2), y: pc(-side(c)[1] * 0.2), zIndex: 1, transition: tr(c) }) },
  uncover: { enter: (c: Cust) => ({ x: pc(side(c)[0] * 0.2), y: pc(side(c)[1] * 0.2), zIndex: 1 }), center: (c: Cust) => ({ x: 0, y: 0, zIndex: 1, transition: tr(c) }), exit: (c: Cust) => ({ x: pc(-side(c)[0]), y: pc(-side(c)[1]), zIndex: 2, transition: tr(c) }) },
  wipe: { enter: (c: Cust) => ({ clipPath: clip(c)[0], zIndex: 2 }), center: (c: Cust) => ({ clipPath: clip(c)[1], zIndex: 2, transition: tr(c) }), exit: (c: Cust) => ({ zIndex: 1, opacity: 0.99, transition: tr(c) }) },
  split: { enter: { clipPath: "inset(0 50% 0 50%)", zIndex: 2 }, center: (c: Cust) => ({ clipPath: "inset(0 0% 0 0%)", zIndex: 2, transition: tr(c) }), exit: (c: Cust) => ({ zIndex: 1, opacity: 0.99, transition: tr(c) }) },
  iris: { enter: { clipPath: "circle(0% at 50% 50%)", zIndex: 2 }, center: (c: Cust) => ({ clipPath: "circle(75% at 50% 50%)", zIndex: 2, transition: tr(c) }), exit: (c: Cust) => ({ zIndex: 1, opacity: 0.99, transition: tr(c) }) },
  zoom: { enter: { scale: 0.86, opacity: 0 }, center: (c: Cust) => ({ scale: 1, opacity: 1, transition: tr(c) }), exit: (c: Cust) => ({ scale: 1.12, opacity: 0, transition: tr(c) }) },
  "zoom-out": { enter: { scale: 1.15, opacity: 0 }, center: (c: Cust) => ({ scale: 1, opacity: 1, transition: tr(c) }), exit: (c: Cust) => ({ scale: 0.88, opacity: 0, transition: tr(c) }) },
  rotate: { enter: { rotate: -7, scale: 0.88, opacity: 0 }, center: (c: Cust) => ({ rotate: 0, scale: 1, opacity: 1, transition: tr(c) }), exit: (c: Cust) => ({ rotate: 7, scale: 0.88, opacity: 0, transition: tr(c) }) },
  drop: { enter: { y: "-100%", zIndex: 2 }, center: (c: Cust) => ({ y: 0, zIndex: 2, transition: { duration: c.dur, ease: [0.34, 1.4, 0.64, 1] } }), exit: (c: Cust) => ({ opacity: 0.4, scale: 0.96, zIndex: 1, transition: tr(c) }) },
  flip: { enter: (c: Cust) => ({ rotateY: side(c)[0] * -90 || -90, opacity: 0 }), center: (c: Cust) => ({ rotateY: 0, opacity: 1, transition: tr(c, { duration: c.dur / 2 }) }), exit: (c: Cust) => ({ rotateY: side(c)[0] * 90 || 90, opacity: 0, transition: tr(c, { duration: c.dur / 2 }) }) },
  cube: { enter: (c: Cust) => ({ rotateY: side(c)[0] * 90, x: pc(side(c)[0]), transformOrigin: side(c)[0] > 0 ? "0% 50%" : "100% 50%", opacity: 0.6 }), center: (c: Cust) => ({ rotateY: 0, x: 0, opacity: 1, transition: tr(c) }), exit: (c: Cust) => ({ rotateY: -side(c)[0] * 90, x: pc(-side(c)[0]), transformOrigin: side(c)[0] > 0 ? "100% 50%" : "0% 50%", opacity: 0.6, transition: tr(c) }) },
  morph: { enter: { opacity: 0 }, center: (c: Cust) => ({ opacity: 1, transition: { duration: Math.min(0.3, c.dur * 0.4) } }), exit: (c: Cust) => ({ opacity: 1, transition: { duration: 0.01, delay: c.dur } }) },
};

// ---- Morph: objects on the two slides that share a name (`<!-- @id x -->`), a picture file or their text glide from the old place, size and angle to the new one ----
const keyOf = (el: HTMLElement): string | null => {
  if (el.dataset.id) return `id:${el.dataset.id}`;
  const img = el.querySelector("img"); if (img?.getAttribute("src")) return `img:${img.getAttribute("src")}`;
  const t = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80); return t ? `t:${t}` : null;
};
const objects = (slide: Element) => {
  const seen = new Map<string, number>(), out = new Map<string, HTMLElement>();
  slide.querySelectorAll<HTMLElement>("[data-blk],[data-pn]").forEach((el) => {
    const k = keyOf(el); if (!k) return;
    const n = (seen.get(k) ?? 0) + 1; seen.set(k, n); out.set(n > 1 ? `${k}#${n}` : k, el);
  });
  return out;
};
const rotOf = (el: HTMLElement) => { const m = getComputedStyle(el).rotate; return m && m !== "none" ? parseFloat(m) || 0 : 0; };
function morph(frame: HTMLElement, dur: number) {
  const slides = frame.querySelectorAll<HTMLElement>(":scope > .slide"); if (slides.length < 2) return;
  const [old, now] = [slides[0], slides[slides.length - 1]], a = objects(old), b = objects(now), f = frame.getBoundingClientRect();
  b.forEach((el, k) => {
    const from = a.get(k); if (!from) return;
    const r0 = from.getBoundingClientRect(), r1 = el.getBoundingClientRect(); if (!r1.width || !r1.height) return;
    const dx = r0.left - r1.left, dy = r0.top - r1.top, sx = r0.width / r1.width, sy = r0.height / r1.height, dr = rotOf(from) - rotOf(el);
    from.style.visibility = "hidden";
    el.animate([
      { translate: `${dx}px ${dy}px`, scale: `${sx} ${sy}`, rotate: `${dr}deg`, opacity: 1 },
      { translate: "0px 0px", scale: "1 1", rotate: "0deg", opacity: 1 },
    ], { duration: dur * 1000, easing: "cubic-bezier(.4,0,.2,1)", composite: "add", fill: "backwards" });
    el.style.transformOrigin = "0 0"; setTimeout(() => el.style.removeProperty("transform-origin"), dur * 1000 + 50);
  });
  void f;
}

interface Props { deck: Deck; idx: number; dir: number; tools: Record<string, boolean>; edits: Map<string, string> }

export function Stage({ deck, idx, dir, tools, edits }: Props) {
  const calm = useReducedMotion();
  const slide = deck.slides[idx];
  const api = useContext(DeckCtx);
  const frame = useRef<HTMLDivElement>(null), prev = useRef(idx);
  // `sound: name` in a slide's comment plays as the slide appears, but only while presenting (so editing stays quiet).
  useEffect(() => { if (slide.opts.sound && api.presenting()) { const sp = parseSoundSpec(slide.opts.sound); if (sp) void api.sound.play(sp.name, sp); } }, [idx, slide.id, slide.opts.sound]);
  const tt = parseTransition(slide.opts.transition ?? deck.meta.transition);
  const t = calm ? "none" : tt.id;
  const dur = t === "none" ? 0 : (() => { const v = parseFloat(slide.opts.duration ?? deck.meta.duration ?? ""); return Number.isFinite(v) && v >= 0 ? Math.min(v, 5) : tt.def.dur; })();
  const reveal = !calm && t !== "morph" && (slide.opts.reveal ?? deck.meta.reveal ?? "stagger") !== "none";
  const cust: Cust = { d: dir, dir: tt.dir, dur };
  useLayoutEffect(() => { // runs once the new slide is in the DOM beside the old one, which is still on its way out
    if (prev.current !== idx && t === "morph" && frame.current) morph(frame.current, dur);
    prev.current = idx;
  }, [idx]);
  const sequential = tt.def.wait;
  return (
    <div className={`frame t-${t}`} ref={frame} style={t === "flip" || t === "cube" ? { perspective: 1600 } : undefined}>
      <AnimatePresence mode={sequential ? "wait" : "popLayout"} custom={cust} initial={false}>
        <motion.div key={idx} className="slide" custom={cust} variants={TRANS_VARIANTS[t] ?? TRANS_VARIANTS.fade}
          initial="enter" animate="center" exit="exit" transition={{ duration: dur }}>
          {slide.trace ? <TraceView trace={slide.trace} onMake={() => slide.trace!.src !== undefined && api.makeTraceSlide(slide.trace!.src!, slide.trace!.name ?? "")} /> : <SlideView slide={slide} slideKey={idx} reveal={reveal} tools={tools} edits={edits} align={deck.meta.align} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
