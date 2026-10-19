// The folder system as the front end sees it (the Rust side is workspace.rs): install folder + workspace, listing and file actions, and the recent-decks list.
import { invoke } from "@tauri-apps/api/core";
import { parseDeck } from "./itsd";

export interface Entry { name: string; path: string; dir: boolean; modified: number; size: number }
export interface WsInfo { install_dir: string; resources: string; workspace: string; version: string; templates: Entry[]; examples: Entry[] }

const root = (r: string) => r || null;
export const wsInit = (workspace: string) => invoke<WsInfo>("workspace_init", { root: root(workspace) });
export const wsList = (workspace: string, path: string) => invoke<Entry[]>("workspace_list", { root: root(workspace), path });
export const wsStat = (paths: string[]) => invoke<(Entry | null)[]>("workspace_stat", { paths });
export const wsOp = (workspace: string, op: "mkdir" | "rename" | "copy" | "trash", path: string, arg = "") => invoke<string>("workspace_op", { root: root(workspace), op, path, arg });
export const wsNew = (workspace: string, template: string | null, name: string) => invoke<string>("workspace_new", { root: root(workspace), template, name });
export const wsReveal = (workspace: string, path: string) => invoke<void>("workspace_reveal", { root: root(workspace), path });

/** What a deck card shows: its title, its first slide's heading and first lines, and the slide count. */
export interface Summary { title: string; heading: string; lines: string[]; slides: number }
export function summarize(text: string, fallback: string): Summary {
  const d = parseDeck(text), first = (d.slides[0]?.src ?? "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("<!--") && !l.startsWith(":::"));
  const h = first.find((l) => l.startsWith("#")) ?? "";
  return { title: d.meta.title || h.replace(/^#+\s*/, "") || fallback, heading: h.replace(/^#+\s*/, ""), lines: first.filter((l) => l !== h).slice(0, 4).map((l) => l.replace(/^[-*]\s+/, "• ")), slides: d.slides.length };
}

// ---- recent decks ----
const KEY = "itsd.recent";
export const recent = (): string[] => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; } };
const put = (v: string[]) => { try { localStorage.setItem(KEY, JSON.stringify(v.slice(0, 24))); } catch { /* storage may be unavailable */ } };
export const addRecent = (p: string) => put([p, ...recent().filter((x) => x !== p)]);
export const dropRecent = (p: string) => put(recent().filter((x) => x !== p));

export const ago = (secs: number) => {
  if (!secs) return "";
  const d = Math.floor((Date.now() / 1000 - secs) / 86400);
  return d < 1 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : new Date(secs * 1000).toLocaleDateString();
};
export const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;
export const stem = (n: string) => n.replace(/\.itsd$/i, "");
