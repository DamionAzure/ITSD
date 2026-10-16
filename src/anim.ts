// PowerPoint-style object animations: `anim <target> <effect> [from left|right|up|down] [over 0.6s] [delay 0.2s]`.
// Entrance effects start hidden (until their turn), exit effects leave the object hidden, emphasis effects play and return to rest.
export type Kind = "entrance" | "emphasis" | "exit";
export type Dir = "left" | "right" | "up" | "down";
export interface Effect { id: string; label: string; kind: Kind; dirs?: boolean; dur: number; defDir?: Dir }

export const EFFECTS: Effect[] = [
  { id: "appear", label: "Appear", kind: "entrance", dur: 0 },
  { id: "fade-in", label: "Fade", kind: "entrance", dur: 0.5 },
  { id: "fly-in", label: "Fly in", kind: "entrance", dirs: true, defDir: "down", dur: 0.6 },
  { id: "float-in", label: "Float in", kind: "entrance", dirs: true, defDir: "down", dur: 0.8 },
  { id: "wipe-in", label: "Wipe", kind: "entrance", dirs: true, defDir: "left", dur: 0.6 },
  { id: "zoom-in", label: "Zoom", kind: "entrance", dur: 0.5 },
  { id: "bounce-in", label: "Bounce", kind: "entrance", dur: 0.9 },
  { id: "spin-in", label: "Spin in", kind: "entrance", dur: 0.7 },
  { id: "swivel-in", label: "Swivel", kind: "entrance", dur: 0.7 },
  { id: "drop-in", label: "Drop", kind: "entrance", dur: 0.8 },
  { id: "split-in", label: "Split", kind: "entrance", dur: 0.6 },
  { id: "pulse", label: "Pulse", kind: "emphasis", dur: 0.6 },
  { id: "grow", label: "Grow / shrink", kind: "emphasis", dur: 0.7 },
  { id: "spin", label: "Spin", kind: "emphasis", dur: 0.8 },
  { id: "shake", label: "Shake", kind: "emphasis", dur: 0.6 },
  { id: "wobble", label: "Wobble", kind: "emphasis", dur: 0.8 },
  { id: "blink", label: "Blink", kind: "emphasis", dur: 0.6 },
  { id: "bounce", label: "Bounce", kind: "emphasis", dur: 0.8 },
  { id: "flip", label: "Flip", kind: "emphasis", dur: 0.8 },
  { id: "heartbeat", label: "Heartbeat", kind: "emphasis", dur: 0.9 },
  { id: "disappear", label: "Disappear", kind: "exit", dur: 0 },
  { id: "fade-out", label: "Fade", kind: "exit", dur: 0.5 },
  { id: "fly-out", label: "Fly out", kind: "exit", dirs: true, defDir: "down", dur: 0.6 },
  { id: "float-out", label: "Float out", kind: "exit", dirs: true, defDir: "up", dur: 0.8 },
  { id: "wipe-out", label: "Wipe", kind: "exit", dirs: true, defDir: "left", dur: 0.6 },
  { id: "zoom-out", label: "Zoom", kind: "exit", dur: 0.5 },
  { id: "spin-out", label: "Spin out", kind: "exit", dur: 0.7 },
  { id: "shrink-out", label: "Shrink & turn", kind: "exit", dur: 0.7 },
];
export const effectOf = (id: string) => EFFECTS.find((e) => e.id === id);
export const isEntrance = (id: string) => effectOf(id)?.kind === "entrance";
export const DIRS: Dir[] = ["left", "right", "up", "down"];
export const isDir = (w: string): w is Dir => (DIRS as string[]).includes(w);

