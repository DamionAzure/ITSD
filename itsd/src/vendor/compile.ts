import React, { type ComponentType } from "react";
import * as ReactDOM from "react-dom";
import gsap from "gsap";
import * as motion from "motion/react";

// The libraries a downloaded component may import. The app supplies them (ogl and @gsap/react are loaded only when a component
// needs them), so a vendor's code never has to ship its own copies. Anything else means the component can't run in the app.
const ns = (def: unknown, named: object = {}) => ({ __esModule: true, default: def, ...named });
const PROVIDED: Record<string, () => unknown | Promise<unknown>> = {
  react: () => ns(React, React),
  "react-dom": () => ns(ReactDOM, ReactDOM),
  gsap: () => ns(gsap, { gsap }),
  "motion/react": () => ns(motion, motion),
  motion: () => ns(motion, motion),
  ogl: () => import("ogl").then((m) => ns(m, m)),
  "@gsap/react": () => import("@gsap/react").then((m) => ns(m, m)),
  // GSAP's own plugins (free since 3.13). Written out one by one so each stays a separate, lazily loaded piece.
  "gsap/ScrollTrigger": () => import("gsap/ScrollTrigger").then((m) => ns(m, m)),
  "gsap/SplitText": () => import("gsap/SplitText").then((m) => ns(m, m)),
  "gsap/ScrambleTextPlugin": () => import("gsap/ScrambleTextPlugin").then((m) => ns(m, m)),
  "gsap/Observer": () => import("gsap/Observer").then((m) => ns(m, m)),
  "gsap/Flip": () => import("gsap/Flip").then((m) => ns(m, m)),
  "gsap/Draggable": () => import("gsap/Draggable").then((m) => ns(m, m)),
  "gsap/ScrollToPlugin": () => import("gsap/ScrollToPlugin").then((m) => ns(m, m)),
  "gsap/TextPlugin": () => import("gsap/TextPlugin").then((m) => ns(m, m)),
  "gsap/MotionPathPlugin": () => import("gsap/MotionPathPlugin").then((m) => ns(m, m)),
  "gsap/CustomEase": () => import("gsap/CustomEase").then((m) => ns(m, m)),
};
export const canProvide = (dep: string) => dep.replace(/(?!^)@.*$/, "") in PROVIDED;

function injectCss(id: string, text: string) {
  if (!text || typeof document === "undefined") return;
  let el = document.querySelector(`style[data-vendor="${id}"]`);
  if (!el) { el = document.createElement("style"); el.setAttribute("data-vendor", id); document.head.appendChild(el); }
  el.textContent = text;
}

/** Turn a downloaded component's source (TypeScript, JSX and imports) into a React component. */
export async function instantiate(id: string, js: string, css: string): Promise<ComponentType<any>> {
  const { transform } = await import("sucrase"); // the compiler is only fetched the first time a downloaded effect is used
  const { code } = transform(js, { transforms: ["typescript", "jsx", "imports"], jsxRuntime: "classic", production: true });
  const have = new Map<string, unknown>();
  for (const name of new Set([...code.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((m) => m[2]))) {
    if (name.endsWith(".css")) { injectCss(id, css); have.set(name, {}); continue; }
    const get = PROVIDED[name];
    if (!get) throw new Error(`needs "${name}", which the app doesn't provide`);
    have.set(name, await get());
  }
  const mod: { exports: any } = { exports: {} };
  new Function("require", "module", "exports", "React", code)((n: string) => have.get(n), mod, mod.exports, React);
  const C = mod.exports.default ?? mod.exports;
  if (typeof C !== "function" && typeof C !== "object") throw new Error("has no default export");
  return C;
}
