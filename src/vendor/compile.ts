import React, { type ComponentType } from "react";
import * as ReactDOM from "react-dom";
import * as jsxRuntime from "react/jsx-runtime";
import gsap from "gsap";
import * as motion from "motion/react";

// The libraries a downloaded component may import. The app supplies them, so a vendor's code never has to ship its own copies.
// Everything but react, gsap and motion is a separate lazily loaded piece (nothing is fetched until a component needs it), so the
// big ones (three, react-three-fiber, chakra...) cost nothing for decks that don't use them.
// `ns` makes a module look like a compiled ES module, so both `import x from "p"` and `import { y } from "p"` work.
const ns = (m: any) => ({ ...m, __esModule: true, default: m && "default" in m ? m.default : m });
const lazy = (f: () => Promise<any>) => () => f().then(ns);
const NextImage = ({ src, alt = "", fill, width, height, priority, quality, placeholder, blurDataURL, unoptimized, loader, onLoadingComplete, style, ...rest }: any) =>
  React.createElement("img", { src: typeof src === "object" && src ? src.src : src, alt, width: fill ? undefined : width, height: fill ? undefined : height,
    style: fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style, ...rest });
const NextLink = ({ href, children, prefetch, replace, scroll, shallow, passHref, legacyBehavior, ...rest }: any) =>
  React.createElement("a", { href: typeof href === "string" ? href : href?.pathname ?? "#", ...rest }, children);
const PROVIDED: Record<string, () => unknown | Promise<unknown>> = {
  "react": () => ns(React), "react/jsx-runtime": () => ns(jsxRuntime), "react-dom": () => ns(ReactDOM),
  "gsap": () => ns({ gsap, default: gsap }), "motion/react": () => ns(motion), "motion/react-client": lazy(() => import("motion/react-client")), "motion": () => ns(motion), "framer-motion": () => ns(motion),
  "@gsap/react": lazy(() => import("@gsap/react")),
  "gsap/ScrollTrigger": lazy(() => import("gsap/ScrollTrigger")), "gsap/SplitText": lazy(() => import("gsap/SplitText")),
  "gsap/ScrambleTextPlugin": lazy(() => import("gsap/ScrambleTextPlugin")), "gsap/Observer": lazy(() => import("gsap/Observer")),
  "gsap/Flip": lazy(() => import("gsap/Flip")), "gsap/Draggable": lazy(() => import("gsap/Draggable")),
  "gsap/ScrollToPlugin": lazy(() => import("gsap/ScrollToPlugin")), "gsap/TextPlugin": lazy(() => import("gsap/TextPlugin")),
  "gsap/MotionPathPlugin": lazy(() => import("gsap/MotionPathPlugin")), "gsap/CustomEase": lazy(() => import("gsap/CustomEase")),
  "gsap/InertiaPlugin": lazy(() => import("gsap/InertiaPlugin")),
  "ogl": lazy(() => import("ogl")),
  "three": lazy(() => import("three")),
  "three/examples/jsm/environments/RoomEnvironment.js": lazy(() => import("three/examples/jsm/environments/RoomEnvironment.js")),
  "three/examples/jsm/loaders/OBJLoader.js": lazy(() => import("three/examples/jsm/loaders/OBJLoader.js")),
  "@react-three/fiber": lazy(() => import("@react-three/fiber")), "@react-three/drei": lazy(() => import("@react-three/drei")),
  "maath": lazy(() => import("maath")), "postprocessing": lazy(() => import("postprocessing")), "vgpu": lazy(() => import("vgpu")),
  "matter-js": lazy(() => import("matter-js")), "@use-gesture/react": lazy(() => import("@use-gesture/react")),
  "@hugeicons/react": lazy(() => import("@hugeicons/react")), "@hugeicons/core-free-icons": lazy(() => import("@hugeicons/core-free-icons")),
  "react-icons/go": lazy(() => import("react-icons/go")), "react-icons/ri": lazy(() => import("react-icons/ri")),
  "react-router-dom": lazy(() => import("react-router-dom")), "@chakra-ui/react": lazy(() => import("@chakra-ui/react")),
  // What shadcn-style registries (Magic UI, Aceternity, Cult UI...) import. `@/lib/utils` is their one shared helper, cn().
  "clsx": lazy(() => import("clsx")), "tailwind-merge": lazy(() => import("tailwind-merge")), "class-variance-authority": lazy(() => import("class-variance-authority")),
  "@/lib/utils": lazy(async () => { const [{ clsx }, { twMerge }] = await Promise.all([import("clsx"), import("tailwind-merge")]); return { cn: (...a: any[]) => twMerge(clsx(a)) }; }),
  "lucide-react": lazy(() => import("lucide-react")),
  "@radix-ui/react-slot": lazy(() => import("@radix-ui/react-slot")), "@radix-ui/react-label": lazy(() => import("@radix-ui/react-label")), "@radix-ui/react-use-controllable-state": lazy(() => import("@radix-ui/react-use-controllable-state")),
  "react-use-measure": lazy(() => import("react-use-measure")),
  // The few Next.js things these components touch, replaced by plain equivalents (a slide is not a website).
  "next/image": () => ns({ default: NextImage }), "next/link": () => ns({ default: NextLink }),
  "next/navigation": () => ns({ usePathname: () => "/", useRouter: () => ({ push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} }), useSearchParams: () => new URLSearchParams(), useParams: () => ({}) }),
  "next-themes": () => ns({ useTheme: () => ({ theme: "dark", resolvedTheme: "dark", systemTheme: "dark", themes: ["dark"], setTheme() {} }), ThemeProvider: ({ children }: any) => children }),
};
export const canProvide = (dep: string) => dep.replace(/(?!^)@.*$/, "") in PROVIDED || Object.keys(PROVIDED).some((k) => k.startsWith(dep.replace(/(?!^)@.*$/, "") + "/"));

