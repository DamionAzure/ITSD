// Fonts that belong to a deck. A deck lists font files in its frontmatter and the app registers each one as a font family
// named after the file, so `font: Inter-Bold` (or a styled span) can use it:
//
//   ---
//   fonts: assets/fonts/Inter-Bold.ttf, assets/fonts/Lobster.woff2
//   font: Inter-Bold          (body text)      headingfont: Lobster      codefont: mono
//   ---
import type { AssetStore } from "./assets";

export const FONT_EXT = ["ttf", "otf", "woff", "woff2"];
export const isFontPath = (p: string) => FONT_EXT.includes((p.split(".").pop() ?? "").toLowerCase());
export const fontRefs = (meta: Record<string, string>): string[] => (meta.fonts ?? "").split(",").map((s) => s.trim()).filter(Boolean);
/** The family name a font file registers under: its file name without the extension. */
export const fontName = (ref: string) => (ref.split(/[\\/]/).pop() ?? ref).replace(/\.[^.]+$/, "");

const live = new Map<string, FontFace>(); // ref -> registered face
/** Register the deck's fonts and drop ones it no longer lists. Safe to call again whenever the list or the deck location changes. */
export async function syncFonts(refs: string[], assets: AssetStore) {
  for (const [ref, face] of live) if (!refs.includes(ref)) { document.fonts.delete(face); live.delete(ref); }
  await Promise.all(refs.filter((r) => !live.has(r) && isFontPath(r)).map(async (ref) => {
    const url = await assets.ready(ref); if (!url) return;
    try {
      const face = new FontFace(fontName(ref), `url("${url}")`);
      await face.load(); document.fonts.add(face); live.set(ref, face);
    } catch { /* a damaged file: the deck falls back to the next font in the list */ }
  }));
}
export const forgetFonts = () => { for (const f of live.values()) document.fonts.delete(f); live.clear(); };
