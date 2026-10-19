import type { FxKind, PropDef } from "../types";
export function parseMeta(id: string, label: string, src: string): { id: string; label: string; kind: FxKind; props: PropDef[]; plain?: boolean; parts?: boolean };
