// Reads a React Bits component's TypeScript source and describes the props a deck author can set from text.
// Only single-line, serialisable props are kept (numbers, booleans, strings, colours, string lists, string unions).
const LIT = String.raw`(\[[^\]]*\]|'[^']*'|"[^"]*"|-?[\d.]+|true|false)`;
const lit = (s) => { try { return JSON.parse(s.replace(/'/g, '"')); } catch { return undefined; } };

export function parseMeta(id, label, src) {
  const body = src.match(/(?:interface\s+\w*Props\s*(?:extends[^{]*)?\{|type\s+\w*Props\s*=\s*\{)([\s\S]*?)\n\}/)?.[1] ?? "";
  const hasText = /^\s*text\??:/m.test(body); // takes its words from a `text` prop (even if it also accepts children)
  const kids = body.match(/^\s*children\??:\s*(.+?);?\s*$/m)?.[1]?.trim();
  const wrap = !hasText && /\bchildren\b/.test(body || src); // a component that goes around content
  const defaults = {};
  for (const m of src.matchAll(new RegExp(String.raw`^\s*(\w+)\s*=\s*${LIT}\s*,?\s*$`, "gm"))) defaults[m[1]] = lit(m[2]);
  const props = [];
  for (const m of body.matchAll(/^\s*(\w+)\??:\s*(.+?);?\s*$/gm)) {
    const [, key, t] = m, type = t.trim(), d = defaults[key], clr = /colou?r/i.test(key) || (typeof d === "string" && /^#|^rgb/.test(d));
    let p = null;
    if (key === "className" || key === "style" || key === "children") continue;
    if (type === "number") p = { key, type: "number" };
    else if (type === "boolean") p = { key, type: "boolean" };
    else if (type === "string" || type === "string | string[]") p = { key, type: clr ? "color" : "string" };
    else if (type === "string[]") p = { key, type: "colors" };
    else if (/^(['"][^'"]*['"]\s*\|\s*)+['"][^'"]*['"]$/.test(type)) p = { key, type: "select", options: [...type.matchAll(/['"]([^'"]*)['"]/g)].map((x) => x[1]) };
    if (!p) continue;
    if (d !== undefined && typeof d !== "object" || Array.isArray(d)) p.def = d;
    props.push(p);
  }
  const kind = wrap ? "wrap" : hasText ? "text" : "background";
  return { id, label, kind, ...(wrap && kids === "string" ? { plain: true } : {}), props };
}