// Some libraries only work inside a provider that a slide doesn't have, so a component that uses one is shown inside its own.
const WRAPPERS: Record<string, (ext: Map<string, any>) => [ComponentType<any>, Record<string, unknown>]> = {
  "react-router-dom": (e) => [e.get("react-router-dom").MemoryRouter, {}],
  "@chakra-ui/react": (e) => [e.get("@chakra-ui/react").ChakraProvider, { value: e.get("@chakra-ui/react").defaultSystem }],
};

const css = (id: string) => `style[data-vendor="${CSS.escape(id)}"]`;
function injectCss(id: string, text: string) {
  if (!text || typeof document === "undefined") return;
  let el = document.querySelector(css(id));
  if (!el) { el = document.createElement("style"); el.setAttribute("data-vendor", id); document.head.appendChild(el); }
  el.textContent = text;
}
export const dropCss = (id: string) => { if (typeof document !== "undefined") document.querySelector(css(id))?.remove(); };

/** Where an import points inside the download: `@/components/ui/button`, `./helpers` -> the file named button / helpers. */
const localName = (name: string) => (/^(@\/|\.)/.test(name) ? name.split("/").pop()!.replace(/\.(tsx?|jsx?)$/, "") : undefined);
const requiresOf = (code: string) => [...new Set([...code.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((m) => m[2]))];

export interface Extra {
  /** The other pieces the component imports (a button it builds on, a hook), by file name. */
  files?: Record<string, string>;
  /** `cssText` is a finished Tailwind stylesheet: apply it as soon as the component is built (React Bits' own CSS is applied when it imports it). */
  tw?: boolean;
  /** For code with several named exports (the shadcn way): which one is the component. */
  main?: string;
}

/** Turn a downloaded component's source (TypeScript, JSX and imports) into a React component. Throws a readable reason when it can't run. */
export async function instantiate(id: string, js: string, cssText: string, extra: Extra = {}): Promise<ComponentType<any>> {
  const { transform } = await import("sucrase"); // the compiler is only fetched the first time a downloaded effect is used
  if (extra.tw) injectCss(id, cssText);
  const local = new Map(Object.entries(extra.files ?? {}).map(([n, src]) => [localName(`./${n}`) ?? n, src]));
  const done = new Map<string, any>(), visiting = new Set<string>(), used = new Set<string>(); // used: the app-provided libraries any file asked for

  // Builds one file into its exports, building the local files it imports first (they are found by name, so a cycle is an error, not a hang).
  async function build(label: string, src: string): Promise<any> {
    const { code } = transform(src, { transforms: ["typescript", "jsx", "imports"], jsxRuntime: "classic", production: true });
    const have = new Map<string, any>();
    for (const name of requiresOf(code)) {
      if (name.endsWith(".css")) { if (!extra.tw) injectCss(id, cssText); have.set(name, {}); continue; }
      const get = PROVIDED[name];
      if (get) { used.add(name); have.set(name, await get()); continue; }
      const file = localName(name);
      if (file !== undefined && local.has(file)) {
        if (!done.has(file)) {
          if (visiting.has(file)) throw new Error(`\"${file}\" and \"${label}\" import each other`);
          visiting.add(file); done.set(file, await build(file, local.get(file)!)); visiting.delete(file);
        }
        have.set(name, done.get(file)); continue;
      }
      throw new Error(name.startsWith(".") || name.startsWith("@/") ? `needs "${name}", which isn't part of the download` : `needs "${name}", which the app doesn't provide`);
    }
    const mod: { exports: any } = { exports: {} };
    new Function("require", "module", "exports", "React", code)((n: string) => have.get(n), mod, mod.exports, React);
    return mod.exports;
  }

  const exp = await build(id, js);
  const C = (extra.main ? exp[extra.main] : undefined) ?? exp.default ?? (extra.main ? undefined : exp);
  if (typeof C !== "function" && !(C && typeof C === "object" && "$$typeof" in C)) {
    const found = (extra.main ? exp[extra.main] : undefined) ?? exp.default;
    throw new Error(found !== undefined ? "is a set of parts (like Thing.Root, Thing.Item) that only work together, not one component" : extra.main ? `has no export named ${extra.main}` : "has no default export");
  }
  const wrap = Object.keys(WRAPPERS).find((k) => used.has(k));
  if (!wrap) return C;
  const [Provider, pp] = WRAPPERS[wrap](new Map<string, any>([[wrap, await PROVIDED[wrap]()]]));
  return (props: any) => React.createElement(Provider, pp, React.createElement(C, props));
}
