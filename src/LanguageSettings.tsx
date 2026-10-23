import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { RUN_LANGS } from "./langs";
import { settings, setSettings, useSettings } from "./settings";

/** What the backend's `tool_status` says about one language. */
interface ToolInfo { id: string; ok: boolean; program: string; version: string; manual: boolean }
type Note = { t: string; bad?: boolean };

/** Settings > Languages: which languages ITSD can run, and where each one's program is.
 *  Normally a program is found on PATH. When it isn't, find it automatically (PATH and the usual install folders) or point at it by hand. */
export function LanguageSettings() {
  const s = useSettings();
  const [info, setInfo] = useState<Record<string, ToolInfo>>({});
  const [note, setNote] = useState<Record<string, Note>>({});
  const [busy, setBusy] = useState(false);
  const [only, setOnly] = useState<"all" | "found" | "missing">("all");
  const say = (id: string, t: string, bad = false) => setNote((n) => ({ ...n, [id]: { t, bad } }));

  /** Ask the backend again (with these hand-set paths) and let the rest of the app follow. */
  const rescan = async (paths: Record<string, string> = settings().langPaths) => {
    setBusy(true);
    const list = await invoke<ToolInfo[]>("tool_status", { langPaths: paths }).catch(() => [] as ToolInfo[]);
    setInfo(Object.fromEntries(list.map((i) => [i.id, i])));
    if (list.length) setSettings({ compilers: Object.fromEntries(list.map((i) => [i.id, i.ok])) });
    setBusy(false);
  };
  useEffect(() => { void rescan(); }, []);

  const withPaths = (patch: Record<string, string | null>) => {
    const next = { ...settings().langPaths };
    for (const [k, v] of Object.entries(patch)) { if (v && v.trim()) next[k] = v.trim(); else delete next[k]; }
    setSettings({ langPaths: next });
    return next;
  };
  const apply = async (id: string, path: string | null) => {
    const next = withPaths({ [id]: path });
    setNote((n) => { const c = { ...n }; delete c[id]; return c; });
    await rescan(next);
  };
  const browse = async (id: string) => {
    const f = await open({ multiple: false, directory: false, title: `Where is the ${RUN_LANGS.find((l) => l.id === id)?.label ?? id} program?` });
    if (typeof f === "string") await apply(id, f);
  };
  const test = async (id: string, path: string) => {
    try { say(id, "Works: " + await invoke<string>("test_tool", { lang: id, path })); } catch (e) { say(id, String(e), true); }
  };
  /** Look on PATH and in the usual install folders; the first program that answers is set. */
  const find = async (id: string, quiet = false): Promise<string | null> => {
    try {
      const hits = await invoke<[string, string][]>("find_tool", { lang: id });
      if (!hits.length) { if (!quiet) say(id, "Not found on PATH or in the usual install folders. Install it, or use Browse… to point at it.", true); return null; }
      if (!quiet) say(id, hits.length > 1 ? `Using ${hits[0][0]}. Also found: ${hits.slice(1).map((h) => h[0]).join("; ")}` : `Found ${hits[0][0]} (${hits[0][1]})`);
      return hits[0][0];
    } catch (e) { if (!quiet) say(id, String(e), true); return null; }
  };
  const findOne = async (id: string) => { setBusy(true); const p = await find(id); if (p) await apply(id, p); else setBusy(false); };
  const findMissing = async () => {
    setBusy(true);
    const patch: Record<string, string | null> = {}; let got = 0;
    for (const l of RUN_LANGS) {
      if (info[l.id]?.ok || settings().langPaths[l.id]) continue;
      const p = await find(l.id, true);
      if (p) { patch[l.id] = p; got++; say(l.id, `Found ${p}`); }
    }
    await rescan(withPaths(patch));
    setNote((n) => ({ ...n, "": { t: got ? `Found ${got} more. They are saved in Settings.` : "Nothing more was found. Install the language, or use Browse… on its row." } }));
  };

  const found = RUN_LANGS.filter((l) => info[l.id]?.ok).length;
  const rows = RUN_LANGS.filter((l) => only === "all" || (only === "found") === !!info[l.id]?.ok);
  return (
    <>
      <h3>Languages</h3>
      <div className="srow">
        <span className="sval" style={{ whiteSpace: "normal" }}>
          A <code>run</code> block needs its language installed. ITSD looks on PATH. If one shows as missing, press <b>Find</b> (searches PATH and the usual install folders) or <b>Browse…</b> to the program yourself
          (a folder that holds it also works). A path set here is used exactly as written.
        </span>
      </div>
      <div className="srow">
        <label>{busy ? "Checking…" : `${found} of ${RUN_LANGS.length} found`}</label>
        <select value={only} onChange={(e) => setOnly(e.target.value as typeof only)}><option value="all">show all</option><option value="found">only found</option><option value="missing">only missing</option></select>
        <button disabled={busy} onClick={() => void rescan()}>Check again</button>
        <button disabled={busy} onClick={() => void findMissing()} title="Search for every language that isn't found yet and set the path for each one that turns up">Find all missing</button>
        {note[""] && <span className="sval">{note[""].t}</span>}
      </div>
      <div className="langs">
        {rows.map((l) => {
          const i = info[l.id], set = s.langPaths[l.id] ?? "", n = note[l.id];
          return (
            <div className="lrow" key={l.id}>
              <span className={"ldot " + (i ? (i.ok ? "ok" : "no") : "")} title={i ? (i.ok ? "found" : "not found") : "checking"} />
              <span className="lname" title={l.also.length ? `also written: ${l.also.join(", ")}` : undefined}>{l.label}</span>
              <input className="lpath" key={set} defaultValue={set} spellCheck={false}
                placeholder={i?.ok && !i.manual ? `on PATH: ${i.program}` : "program or folder path"}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                onBlur={(e) => { const v = e.target.value.trim(); if (v !== set) void apply(l.id, v || null); }} />
              <button onClick={() => void browse(l.id)}>Browse…</button>
              <button disabled={busy} onClick={() => void findOne(l.id)}>Find</button>
              {set && <button onClick={() => void test(l.id, set)}>Test</button>}
              {set && <button onClick={() => void apply(l.id, null)}>Clear</button>}
              <div className={"lnote" + (n?.bad || (i && !i.ok && set) ? " bad" : "")}>
                {n ? n.t : i?.ok ? i.version : set && i && !i.ok ? "That path doesn't work." : ""}
                {l.note ? <span className="dim"> ({l.note})</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
