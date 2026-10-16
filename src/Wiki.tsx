import { useEffect, useMemo, useRef, useState } from "react";
import { CATS, WIKI, type Entry } from "./wikiData";

/** The Wiki: type what you want to do, get the shortest way to it, and a button that takes you there. */
export function Wiki({ onClose, go, can, onManual }: { onClose: () => void; go: (key: string) => void; can: (key: string) => boolean; onManual: () => void }) {
  const [q, setQ] = useState(""), [cat, setCat] = useState<string>("All");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return WIKI.filter((e) => (cat === "All" || e.cat === cat) && words.every((w) => `${e.q} ${e.where.join(" ")} ${e.steps.join(" ")} ${e.keys ?? ""} ${e.cat}`.toLowerCase().includes(w)));
  }, [q, cat]);
  const grouped = CATS.map((c) => [c, list.filter((e) => e.cat === c)] as const).filter(([, l]) => l.length);
  const Row = ({ e }: { e: Entry }) => (
    <article className="wk-card">
      <h3>{e.q}</h3>
      <div className="wk-where">{e.where.map((w, i) => <span key={i}>{i > 0 && <em>›</em>}<kbd>{w}</kbd></span>)}{e.keys && <span className="wk-keys">{e.keys}</span>}</div>
      <ol>{e.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      {e.go && can(e.go.split(":")[0]) && <button className="wk-go" onClick={() => { onClose(); setTimeout(() => go(e.go!), 60); }}>{e.goLabel ?? "Take me there"} →</button>}
    </article>
  );
  return (
    <div className="manual-back" onMouseDown={onClose}>
      <div className="wiki" role="dialog" aria-label="Wiki" onMouseDown={(e) => e.stopPropagation()}>
        <div className="wk-top">
          <strong>Wiki</strong><span className="wk-sub">Where is everything?</span>
          <input ref={input} placeholder="What do you want to do?  e.g. transition, font, save, branch, sound…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={onManual}>Full manual</button><button onClick={onClose} aria-label="Close wiki">Close (Esc)</button>
        </div>
        <div className="wk-body">
          <nav className="wk-cats">
            {["All", ...CATS].map((c) => <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c}<span>{c === "All" ? WIKI.length : WIKI.filter((e) => e.cat === c).length}</span></button>)}
            <p>Tip: the top bar is Home, File, Insert, Format, Transitions, Animations, View, Vendor, Sound, Present, Help. Right-click almost anything.</p>
          </nav>
          <div className="wk-list">
            {!list.length && <p className="wk-none">Nothing matches “{q}”. Try a shorter word, or open the full manual.</p>}
            {grouped.map(([c, l]) => <section key={c}>{cat === "All" && <h2>{c}</h2>}{l.map((e, i) => <Row key={e.q + i} e={e} />)}</section>)}
          </div>
        </div>
      </div>
    </div>
  );
}
