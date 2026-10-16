import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { modulesVersion, subscribeModules } from "../modules/registry";
import { flush, install, installed, uninstall } from "./runtime";
import { SOURCES } from "./sources";
import type { CatalogItem } from "./types";

type Filter = "all" | "installed" | "available";

/** Download effects from a vendor's website to this computer, and remove them again. */
export function VendorDialog({ sourceId, onClose }: { sourceId: string; onClose: () => void }) {
  const src = SOURCES.find((s) => s.id === sourceId) ?? SOURCES[0];
  useSyncExternalStore(subscribeModules, modulesVersion); // the installed list follows every download
  const have = installed(src.id);
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState(""), [filter, setFilter] = useState<Filter>("all");
  const [prog, setProg] = useState<{ done: number; total: number; failed: string[] } | null>(null);

  const load = () => { setErr(""); setItems(null); src.catalog().then(setItems, (e) => setErr(`Couldn't reach ${src.site}: ${e?.message ?? e}`)); };
  useEffect(load, [src.id]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);

  const shown = useMemo(() => (items ?? []).filter((i) =>
    (filter === "all" || (filter === "installed") === have.has(i.id)) && (!q.trim() || `${i.label} ${i.description}`.toLowerCase().includes(q.trim().toLowerCase()))), [items, q, filter, have.size]);
  const canGet = (items ?? []).filter((i) => i.ok && !have.has(i.id)), blocked = (items ?? []).filter((i) => !i.ok);

  // A handful at a time, so a long list is quick without hammering the site.
  async function batch(ids: string[], op: (id: string) => Promise<void>) {
    const failed: string[] = []; let done = 0, next = 0;
    setProg({ done, total: ids.length, failed });
    await Promise.all(Array.from({ length: Math.min(6, ids.length) }, async () => {
      while (next < ids.length) {
        const id = ids[next++];
        try { await op(id); } catch (e) { failed.push(`${id}: ${(e as Error)?.message ?? e}`); }
        setProg({ done: ++done, total: ids.length, failed: [...failed] });
        if (done % 12 === 0) flush();
      }
    }));
    flush();
  }
  const get = (ids: string[]) => batch(ids, (id) => install(src, id, true));
  const drop = (ids: string[]) => batch(ids, (id) => uninstall(src.id, id, true));
  const busy = !!prog && prog.done < prog.total;

  return (
    <div className="vd-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vd" role="dialog" aria-label={`${src.name} downloads`}>
        <header><h2>{src.name}</h2><a href={src.site} target="_blank" rel="noreferrer">{src.site.replace("https://", "")}</a><span className="grow" /><button onClick={onClose}>Close</button></header>
        <p className="vd-terms"><b>{src.license}.</b> {src.terms}</p>
        {src.note && <p className="vd-note">{src.note}</p>}
        {err && <p className="vd-err">{err} <button onClick={load}>Try again</button></p>}
        {!err && !items && <p className="vd-note">Loading the list…</p>}
        {items && (<>
          <div className="vd-bar">
            <input placeholder="Search…" value={q} spellCheck={false} onChange={(e) => setQ(e.target.value)} />
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}><option value="all">All</option><option value="installed">Downloaded</option><option value="available">Not downloaded</option></select>
            <button disabled={busy || !canGet.length} onClick={() => get(canGet.map((i) => i.id))}>Download all ({canGet.length})</button>
            <button disabled={busy || !have.size} onClick={() => drop([...have])}>Remove all</button>
          </div>
          <p className="vd-note">{have.size} downloaded · {canGet.length} available · {blocked.length} can't run inside ITSD (they need libraries it doesn't include).</p>
          {prog && <p className="vd-note">{busy ? "Working… " : "Done. "}{prog.done} / {prog.total}{prog.failed.length ? ` · ${prog.failed.length} couldn't be added` : ""}</p>}
          {prog && prog.failed.length > 0 && <details className="vd-note"><summary>Why {prog.failed.length} couldn't be added</summary><ul>{prog.failed.map((f) => <li key={f}>{f}</li>)}</ul></details>}
          <ul className="vd-list">
            {shown.map((i) => (
              <li key={i.id} className={i.ok ? "" : "off"}>
                <div><b>{i.label}</b><small>{i.ok ? i.description : `Can't run here: ${i.why}`}</small></div>
                {i.ok && (have.has(i.id) ? <button disabled={busy} onClick={() => drop([i.id])}>Remove</button> : <button disabled={busy} onClick={() => get([i.id])}>Download</button>)}
              </li>))}
            {!shown.length && <li className="vd-note">Nothing matches.</li>}
          </ul>
        </>)}
      </div>
    </div>
  );
}
