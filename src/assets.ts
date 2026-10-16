// Image files used by a deck (pictures and backgrounds). Each is read once through the backend and kept as
// an object URL, so the webview never needs permission to read arbitrary paths. Cleared when the deck's
// location changes, because relative references resolve against the .itsd file.
const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml", avif: "image/avif",
};
const FONT_MIME: Record<string, string> = { ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2" };
export const IMG_EXT = Object.keys(MIME);
// Videos (for the scoreboard module) are read the same way but are kept out of IMG_EXT, so the picture importer still lists only pictures.
const VIDEO_MIME: Record<string, string> = { mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", ogv: "video/ogg", mov: "video/quicktime", wav: "audio/wav", mp3: "audio/mpeg", ogg: "audio/ogg", m4a: "audio/mp4", flac: "audio/flac", aac: "audio/aac", opus: "audio/ogg" };
export const isImagePath = (p: string) => IMG_EXT.includes((p.split(".").pop() ?? "").toLowerCase());
export const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;

export function createAssets(read: (ref: string) => Promise<ArrayBuffer>) {
  let urls = new Map<string, string>();
  let loading = new Map<string, Promise<string | undefined>>();
  let bad = new Set<string>();
  let gen = 0, ver = 0;
  const subs = new Set<() => void>();
  const emit = () => { ver++; subs.forEach((f) => f()); };

  const load = (ref: string): Promise<string | undefined> => {
    const g = gen;
    const p = read(ref).then((buf) => {
      if (g !== gen) return undefined;
      const url = URL.createObjectURL(new Blob([buf], { type: (() => { const e = (ref.split(".").pop() ?? "").toLowerCase(); return MIME[e] ?? VIDEO_MIME[e] ?? FONT_MIME[e] ?? "image/png"; })() }));
      urls.set(ref, url); loading.delete(ref); emit();
      return url;
    }).catch(() => {
      if (g === gen) { loading.delete(ref); bad.add(ref); emit(); }
      return undefined;
    });
    loading.set(ref, p);
    return p;
  };

  return {
    /** The object URL if loaded; otherwise starts loading it and returns undefined (subscribers are told when it lands). */
    url(ref: string): string | undefined {
      if (!urls.has(ref) && !loading.has(ref) && !bad.has(ref)) void load(ref);
      return urls.get(ref);
    },
    /** Resolves with the object URL once the file is loaded (undefined if it can't be read). */
    ready(ref: string): Promise<string | undefined> {
      const have = urls.get(ref); if (have) return Promise.resolve(have);
      bad.delete(ref);
      return loading.get(ref) ?? load(ref);
    },
    missing: (ref: string) => bad.has(ref),
    clear() {
      gen++; urls.forEach((u) => URL.revokeObjectURL(u));
      urls = new Map(); loading = new Map(); bad = new Set(); emit();
    },
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
    snapshot: () => ver,
  };
}
export type AssetStore = ReturnType<typeof createAssets>;
