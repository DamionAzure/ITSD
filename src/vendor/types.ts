// Vendors are websites that publish effects. The app downloads them to the user's own computer on request, so nothing
// they publish is part of ITSD itself (some licences, React Bits' included, don't allow redistributing the components).
import type { FxKind, PropDef } from "../modules/types";

export interface Meta { id: string; label: string; kind: FxKind; props: PropDef[]; plain?: boolean; parts?: boolean; fill?: boolean; unusable?: string }
/**
 * What is kept on this computer for one downloaded effect.
 * js/css: the component and its stylesheet (React Bits). files/tw/main: a shadcn-style item, where `files` are the other pieces it imports
 * (found by file name), `css` is then the Tailwind stylesheet made for it at download time, and `main` is the export to show.
 */
export interface Stored { key: string; vendor: string; id: string; meta: Meta; js: string; css: string; at: number; files?: Record<string, string>; tw?: boolean; main?: string }
export interface CatalogItem { id: string; label: string; description: string; ok: boolean; why?: string }
export interface VendorSource {
  id: string; name: string; site: string; license: string; terms: string;
  /** Shown under the licence: what this vendor does NOT give away (paid parts), so nobody goes looking for them here. */
  note?: string;
  catalog(): Promise<CatalogItem[]>;
  fetchOne(id: string): Promise<Stored>;
}
