import { Component, Suspense, lazy, useMemo, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { fxProps, findEffect } from "./registry";

const cache = new Map<string, LazyExoticComponent<ComponentType<any>>>();
const lazyOf = (full: string) => {
  let c = cache.get(full);
  if (!c) { c = lazy(findEffect(full)!.effect.load); cache.set(full, c); }
  return c;
};

// A broken effect (no WebGL, bad prop) must never take the slide down with it.
class Safe extends Component<{ children: ReactNode; label: string }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  render() { return this.state.bad ? <span className="fx-bad">{this.props.label} couldn't start</span> : this.props.children; }
}

/** One effect. A background or text effect renders nothing when its module isn't installed; a wrap effect shows just its content. */
export function Fx({ id, attrs, children, plain, fallback }: { id: string; attrs: Record<string, string>; children?: ReactNode; plain?: string; fallback?: ReactNode }) {
  const e = findEffect(id);
  const key = JSON.stringify(attrs);
  const props = useMemo(() => (e ? fxProps(e.effect, attrs) : {}), [e, key]);
  if (!e) return <>{children}</>; // a wrap effect whose module is missing still shows its content
  const C = lazyOf(id);
  return <Safe label={e.effect.label}><Suspense fallback={fallback ?? children ?? null}><C {...props}>{e.effect.plain ? plain ?? "" : children}</C></Suspense></Safe>;
}
