// One adapter for every vendor that publishes the "shadcn registry" format (Magic UI, Aceternity UI, Cult UI, Kokonut UI...): each item is a small
// JSON file holding its source, the npm packages it needs, other items it builds on, and a little CSS. A new vendor of this kind is a few
// lines in sources.ts. The components use Tailwind, so each download also gets the stylesheet it needs (see tailwind.ts).
import { parseMeta } from "../modules/reactbits/meta.mjs";
import { canProvide } from "./compile";
import { HttpError, getJson, getText } from "./net";
import { buildTailwind, type TwItem } from "./tailwind";
import type { CatalogItem, Meta, Stored, VendorSource } from "./types";

export interface ShadcnRegistry {
  id: string; name: string; site: string; license: string; terms: string; note?: string;
  /** Address of one item, with {name} where its name goes. */
  item: string;
  /** The vendor's own list of everything it publishes (registry.json)... */
  index?: string;
  /** ...or, for a vendor with no such list, the names we know to be free. */
  names?: string[];
  /** For a vendor that publishes only component source files (no registry JSON): `{path}` is replaced by the file's path in the repository,
   *  and `paths` maps each component name to it. The npm packages and sibling components it needs are read from its imports. */
  raw?: { url: string; paths: Record<string, string>; /** which paths are offered in the list (the rest can still be built on) */ offer?: (path: string) => boolean };
  /** Which kinds of item to offer from the index. Examples and themes are not effects. */
  types?: string[];
}

interface Item extends TwItem {
  name: string; type?: string; title?: string; description?: string;
  dependencies?: string[]; registryDependencies?: string[];
  files?: { path: string; content?: string; type?: string }[];
}

// shadcn/ui's own small components (MIT) that many items are built on. Only the ones that need nothing the app lacks are offered.
const BASE = "https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/public/r/styles/new-york";
const BASE_OK = new Set(["button", "badge", "card", "input", "textarea", "skeleton", "label"]);
const BUILT_IN = new Set(["utils"]); // `@/lib/utils` is supplied by the app

