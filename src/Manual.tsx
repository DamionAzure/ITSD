import { useEffect, useMemo } from "react";
import { marked } from "marked";
import manual from "../MANUAL.md?raw";

/** The manual, shown in a window over the app. It is the same MANUAL.md that ships next to the README. */
export function Manual({ onClose }: { onClose: () => void }) {
  const html = useMemo(() => marked.parse(manual) as string, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  return (
    <div className="manual-back" onMouseDown={onClose}>
      <div className="manual" role="dialog" aria-label="Manual" onMouseDown={(e) => e.stopPropagation()}>
        <div className="manual-bar"><strong>Manual</strong><span className="grow" /><button onClick={onClose} aria-label="Close manual">Close (Esc)</button></div>
        <article className="manual-body" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