type Frames = { move?: Keyframe[]; look?: Keyframe[]; ease?: string; end?: "show" | "hide" | "keep" };
// A "from" direction: where the object comes from (entrance) or goes to (exit).
const vec = (d: Dir) => ({ left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[d]);
const clipFrom = (d: Dir, shown: boolean): [string, string] => {
  const hidden = { left: "inset(0 100% 0 0)", right: "inset(0 0 0 100%)", up: "inset(0 0 100% 0)", down: "inset(100% 0 0 0)" }[d];
  return shown ? [hidden, "inset(0 0 0 0)"] : ["inset(0 0 0 0)", hidden];
};

function frames(id: string, dir: Dir, w: number, h: number): Frames {
  const [vx, vy] = vec(dir), T = (x: number, y: number) => `${x}px ${y}px`;
  switch (id) {
    case "appear": return { end: "show" };
    case "disappear": return { end: "hide" };
    case "fade-in": return { look: [{ opacity: 0 }, { opacity: 1 }], end: "show" };
    case "fade-out": return { look: [{ opacity: 1 }, { opacity: 0 }], end: "hide" };
    case "fly-in": return { move: [{ translate: T(vx * w, vy * h) }, { translate: T(0, 0) }], look: [{ opacity: 1 }, { opacity: 1 }], ease: "cubic-bezier(.2,.8,.2,1)", end: "show" };
    case "fly-out": return { move: [{ translate: T(0, 0) }, { translate: T(vx * w, vy * h) }], ease: "cubic-bezier(.8,0,.8,.2)", end: "hide" };
    case "float-in": return { move: [{ translate: T(vx * w * 0.08, vy * h * 0.12) }, { translate: T(0, 0) }], look: [{ opacity: 0 }, { opacity: 1 }], end: "show" };
    case "float-out": return { move: [{ translate: T(0, 0) }, { translate: T(vx * w * 0.08, vy * h * 0.12) }], look: [{ opacity: 1 }, { opacity: 0 }], end: "hide" };
    case "wipe-in": return { look: [{ clipPath: clipFrom(dir, true)[0], opacity: 1 }, { clipPath: clipFrom(dir, true)[1], opacity: 1 }], end: "show" };
    case "wipe-out": return { look: [{ clipPath: clipFrom(dir, false)[0] }, { clipPath: clipFrom(dir, false)[1] }], end: "hide" };
    case "zoom-in": return { move: [{ scale: "0.05" }, { scale: "1" }], look: [{ opacity: 0 }, { opacity: 1 }], end: "show" };
    case "zoom-out": return { move: [{ scale: "1" }, { scale: "0.05" }], look: [{ opacity: 1 }, { opacity: 0 }], end: "hide" };
    case "bounce-in": return { move: [{ scale: "0.2", offset: 0 }, { scale: "1.15", offset: 0.5 }, { scale: "0.92", offset: 0.75 }, { scale: "1", offset: 1 }], look: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 1 }], end: "show" };
    case "spin-in": return { move: [{ rotate: "-360deg", scale: "0.1" }, { rotate: "0deg", scale: "1" }], look: [{ opacity: 0 }, { opacity: 1 }], end: "show" };
    case "spin-out": return { move: [{ rotate: "0deg", scale: "1" }, { rotate: "360deg", scale: "0.1" }], look: [{ opacity: 1 }, { opacity: 0 }], end: "hide" };
    case "swivel-in": return { look: [{ transform: "perspective(900px) rotateY(-90deg)", opacity: 0 }, { transform: "perspective(900px) rotateY(0deg)", opacity: 1 }], end: "show" };
    case "drop-in": return { move: [{ translate: T(0, -h * 0.9), offset: 0 }, { translate: T(0, 0), offset: 0.55 }, { translate: T(0, -h * 0.12), offset: 0.75 }, { translate: T(0, 0), offset: 0.9 }, { translate: T(0, -h * 0.03), offset: 0.95 }, { translate: T(0, 0), offset: 1 }], look: [{ opacity: 1 }, { opacity: 1 }], end: "show" };
    case "split-in": return { look: [{ clipPath: "inset(0 50% 0 50%)", opacity: 1 }, { clipPath: "inset(0 0 0 0)", opacity: 1 }], end: "show" };
    case "shrink-out": return { move: [{ rotate: "0deg", scale: "1" }, { rotate: "-90deg", scale: "0.1" }], look: [{ opacity: 1 }, { opacity: 0 }], end: "hide" };
    case "pulse": return { move: [{ scale: "1" }, { scale: "1.15" }, { scale: "1" }] };
    case "grow": return { move: [{ scale: "1" }, { scale: "1.4" }, { scale: "1" }] };
    case "spin": return { move: [{ rotate: "0deg" }, { rotate: "360deg" }] };
    case "flip": return { look: [{ transform: "perspective(900px) rotateY(0deg)" }, { transform: "perspective(900px) rotateY(360deg)" }] };
    case "shake": return { move: [0, -1, 1, -1, 1, -1, 1, 0].map((k) => ({ translate: T(k * w * 0.012, 0) })) };
    case "wobble": return { move: [0, -6, 5, -4, 3, -1, 0].map((k) => ({ rotate: `${k}deg` })) };
    case "blink": return { look: [{ opacity: 1 }, { opacity: 0.1 }, { opacity: 1 }, { opacity: 0.1 }, { opacity: 1 }] };
    case "bounce": return { move: [0, -0.12, 0, -0.06, 0].map((k) => ({ translate: T(0, k * h) })), ease: "ease-out" };
    case "heartbeat": return { move: [{ scale: "1" }, { scale: "1.18" }, { scale: "1" }, { scale: "1.12" }, { scale: "1" }] };
  }
  return {};
}

/** Play one effect on `el`. `rest` is the opacity the element has before it (0 while an entrance is waiting). Resolves when finished. */
export function playEffect(el: HTMLElement, id: string, dir: Dir | "", dur: number, delay: number, still: boolean, setOpacity: (v: number) => void): Promise<void> {
  const e = effectOf(id); if (!e) return Promise.resolve();
  const slide = (el.closest(".slide") ?? el.parentElement!).getBoundingClientRect();
  const f = frames(id, dir || e.defDir || "down", slide.width, slide.height);
  const done = () => { if (f.end === "show") { setOpacity(1); el.style.removeProperty("clip-path"); } else if (f.end === "hide") setOpacity(0); };
  if (still || dur <= 0 || (!f.move && !f.look)) return new Promise((res) => setTimeout(() => { done(); res(); }, delay * 1000));
  const opts: KeyframeAnimationOptions = { duration: dur * 1000, delay: delay * 1000, easing: f.ease ?? "ease-in-out", fill: "both" };
  const runs: Animation[] = [];
  if (f.move) runs.push(el.animate(f.move, { ...opts, composite: "add" }));
  if (f.look) {
    const look = f.look.map((k) => k.transform ? { ...k } : k);
    runs.push(el.animate(look, opts));
  }
  if (e.kind === "entrance") { el.style.opacity = "1"; } // the animation's own frames take over from the waiting-hidden state
  return Promise.all(runs.map((a) => a.finished)).then(() => { done(); runs.forEach((a) => a.cancel()); }, () => done());
}
