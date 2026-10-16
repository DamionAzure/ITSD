import { reactbits } from "./reactbits";
import { ANIMATA_PATHS } from "./animata";

/** Animata also ships app-style widgets, cards, lists and charts; only its effect categories are offered. */
const ANIMATA_EFFECTS = /^animata\/(background|text|image|icon|preloader|hero)\/|^animata\/container\/(fibonacci-lines|animated-dock)\./;
import { shadcnSource } from "./shadcn";
import type { VendorSource } from "./types";

// Components are read from each vendor's GitHub repository where it publishes the built registry there (the same files its website serves, and
// GitHub allows any app to read them), otherwise from the vendor's website.
const GH = "https://raw.githubusercontent.com";
const MIT = (name: string) => `Free and open source under the MIT licence: you may use and change these components, commercially too, as long as the licence notice stays with them. ITSD doesn't bundle ${name}: each component is downloaded to this computer when you ask.`;

/** Every vendor the app knows how to download from. Another vendor is one more file like reactbits.ts, or, if it publishes a shadcn registry, one more entry here. */
export const SOURCES: VendorSource[] = [
  reactbits,
  shadcnSource({
    id: "magicui", name: "Magic UI", site: "https://magicui.design", license: "MIT", terms: MIT("Magic UI"),
    note: "Magic UI also sells Pro templates. Only the free, open-source components are listed here.",
    item: `${GH}/magicuidesign/magicui/main/apps/www/public/r/{name}.json`, index: `${GH}/magicuidesign/magicui/main/apps/www/public/r/registry.json`, types: ["registry:ui"],
  }),
  shadcnSource({
    id: "cultui", name: "Cult UI", site: "https://www.cult-ui.com", license: "MIT", terms: MIT("Cult UI"),
    item: `${GH}/nolly-studio/cult-ui/main/apps/www/public/r/{name}.json`, index: `${GH}/nolly-studio/cult-ui/main/apps/www/public/r/registry.json`,
    types: ["registry:ui"], // its other entries are *-demo pages that import things they don't declare
  }),
  shadcnSource({
    id: "kokonutui", name: "Kokonut UI", site: "https://kokonutui.com", license: "MIT", terms: MIT("Kokonut UI"),
    item: `${GH}/kokonut-labs/kokonutui/main/public/r/{name}.json`, index: `${GH}/kokonut-labs/kokonutui/main/public/r/registry.json`,
  }),
  shadcnSource({
    id: "eldoraui", name: "Eldora UI", site: "https://www.eldoraui.site", license: "MIT", terms: MIT("Eldora UI"),
    item: `${GH}/karthikmudunuri/eldoraui/main/apps/www/public/r/{name}.json`, index: `${GH}/karthikmudunuri/eldoraui/main/apps/www/public/r/registry.json`,
    types: ["registry:ui"], // its blocks are page sections and its examples are demos
  }),
  shadcnSource({
    id: "motionprimitives", name: "Motion Primitives", site: "https://motion-primitives.com", license: "MIT", terms: MIT("Motion Primitives"),
    note: "Licence checked in the repository (LICENCE.md, \"MIT License, Copyright (c) 2024 ibelick\").",
    item: `${GH}/ibelick/motion-primitives/main/public/c/{name}.json`, index: `${GH}/ibelick/motion-primitives/main/public/c/registry.json`,
  }),
  shadcnSource({
    id: "animata", name: "Animata", site: "https://animata.design", license: "MIT", terms: MIT("Animata"),
    note: "Animata publishes its components as source files in its GitHub repository rather than a registry, so these are read from there. Only the single-file components that need nothing the app lacks are listed.",
    item: "", raw: { url: `${GH}/codse/animata/main/{path}`, paths: ANIMATA_PATHS, offer: (path) => ANIMATA_EFFECTS.test(path) },
  }),
  shadcnSource({
    id: "aceternity", name: "Aceternity UI", site: "https://ui.aceternity.com", license: "Aceternity License (free components)",
    terms: "Free to use in your own work, presentations and commercial projects included, but you may not redistribute or resell the components themselves. ITSD doesn't contain them: each one is downloaded from Aceternity to this computer when you ask.",
    note: "Aceternity's Blocks and templates are paid (Aceternity UI Pro) and can't be downloaded here; if you buy them you may use them in your decks, but this app has no way to log in. Aceternity publishes no machine-readable list of its free components, so this is a hand-picked starter set; one that is missing or has been renamed shows up under \"couldn't be added\".",
    item: "https://ui.aceternity.com/registry/{name}.json",
    names: ["3d-card", "animated-modal", "aurora-background", "background-beams", "card-hover-effect", "infinite-moving-cards", "lamp", "macbook-scroll",
      "moving-border", "placeholders-and-vanish-input", "sparkles", "spotlight", "sticky-scroll-reveal", "text-generate-effect", "typewriter-effect", "wavy-background"],
  }),
];
