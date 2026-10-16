import { parseMeta } from "../modules/reactbits/meta.mjs";
import { canProvide } from "./compile";
import { getJson } from "./net";
import type { VendorSource } from "./types";

// React Bits publishes every component as a small JSON file in its repository. We read the TypeScript + CSS variant: its
// type annotations are what the options (and which effects take text) are worked out from.
const REGISTRY = "https://raw.githubusercontent.com/DavidHDev/react-bits/main/public/r";
const plain = (n: string) => n.replace(/-(TS|JS)-(CSS|TW)$/, "");
const pkg = (d: string) => d.replace(/(?!^)@.*$/, "");
const json = getJson;

export const reactbits: VendorSource = {
  id: "reactbits", name: "React Bits", site: "https://reactbits.dev", license: "MIT + Commons Clause",
  terms: "You may use these components in your own work, including commercially, but not sell or redistribute the components themselves. ITSD doesn't contain them: each one is downloaded from React Bits to this computer when you ask.",
  async catalog() {
    const reg = await json(`${REGISTRY}/registry.json`);
    return (reg.items as any[]).filter((i) => /-TS-CSS$/.test(i.name)).map((i) => {
      const missing = (i.dependencies ?? []).map(pkg).filter((d: string) => !canProvide(d));
      const ok = !missing.length && !i.registryDependencies?.length;
      return { id: plain(i.name), label: i.title ?? plain(i.name), description: i.description ?? "", ok, why: ok ? undefined : missing.length ? `needs ${missing.join(", ")}` : "builds on other components" };
    }).sort((a, b) => a.label.localeCompare(b.label));
  },
  async fetchOne(id) {
    const it = await json(`${REGISTRY}/${id}-TS-CSS.json`);
    const files = (it.files ?? []).filter((f: any) => typeof f.content === "string");
    const tsFiles = files.filter((f: any) => /\.tsx?$/.test(f.path)); // the component is the file named like it (the registry may list others)
    const js: string | undefined = (tsFiles.find((f: any) => /\.tsx$/.test(f.path) && f.path.split("/").pop().replace(/\.tsx$/, "") === id) ?? tsFiles[0])?.content, css: string = files.find((f: any) => f.path.endsWith(".css"))?.content ?? "";
    if (!js) throw new Error("no component file");
    return { key: `reactbits/${id}`, vendor: "reactbits", id, meta: parseMeta(id, it.title ?? id, js), js, css, at: Date.now() };
  },
};
