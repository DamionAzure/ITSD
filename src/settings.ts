// App settings: things about the app and the author's machine, not about one deck (so they are not saved in the .itsd file).
// Kept in localStorage; the sound folder and volume live in sound.ts (their own keys) and are shown in the same dialog.
import { useSyncExternalStore } from "react";

export interface Settings {
  /** What a run that prints a trace gets: a real editable branch slide off the slide that ran it, a generated slide that follows it, or nothing. */
  traceSlide: "branch" | "next" | "off";
  /** Also put a "Show trace" button on the slide that ran, so a presenter can reach the branch slide. */
  traceButton: boolean;
  /** A CSS file applied to every deck's trace (and anything else); read again whenever the window gets focus. */
  traceCss: string;
  traceCssOn: boolean;
  /** `::: script` blocks: ask once per opened deck, always run, or never run. */
  scripts: "ask" | "allow" | "deny";
  /** Your ITSD folder (Decks, Templates, Sounds, Styles). Empty = Documents\ITSD. */
  workspace: string;
  /** Show the Home dashboard when the app starts without a file. */
  homeAtStart: boolean;
  /** Open the Presenter View window whenever you present. */
  presenter: boolean;
}
export const DEFAULTS: Settings = { traceSlide: "branch", traceButton: true, traceCss: "", traceCssOn: true, scripts: "ask", workspace: "", homeAtStart: true, presenter: false };

const KEY = "itsd.settings";
const load = (): Settings => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return { ...DEFAULTS }; } };
let cur = load(); const subs = new Set<() => void>();
export const settings = () => cur;
export function setSettings(patch: Partial<Settings>) {
  cur = { ...cur, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* storage may be unavailable */ }
  subs.forEach((f) => f());
}
export const resetSettings = () => setSettings({ ...DEFAULTS });
export const useSettings = (): Settings => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, settings);
