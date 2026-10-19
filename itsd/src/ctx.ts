import { createContext } from "react";
import type { AssetStore } from "./assets";

export interface Frame { op: string; a: number[]; hl?: number[]; sorted?: number; key?: number; line?: number }
export interface TraceData { frames: Frame[]; code: string; lang: string }
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
  fill(text: string, html?: boolean): string; // substitutes {{name}} references
  subscribe(f: () => void): () => void; snapshot(): unknown; // for useSyncExternalStore
  assets: AssetStore; // picture and background files
  firstVisit(key: string): boolean; // at-start: true only the first time per presentation run
  armNext(f: () => void): () => void; // when-next: wait for the next Next press
  presenting(): boolean;
  onTrace(srcId: number, frames: Frame[], code: { text: string; lang: string }): void;
}
export const DeckCtx = createContext<DeckApi>(null as unknown as DeckApi);
export const FontCtx = createContext(16);
export const RegCtx = createContext<Map<string, BlockHandle>>(new Map());
