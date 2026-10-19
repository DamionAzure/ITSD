import { useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RegCtx } from "./ctx";
import { useAssetUrl } from "./ImageLayer";
import { SHOW_EFFECTS, type ShowDef } from "./slideshow";

const ENTER: Record<string, Keyframe[]> = {
  fade: [{ opacity: 0 }, { opacity: 1 }],
  slide: [{ translate: "100% 0" }, { translate: "0 0" }], slideup: [{ translate: "0 100%" }, { translate: "0 0" }],
  zoom: [{ opacity: 0, scale: "1.3" }, { opacity: 1, scale: "1" }],
  blur: [{ opacity: 0, filter: "blur(14px)" }, { opacity: 1, filter: "blur(0px)" }],
  flip: [{ transform: "perspective(900px) rotateY(90deg)", opacity: 0 }, { transform: "perspective(900px) rotateY(0deg)", opacity: 1 }],
  wipe: [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], iris: [{ clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(75% at 50% 50%)" }],
};
const EXIT: Record<string, Keyframe[]> = {
  slide: [{ translate: "0 0" }, { translate: "-100% 0" }], slideup: [{ translate: "0 0" }, { translate: "0 -100%" }],
  zoom: [{ opacity: 1 }, { opacity: 0 }], flip: [{ transform: "perspective(900px) rotateY(0deg)", opacity: 1 }, { transform: "perspective(900px) rotateY(-90deg)", opacity: 0 }],
};
const RANDOM_POOL = SHOW_EFFECTS.filter((e) => e !== "none" && e !== "random");

type Layer = { key: number; idx: number; eff?: string };
const pickRandom = (n: number, avoid: number[]) => { const ok = Array.from({ length: n }, (_, i) => i).filter((i) => !avoid.includes(i)); const pool = ok.length ? ok : Array.from({ length: n }, (_, i) => i); return pool[Math.floor(Math.random() * pool.length)]; };

function Frame({ src, fit, eff, leaving, dur }: { src: string; fit: string; eff?: string; leaving: boolean; dur: number }) {
  const url = useAssetUrl(src), el = useRef<HTMLDivElement>(null);
  useEffect(() => { if (eff && eff !== "none" && ENTER[eff] && dur > 0) el.current?.animate(ENTER[eff], { duration: dur * 1000, easing: "ease", fill: "both" }); }, []); // only a frame that arrives by a change animates
  useEffect(() => { if (leaving && eff && EXIT[eff] && dur > 0) el.current?.animate(EXIT[eff], { duration: dur * 1000, easing: "ease", fill: "both" }); }, [leaving]);
  return <div className="sh-frame" ref={el}>{url ? <img src={url} alt="" draggable={false} style={{ objectFit: fit as CSSProperties["objectFit"] }} /> : <span>{src}</span>}</div>;
}

function Show({ def, srcs }: { def: ShowDef; srcs: string[] }) {
  const reg = useContext(RegCtx);
  const n = srcs.length, cells = def.mode === "staggered" ? Math.max(1, Math.min(def.cells, n)) : 1;
  const keyc = useRef(0);
  const shown = useRef<number[]>(Array.from({ length: cells }, (_, i) => (def.mode === "random" && cells === 1 ? Math.floor(Math.random() * n) : i % n)));
  const rr = useRef(0);
  const [layers, setLayers] = useState<Layer[][]>(() => shown.current.map((idx) => [{ key: ++keyc.current, idx }]));
  const [playing, setPlaying] = useState(def.autoplay);
  const root = useRef<HTMLDivElement>(null);

  const tick = () => {
    const c = def.mode === "staggered" ? rr.current++ % cells : 0, cur = shown.current[c];
    let next: number;
    if (def.mode === "random") next = pickRandom(n, cells > 1 && n > cells ? shown.current : [cur]);
    else if (def.mode === "staggered") next = (cur + (n > cells ? cells : 1)) % n;
    else if (def.mode === "once") { if (cur >= n - 1) { setPlaying(false); return; } next = cur + 1; }
    else next = (cur + 1) % n;
    if (next === cur) return;
    shown.current[c] = next;
    const eff = def.effect === "random" ? RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)] : def.effect, key = ++keyc.current;
    setLayers((prev) => prev.map((l, k) => (k === c ? [...l.slice(-1), { key, idx: next, eff }] : l)));
    window.setTimeout(() => setLayers((prev) => prev.map((l, k) => (k === c && l.length > 1 && l[l.length - 1].key === key ? l.slice(-1) : l))), def.fade * 1000 + 80);
  };
  const latest = useRef(tick); latest.current = tick;
  useEffect(() => { if (n < 2 || !playing) return; const id = window.setInterval(() => latest.current(), def.every * 1000); return () => window.clearInterval(id); }, [playing, n, def.every]);
  useEffect(() => {
    if (!def.id) return;
    reg.set(def.id, { setCode: () => {}, run: async () => {}, note: () => {}, start: () => setPlaying(true), stop: () => setPlaying(false), show: (on) => { if (root.current) root.current.hidden = !on; } });
    return () => { reg.delete(def.id!); };
  }, [def.id]);

  const grid: CSSProperties = { aspectRatio: def.ratio?.replace(":", "/") ?? "16 / 9", gridTemplateColumns: `repeat(${cells > 1 ? def.cols : 1}, minmax(0, 1fr))`, gap: `calc(var(--u) * ${cells > 1 ? def.gap : 0})` };
  return (
    <div className={`sh sh-${def.mode}`} ref={root} style={grid} data-playing={playing ? "1" : undefined}>
      {layers.map((ls, c) => (
        <div className="sh-cell" key={c}>
          {ls.map((l, k) => <Frame key={l.key} src={srcs[l.idx]} fit={def.fit} eff={l.eff} leaving={k < ls.length - 1} dur={def.fade} />)}
        </div>
      ))}
    </div>
  );
}

/** Pictures that change by themselves: loop, random or staggered (see slideshow.ts). */
export function Slideshow({ def }: { def: ShowDef }) {
  const srcs = useMemo(() => { const s = [...def.srcs]; if (def.shuffle) for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; } return s; }, [def.srcs.join("|"), def.shuffle]);
  if (!srcs.length) return <div className="media empty"><p>Slideshow: add pictures, for example <code>::: slideshow "assets/a.jpg" "assets/b.jpg"</code>.</p></div>;
  return <Show key={`${srcs.join("|")}|${def.mode}|${def.cells}`} def={def} srcs={srcs} />;
}
