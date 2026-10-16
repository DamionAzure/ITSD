// Video and audio as slide elements. They are ordinary blocks, so the Visual view can place, size, rotate and layer them.
//
//   ::: video "assets/intro.mp4" id=intro autoplay loop muted controls=false fit=cover start=3 vol=0.8
//   ::: audio "assets/theme.mp3" id=theme autoplay loop
//
// One line, no closing `:::`. The file is streamed from disk (never loaded whole into memory). `id=` lets a button run `start intro` / `stop intro`.
export const VIDEO_EXT = ["mp4", "m4v", "webm", "ogv", "mov"];
export const AUDIO_EXT = ["wav", "mp3", "ogg", "m4a", "flac", "aac", "opus"];
export const MEDIA_EXT = [...VIDEO_EXT, ...AUDIO_EXT];
export interface MediaDef { kind: "video" | "audio"; src: string; id?: string; autoplay: boolean; loop: boolean; muted: boolean; controls: boolean; fit: "contain" | "cover"; start: number; vol: number; poster?: string }
export const MEDIA_LINE = /^:::\s*(video|audio)\s+(.*)$/;

export function parseMedia(kind: "video" | "audio", rest: string): MediaDef | null {
  const q = rest.match(/^\s*"([^"]+)"/) ?? rest.match(/^\s*([^\s"]+)/);
  if (!q) return null;
  const tail = rest.slice(q[0].length), a: Record<string, string> = {};
  tail.replace(/(\w+)=("([^"]*)"|\S+)/g, (_, k, v, qq) => { a[k] = qq ?? v; return " "; });
  const flags = new Set(tail.replace(/(\w+)=("[^"]*"|\S+)/g, " ").trim().split(/\s+/).filter(Boolean));
  const on = (k: string, d: boolean) => (a[k] !== undefined ? !["false", "0", "off", "no"].includes(a[k]) : flags.has(k) ? true : d);
  const num = (k: string, d: number) => { const n = parseFloat(a[k]); return Number.isFinite(n) ? n : d; };
  return {
    kind, src: q[1], id: a.id, autoplay: on("autoplay", false), loop: on("loop", false), muted: on("muted", false), controls: on("controls", true),
    fit: a.fit === "cover" ? "cover" : "contain", start: Math.max(0, num("start", 0)), vol: Math.max(0, Math.min(1, num("vol", 1))), poster: a.poster,
  };
}
export const isVideo = (p: string) => VIDEO_EXT.includes((p.split(".").pop() ?? "").toLowerCase());
