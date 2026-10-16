// Code beautifier for code blocks. Three tiers, first that works wins:
//  1. Prettier (bundled, lazy) for JavaScript, TypeScript, JSON, CSS, HTML, Markdown.
//  2. The language's own formatter on this machine (rustfmt, black, clang-format, gofmt) through the `format_code` command.
//  3. A built-in tidy: tabs/trailing space, and brace-based re-indenting for C-like languages.
import { invoke } from "@tauri-apps/api/core";

export interface Beautified { text: string; how: string }
const WEB: Record<string, string> = { js: "babel", javascript: "babel", node: "babel", jsx: "babel", ts: "typescript", typescript: "typescript", tsx: "typescript", json: "json", css: "css", html: "html", markdown: "markdown", md: "markdown" };
const BRACE = new Set(["c", "cpp", "java", "rust", "rs", "go", "js", "javascript", "node", "ts", "typescript", "csharp", "cs", "swift", "kotlin", "php", "json", "css"]);

async function prettier(parser: string, code: string): Promise<string> {
  const [p, ...plugins] = await Promise.all([
    import("prettier/standalone"), import("prettier/plugins/babel"), import("prettier/plugins/estree"), import("prettier/plugins/typescript"),
    import("prettier/plugins/postcss"), import("prettier/plugins/html"), import("prettier/plugins/markdown"),
  ]);
  return p.format(code, { parser, plugins: plugins as unknown as never[], printWidth: 90, tabWidth: 2 });
}

/** Re-indent by bracket depth. Strings, comments and a leading `}` are handled; it never reflows or splits lines. */
export function reindent(code: string, unit = "  "): string {
  let depth = 0, block = false;
  return code.split("\n").map((raw) => {
    const t = raw.trim();
    if (!t) return "";
    const start = block ? depth : depth - (/^[)\]}]/.test(t) ? 1 : 0);
    let open = 0, s = "", i = 0; const lineStartBlock = block;
    for (; i < t.length; i++) {
      const c = t[i], n = t[i + 1];
      if (block) { if (c === "*" && n === "/") { block = false; i++; } continue; }
      if (c === "/" && n === "/") break;
      if (c === "/" && n === "*") { block = true; i++; continue; }
      if (s) { if (c === "\\") i++; else if (c === s) s = ""; continue; }
      if (c === '"' || c === "'" || c === "`") { s = c; continue; }
      if ("([{".includes(c)) open++; else if (")]}".includes(c)) open--;
    }
    s = "";
    const out = (lineStartBlock ? unit.repeat(Math.max(0, depth)) + " " : unit.repeat(Math.max(0, start))) + t;
    depth = Math.max(0, depth + open);
    return out;
  }).join("\n");
}
export function tidy(lang: string, code: string): string {
  const lines = code.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n").map((l) => l.replace(/\s+$/, ""));
  let text = lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "") + "\n";
  if (BRACE.has(lang)) text = reindent(text);
  return text;
}

export async function beautify(lang: string, code: string): Promise<Beautified> {
  const parser = WEB[lang];
  if (parser) { try { return { text: await prettier(parser, code), how: "Prettier" }; } catch (e) { throw new Error(`Prettier: ${String(e).split("\n")[0]}`); } }
  try { const text = await invoke<string>("format_code", { lang, code }); return { text, how: "system formatter" }; } catch { /* not installed here */ }
  return { text: tidy(lang, code), how: "basic tidy (install rustfmt, black, clang-format or gofmt for full formatting)" };
}
