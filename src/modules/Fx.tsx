import { Component, Suspense, lazy, useMemo, useSyncExternalStore, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { fxProps, findEffect, modulesVersion, subscribeModules } from "./registry";

// Keyed by the loader function itself, so a re-downloaded effect gets a fresh component instead of the old one.
const cache = new WeakMap<object, LazyExoticComponent<ComponentType<any>>>();
const lazyOf = (load: () => Promise<{ default: ComponentType<any> }>) => {
  let c = cache.get(load);
  if (!c) { c = lazy(load); cache.set(load, c); }
  return c;
};

// A broken effect (no WebGL, bad prop) must never take the slide down with it. The boundary is keyed by effect and options (see Fx),
// so one that failed doesn't stay failed for whatever effect comes next in the same place.
class Safe extends Component<{ children: ReactNode; label: string }, { bad: boolean; why: string }> {
  state = { bad: false, why: "" };
  static getDerivedStateFromError() { return { bad: true }; }
  componentDidCatch(e: Error) { this.setState({ why: String(e?.message ?? e) }); console.error(`[effect ${this.props.label}]`, e); }
  render() { return this.state.bad ? <span className="fx-bad" title={this.state.why}>{this.props.label} couldn't start{this.state.why ? `: ${this.state.why}` : ""}</span> : this.props.children; }
}

/** One effect. A background or text effect renders nothing when its module isn't installed; a wrap effect shows just its content. */
export function Fx({ id, attrs, children, plain, fallback }: { id: string; attrs: Record<string, string>; children?: ReactNode; plain?: string; fallback?: ReactNode }) {
  useSyncExternalStore(subscribeModules, modulesVersion); // an effect downloaded (or removed) while a slide is open shows up at once
  const e = findEffect(id);
  const key = JSON.stringify(attrs);
  const props = useMemo(() => (e ? fxProps(e.effect, attrs) : {}), [e, key]);
  if (!e) return <>{children}</>; // a wrap effect whose module is missing still shows its content
  const C = lazyOf(e.effect.load);
  return <Safe key={`${id}:${key}`} label={e.effect.label}><Suspense fallback={fallback ?? children ?? null}><C {...props}>{e.effect.plain ? plain ?? "" : children}</C></Suspense></Safe>;
}
