import { useEffect, useState } from "react";
import { useSettings, setSettings, resetSettings, type Settings } from "./settings";
import type { SoundStore } from "./sound";
import { open } from "@tauri-apps/plugin-dialog";

/** The Settings window (File > Settings, Ctrl+,). Every change applies at once. */
export function SettingsDialog({ sfx, onClose, pickFolder, pickCss, cssNote, onReloadCss }: {
  sfx: SoundStore; onClose: () => void; pickFolder: () => void; pickCss: () => void; cssNote: string; onReloadCss: () => void;
}) {
  const s = useSettings();
  const [, bump] = useState(0); // the sound store has its own subscription; a re-render is enough to show its new values
  useEffect(() => sfx.subscribe(() => bump((n) => n + 1)), [sfx]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  const sel = <K extends keyof Settings>(k: K, opts: [Settings[K], string][]) => (
    <select value={String(s[k])} onChange={(e) => setSettings({ [k]: e.target.value } as Partial<Settings>)}>{opts.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}</select>
  );
  return (
    <div className="manual-back" onMouseDown={onClose}>
      <div className="manual settings" role="dialog" aria-label="Settings" onMouseDown={(e) => e.stopPropagation()}>
        <div className="manual-bar"><strong>Settings</strong><span className="grow" /><button onClick={onClose} aria-label="Close settings">Close (Esc)</button></div>
        <div className="settings-body">
          <h3>Files</h3>
          <div className="srow"><label>Your ITSD folder</label>
            <span className="sval" title={s.workspace}>{s.workspace || "Documents\\ITSD (default)"}</span>
            <button onClick={async () => { const d = await open({ directory: true, title: "Choose your ITSD folder" }); if (typeof d === "string") setSettings({ workspace: d }); }}>Choose…</button>{s.workspace && <button onClick={() => setSettings({ workspace: "" })}>Default</button>}</div>
          <div className="srow"><label>Home at start</label>
            <input type="checkbox" checked={s.homeAtStart} onChange={(e) => setSettings({ homeAtStart: e.target.checked })} /><span className="sval">show the Home dashboard when the app starts without a file (File &gt; Home brings it back)</span></div>

          <h3>Sound</h3>
          <div className="srow"><label>Sound folder</label>
            <span className="sval" title={sfx.folder ?? ""}>{sfx.folder ?? "none (built-in sounds only)"}</span>
            <button onClick={pickFolder}>Choose…</button>{sfx.folder && <><button onClick={() => void sfx.refresh()}>Reload ({sfx.files.length})</button><button onClick={() => void sfx.setFolder(null)}>Forget</button></>}</div>
          <div className="srow"><label>Volume</label>
            <input type="range" min={0} max={1} step={0.05} value={sfx.volume} onChange={(e) => sfx.setVolume(+e.target.value)} /><span className="sval">{Math.round(sfx.volume * 100)}%</span>
            <button onClick={() => void sfx.play("chime")}>Try</button></div>

          <h3>Trace</h3>
          <div className="srow"><label>A run that prints a trace gets</label>
            {sel("traceSlide", [["branch", "a branch slide you can edit (2-1)"], ["next", "a generated slide right after it"], ["off", "nothing (use ::: trace blocks)"]])}</div>
          <div className="srow"><label>“Show trace” button</label>
            <input type="checkbox" checked={s.traceButton} onChange={(e) => setSettings({ traceButton: e.target.checked })} /><span className="sval">put one on the slide that ran, to reach the branch slide while presenting</span></div>
          <div className="srow"><label>Trace stylesheet (.css)</label>
            <span className="sval" title={s.traceCss}>{s.traceCss || "none"}</span>
            <button onClick={pickCss}>Choose…</button>{s.traceCss && <><button onClick={onReloadCss}>Reload</button><button onClick={() => setSettings({ traceCss: "" })}>Clear</button></>}</div>
          <div className="srow"><label>Use it</label>
            <input type="checkbox" checked={s.traceCssOn} onChange={(e) => setSettings({ traceCssOn: e.target.checked })} />
            <span className={"sval" + (cssNote.startsWith("Couldn't") ? " bad" : "")}>{cssNote || "applies to every deck; a deck's own  style: file comes after it. See example/exampletrace.css"}</span></div>

          <h3>Scripts</h3>
          <div className="srow"><label>::: script blocks</label>
            {sel("scripts", [["ask", "ask once per opened deck"], ["allow", "always run them"], ["deny", "never run them"]])}</div>

          <div className="srow end"><button onClick={() => { if (window.confirm("Put every setting back to its default?\n(The sound folder is left as it is.)")) resetSettings(); }}>Reset settings</button></div>
        </div>
      </div>
    </div>
  );
}
