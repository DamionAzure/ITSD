import { useEffect, useState } from "react";

export function NotesBox({ slideId, value, onCommit }: { slideId: number; value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [slideId, value]);
  return (
    <div className="notesbox">
      <label htmlFor="notes-ta">Speaker notes <small>(shown in the Presenter View, not on the slide)</small></label>
      <textarea id="notes-ta" value={v} rows={3} placeholder="What to say on this slide…" onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onCommit(v); }} />
    </div>
  );
}
