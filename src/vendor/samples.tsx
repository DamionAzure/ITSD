import React, { useRef, type ComponentType } from "react";

// A few React Bits components are built around data a deck can't write as text: lists of links, logos or pictures, content to swap
// between, a reference to another element. Each gets a small sample here so it works as an effect, and the options it does have
// (colours, speeds...) stay editable. The sample also takes whatever the deck sets for the same option, e.g. `logo=...`.
const pic = (a: string, b: string, text = "") => "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><text x="300" y="320" font-family="sans-serif" font-size="64" fill="#fff" text-anchor="middle">${text}</text></svg>`);
const logo = pic("#5227FF", "#FF9FFC", "ITSD");
const set = (v: unknown, d: unknown) => (v === undefined || v === "Text" ? d : v); // "Text" is the placeholder given to required text options
const box = (bg: string, text: string) => React.createElement("div", { style: { width: "100%", height: "100%", display: "grid", placeItems: "center", background: bg, color: "#fff", font: "600 2rem system-ui, sans-serif" } }, text);

const grad: [string, string][] = [["#5227FF", "#FF9FFC"], ["#00b4db", "#0083b0"], ["#f7971e", "#ffd200"], ["#11998e", "#38ef7d"], ["#ee0979", "#ff6a00"], ["#8e2de2", "#4a00e0"]];
const nav = (labels: string[]) => labels.map((label) => ({ label, href: "#", ariaLabel: label }));

type Adapter = (C: ComponentType<any>) => ComponentType<any>;
const SAMPLES: Record<string, Adapter> = {
  CardNav: (C) => (p) => <C {...p} logo={set(p.logo, logo)} items={[
    { label: "About", bgColor: "#0D0716", textColor: "#fff", links: [{ label: "Company", href: "#", ariaLabel: "Company" }, { label: "Careers", href: "#", ariaLabel: "Careers" }] },
    { label: "Projects", bgColor: "#170D27", textColor: "#fff", links: [{ label: "Featured", href: "#", ariaLabel: "Featured" }, { label: "Case studies", href: "#", ariaLabel: "Case studies" }] },
    { label: "Contact", bgColor: "#271E37", textColor: "#fff", links: [{ label: "Email", href: "#", ariaLabel: "Email" }, { label: "Twitter", href: "#", ariaLabel: "Twitter" }] },
  ]} />,
  BubbleMenu: (C) => (p) => <C {...p} logo={set(p.logo, <span style={{ fontWeight: 700 }}>ITSD</span>)} useFixedPosition={false} items={[
    { label: "home", href: "#", ariaLabel: "Home", rotation: -8, hoverStyles: { bgColor: "#3b82f6", textColor: "#ffffff" } },
    { label: "about", href: "#", ariaLabel: "About", rotation: 8, hoverStyles: { bgColor: "#10b981", textColor: "#ffffff" } },
    { label: "projects", href: "#", ariaLabel: "Projects", rotation: 8, hoverStyles: { bgColor: "#f59e0b", textColor: "#ffffff" } },
    { label: "contact", href: "#", ariaLabel: "Contact", rotation: -8, hoverStyles: { bgColor: "#ef4444", textColor: "#ffffff" } },
  ]} />,
  PillNav: (C) => (p) => <C {...p} logo={set(p.logo, logo)} items={[...nav(["Home", "About", "Services", "Contact"])]} activeHref="#" />,
  LogoLoop: (C) => (p) => <C {...p} logos={["React", "Tauri", "Vite", "Rust", "Monaco", "GSAP"].map((t) => ({ node: <span style={{ fontSize: "1.6em", fontWeight: 600, whiteSpace: "nowrap" }}>{t}</span>, title: t }))} />,
  Masonry: (C) => (p) => <C {...p} items={Array.from({ length: 10 }, (_, i) => ({ id: String(i), img: pic(...grad[i % grad.length], String(i + 1)), url: "#", height: [320, 420, 260, 380, 300][i % 5] }))} />,
  PixelSwap: (C) => (p) => <C {...p} firstContent={box("#5227FF", "Front")} secondContent={box("#ee0979", "Back")} />,
  PixelTransition: (C) => (p) => <C {...p} firstContent={box("#5227FF", "Front")} secondContent={box("#ee0979", "Back")} />,
  RubberSegment: (C) => (p) => <C {...p} items={["Day", "Week", "Month"]} />,
  TiltedCard: (C) => (p) => <C {...p} imageSrc={pic("#5227FF", "#FF9FFC", "ITSD")} containerHeight="300px" containerWidth="300px" imageHeight="300px" imageWidth="300px" />,
  WarmTooltip: (C) => (p) => <C {...p} content={set(p.content, "A helpful tip")} />, // wraps the content you write; the tip shows on hover
  VariableProximity: (C) => (p) => {
    const ref = useRef<HTMLDivElement>(null); // the area the pointer is measured against: the slide block around the effect
    return <div ref={ref} style={{ position: "relative", width: "100%" }}><C {...p} label={set(p.label, "Move your mouse here")} fromFontVariationSettings={set(p.fromFontVariationSettings, "'wght' 400, 'opsz' 9")} toFontVariationSettings={set(p.toFontVariationSettings, "'wght' 1000, 'opsz' 40")} containerRef={ref} /></div>;
  },
};

// Samples for components from the shadcn-style vendors are keyed `vendor/id`, since two vendors can both publish an `avatar-circles`.
const dot = { width: "6em", height: "6em", borderRadius: "50%", border: "2px solid currentColor", display: "grid", placeItems: "center", background: "rgba(255,255,255,.08)", zIndex: 1 } as const;
Object.assign(SAMPLES, {
  "magicui/avatar-circles": (C: ComponentType<any>) => (p: any) => <C {...p} numPeople={set(p.numPeople, 99)} avatarUrls={grad.slice(0, 4).map(([a, b], i) => ({ imageUrl: pic(a, b, String.fromCharCode(65 + i)), profileUrl: "#" }))} />,
  // two circles with a beam travelling between them; the beam needs references to the three elements, which a deck can't write
  "magicui/animated-beam": (C: ComponentType<any>) => (p: any) => {
    const box = useRef<HTMLDivElement>(null), a = useRef<HTMLDivElement>(null), b = useRef<HTMLDivElement>(null);
    return <div ref={box} style={{ position: "relative", width: "100%", height: "100%", minHeight: "10em", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12%" }}>
      <div ref={a} style={dot}>A</div><div ref={b} style={dot}>B</div><C {...p} containerRef={box} fromRef={a} toRef={b} />
    </div>;
  },
});

export const hasSample = (id: string, vendor = "") => `${vendor}/${id}` in SAMPLES || id in SAMPLES;
/** The component with its sample data built in (the component itself when it needs none). */
export const adapt = (id: string, C: ComponentType<any>, vendor = "") => { const f = SAMPLES[`${vendor}/${id}`] ?? SAMPLES[id]; return f ? f(C) : C; };
