import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DeckCtx, type DeckApi } from "./ctx";
import { Thumb } from "./SlideView";
import { createAssets } from "./assets";
import { openBus, type PState, type ToMain, type ToPresenter } from "./presenterBus";

const mmss = (s: number) => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ":" : ""}${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function PresenterWindow() {
  const [st, setSt] = useState<PState | null>(null);
  const [secs, setSecs] = useState(0), [run, setRun] = useState(true), [size, setSize] = useState(() => { try { return +(localStorage.getItem("itsd.pnotes") ?? "") || 26; } catch { return 26; } });
  const [now, setNow] = useState(new Date()), [ended, setEnded] = useState(false);
  const bus = useRef<ReturnType<typeof openBus> | null>(null);
  const path = useRef<string | null>(null); path.current = st?.path ?? null;
  const assets = useMemo(() => createAssets(async (ref) => {
    const p = /^([\\/]|[A-Za-z]:[\\/])/.test(ref) ? ref : (path.current ?? "").replace(/[^\\/]*$/, "") + ref;
    return invoke<ArrayBuffer>("read_binary", { path: p });
  }), []);
  const api = useMemo(() => ({ fill: (t: string) => t, assets }) as unknown as DeckApi, [assets]);
  const send = (cmd: ToMain["cmd"], idx?: number) => bus.current?.send({ t: "cmd", cmd, idx });

  useEffect(() => {
    const b = openBus<ToPresenter>((m) => {
      if (m.t === "state") { setSt(m.s); if (m.s.presenting) { setEnded(false); setSecs((n) => n); } }
      else setEnded(true);
    });
    bus.current = b;
    b.send({ t: "cmd", cmd: "hello" });
    const poll = setInterval(() => b.send({ t: "cmd", cmd: "hello" }), 4000);
    return () => { clearInterval(poll); b.close(); };
  }, []);
  useEffect(() => {
    const h = setInterval(() => { setNow(new Date()); if (run && st?.presenting) setSecs((n) => n + 1); }, 1000);
    return () => clearInterval(h);
  }, [run, st?.presenting]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("select,input,textarea")) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); send("next"); }
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); send("prev"); }
      else if (e.key === "Escape") send("end");
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const bigger = (d: number) => setSize((n) => { const v = Math.max(14, Math.min(64, n + d)); try { localStorage.setItem("itsd.pnotes", String(v)); } catch { /* Storage may be unavailable. */ } return v; });
  const cur = st?.slides[st.idx], nxt = st && st.next !== st.idx ? st.slides[st.next] : undefined;
  return (
    <DeckCtx.Provider value={api}>
      <div className="pv">
        <header className="pv-bar">
          <strong className="pv-brand"><img src="/itsd-logo.png" alt="" />ITSD</strong><span className="pv-name">{st?.name ?? ""}</span><span className="grow" />
          <span className="pv-time" title="Time on stage. Click to pause or resume." onClick={() => setRun((v) => !v)}>{run ? "" : "⏸ "}{mmss(secs)}</span>
          <button onClick={() => { setSecs(0); setRun(true); }}>Reset timer</button>
          <span className="pv-clock">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          <button className="pv-end" onClick={() => send("end")}>End show</button>
        </header>
        {!st ? <p className="pv-wait">Waiting for the main ITSD window… (press F5 there)</p> : <>
          {!st.presenting && <p className="pv-wait">{ended ? "The presentation ended." : "Not presenting yet: press F5 in the main window."}</p>}
          <div className="pv-main">
            <section className="pv-cur">
              <div className="pv-lbl">Now · slide {cur?.label}</div>
              <div className="pv-frame">{cur && <Thumb src={cur.src} align={st.align} />}</div>
              <div className="pv-nav">
                <button onClick={() => send("prev")}>← Previous</button>
                <select value={st.idx} onChange={(e) => send("goto", +e.target.value)}>{st.slides.map((s, k) => <option key={k} value={k}>{s.label} {s.title}</option>)}</select>
                <button onClick={() => send("next")}>Next →</button>
              </div>
            </section>
            <aside className="pv-side">
              <div className="pv-lbl">Next{nxt ? ` · slide ${nxt.label}` : ""}</div>
              <div className="pv-frame small">{nxt ? <Thumb src={nxt.src} align={st.align} /> : <div className="pv-last">End of the show</div>}</div>
              {nxt && <div className="pv-nexttitle">{nxt.title}</div>}
              <div className="pv-lbl notes-h">Notes <span className="grow" /><button onClick={() => bigger(-3)} title="Smaller">A−</button><button onClick={() => bigger(3)} title="Bigger">A+</button></div>
              <div className="pv-notes" style={{ fontSize: size }}>{cur?.notes ? cur.notes : <em>No notes for this slide. Add them in the Notes box under the slide, or with ::: notes.</em>}</div>
            </aside>
          </div>
        </>}
      </div>
    </DeckCtx.Provider>
  );
}
