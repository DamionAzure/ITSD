import type { Val } from "./expr";
import { createContext } from "react";
import type { AssetStore } from "./assets";
import type { SoundStore } from "./sound";

export interface Frame { op: string; a: number[]; hl?: number[]; sorted?: number; key?: number; line?: number }
export interface TraceData { frames: Frame[]; code: string; lang: string; src?: number; name?: string } // src/name: the run block it came from
export interface BlockHandle {
  setCode(text: string, lang: string): void;
  run(): Promise<void>;
  show(v: boolean): void;
  note(t: string): void;
  start?(): void; // flash regions
  stop?(): void;
}
export interface DeckApi {
  getSource(name: string): { lang: string; text: string } | undefined;
  readFile(ref: string): Promise<string>;
  goto(n: number): void; // 1-based source slide number
  input(name: string): string | undefined; // live value, else the deck's default
  setInput(name: string, value: string): void;
  macro(name: string): string[] | undefined; // the action lines of a `::: macro`
  runScript(name: string, args: string[], act: (line: string) => Promise<void>): Promise<void>; // run a `::: script` (asks once per deck); `act` performs the action lines it asks for
  calc(expr: string): Val; // evaluate a calculation (expr.ts) with the deck variables; throws ExprError when it is malformed
  holds(cond: string): boolean; // a condition for show-if / when: like calc, but refuses random() because it would change on every look
  reset(name?: string): void; // put one variable (or all of them) back to the deck default
  fill(text: string, html?: boolean): string; // substitutes {{name}} references
  subscribe(f: () => void): () => void; snapshot(): unknown; // for useSyncExternalStore
  assets: AssetStore; // picture and background files
  firstVisit(key: string): boolean; // at-start: true only the first time per presentation run
  armNext(f: () => void): () => void; // when-next: wait for the next Next press
  presenting(): boolean;
  onTrace(srcId: number, name: string, frames: Frame[], code: { text: string; lang: string }): string | void; // returns a note to show under the run when it made a trace slide
  trace(from: string): TraceData | undefined; // the latest run of block `from` (or the latest run at all when empty)
  traceSlide(from: string): number | undefined; // 1-based number of the slide that has a `::: trace` block for it
  makeTraceSlide(srcId: number, name: string): void; // turn a generated trace slide into a real one made of separate parts
  splitTrace(slideId: number, blk: { line: number; marker?: number; at?: import("./layout").Place }): void; // turn a whole `::: trace` into separate parts
  tracePlayer(key: string): import("./tracePlayer").TracePlayer; // playback state shared by the parts of one trace
  sound: SoundStore;
  branch(n: number): void; proceed(): void; back(): void; // branch slides: enter branch n of this slide, go on inside the branch, return to the main line
  mediaUrl(ref: string): Promise<string>; // a streaming URL for a video/audio file (deck-relative or absolute)
}
export const DeckCtx = createContext<DeckApi>(null as unknown as DeckApi);
export const FontCtx = createContext(16);
export const RegCtx = createContext<Map<string, BlockHandle>>(new Map());
