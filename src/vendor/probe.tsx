import { Component, createElement, type ComponentType, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { fxProps } from "../modules/registry";
import type { Meta } from "./types";

class Catch extends Component<{ children?: ReactNode; onError: (e: unknown) => void }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  componentDidCatch(e: unknown) { this.props.onError(e); }
  render() { return this.state.bad ? null : this.props.children; }
}

/**
 * Mounts a component once, off screen, with the props a deck would give it, and says why it threw (or null if it is fine).
 * Some components only work inside a provider or with data a deck can't write; this finds that now, not on a slide.
 */
export function probe(C: ComponentType<any>, meta: Meta): string | null {
  let why: string | null = null;
  const say = (e: unknown) => { why = String((e as Error)?.message ?? e).split("\n")[0].slice(0, 160); };
  const root = createRoot(document.createElement("div"));
  const props = fxProps({ props: meta.props } as any, meta.kind === "text" ? { text: "Sample" } : {});
  const kids = meta.kind === "wrap" ? (meta.plain ? "Sample" : createElement("p", null, "Sample")) : undefined;
  try { flushSync(() => root.render(createElement(Catch, { onError: say }, createElement(C, props, kids)))); } catch (e) { say(e); }
  try { root.unmount(); } catch { /* already gone */ }
  return why;
}
