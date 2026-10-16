// Sound effects. Two sources, looked up by name:
//   1. files in ONE sound folder the author points the app at (Sound menu > Set sound folder...). It is an app setting, not part of the
//      deck, so it can be moved or changed at any time; `boom` finds boom.wav / boom.mp3 / boom.ogg ... in it (case-insensitive).
//   2. built-in sounds, synthesized with Web Audio (no files): click tick pop blip ding chime success error whoosh zap boom.
// A folder file wins over a built-in of the same name, so any built-in can be replaced by dropping a file in the folder.
export const SFX_EXT = ["wav", "mp3", "ogg", "m4a", "flac", "aac", "opus", "webm"];
export const isSoundPath = (p: string) => SFX_EXT.includes((p.split(".").pop() ?? "").toLowerCase());

type Out = { c: AudioContext; out: AudioNode; t: number; r: number }; // r: pitch ratio (1 = as designed)
interface Tone { f: number; f2?: number; dur: number; type?: OscillatorType; vol?: number; at?: number; att?: number }
interface Hiss { dur: number; vol?: number; at?: number; kind?: BiquadFilterType; f: number; f2?: number; q?: number }

const tone = ({ c, out, t, r }: Out, o: Tone) => {
  const s = t + (o.at ?? 0), osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f * r, s);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2 * r, s + o.dur);
  const a = o.att ?? 0.005, v = o.vol ?? 0.4;
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(v, s + a);
  g.gain.exponentialRampToValueAtTime(0.0001, s + o.dur);
  osc.connect(g).connect(out); osc.start(s); osc.stop(s + o.dur + 0.05);
};
const hiss = ({ c, out, t, r }: Out, o: Hiss) => {
  const s = t + (o.at ?? 0), n = Math.max(1, Math.floor(c.sampleRate * o.dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = o.kind ?? "bandpass"; f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.f * r, s); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2 * r, s + o.dur);
  const g = c.createGain(), v = o.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(v, s + Math.min(0.05, o.dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, s + o.dur);
  src.connect(f).connect(g).connect(out); src.start(s);
};

export const BUILTIN: Record<string, (o: Out) => void> = {
  click: (o) => { tone(o, { f: 1800, f2: 900, dur: 0.04, type: "square", vol: 0.15 }); hiss(o, { dur: 0.03, f: 4000, kind: "highpass", vol: 0.12 }); },
  tick: (o) => tone(o, { f: 1200, dur: 0.05, type: "triangle", vol: 0.3 }),
  pop: (o) => tone(o, { f: 520, f2: 140, dur: 0.12, vol: 0.5 }),
  blip: (o) => tone(o, { f: 880, f2: 1320, dur: 0.09, type: "square", vol: 0.18 }),
  ding: (o) => { tone(o, { f: 1320, dur: 0.9, vol: 0.35 }); tone(o, { f: 2640, dur: 0.5, vol: 0.1 }); },
  chime: (o) => [784, 988, 1175, 1568].forEach((f, k) => tone(o, { f, dur: 0.7, vol: 0.22, at: k * 0.09 })),
  success: (o) => [523, 659, 784].forEach((f, k) => tone(o, { f, dur: 0.25, type: "triangle", vol: 0.3, at: k * 0.1 })),
  error: (o) => { tone(o, { f: 220, dur: 0.18, type: "sawtooth", vol: 0.25 }); tone(o, { f: 165, dur: 0.3, type: "sawtooth", vol: 0.25, at: 0.16 }); },
  whoosh: (o) => hiss(o, { dur: 0.55, f: 300, f2: 3500, q: 0.8, vol: 0.4 }),
  zap: (o) => { tone(o, { f: 1800, f2: 120, dur: 0.25, type: "sawtooth", vol: 0.2 }); hiss(o, { dur: 0.2, f: 3000, kind: "highpass", vol: 0.1 }); },
  boom: (o) => { tone(o, { f: 120, f2: 30, dur: 0.9, vol: 0.8 }); hiss(o, { dur: 0.5, f: 600, f2: 80, kind: "lowpass", vol: 0.5 }); },
};
export const BUILTIN_NAMES = Object.keys(BUILTIN);

// ---- how a sound is played: volume and pitch, each optionally a little random so a repeated sound doesn't wear on the ear ----
//   vol=0.8            pitch=1.5 (a ratio: 2 = an octave up, 0.5 = down)       pitch=1+-0.2 (1, give or take up to 0.2, drawn fresh each play)
//   pitch=+-0.2        the same, around 1                                       pitch=+-2st  (give or take up to 2 semitones)    pitch=3st (3 up)
export interface Vary { base?: number; jitter: number; st: boolean; follow?: boolean } // follow: written with a sign (+0.2, -0.2): moves with the data (see rateOf)
const VARY = /^([-+]?\d*\.?\d+)?(?:(?:\+-|\+\/-|±)(\d*\.?\d+))?(st)?$/i;
export function parseVary(s: string): Vary | null {
  const m = s.trim().match(VARY);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  return { base: m[1] === undefined ? undefined : parseFloat(m[1]), jitter: m[2] ? parseFloat(m[2]) : 0, st: !!m[3], ...(m[1] !== undefined && /^[-+]/.test(m[1]) ? { follow: true } : {}) };
}
const draw = (v: Vary, dflt: number) => (v.base ?? dflt) + (v.jitter ? (Math.random() * 2 - 1) * v.jitter : 0);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
export const volOf = (v?: Vary | number) => clamp(v === undefined ? 1 : typeof v === "number" ? v : draw(v, 1), 0, 1);
/** The playback-rate ratio for a pitch setting (a fresh random draw each call).
 *  A pitch written with a sign (`+0.2`, `-0.2`, `+12st`) follows the data: `norm` (0 = the lowest value, 1 = the highest, as in a trace's bars) scales the
 *  amount, so `+1` rises an octave from the lowest bar to the highest and `-0.5` falls one. With no data (`norm` missing) it is simply that much up or down. */
export const rateOf = (v?: Vary | number, norm?: number) => {
  if (v === undefined) return 1;
  if (typeof v === "number") return clamp(v, 0.25, 4);
  if (v.follow) {
    const k = norm === undefined ? 1 : clamp(norm, 0, 1), jit = v.jitter ? (Math.random() * 2 - 1) * v.jitter : 0, a = v.base! * k;
    return clamp(v.st ? 2 ** ((a + jit) / 12) : 1 + a + jit, 0.25, 4);
  }
  return clamp(v.st ? 2 ** (draw(v, 0) / 12) : draw(v, 1), 0.25, 4);
};
export interface PlayOpts { vol?: Vary | number; pitch?: Vary | number; norm?: number } // norm: where this sound's data sits between the lowest (0) and highest (1) value
export interface SoundSpec extends PlayOpts { name: string; vol?: Vary; pitch?: Vary }

/** `boom vol=0.8 pitch=1+-0.2`, or `"big boom" pitch=+-2st`. Null when it can't be read. */
export function parseSoundSpec(s: string): SoundSpec | null {
  const m = s.trim().match(/^(?:"([^"]+)"|'([^']+)'|(\S+))((?:\s+(?:vol|pitch)=\S+)*)\s*$/i);
  if (!m) return null;
  const spec: SoundSpec = { name: m[1] ?? m[2] ?? m[3] };
  for (const a of m[4].matchAll(/(vol|pitch)=(\S+)/gi)) { const v = parseVary(a[2]); if (!v) return null; spec[a[1].toLowerCase() as "vol" | "pitch"] = v; }
  return spec;
}

/** `compare:tick swap:pop,pitch=1+-0.3 done:chime,vol=0.6` -> a sound per operation; a lone `tick` (or `tick,pitch=+-0.2`) is the default for every step. Used by trace blocks. */
export function parseSoundMap(s: string | undefined): Record<string, SoundSpec> {
  const m: Record<string, SoundSpec> = {};
  for (const w of (s ?? "").trim().split(/\s+/).filter(Boolean)) {
    const [head, ...opts] = w.split(","), k = head.indexOf(":");
    const op = k > 0 ? head.slice(0, k) : "*", spec: SoundSpec = { name: k > 0 ? head.slice(k + 1) : head };
    for (const o of opts) { const kv = o.match(/^(vol|pitch)=(.+)$/i), v = kv && parseVary(kv[2]); if (kv && v) spec[kv[1].toLowerCase() as "vol" | "pitch"] = v; }
    m[op] = spec;
  }
  return m;
}
/** Which sound a trace step makes: its own op's entry, else the `*` default. */
export const soundForOp = (map: Record<string, SoundSpec>, op: string) => map[op] ?? map["*"];

const stem = (f: string) => f.replace(/\.[^.]+$/, "").toLowerCase();

export interface SoundIo {
  read(path: string): Promise<ArrayBuffer>;
  list(dir: string): Promise<string[]>; // file names in the folder
  /** Resolves a deck-relative reference (assets/boom.wav) to a path, or throws if the deck is unsaved. */
  resolve(ref: string): string;
}

export function createSound(io: SoundIo) {
  const store = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
  const keep = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage may be unavailable */ } };
  let dir = store("itsd.sfx") || null;
  const sv = parseFloat(store("itsd.sfxvol") ?? "");
  let volume = Number.isFinite(sv) ? Math.max(0, Math.min(1, sv)) : 1;
  let files: string[] = [];
  let ctx: AudioContext | null = null, master: GainNode | null = null;
  const buffers = new Map<string, Promise<AudioBuffer | undefined>>();
  const subs = new Set<() => void>(); let ver = 0;
  const emit = () => { ver++; subs.forEach((f) => f()); };

  const audio = () => {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC(); master = ctx!.createGain(); master.gain.value = volume; master.connect(ctx!.destination);
    }
    if (ctx!.state === "suspended") void ctx!.resume();
    return ctx!;
  };
  const refresh = async () => {
    files = dir ? await io.list(dir).catch(() => []) : [];
    files = files.filter(isSoundPath).sort((a, b) => a.localeCompare(b));
    emit();
  };
  void refresh();

  /** The folder file a name refers to: `boom` or `boom.wav`, case-insensitive. */
  const inFolder = (name: string) => {
    const n = name.toLowerCase();
    return files.find((f) => f.toLowerCase() === n) ?? files.find((f) => stem(f) === n);
  };
  const decode = (key: string, load: () => Promise<ArrayBuffer>) => {
    let p = buffers.get(key);
    if (!p) { p = load().then((b) => audio()!.decodeAudioData(b)).catch(() => undefined); buffers.set(key, p); }
    return p;
  };
  const fileFor = (name: string): { key: string; load: () => Promise<ArrayBuffer> } | null => {
    const f = inFolder(name);
    if (f && dir) { const full = dir.replace(/[\\/]+$/, "") + (dir.includes("\\") && !dir.includes("/") ? "\\" : "/") + f; return { key: full, load: () => io.read(full) }; }
    if (isSoundPath(name) && (name.includes("/") || name.includes("\\"))) {
      return { key: name, load: () => io.read(/^([\\/]|[A-Za-z]:[\\/])/.test(name) ? name : io.resolve(name)) };
    }
    return null;
  };
  const bad = new Set<string>();

  return {
    /** Play a sound by name (folder file, built-in, or a path) with an optional volume (0..1, on top of the master volume) and pitch, either of which may vary. Silently does nothing if unknown. */
    async play(name: string | undefined, opts?: number | PlayOpts) {
      name = name?.trim(); if (!name || name === "none" || volume === 0) return;
      const o = typeof opts === "number" ? { vol: opts } : opts ?? {}, vol = volOf(o.vol), rate = rateOf(o.pitch, o.norm);
      const c = audio(); if (!c) return;
      const src = fileFor(name);
      if (src) {
        const buf = await decode(src.key, src.load);
        if (buf) {
          const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; s.playbackRate.value = rate; g.gain.value = vol;
          s.connect(g).connect(master!); s.start(); return;
        }
        bad.add(name); emit();
      }
      const syn = BUILTIN[name.toLowerCase()];
      if (syn) {
        const g = c.createGain(); g.gain.value = vol; g.connect(master!);
        syn({ c, out: g, t: c.currentTime + 0.01, r: rate });
      }
    },
    /** Does the name resolve to something? (For the editor's warnings.) A folder that isn't set yet counts as "can't tell". */
    known(name: string) {
      const n = name.trim().toLowerCase();
      return n === "none" || n in BUILTIN || !!inFolder(n) || (isSoundPath(n) && (n.includes("/") || n.includes("\\")));
    },
    get folder() { return dir; },
    get files() { return files; },
    get volume() { return volume; },
    /** Every name a slide can use: built-ins first, then the folder's files (without extension, de-duplicated). */
    names(): string[] { return [...new Set([...BUILTIN_NAMES, ...files.map((f) => f.replace(/\.[^.]+$/, ""))])]; },
    async setFolder(d: string | null) { dir = d; keep("itsd.sfx", d); buffers.clear(); bad.clear(); await refresh(); },
    refresh,
    setVolume(v: number) { volume = Math.max(0, Math.min(1, v)); keep("itsd.sfxvol", String(volume)); if (master) master.gain.value = volume; emit(); },
    /** Forget decoded files (the deck moved or a file changed). */
    clearCache() { buffers.clear(); bad.clear(); },
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
    snapshot: () => ver,
  };
}
export type SoundStore = ReturnType<typeof createSound>;
