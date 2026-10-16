// Reads a React Bits component's TypeScript source and describes the props a deck author can set from text.
// Only single-line, serialisable props are kept (numbers, booleans, strings, colours, string lists, string unions).
const LIT = String.raw`(\[[^\]]*\]|'[^']*'|"[^"]*"|-?[\d.]+|true|false)`;
const lit = (s) => { try { return JSON.parse(s.replace(/'/g, '"')); } catch { return undefined; } };

export function parseMeta(id, label, src) {
  // The props of the component itself: the one named <Id>Props when the file has several (Counter also describes its inner pieces).
  const propsOf = (name) => src.match(new RegExp(String.raw`(?:interface\s+${name}\s*(?:extends[^{]*)?\{|type\s+${name}\s*=\s*(?:[^{;]*&\s*)?\{)([\s\S]*?)\n\}`));
  const hit = propsOf(`${id}Props`) ?? propsOf(String.raw`\w*Props`);
  const whole = hit?.[1] ?? "";
  const header = hit ? hit[0].slice(0, hit[0].indexOf("{")) : "";
  const htmlProps = /^type\b[^&]*&/.test(header) && /HTMLAttributes|ComponentProps|PropsWithChildren/.test(header); // `type P = HTMLAttributes<..> & {..}` allows children without listing them
  // Only the component's own props: the lines inside a nested type (`variant?: {` ... `}`) describe that object, not the component.
  let depth = 0;
  const body = whole.split("\n").filter((line) => {
    const top = depth === 0;
    for (const ch of line.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "")) { if ("{([".includes(ch)) depth++; else if ("})]".includes(ch)) depth = Math.max(0, depth - 1); }
    return top;
  }).join("\n");
  const hasText = /^\s*text\??:/m.test(body); // takes its words from a `text` prop (even if it also accepts children)
  const kids = body.match(/^\s*children\??:\s*(.+?);?\s*$/m)?.[1]?.trim();
  const wrap = !hasText && /\bchildren\b/.test(body || htmlProps ? (htmlProps ? body + src : body) : src); // a component that goes around content (children can also come from the HTML attributes its props extend)
  const defaults = {};
  for (const m of src.matchAll(new RegExp(String.raw`^\s*(\w+)\s*=\s*${LIT}\s*,?\s*$`, "gm"))) defaults[m[1]] = lit(m[2]);
  // `type Direction = 'a' | 'b'` written next to the props: use its options wherever the props name it
  const alias = {};
  for (const m of src.matchAll(/(?:export\s+)?type\s+(\w+)\s*=\s*((?:\s*\|?\s*['"][^'"]*['"])+)\s*;/g)) alias[m[1]] = m[2].trim().replace(/^\|/, "");
  const props = [], need = [];
  for (const m of body.matchAll(/^\s*(\w+)(\??):\s*(.+?);?\s*$/gm)) {
    const [, key, opt, t0] = m, type = (alias[t0.trim()] ?? t0).trim(), d = defaults[key], clr = /colou?r/i.test(key) || (typeof d === "string" && /^#|^rgb/.test(d));
    let p = null;
    if (key === "className" || key === "style" || key === "children") continue;
    if (type === "number") p = { key, type: "number" };
    else if (type === "boolean") p = { key, type: "boolean" };
    else if (type === "string" || type === "string | string[]") p = { key, type: clr ? "color" : "string" };
    else if (type === "string[]") p = { key, type: "colors" };
    else if (/^(['"][^'"]*['"]\s*\|\s*)+['"][^'"]*['"]$/.test(type)) p = { key, type: "select", options: [...type.matchAll(/['"]([^'"]*)['"]/g)].map((x) => x[1]) };
    if (!p) { if (!opt && d === undefined) need.push(key); continue; } // a required prop whose value can't be written as text
    if (d !== undefined && typeof d !== "object" || Array.isArray(d)) p.def = d;
    // A required prop with no default would crash the component, so it gets a placeholder value that is always passed.
    if (!opt && d === undefined) {
      p.req = true;
      p.def = p.type === "number" ? 10 : p.type === "boolean" ? false : p.type === "colors" ? ["One", "Two", "Three"] : p.type === "select" ? p.options[0] : "Text";
    }
    props.push(p);
  }
  const kind = wrap ? "wrap" : hasText ? "text" : "background";
  // Text effects drawn on a canvas have no height of their own, so the slide gives them a box to fill.
  const fill = kind === "text" && /new Renderer|WebGLRenderer|<canvas|getContext\(['"]webgl/.test(src);
  return { id, label, kind, ...(wrap && /^string(\s*\|\s*string\[\])?$/.test(kids ?? "") ? { plain: true } : {}), ...(fill ? { fill: true } : {}),
    ...(need.length ? { unusable: `needs ${need.join(", ")}, which can't be written in a deck` } : {}), props };
}
