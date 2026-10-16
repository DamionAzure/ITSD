import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useSettings, setSettings } from "./settings";
import { wsInit, wsList, wsStat, wsOp, wsNew, wsReveal, summarize, recent, dropRecent, ago, baseName, stem, type Entry, type WsInfo, type Summary } from "./workspace";

type Page = "home" | "recent" | "folder";
interface Card { path: string; name: string; modified: number; sum?: Summary }

/** The first thing you see: start a deck, pick up where you left off, and your ITSD folder. Esc (or the button) returns to the deck being edited. */
export function Dashboard({ onOpen, onClose, canClose, onSettings, onManual, onOpenFile, onInfo }: {
  onOpen: (path: string) => void; onClose: () => void; canClose: boolean; onSettings: () => void; onManual: () => void; onOpenFile: () => void; onInfo?: (i: WsInfo) => void;
}) {
  const { workspace } = useSettings();
  const [info, setInfo] = useState<WsInfo | null>(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState<Page>("home");
  const [dir, setDir] = useState(""); // the folder shown on the "folder" page
  const [items, setItems] = useState<Entry[]>([]);
  const [recents, setRecents] = useState<Card[]>([]);
  const [tpl, setTpl] = useState<Card[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");

  const refreshInfo = useCallback(() => wsInit(workspace).then((i) => { setInfo(i); setErr(""); onInfo?.(i); return i; }).catch((e) => { setErr(String(e)); return null; }), [workspace, onInfo]);
  useEffect(() => { void refreshInfo(); }, [refreshInfo]);

  const read = (p: string) => invoke<string>("read_deck", { path: p });
  const cards = async (es: { path: string; name: string; modified: number }[]): Promise<Card[]> =>
    Promise.all(es.map(async (e) => ({ ...e, sum: await read(e.path).then((t) => summarize(t, stem(e.name))).catch(() => undefined) })));
  const loadRecents = useCallback(async () => {
    const paths = recent(); if (!paths.length) { setRecents([]); return; }
    const st = await wsStat(paths).catch(() => paths.map(() => null));
    const ok = paths.map((p, k) => ({ p, e: st[k] })).filter((x) => x.e);
    paths.filter((_, k) => !st[k]).forEach(dropRecent); // gone from disk
    setRecents(await cards(ok.slice(0, 18).map((x) => ({ path: x.p, name: baseName(x.p), modified: x.e!.modified }))));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadRecents(); }, [loadRecents]);
  useEffect(() => { // the templates: the workspace's own Templates folder (edit or add yours there)
    if (!info) return;
    void wsList(workspace, `${info.workspace}/Templates`).then((es) => cards(es.filter((e) => !e.dir && e.name.endsWith(".itsd") && stem(e.name).toLowerCase() !== "blank"))).then(setTpl).catch(() => setTpl([]));
  }, [info]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = useCallback(async (d: string) => { try { setItems(await wsList(workspace, d)); setDir(d); setPage("folder"); setErr(""); } catch (e) { setErr(String(e)); } }, [workspace]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && canClose) { e.stopPropagation(); onClose(); } }; window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true); }, [canClose, onClose]);

  const fromTemplate = async (path: string | null, label: string) => {
    setBusy(label); try { onOpen(await wsNew(workspace, path, label === "Blank" ? "Untitled" : stem(baseName(path ?? label)))); } catch (e) { setErr(String(e)); } setBusy("");
  };
  const act = async (op: "rename" | "copy" | "trash" | "mkdir", e: Entry | null) => {
    try {
      if (op === "mkdir") { const n = window.prompt("Folder name"); if (!n) return; await wsOp(workspace, "mkdir", dir, n); }
      else if (op === "rename") { const n = window.prompt("New name", e!.name); if (!n || n === e!.name) return; await wsOp(workspace, "rename", e!.path, e!.dir || n.includes(".") ? n : n + ".itsd"); }
      else if (op === "trash") { if (!window.confirm(`Move “${e!.name}” to the .trash folder in your ITSD folder?`)) return; await wsOp(workspace, "trash", e!.path); dropRecent(e!.path); }
      else await wsOp(workspace, "copy", e!.path);
      await show(dir); void loadRecents();
    } catch (x) { setErr(String(x)); }
  };
  const pickWorkspace = async () => { const d = await open({ directory: true, title: "Choose your ITSD folder" }); if (typeof d === "string") setSettings({ workspace: d }); };

  const roots = useMemo(() => info ? ([["Decks", `${info.workspace}/Decks`], ["Templates", `${info.workspace}/Templates`], ["Sounds", `${info.workspace}/Sounds`], ["Styles", `${info.workspace}/Styles`], ["Examples", `${info.resources}/example`]] as const) : [], [info]);
  const within = (p: string) => roots.find(([, r]) => p.replace(/\\/g, "/").startsWith(r.replace(/\\/g, "/")));
  const crumbs = () => { const r = within(dir); if (!r || !info) return []; const base = r[1].replace(/\\/g, "/"), rest = dir.replace(/\\/g, "/").slice(base.length).split("/").filter(Boolean); return [[r[0], r[1]] as const, ...rest.map((n, k) => [n, base + "/" + rest.slice(0, k + 1).join("/")] as const)]; };
  const mine = (p: string) => info && p.replace(/\\/g, "/").startsWith(info.workspace.replace(/\\/g, "/"));
  const shown = (l: Card[]) => l.filter((c) => !q || `${c.name} ${c.sum?.title ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  const Thumb = ({ c }: { c: Card }) => (
    <div className="hthumb"><b>{c.sum?.heading || c.sum?.title || stem(c.name)}</b>{c.sum?.lines.map((l, k) => <i key={k}>{l}</i>)}</div>
  );
  const Deck = ({ c }: { c: Card }) => (
    <button className="hcard" onClick={() => onOpen(c.path)} title={c.path}>
      <Thumb c={c} /><span className="hname">{c.sum?.title ?? stem(c.name)}</span><span className="hsub">{c.sum ? `${c.sum.slides} slide${c.sum.slides === 1 ? "" : "s"} · ` : ""}{ago(c.modified)}</span>
    </button>
  );

  return (
    <div className="home" role="dialog" aria-label="Home">
      <div className="menubar">
        <strong className="brand">ITSD</strong><span className="hcrumb">{page === "folder" ? "Folders" : page === "recent" ? "Recent" : "Home"}</span>
        <span className="grow" />
        {canClose && <button className="hback" title="Esc" onClick={onClose}>Back to the deck</button>}
      </div>
      <div className="hbody">
      <aside className="hside">
        <div className="ptitle">START</div>
        <button className={page === "home" ? "on" : ""} onClick={() => setPage("home")}>Home</button>
        <button className={page === "recent" ? "on" : ""} onClick={() => setPage("recent")}>Recent</button>
        <div className="ptitle">YOUR FOLDER</div>
        {roots.filter(([n]) => n !== "Examples").map(([n, r]) => <button key={n} className={page === "folder" && dir.startsWith(r) ? "on" : ""} onClick={() => void show(r)}>{n}</button>)}
        <div className="ptitle">INSTALLED</div>
        {roots.filter(([n]) => n === "Examples").map(([n, r]) => <button key={n} className={page === "folder" && dir.startsWith(r) ? "on" : ""} onClick={() => void show(r)}>{n}</button>)}
        <span className="grow" />
        <button onClick={onOpenFile}>Open a file…</button><button onClick={onSettings}>Settings</button><button onClick={onManual}>Manual</button>
      </aside>
      <main className="hmain">
        {err && <div className="herr" onClick={() => setErr("")}>{err}</div>}
        {page !== "folder" && <input className="hsearch" placeholder="Search decks" value={q} onChange={(e) => setQ(e.target.value)} />}
        {page === "home" && <>
          <h1>Start a deck</h1>
          <div className="hrow">
            <button className="hcard" disabled={!!busy} onClick={() => void fromTemplate(null, "Blank")}><div className="hthumb blank"><b>+</b></div><span className="hname">Blank deck</span><span className="hsub">saved in Decks</span></button>
            {shown(tpl).map((c) => <button key={c.path} className="hcard" disabled={!!busy} onClick={() => void fromTemplate(c.path, c.name)} title={`Template: ${c.path}`}><Thumb c={c} /><span className="hname">{stem(c.name)}</span><span className="hsub">template</span></button>)}
          </div>
          <h1>Recent</h1>
          {shown(recents).length ? <div className="hrow">{shown(recents).slice(0, 6).map((c) => <Deck key={c.path} c={c} />)}</div> : <p className="hdim">Decks you open or save show up here.</p>}
          {recents.length > 6 && <button className="hlink" onClick={() => setPage("recent")}>All recent decks ({recents.length})</button>}
          <h1>Where things are</h1>
          {info ? <dl className="hwhere">
            <dt>Your folder</dt><dd><code>{info.workspace}</code> <button onClick={() => void wsReveal(workspace, info.workspace)}>Show</button><button onClick={() => void pickWorkspace()}>Change…</button>{workspace && <button onClick={() => setSettings({ workspace: "" })}>Use Documents\ITSD</button>}</dd>
            <dt>Installed in</dt><dd><code>{info.install_dir}</code> <button onClick={() => void wsReveal(workspace, info.install_dir)}>Show</button></dd>
            <dt>Version</dt><dd>{info.version} · {info.templates.length} templates and {info.examples.length} examples came with it</dd>
          </dl> : <p className="hdim">{err ? "" : "Preparing your ITSD folder…"}</p>}
        </>}
        {page === "recent" && <><h1>Recent</h1>{shown(recents).length ? <div className="hrow wrap">{shown(recents).map((c) => <Deck key={c.path} c={c} />)}</div> : <p className="hdim">Nothing here yet.</p>}</>}
        {page === "folder" && <>
          <h1 className="crumbs">{crumbs().map(([n, p], k, a) => <span key={p}><button onClick={() => void show(p)} disabled={k === a.length - 1}>{n}</button>{k < a.length - 1 && " / "}</span>)}</h1>
          <div className="hbar">{mine(dir) && <button onClick={() => void act("mkdir", null)}>New folder</button>}<button onClick={() => info && void wsReveal(workspace, dir)}>Show in file manager</button></div>
          <table className="hfiles"><tbody>
            {items.length === 0 && <tr><td className="hdim">Empty.</td></tr>}
            {items.map((e) => (
              <tr key={e.path}>
                <td className="fn"><button onClick={() => (e.dir ? void show(e.path) : e.name.endsWith(".itsd") ? onOpen(e.path) : void wsReveal(workspace, e.path))}>{e.dir ? "📁" : e.name.endsWith(".itsd") ? "▶" : "·"} {e.name}</button></td>
                <td className="hdim">{ago(e.modified)}</td>
                <td className="fa">{mine(e.path) && <>{!e.dir && <button onClick={() => void act("copy", e)}>Duplicate</button>}<button onClick={() => void act("rename", e)}>Rename</button><button onClick={() => void act("trash", e)}>Delete</button></>}</td>
              </tr>))}
          </tbody></table>
        </>}
      </main>
      </div>
      <footer className="statusbar">
        <span>{busy ? `Creating ${busy}…` : "Home"}</span>
        <span className="path">{info?.workspace ?? ""}</span>
        <span className="grow" />
        {info && <span>ITSD {info.version}</span>}
      </footer>
    </div>
  );
}
