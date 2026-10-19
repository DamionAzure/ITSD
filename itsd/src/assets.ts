// Image files used by a deck (pictures and backgrounds). Each is read once through the backend and kept as
// an object URL, so the webview never needs permission to read arbitrary paths. Cleared when the deck's
// location changes, because relative references resolve against the .itsd file.
const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml", avif: "image/avif",
};
export const IMG_EXT = Object.keys(MIME);
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
      const url = URL.createObjectURL(new Blob([buf], { type: MIME[(ref.split(".").pop() ?? "").toLowerCase()] ?? "image/png" }));
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