const npmName = (d: string) => d.replace(/(?!^)@.*$/, "");
const needsPkgs = (it: Item) => (it.dependencies ?? []).filter((d) => !d.startsWith("@types/") && !canProvide(d)).map(npmName);
const sourceFile = (f: { path: string; content?: string }) => typeof f.content === "string" && /\.(tsx?|jsx?)$/.test(f.path);
const stem = (path: string) => path.split("/").pop()!.replace(/\.(tsx?|jsx?)$/, "");
const pascal = (s: string) => s.split(/[-_.\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
const titleOf = (n: string) => n.split(/[-_]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/** Which exported name is "the component": the one named like the item, else the first capitalised one that has a Props type, else the first. */
export function mainExport(id: string, src: string): string | undefined {
  const names = new Set<string>();
  for (const m of src.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+([A-Za-z_]\w*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) for (const part of m[1].split(",")) { const n = part.trim().split(/\s+as\s+/).pop()?.trim(); if (n && n !== "default") names.add(n); }
  const comps = [...names].filter((n) => /^[A-Z]/.test(n));
  const flat = id.replace(/[-_.]/g, "").toLowerCase();
  return comps.find((n) => n === pascal(id)) ?? comps.find((n) => n.toLowerCase() === flat) ?? comps.find((n) => new RegExp(`\\b${n}Props\\b`).test(src)) ?? comps[0];
}

const INLINE_TAGS = new Set(["span", "p", "a", "em", "strong", "small", "label", "h1", "h2", "h3", "h4", "h5", "h6"]);
/** The tag a component's props are typed after (ComponentProps<"span"> / HTMLAttributes<HTMLSpanElement>), for code that never renders `{children}` directly. */
function propsTag(main: string | undefined, src: string): string {
  const header = src.match(new RegExp(`(?:interface|type)\\s+${main ?? "\\w+"}Props[^{]*`))?.[0] ?? "";
  const html = header.match(/HTML(\w*?)(?:Element)?>/)?.[1] ?? "";
  return header.match(/ComponentProps(?:WithoutRef)?<\s*["'](\w+)["']/)?.[1] ?? ({ Span: "span", Paragraph: "p", Heading: "h1", Anchor: "a", Label: "label" } as Record<string, string>)[html] ?? "";
}
/**
 * shadcn-style components often take `children` without declaring it (they extend ComponentProps<"span">), so the prop reader sees nothing to wrap.
 *  - If the code renders children it is a wrapper; if it is built on an inline tag (span, h1...) it wants plain words, not blocks of content.
 *  - A "background" that doesn't position itself over a box (no absolute / inset / full-size / canvas) is content, not a backdrop: it flows like text.
 */
const BACKDROP = /\babsolute\b|\bfixed\b|\binset-|\bsize-full\b|\bh-full\b|\bw-full\b|<canvas|createElement\(\s*["']canvas/;
export function classify(meta: Meta, main: string | undefined, src: string): Meta {
  if (meta.unusable) return meta;
  let out = meta;
  if (out.kind === "background" && /\{\s*children\s*\}|\bchildren\s*[,}=]|\bprops\.children\b/.test(src)) out = { ...out, kind: "wrap" };
  if (out.kind === "wrap" && out.plain === undefined) {
    // What the children are rendered into decides whether they can be blocks of content: a <div> takes them, a <span> or <h1> wants words.
    const parents = [...src.matchAll(/<([\w.]+)\b(?:[^<>]|=>)*>\s*\{\s*children\s*\}/g)].map((m) => m[1].split(".").pop()!.toLowerCase());
    if (parents.length ? parents.every((t) => INLINE_TAGS.has(t)) : INLINE_TAGS.has(propsTag(main, src))) out = { ...out, plain: true };
  }
  if (out.kind === "background" && !BACKDROP.test(src)) out = { ...out, kind: "text" };
  return out;
}

/** The Vendor lists offer effects, not the ordinary widgets of a UI kit (a plain button, a form field, a dialog, a data table, a navbar...).
 *  Judged by name: an exact plain-widget name, or a name that says the thing is page furniture. Animated variants ("shimmer-button") stay. */
const PLAIN_EXACT = new Set(["accordion", "alert", "alert-dialog", "avatar", "badge", "breadcrumb", "button", "calendar", "card", "checkbox", "collapsible", "command", "context-menu", "dialog", "drawer", "dropdown-menu", "form", "hover-card", "input", "input-otp", "label", "menu", "menubar", "modal", "navbar", "navigation-menu", "pagination", "popover", "progress", "radio-group", "resizable", "scroll-area", "select", "separator", "sheet", "sidebar", "skeleton", "slider", "sonner", "switch", "table", "tabs", "textarea", "toast", "toggle", "toggle-group", "tooltip"]);
const PLAIN_TOKEN = /(^|-)(navbar|sidebar|footer|login|signup|sign-in|signin|form|table|pricing|dialog|modal|dropdown|breadcrumb|pagination|testimonials?|faq|checkout|dashboard|demo|example|calculator|widget)(-|$)/;
export const isPlainUi = (name: string) => PLAIN_EXACT.has(name) || PLAIN_TOKEN.test(name);

const importsOf = (src: string) => [...src.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)].map((m) => m[1]);

export function shadcnSource(r: ShadcnRegistry): VendorSource {
  if (r.raw) r.names = Object.keys(r.raw.paths).filter((n) => !r.raw!.offer || r.raw!.offer(r.raw!.paths[n]));
  const url = (name: string) => (r.raw ? `raw:${name}` : r.item.replace("{name}", name));
  /** A component that is just a source file: build the same kind of item a registry would have served. */
  async function rawItem(name: string): Promise<Item> {
    const path = r.raw!.paths[name];
    if (!path) throw new HttpError(name, 404);
    const content = await getText(r.raw!.url.replace("{path}", path));
    const imps = importsOf(content);
    const dependencies = [...new Set(imps.filter((i) => !/^[.@]\//.test(i) && !i.startsWith("@/") && !i.startsWith(".")).map((i) => (i.startsWith("@") ? i.split("/").slice(0, 2).join("/") : i.split("/")[0])))].filter((d) => d !== "react" && d !== "next");
    const registryDependencies = imps.flatMap((i) => { const m = i.match(/^@\/animata\/(?:[\w-]+\/)([\w-]+)$/); return m ? [Object.keys(r.raw!.paths).find((k) => r.raw!.paths[k].endsWith(`/${m[1]}.tsx`)) ?? m[1]] : []; });
    return { name, type: "registry:ui", title: titleOf(name), dependencies, registryDependencies, files: [{ path: `${name}.tsx`, content }] };
  }
  let known: Set<string> | null = null; // names in this vendor's own index, to tell its items from shadcn/ui's when one builds on another
  const index = async () => { if (!r.index) return []; const reg = await getJson(r.index); const all = ((reg.items as Item[]) ?? []); known = new Set(all.map((i) => i.name)); return all; };

  /** One item, wherever it lives. A paid item answers 401/403: say so instead of "failed". */
  async function get(u: string): Promise<Item> {
    try { return u.startsWith("raw:") ? await rawItem(u.slice(4)) : await getJson(u); }
    catch (e) {
      if (e instanceof HttpError && (e.status === 401 || e.status === 403)) throw new Error(`is part of ${r.name}'s paid tier (it needs a licence this app can't use)`);
      if (e instanceof HttpError && e.status === 404) throw new Error(`isn't published under that name any more`);
      throw e;
    }
  }

  /** Everything this item builds on, one level at a time, into `out` (file name -> source) and `items` (for their CSS). */
  async function gather(it: Item, out: Record<string, string>, items: Item[], seen: Set<string>) {
    if (!known && r.index && it.registryDependencies?.length) await index(); // fetchOne can run without the list ever having been opened
    for (const dep of it.registryDependencies ?? []) {
      const key = /^https?:/.test(dep) ? dep : dep.replace(/^@[\w-]+\//, "");
      if (BUILT_IN.has(key) || seen.has(key)) continue;
      seen.add(key);
      const own = /^https?:/.test(dep) ? dep : known?.has(key) || (r.raw ? key in r.raw.paths : r.names?.includes(key)) ? url(key) : `${BASE}/${key}.json`;
      let sub: Item;
      try { sub = await get(own); } catch (e) { throw new Error(`builds on "${key}", which couldn't be downloaded (${(e as Error).message})`); }
      const bad = needsPkgs(sub); if (bad.length) throw new Error(`builds on "${key}", which needs ${bad.join(", ")}`);
      for (const f of (sub.files ?? []).filter(sourceFile)) out[stem(f.path)] = f.content!;
      items.push(sub);
      await gather(sub, out, items, seen);
    }
  }

  return {
    id: r.id, name: r.name, site: r.site, license: r.license, terms: r.terms, note: r.note,

    async catalog(): Promise<CatalogItem[]> {
      if (!r.index) return (r.names ?? []).filter((n) => !isPlainUi(n)).map((n) => ({ id: n, label: titleOf(n), description: "", ok: true })).sort((a, b) => a.label.localeCompare(b.label));
      const all = (await index()).filter((i) => !isPlainUi(i.name));
      const types = r.types ?? ["registry:ui", "registry:component", "registry:block"];
      return all.filter((i) => (!i.type || types.includes(i.type)) && (i.files?.length ?? 1) > 0).map((i) => {
        const pkgs = needsPkgs(i);
        const deps = (i.registryDependencies ?? []).map((d) => d.replace(/^@[\w-]+\//, "")).filter((d) => !/^https?:/.test(d) && !BUILT_IN.has(d) && !known!.has(d) && !BASE_OK.has(d));
        const urlDeps = (i.registryDependencies ?? []).some((d) => /^https?:/.test(d));
        const ok = !pkgs.length && !deps.length && !urlDeps;
        return { id: i.name, label: i.title ?? titleOf(i.name), description: i.description ?? "", ok,
          why: ok ? undefined : pkgs.length ? `needs ${pkgs.join(", ")}` : `builds on ${deps.join(", ") || "another vendor's component"}` };
      }).sort((a, b) => a.label.localeCompare(b.label));
    },

    async fetchOne(id: string): Promise<Stored> {
      if (isPlainUi(id)) throw new Error("is an ordinary UI component, not an effect");
      const it = await get(url(id));
      const bad = needsPkgs(it); if (bad.length) throw new Error(`needs ${bad.join(", ")}, which the app doesn't provide`);
      const srcs = (it.files ?? []).filter(sourceFile);
      if (!srcs.length) throw new Error("has no component file");
      const mainFile = srcs.find((f) => stem(f.path) === id) ?? srcs.find((f) => /\.tsx$/.test(f.path)) ?? srcs[0];
      const files: Record<string, string> = {}, items: Item[] = [it];
      for (const f of srcs) if (f !== mainFile) files[stem(f.path)] = f.content!;
      await gather(it, files, items, new Set());
      const js = mainFile.content!;
      const main = mainExport(id, js);
      const label = it.title ?? titleOf(id);
      const meta = classify({ ...parseMeta(main ?? pascal(id), label, js), id, label }, main, js);
      const css = await buildTailwind([js, ...Object.values(files)], items);
      return { key: `${r.id}/${id}`, vendor: r.id, id, meta, js, css, at: Date.now(), files, tw: true, main };
    },
  };
}
