// A module is a folder in src/modules/<id>/ with a module.ts that default-exports an ItsdModule.
// The core never imports a module by name: registry.ts discovers them, so deleting a folder removes the feature.
import type { ComponentType } from "react";

export type PropType = "number" | "boolean" | "string" | "color" | "colors" | "select";
export interface PropDef { key: string; type: PropType; def?: string | number | boolean | string[]; options?: string[] }

/** background: fills the slide behind the text. text: a block that takes `text=`. wrap: a block that goes around content you write inside it. */
export type FxKind = "background" | "text" | "wrap";
export interface FxEffect {
  id: string; label: string; kind: FxKind; props: PropDef[];
  /** A wrap effect whose children must be a plain string (not elements): it gets the content's text. */
  plain?: boolean;
  /** A wrap effect with several faces/slots: the content is split at `+++` lines and each part arrives as its own child (FlipCard: front, back). */
  parts?: boolean;
  load: () => Promise<{ default: ComponentType<any> }>;
}
export interface ItsdModule { id: string; name: string; effects: FxEffect[]; hint?: string }
