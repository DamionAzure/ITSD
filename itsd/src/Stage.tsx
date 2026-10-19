import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SlideView } from "./SlideView";
import { TraceView } from "./TraceView";
import type { Deck } from "./itsd";

// Motion handles slide-to-slide transitions; GSAP (in SlideView) handles reveals inside a slide.
const VARIANTS: Record<string, any> = {
  fade:  { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } },
  slide: { enter: (d: number) => ({ x: d * 70, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: -d * 70, opacity: 0 }) },
  zoom:  { enter: { scale: 0.94, opacity: 0 }, center: { scale: 1, opacity: 1 }, exit: { scale: 1.05, opacity: 0 } },
  none:  { enter: {}, center: {}, exit: {} },
};

interface Props { deck: Deck; idx: number; dir: number; tools: Record<string, boolean>; edits: Map<string, string> }

export function Stage({ deck, idx, dir, tools, edits }: Props) {
  const calm = useReducedMotion();
  const slide = deck.slides[idx];
  const t = calm ? "none" : slide.opts.transition ?? deck.meta.transition ?? "fade";
  const reveal = !calm && (slide.opts.reveal ?? deck.meta.reveal ?? "stagger") !== "none";
  return (
    <div className="frame">
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div key={idx} className="slide" custom={dir} variants={VARIANTS[t] ?? VARIANTS.fade}
          initial="enter" animate="center" exit="exit" transition={{ duration: t === "none" ? 0 : 0.26, ease: "easeOut" }}>
          {slide.trace ? <TraceView trace={slide.trace} /> : <SlideView slide={slide} slideKey={idx} reveal={reveal} tools={tools} edits={edits} align={deck.meta.align} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
