#!/usr/bin/env node
// npm run module:reactbits -- add Aurora BlurText Particles
// npm run module:reactbits -- add all          (every component in the registry)
// npm run module:reactbits -- remove Aurora
// npm run module:reactbits -- list             (what is installed)
// Downloads components from React Bits' public registry (https://reactbits.dev/r/<Name>-TS-CSS.json) into ./components,
// installs the npm packages they list, and writes <Name>.meta.json describing the props the Modules tab can edit.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMeta } from "./meta.mjs";

const here = dirname(fileURLToPath(import.meta.url)), out = join(here, "components"), root = join(here, "../../..");
const REGISTRY = process.env.REACTBITS_REGISTRY ?? "https://reactbits.dev/r";
const FORCE = process.argv.includes("--force"), NO_INSTALL = process.argv.includes("--no-install");
const [cmd, ...names] = process.argv.slice(2).filter((a) => a !== "--force" && a !== "--no-install");
// `*` (or `all`) means every component. An unquoted * in bash/zsh is expanded by the shell into this folder's file names
// before we see it, so that is recognised too; quoting it ("*") also works everywhere.
const isAll = (ns) => ns.some((n) => n === "*" || n === "all" || n === "--all") || (ns.includes("package.json") && ns.includes("src"));

const nameOf = (n) => basename(String(n)).replace(/\.json$/, "");
const variant = (n) => (/-(TS|JS)-(CSS|TW)$/.test(n) ? n : `${n}-TS-CSS`); // TS + plain CSS: Vite handles both with no Tailwind
const plain = (n) => nameOf(n).replace(/-(TS|JS)-(CSS|TW)$/, "");

async function fetchItem(n) {
  const url = `${REGISTRY}/${variant(nameOf(n))}.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}

// Every component name in the registry. Accepts an array or { items: [...] }, entries as strings or { name }.
async function everything() {
  for (const file of ["index.json", "registry.json"]) {
    const r = await fetch(`${REGISTRY}/${file}`).catch(() => null);
    if (!r?.ok) continue;
    const j = await r.json(), list = Array.isArray(j) ? j : j.items ?? j.registry ?? [];
    const names = [...new Set(list.map((i) => plain(i.name ?? i)))].filter(Boolean);
    if (names.length) return names;
  }
  throw new Error(`couldn't read a component list from ${REGISTRY}/index.json; name the components instead`);
}

// Components that import files we don't have (shadcn aliases, 3D models, images) would break the whole build, so they are skipped.
const needsMore = (files) => files.some((f) => /from\s+['"]@\//.test(f.content) || /from\s+['"]\.{1,2}\/[^'"]+\.(glb|gltf|hdr|png|jpe?g|webp|svg|mp3|wav)['"]/.test(f.content));

async function add(names) {
  mkdirSync(out, { recursive: true });
  if (isAll(names)) { names = await everything(); console.log(`${names.length} components in the registry`); }
  const skipped = [];
  // Components that import something this app can't provide would break the whole build, so they are skipped (--force adds them anyway).
  const react = parseInt(String(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).dependencies?.react ?? "").replace(/^\D+/, "")) || 18;
  const unsuitable = {
    "@chakra-ui/react": "needs the Chakra UI framework (and its @emotion/react peer, which isn't installed)",
    "react-router-dom": "needs a router around it, which a slide doesn't have",
    "face-api.js": "needs face-detection model files and a camera",
    ...(react < 19 ? Object.fromEntries(["@react-three/fiber", "@react-three/drei", "maath"].map((d) => [d, `needs React 19 or React Three Fiber v9 (this app is on React ${react})`])) : {}),
  };
  const seen = new Set(), deps = new Set(), queue = [...names];
  while (queue.length) {
    const n = queue.shift(), id = plain(n);
    if (seen.has(id)) continue; seen.add(id);
    let item;
    try { item = await fetchItem(n); } catch (e) { console.error(`  x ${id}: ${e.message}`); process.exitCode = 1; continue; }
    let main = null;
    const files = (item.files ?? []).filter((f) => typeof f.content === "string");
    if (needsMore(files)) { skipped.push(id); console.warn(`  - ${id}: needs files or aliases that aren't in the registry; skipped`); continue; }
    const bad = FORCE ? null : (item.dependencies ?? []).map((d) => d.replace(/(?!^)@.*$/, "")).find((d) => unsuitable[d]);
    if (bad) { skipped.push(id); console.warn(`  - ${id}: ${bad} ${unsuitable[bad]}; skipped`); continue; }
    for (const f of files) {
      const dest = join(out, f.path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, f.content);
      if (/\.tsx$/.test(f.path) && basename(f.path, ".tsx") === id) main = f.content;
    }
    for (const d of item.dependencies ?? []) deps.add(d);
    for (const d of item.registryDependencies ?? []) queue.push(d); // other React Bits components it builds on
    const meta = main && parseMeta(id, item.title ?? id, main);
    if (!meta) { console.warn(`  - ${id}: no main component file found; skipped`); continue; }
    writeFileSync(join(out, `${id}.meta.json`), JSON.stringify(meta, null, 2));
    console.log(`  + ${id}  (${meta.kind}, ${meta.props.length} options)`);
  }
  const have = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const installed = { ...have.dependencies, ...have.devDependencies };
  const need = [...deps].filter((d) => !(d.replace(/(?!^)@.*$/, "") in installed));
  if (skipped.length) console.log(`${skipped.length} skipped: ${skipped.join(", ")}`);
  if (need.length && NO_INSTALL) console.log(`Not installing (--no-install). It would add: ${need.join(" ")}`);
  else if (need.length) { console.log(`Installing ${need.join(" ")}`); execFileSync("npm", ["install", "--legacy-peer-deps", ...need], { cwd: root, stdio: "inherit", shell: process.platform === "win32" }); }
}

function remove(names) {
  if (isAll(names)) names = existsSync(out) ? readdirSync(out).filter((f) => f.endsWith(".meta.json")).map((f) => f.replace(".meta.json", "")) : [];
  for (const n of names) {
    const id = plain(n);
    for (const f of existsSync(out) ? readdirSync(out) : []) if (f === `${id}.meta.json` || f.startsWith(`${id}.`)) rmSync(join(out, f), { force: true });
    console.log(`  - ${id}`);
  }
}

function list() {
  const have = existsSync(out) ? readdirSync(out).filter((f) => f.endsWith(".meta.json")).map((f) => JSON.parse(readFileSync(join(out, f), "utf8"))) : [];
  for (const m of have) console.log(`${m.id.padEnd(24)}${m.kind}`);
  console.log(`${have.length} installed`);
}

if (cmd === "list") list();
else if ((cmd === "add" || cmd === "remove") && names.length) await (cmd === "add" ? add(names) : remove(names));
else console.log("Usage: npm run module:reactbits -- add <Name...> | add * (everything)\n       npm run module:reactbits -- remove <Name...> | remove *\n       npm run module:reactbits -- list\nBrowse components at https://reactbits.dev");
