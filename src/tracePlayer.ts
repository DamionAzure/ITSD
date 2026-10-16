// Playback state for a trace, shared by every part of it (bars, code, operations, controls, counts, title) that reads the same run.
// It lives outside React so the parts can be separate slide elements, placed and edited on their own, and still stay in step.
import type { Frame, TraceData } from "./ctx";
import { parseSoundMap, parseVary, soundForOp, type SoundStore } from "./sound";

export interface PlayerState { i: number; play: boolean; speed: number }
export interface SoundCfg { sound?: string; vol?: string; pitch?: string; autoplay?: boolean; loop?: boolean }

function makePlayer(sound: SoundStore) {
  let st: PlayerState = { i: 0, play: false, speed: 1 };
  let bound: TraceData | null = null, sample = true, frames: Frame[] = [];
  let map: ReturnType<typeof parseSoundMap> = {}, vol: string | undefined, pitch: string | undefined;
  let range = { lo: 0, hi: 0 }, autoplay = false, loop = false;
  const subs = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  const emit = () => subs.forEach((f) => f());

  // Where the bars a step highlights sit between the lowest and highest value in the whole trace (0..1), so a signed `pitch=+0.5` can follow the data.
  const normOf = (fr: Frame) => {
    const vals = (fr.hl?.length ? fr.hl.map((k) => fr.a[k]) : [fr.key]).filter((v): v is number => Number.isFinite(v));
    return vals.length && range.hi > range.lo ? (vals.reduce((x, y) => x + y, 0) / vals.length - range.lo) / (range.hi - range.lo) : undefined;
  };
  const ring = (fr: Frame) => {
    const sp = soundForOp(map, fr.op); if (!sp) return;
    void sound.play(sp.name, { vol: sp.vol ?? (vol ? parseVary(vol) ?? undefined : undefined), pitch: sp.pitch ?? (pitch ? parseVary(pitch) ?? undefined : undefined), norm: normOf(fr) });
  };
  const retime = () => {
    if (timer) clearInterval(timer); timer = undefined;
    if (st.play && subs.size) timer = setInterval(() => { if (st.i >= frames.length - 1) { if (loop) goto(0, false); else set({ play: false }); } else goto(st.i + 1, true); }, 700 / st.speed);
  };
  const set = (p: Partial<PlayerState>) => { st = { ...st, ...p }; if (p.play !== undefined || p.speed !== undefined) retime(); emit(); };
  const goto = (i: number, ring_: boolean) => {
    i = Math.max(0, Math.min(frames.length - 1, i));
    if (i !== st.i && ring_ && !sample && frames[i]) ring(frames[i]);
    set({ i });
  };

  return {
    subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); if (!subs.size) { if (timer) clearInterval(timer); timer = undefined; st = { ...st, play: false }; } }; },
    snapshot: () => st,
    /** Called by every part when it renders; only the first call for a new run does anything (resets to step 1). The sound options of any part are kept. */
    bind(trace: TraceData, isSample: boolean, cfg: SoundCfg) {
      if (cfg.autoplay !== undefined) autoplay = cfg.autoplay;
      if (cfg.loop !== undefined) loop = cfg.loop;
      if (cfg.sound !== undefined) { map = parseSoundMap(cfg.sound); vol = cfg.vol || undefined; pitch = cfg.pitch || undefined; }
      if (trace === bound && isSample === sample) return;
      bound = trace; sample = isSample; frames = trace.frames;
      const all = frames.flatMap((x) => x.a).filter(Number.isFinite); range = { lo: all.length ? Math.min(...all) : 0, hi: all.length ? Math.max(...all) : 0 };
      st = { ...st, i: 0, play: autoplay && !isSample }; retime(); emit();
    },
    jump(i: number) { set({ play: false }); goto(i, true); },
    step(d: number) { set({ play: false }); goto(st.i + d, true); },
    toggle() { if (!st.play && st.i >= frames.length - 1) goto(0, false); set({ play: !st.play }); },
    setSpeed(s: number) { set({ speed: s }); },
  };
}
export type TracePlayer = ReturnType<typeof makePlayer>;

/** One player per trace key (the run block's id; "" = the latest run). */
export function createPlayers(sound: SoundStore) {
  const m = new Map<string, TracePlayer>();
  return (key: string) => { let p = m.get(key); if (!p) { p = makePlayer(sound); m.set(key, p); } return p; };
}
