import type { TraceData } from "./ctx";
import { TraceComposite } from "./TraceParts";
import { parseTraceDef } from "./traceBlock";

// The generated slide after a run (no `def`): all the parts together, with a Make editable button that turns it into a real slide made of separate parts.
// With `def` it is a plain `::: trace` block (all the parts in one box), which can be split into separate elements.
export function TraceView({ trace, def, onSplit, onMake }: { trace: TraceData; def?: ReturnType<typeof parseTraceDef>; onSplit?: () => void; onMake?: () => void }) {
  const d = def ?? parseTraceDef("");
  return <TraceComposite def={d} over={def ? undefined : { trace, key: `#run:${trace.src ?? ""}:${trace.name ?? ""}` }} onSplit={onSplit} onMake={onMake} />;
}
