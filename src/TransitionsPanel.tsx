import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TRANSITIONS, parseTransition, joinTransition, type Transition } from "./transitions";
import { DIRS, type Dir } from "./anim";
import { TRANS_VARIANTS, type Cust } from "./Stage";

interface Props {
  slideTransition?: string; slideDuration?: string; deckTransition?: string; deckDuration?: string; slideNo: number;
  onApply: (scope: "slide" | "deck" | "all", transition: string | null, duration: string | null) => void; onClose: () => void;
}
const ARROW: Record<Dir, string> = { left: "←", right: "→", up: "↑", down: "↓" };

/** A looping demo of one transition between two little slides (slide 1 -> slide 2 -> slide 1 ...), played with the same motion the real slides use.
 *  It starts at once while `live` (a hovered tile, or the big preview), and shows slide 1 when it is not live. */
function Mini({ t, dir, live, big }: { t: Transition; dir?: Dir; live: boolean; big?: boolean }) {
  const [k, setK] = useState(0);
  const dur = Math.max(0.4, Math.min(t.dur || 0.4, 0.9));
  useEffect(() => {
    if (!live) { setK(0); return; }
    const first = setTimeout(() => setK(1), 140), h = setInterval(() => setK((n) => n + 1), Math.round((dur + 0.85) * 1000));
    return () => { clearTimeout(first); clearInterval(h); };
  }, [live, t.id, dur]);
  const cust: Cust = { d: 1, dir, dur };
  const v = TRANS_VARIANTS[t.id] ?? TRANS_VARIANTS.fade, odd = k % 2 === 1;
  return (
    <div className={"mini" + (big ? " big" : "")} style={{ perspective: 600 }}>
      <AnimatePresence mode={t.wait ? "wait" : "popLayout"} custom={cust} initial={false}>
        <motion.div key={k} className={`mt ${odd ? "b" : "a"}`} custom={cust} variants={v} initial="enter" animate="center" exit="exit" transition={{ duration: dur }}>
          <span className="ttl" /><span className="ln l1" /><span className="ln l2" /><span className="pic" /><span className="num">{odd ? 2 : 1}</span>
          {t.id === "morph" && <span className="mv" style={{ left: odd ? "58%" : "10%", top: odd ? "52%" : "40%", transform: `rotate(${odd ? 18 : 0}deg) scale(${odd ? 1.35 : 1})` }} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function TransitionsPanel({ slideTransition, slideDuration, deckTransition, deckDuration, slideNo, onApply, onClose }: Props) {
  const [scope, setScope] = useState<"slide" | "deck">("slide");
  const [hover, setHover] = useState("");
  const own = scope === "slide" ? slideTransition : deckTransition, ownDur = scope === "slide" ? slideDuration : deckDuration;
  const effective = parseTransition(slideTransition ?? deckTransition), cur = parseTransition(own ?? (scope === "slide" ? deckTransition : undefined));
  const shown = scope === "slide" ? effective : cur;
  const dur = parseFloat(ownDur ?? (scope === "slide" ? deckDuration ?? "" : "")), durV = Number.isFinite(dur) ? dur : shown.def.dur;
  const pick = (t: Transition, dir?: Dir) => onApply(scope, joinTransition(t.id, t.dirs ? dir ?? shown.dir ?? "left" : undefined), ownDur ?? null);
  const groups = ["Subtle", "Exciting", "Dynamic"] as const;
  const shownT = TRANSITIONS.find((x) => x.id === (hover || shown.id)) ?? shown.def; // the big preview follows the pointer, and rests on the chosen transition
  return (
    <aside className="sidepanel">
      <div className="sp-head"><b>Transitions</b><span className="grow" /><button title="Close" onClick={onClose}>✕</button></div>
      <div className="seg2">
        <button className={scope === "slide" ? "on" : ""} onClick={() => setScope("slide")}>Slide {slideNo}</button>
        <button className={scope === "deck" ? "on" : ""} onClick={() => setScope("deck")}>Whole deck</button>
      </div>
      <div className="sp-body">
        <div className="tprev">
          <Mini key={shownT.id} t={shownT} dir={shownT.dirs ? (shown.id === shownT.id ? shown.dir : undefined) : undefined} live big />
          <div className="tcap"><b>{shownT.label}</b><span>{shownT.hint}</span></div>
        </div>
        {scope === "slide" && <p className="sp-note">{slideTransition ? "This slide has its own transition." : "Using the deck's transition."} {slideTransition && <a onClick={() => onApply("slide", null, null)}>Use the deck's</a>}</p>}
        {groups.map((g) => (
          <section key={g}>
            <h4>{g}</h4>
            <div className="tgrid">
              {TRANSITIONS.filter((t) => t.group === g).map((t) => (
                <button key={t.id} className={"tile" + (shown.id === t.id ? " on" : "")} title={t.hint}
                  onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover("")} onFocus={() => setHover(t.id)} onBlur={() => setHover("")} onClick={() => pick(t)}>
                  <Mini t={t} dir={t.dirs ? shown.id === t.id ? shown.dir : undefined : undefined} live={hover === t.id} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        <section>
          <h4>Options</h4>
          <div className="opt">
            <span>From</span>
            <div className="dirs">{DIRS.map((d) => <button key={d} disabled={!shown.def.dirs} className={shown.dir === d ? "on" : ""} title={`From the ${d}`} onClick={() => pick(shown.def, d)}>{ARROW[d]}</button>)}</div>
          </div>
          <div className="opt">
            <span>Duration</span>
            <input type="number" min={0} max={5} step={0.1} value={+durV.toFixed(2)} disabled={shown.id === "none"} onChange={(e) => onApply(scope, own ?? null, e.target.value === "" ? null : String(e.target.value))} /> <em>s</em>
          </div>
          <div className="opt"><button className="wide" onClick={() => onApply("all", own ?? deckTransition ?? null, ownDur ?? null)}>Apply to all slides</button></div>
          <p className="sp-note">Morph: objects with the same <code>@id</code>, picture or text on the next slide glide to their new place, size and angle.</p>
        </section>
      </div>
    </aside>
  );
}
