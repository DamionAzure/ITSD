// Components from shadcn-style registries (Magic UI, Aceternity, Cult UI...) are styled with Tailwind classes, but ITSD has no Tailwind.
// So when one is downloaded, Tailwind's own compiler (loaded only at that moment) reads the class names out of its source and makes
// the stylesheet that component needs. The result is stored with the component, so it works offline and costs nothing at startup.
//
// What the stylesheet is adapted to:
//  - colours like bg-background / text-muted-foreground are the slide's own colours (--itsd-* are set in style.css);
//  - `dark:` always applies, because slides are dark;
//  - sizes in rem follow the slide's width (--rem, set in style.css), so a component looks the same in the editor and on a projector;
//  - it is NOT put in a cascade layer: the app's global rules (`button {}`, `.in h1 {}`) would otherwise win over the component's own classes.
export interface TwItem { cssVars?: { theme?: Record<string, string> }; css?: Record<string, unknown> }

const TOKENS = ["background", "foreground", "card", "card-foreground", "popover", "popover-foreground", "primary", "primary-foreground", "secondary",
  "secondary-foreground", "muted", "muted-foreground", "accent", "accent-foreground", "destructive", "border", "input", "ring"];
const BASE = `
@custom-variant dark (&:is(.slide *));
@theme inline {
${TOKENS.map((t) => `  --color-${t}: var(--itsd-${t});`).join("\n")}
  --radius-sm: calc(var(--itsd-radius) - 4px);
  --radius-md: calc(var(--itsd-radius) - 2px);
  --radius-lg: var(--itsd-radius);
  --radius-xl: calc(var(--itsd-radius) + 4px);
}`;

// ---- class names: Tailwind finds them as plain words inside string literals, and so do we ----
const LITERAL = /(["'`])((?:\\[\s\S]|(?!\1)[^\\])*?)\1/g;
function literals(src: string, out: string[]) {
  for (const m of src.matchAll(LITERAL)) { out.push(m[2]); if (m[1] === "`") literals(m[2], out); } // a template literal can hold more literals in its ${...}
}
export function candidates(sources: string[]): string[] {
  const found = new Set<string>();
  for (const s of sources) {
    const lits: string[] = []; literals(s, lits);
    for (const l of lits) for (const t of l.split(/\s+/)) if (t && !t.includes("$") && t.length < 200) found.add(t);
  }
  return [...found];
}

// ---- the parts of a registry item's `css` / `cssVars` we honour: keyframes, utilities and theme values. Anything else (global
// selectors, @layer base on body...) is dropped, because a vendor has no business restyling the app around its component. ----
const SAFE_VALUE = (v: unknown) => (typeof v === "number" ? String(v) : typeof v === "string" && !/[{}]/.test(v) ? v : null);
const SAFE_KEY = /^[-\w%.,\s]+$/;
function block(o: Record<string, unknown>): string {
  return Object.entries(o).map(([k, v]) => {
    if (!SAFE_KEY.test(k)) return "";
    if (v && typeof v === "object") return `${k} { ${block(v as Record<string, unknown>)} }`;
    const s = SAFE_VALUE(v); return s === null ? "" : `${k}: ${s};`;
  }).join(" ");
}
function itemCss(items: TwItem[]): string {
  const out: string[] = [], vars: string[] = [];
  for (const it of items) {
    for (const [k, v] of Object.entries(it.css ?? {})) {
      if (/^@keyframes [\w-]+$/.test(k) || /^@utility [\w*-]+$/.test(k)) out.push(`${k} { ${block((v ?? {}) as Record<string, unknown>)} }`);
    }
    for (const [k, v] of Object.entries(it.cssVars?.theme ?? {})) {
      const s = SAFE_VALUE(v); if (s !== null && /^[\w-]+$/.test(k)) vars.push(`--${k.replace(/^--/, "")}: ${s};`);
    }
  }
  return (vars.length ? `@theme { ${vars.join(" ")} }\n` : "") + out.join("\n");
}

/** The stylesheet for one component and the pieces it imports. Throws a readable reason if Tailwind can't make sense of it. */
export async function buildTailwind(sources: string[], items: TwItem[]): Promise<string> {
  const [{ compile }, theme, utils] = await Promise.all([import("tailwindcss"), import("tailwindcss/theme.css?raw"), import("tailwindcss/utilities.css?raw")]);
  const sheets: Record<string, string> = { "tailwindcss/theme.css": theme.default, "tailwindcss/utilities.css": utils.default };
  const input = `@import "tailwindcss/theme.css" theme(inline);\n@import "tailwindcss/utilities.css";\n${BASE}\n${itemCss(items)}`;
  let css: string;
  try {
    const c = await compile(input, { loadStylesheet: async (id, base) => { const content = sheets[id]; if (content === undefined) throw new Error(`can't load ${id}`); return { path: id, base, content }; } });
    css = c.build(candidates(sources));
  } catch (e) { throw new Error(`Tailwind couldn't build its styles: ${(e as Error)?.message ?? e}`); }
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(-?\d*\.?\d+)rem\b/g, (_, n) => `calc(${n} * var(--rem, 1rem))`);
}
