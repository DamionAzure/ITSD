// Slide transitions, PowerPoint style. In a deck: `transition: push-left` (frontmatter or a slide's options comment) and `duration: 0.8`.
// The suffix is the side the new slide comes from; without one it follows the direction you are moving (Next comes from the right).
import type { Dir } from "./anim";
export interface Transition { id: string; label: string; group: "Subtle" | "Exciting" | "Dynamic"; dirs?: boolean; dur: number; wait?: boolean; hint: string }
export const TRANSITIONS: Transition[] = [
  { id: "none", label: "None", group: "Subtle", dur: 0, hint: "Cut straight to the next slide" },
  { id: "fade", label: "Fade", group: "Subtle", dur: 0.35, wait: true, hint: "Fade out, then fade in" },
  { id: "dissolve", label: "Dissolve", group: "Subtle", dur: 0.6, hint: "Cross-fade with a soft blur" },
  { id: "push", label: "Push", group: "Subtle", dirs: true, dur: 0.5, hint: "The new slide pushes the old one out" },
  { id: "slide", label: "Slide", group: "Subtle", dur: 0.3, hint: "Short nudge sideways while fading" },
  { id: "wipe", label: "Wipe", group: "Subtle", dirs: true, dur: 0.5, hint: "The new slide is wiped in over the old" },
  { id: "cover", label: "Cover", group: "Subtle", dirs: true, dur: 0.5, hint: "The new slide slides in over the old" },
  { id: "uncover", label: "Uncover", group: "Subtle", dirs: true, dur: 0.5, hint: "The old slide slides away" },
  { id: "split", label: "Split", group: "Subtle", dur: 0.6, hint: "Opens from the middle" },
  { id: "zoom", label: "Zoom in", group: "Exciting", dur: 0.45, hint: "The new slide grows in" },
  { id: "zoom-out", label: "Zoom out", group: "Exciting", dur: 0.45, hint: "The new slide shrinks into place" },
  { id: "iris", label: "Iris", group: "Exciting", dur: 0.7, hint: "A circle opens on the new slide" },
  { id: "flip", label: "Flip", group: "Exciting", dirs: true, dur: 0.8, wait: true, hint: "Turns like a card" },
  { id: "cube", label: "Cube", group: "Exciting", dirs: true, dur: 0.8, hint: "Rotates like the side of a cube" },
  { id: "rotate", label: "Rotate", group: "Exciting", dur: 0.6, hint: "A twist and a fade" },
  { id: "drop", label: "Drop", group: "Exciting", dur: 0.7, hint: "Falls in from above" },
  { id: "morph", label: "Morph", group: "Dynamic", dur: 0.9, hint: "Objects with the same name or text glide to their new place, size and angle" },
];
export const transitionOf = (id: string) => TRANSITIONS.find((t) => t.id === id);

export interface Parsed { id: string; dir?: Dir; def: Transition }
/** "push-left" -> push from the left. An unknown name falls back to fade. */
export function parseTransition(v: string | undefined, fallback = "fade"): Parsed {
  const s = (v ?? fallback).trim().toLowerCase();
  let t = transitionOf(s), dir: Dir | undefined;
  if (!t) { const m = s.match(/^(.*)-(left|right|up|down)$/); if (m) { t = transitionOf(m[1]); dir = m[2] as Dir; } }
  t ??= transitionOf("fade")!;
  return { id: t.id, dir: t.dirs ? dir : undefined, def: t };
}
export const joinTransition = (id: string, dir?: Dir) => (dir ? `${id}-${dir}` : id);
