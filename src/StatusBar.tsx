import type { Problem } from "./lint";

interface Props { dirty: boolean; path: string | null; tools: Record<string, boolean>; problems: Problem[]; ln: number; col: number; cur: number; total: number; note?: string }

export function StatusBar({ dirty, path, tools, problems, ln, col, cur, total, note }: Props) {
  const errs = problems.filter((p) => p.severity === "error").length, warns = problems.length - errs;
  const tip = problems.slice(0, 6).map((p) => `Line ${p.line + 1}: ${p.message}`).join("\n");
  return (
    <footer className="statusbar">
      <span>{note || (dirty ? "● Unsaved changes" : "Ready")}</span>
      <span className="path">{path ?? "Untitled"}</span>
      <span className="grow" />
      {Object.entries(tools).filter(([, ok]) => ok).map(([k]) => (
        <span key={k} className="tool" title={`${k} found`}>{k}</span>
      ))}
      {Object.values(tools).some((ok) => !ok) && <span className="tool miss" title={`Not found: ${Object.entries(tools).filter(([, ok]) => !ok).map(([k]) => k).join(", ")}. Set where they are in Settings > Languages.`}>+{Object.values(tools).filter((ok) => !ok).length} missing</span>}
      <span title={tip}>✖ {errs}  ⚠ {warns}</span>
      <span>Ln {ln}, Col {col}</span>
      <span>Slide {cur} / {total}</span>
    </footer>
  );
}
