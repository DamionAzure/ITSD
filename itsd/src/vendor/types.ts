// Vendors are websites that publish effects. The app downloads them to the user's own computer on request, so nothing
// they publish is part of ITSD itself (some licences, React Bits' included, don't allow redistributing the components).
import type { FxKind, PropDef } from "../modules/types";

export interface Meta { id: string; label: string; kind: FxKind; props: PropDef[]; plain?: boolean; parts?: boolean }
export interface Stored { key: string; vendor: string; id: string; meta: Meta; js: string; css: string; at: number }
export interface CatalogItem { id: string; label: string; description: string; ok: boolean; why?: string }
export interface VendorSource {
  id: string; name: string; site: string; license: string; terms: string;
  catalog(): Promise<CatalogItem[]>;
  fetchOne(id: string): Promise<Stored>;
}
