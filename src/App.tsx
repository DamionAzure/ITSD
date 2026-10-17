import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { MEDIA_EXT, VIDEO_EXT, AUDIO_EXT, isVideo } from "./mediaDef";
import { open, save } from "@tauri-apps/plugin-dialog";
import { parseDeck, type Deck, type Slide } from "./itsd";
import { DeckCtx, type DeckApi, type TraceData } from "./ctx";
import { addSlide, deleteSlide, duplicateSlide, moveSlide, setMeta, setSlideOpt, titleOf } from "./edit";
import { notesOf, setNotes } from "./notes";
import { NotesBox } from "./NotesBox";
import { openBus, openPresenter, closePresenter, type ToMain, type PState } from "./presenterBus";
import { createSound, BUILTIN_NAMES } from "./sound";
import { homeOf, makeTraceSlide, scanTraces } from "./traceBlock";
import { useSettings, settings, setSettings } from "./settings";
import { SettingsDialog } from "./SettingsDialog";
import { Dashboard } from "./Dashboard";
import { addRecent, wsInit, type WsInfo } from "./workspace";
import { splitTraceBlock } from "./traceEdit";
import { createPlayers } from "./tracePlayer";
import { runScript } from "./script";
import { lint } from "./lint";
import { bnum, branchEntry, branchNext, mainNext, mainPrev, labels as slideLabels, where } from "./branch";
import { parseExpr, truthy } from "./expr";
import { createInputs, fillRefs } from "./inputs";
import { SourceEditor, type EditorApi } from "./SourceEditor";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { beautifyDeck, beautifySlide } from "./beautifyDoc";
import { panelMenu, slideMenu } from "./slideMenu";
import { moveSmart } from "./slideOps";
import { Stage } from "./Stage";
import { VisualView } from "./Visual";
import { createAssets, isImagePath, IMG_EXT } from "./assets";
import { createTriggers } from "./triggers";
import { SNIPPETS } from "./snippets";
import { appendBlock, flashBlock } from "./flashEdit";
import type { Trigger } from "./flash";
import { backdropOf, scanImages } from "./images";
import { MODULES, effectGroups, fromModule, modulesVersion, subscribeModules } from "./modules/registry";
import { VendorDialog } from "./vendor/VendorDialog";
import { initVendors } from "./vendor/runtime";
import { SOURCES } from "./vendor/sources";
import { fxSnippet } from "./modules/fxEdit";
import { MenuBar, type Item } from "./MenuBar";
import { Outline } from "./Outline";
import { ContextBar, type Snippet } from "./ContextBar";
import { StatusBar } from "./StatusBar";
import { Manual } from "./Manual";
import { Wiki } from "./Wiki";
import { FONT_EXT, fontName, fontRefs, syncFonts } from "./fonts";
import { FAMILIES, resolveFamily } from "./format";
import { Icon } from "./icons";
import { TransitionsPanel } from "./TransitionsPanel";
import { AnimationsPanel } from "./AnimationsPanel";
import { addAnim, objectAt, removeAnim, swapAnim } from "./animOps";
import { TRANSITIONS, parseTransition, joinTransition } from "./transitions";
import { EFFECTS } from "./anim";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { checkForUpdate } from "./updater";

const filters = [{ name: "Interactive slide deck", extensions: ["itsd"] }];
const STARTER = "# New deck\n\nStart typing.\n\n---\n\n# Second slide\n";
const isAbs = (p: string) => /^([\\/]|[A-Za-z]:[\\/])/.test(p);
type Mode = "edit" | "visual";
type Prefs = { outline: boolean; source: boolean; canvas: boolean; notes: boolean; split: number };
const loadPrefs = (): Prefs => {
  const d = { outline: true, source: true, canvas: true, notes: true, split: 50 };
  try { return { ...d, ...JSON.parse(localStorage.getItem("itsd.layout") ?? "{}") }; } catch { return d; }
};

// Native window fullscreen; the browser Fullscreen API is unreliable inside some webviews, so it is only the fallback.
async function setWindowFs(on: boolean) {
  try { await getCurrentWindow().setFullscreen(on); }
  catch { if (on) document.documentElement.requestFullscreen?.().catch(() => {}); else if (document.fullscreenElement) document.exitFullscreen(); }
}

export default function App() {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState({ ln: 1, col: 1 });
  const [presenting, setPresenting] = useState(false);
  const [mobile, setMobile] = useState(false);
  const isMobileViewport = () => window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
  const [manual, setManual] = useState(false);
  const [wiki, setWiki] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [home, setHome] = useState(true); // the Home dashboard, over everything; closed when a deck is opened or a launch file arrives
  const wsInfo = useRef<WsInfo | null>(null);
  const st = useSettings();
  const [cssNote, setCssNote] = useState("");
  const [vendorOpen, setVendorOpen] = useState<string | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px), (pointer: coarse)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useSyncExternalStore(subscribeModules, modulesVersion); // menus and panels follow effects as they are downloaded
  useEffect(() => { initVendors(); }, []); // load what was downloaded in earlier sessions
  useEffect(() => { void checkForUpdate(false); }, []);
  const [mode, setMode] = useState<Mode>("edit");
  const [listed, setListed] = useState<string[]>([]); // image files in the deck's assets folder
  const [tools, setTools] = useState<Record<string, boolean>>({});
  const [traces, setTraces] = useState<Record<string, TraceData & { src: number; name: string }>>({}); // key: "<slide id>:<run block id>"
  const lastTrace = useRef("");
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [fs, setFs] = useState(true); // the window is created fullscreen (tauri.conf.json); F11 toggles
  const dir = useRef(1);
  const edits = useRef(new Map<string, string>());
  const inputs = useMemo(createInputs, []);
  const editor = useRef<EditorApi>(null);
  const deck = useMemo(() => parseDeck(text), [text]);
  const problems = useMemo(() => lint(text, deck), [text, deck]);
  // `::: trace from=id` blocks: which runs are shown on a slide of the author's own, and on which slide.
  const claims = useMemo(() => {
    const m = new Map<string, number>(); // run block id ("" = latest run) -> first slide number (1-based) with a block for it
    deck.slides.forEach((s, k) => scanTraces(s.src).forEach(({ def }) => { if (!m.has(def.from)) m.set(def.from, k + 1); }));
    return m;
  }, [deck]);
  // Source slides plus the trace slides generated by runs, spliced in after the slide that produced them (unless a trace block claims the run).
  const view = useMemo<Deck>(() => {
    const slides: Slide[] = [];
    const mine = new Map<number, (TraceData & { src: number; name: string })[]>();
    for (const [key, t] of Object.entries(st.traceSlide === "off" ? {} : traces)) {
      if ((t.name && claims.has(t.name)) || (claims.has("") && key === lastTrace.current)) continue;
      const home = t.name ? homeOf(deck.slides, t.name) : -1; // a named run is found by its id, so it follows its slide around
      const at = home >= 0 ? home : t.src;
      mine.set(at, [...(mine.get(at) ?? []), t]);
    }
    deck.slides.forEach((s) => {
      slides.push(s);
      for (const t of mine.get(s.id) ?? []) slides.push({ src: "", line: s.line, id: s.id, opts: s.opts.branch ? { branch: s.opts.branch } : {}, virtual: true, trace: { ...t, src: s.id } });
    });
    return { ...deck, slides };
  }, [deck, traces, claims, st.traceSlide]);
  const tracedIds = useMemo(() => Object.fromEntries(view.slides.filter((s) => s.virtual).map((s) => [s.id, true])), [view]);
  const cur = Math.min(idx, view.slides.length - 1);
  const dirty = text !== saved;
  const live = useRef({ deck, view, cur, text, path, presenting, dirty, fs, mode, traces, claims }); live.current = { deck, view, cur, text, path, presenting, dirty, fs, mode, traces, claims };

  useEffect(() => { try { localStorage.setItem("itsd.layout", JSON.stringify(prefs)); } catch { /* storage may be unavailable */ } }, [prefs]);

  const go = useCallback((n: number) => {
    const { view, cur } = live.current;
    n = Math.max(0, Math.min(n, view.slides.length - 1));
    if (n === cur) return;
    dir.current = n > cur ? 1 : -1;
    setIdx(n);
  }, []);
  const atLine = useCallback((line: number) => {
    let at = 0;
    live.current.view.slides.forEach((s, k) => { if (!s.virtual && s.line <= line) at = k; });
    go(at);
  }, [go]);

  // Branch slides (see branch.ts): the ordinary Next/Previous follow the main line; these reach into and out of a branch.
  const enterBranch = useCallback((n: number) => { const { view, cur } = live.current; const k = branchEntry(view.slides, cur, n); if (k !== undefined) go(k); }, [go]);
  const proceedBranch = useCallback(() => { const { view, cur } = live.current; if (bnum(view.slides[cur]) > 0) go(branchNext(view.slides, cur) ?? mainNext(view.slides, cur)); }, [go]);
  const leaveBranch = useCallback(() => { const { view, cur } = live.current; if (bnum(view.slides[cur]) > 0) go(mainPrev(view.slides, cur)); }, [go]);

  // Files named in a deck resolve next to the .itsd file (or are absolute).
  const resolveRef = (ref: string) => {
    if (isAbs(ref)) return ref;
    const base = live.current.path;
    if (!base) throw new Error("save the deck first so relative files can be found");
    return base.replace(/[^\\/]*$/, "") + ref;
  };
  const assets = useMemo(() => createAssets(async (ref) => invoke<ArrayBuffer>("read_binary", { path: resolveRef(ref) })), []);
  const triggers = useMemo(createTriggers, []);
  const sfx = useMemo(() => createSound({
    read: (p) => invoke<ArrayBuffer>("read_sound", { path: p }),
    list: (d) => invoke<string[]>("list_sounds", { dir: d }),
    resolve: resolveRef,
  }), []);
  useSyncExternalStore(sfx.subscribe, sfx.snapshot);
  const players = useMemo(() => createPlayers(sfx), [sfx]);
  const startedAt = useRef(Date.now()); // for the built-in `elapsed`
  const scriptOk = useRef<boolean | null>(null); // asked once per opened deck; scripts only run after a yes
  const scriptDepth = useRef(0);
  const api = useMemo<DeckApi>(() => {
    const input = (n: string) => inputs.get(n) ?? live.current.deck.inputs[n];
    // Built-in names for calculations, text and scripts: your own variable of the same name wins.
    const builtin = (n: string) => n === "slide" ? String((live.current.view.slides[live.current.cur]?.id ?? 0) + 1) : n === "slides" ? String(live.current.deck.slides.length) : n === "elapsed" ? String(Math.floor((Date.now() - startedAt.current) / 1000)) : undefined;
    const lookup = (n: string) => input(n) ?? builtin(n);
    return {
    assets,
    input, setInput: inputs.set, subscribe: inputs.subscribe, snapshot: inputs.snapshot,
    calc: (src) => parseExpr(src).eval(lookup),
    holds: (src) => { const e = parseExpr(src); if (e.impure) throw new Error("random() can't be used in a condition"); return truthy(e.eval(lookup)); },
    reset: (n) => (n ? inputs.unset(n) : inputs.clear()),
    fill: (t, html) => fillRefs(t, lookup, html),
    macro: (name) => live.current.deck.macros[name],
    runScript: async (name, args, act) => {
      const code = live.current.deck.scripts[name];
      if (code === undefined) { inputs.set("script_error", `There is no script called ${name}`); return; }
      if (settings().scripts === "deny") { inputs.set("script_error", "Scripts are switched off in Settings"); return; }
      if (settings().scripts === "allow") scriptOk.current = true;
      if (scriptOk.current === null) scriptOk.current = window.confirm("This deck contains scripts (JavaScript in a ::: script block).\n\nThey run in an isolated worker: no access to your files or the app, only to the deck's variables and actions. Even so, only allow scripts in decks you trust.\n\nAllow scripts for this deck?");
      if (!scriptOk.current || scriptDepth.current >= 4) return;
      scriptDepth.current++;
      try {
        const err = await runScript(code, args, {
          vars: () => ({ ...live.current.deck.inputs, ...inputs.snapshot(), ...Object.fromEntries(["slide", "slides", "elapsed"].map((n) => [n, builtin(n)!])) }),
          set: inputs.set, act, log: (t) => console.log(`[script ${name}]`, t),
        });
        inputs.set("script_error", err ?? "");
        if (err) console.error(`[script ${name}]`, err);
      } finally { scriptDepth.current--; }
    },
    firstVisit: (k) => triggers.firstVisit(k, live.current.presenting),
    armNext: triggers.armNext,
    presenting: () => live.current.presenting,
    getSource: (n) => live.current.deck.sources[n],
    readFile: async (ref) => {
      return invoke<string>("read_deck", { path: resolveRef(ref) });
    },
    goto: (n) => { const k = live.current.view.slides.findIndex((s) => !s.virtual && s.id === n - 1); if (k >= 0) go(k); },
    onTrace: (id, name, frames, code) => {
      const key = `${id}:${name}`, L = live.current;
      const sl = L.deck.slides[id];
      // A run that prints a trace and has no slide of its own yet gets a real, editable one (a branch slide), unless we are presenting.
      const claimed = L.claims.has(name) || (!name && L.claims.has(""));
      if (frames.length && settings().traceSlide === "branch" && !L.presenting && sl && !claimed) {
        const taken = new Set(L.deck.slides.flatMap((x) => [...x.src.matchAll(/\bid=(\w+)/g)].map((m) => m[1])));
        const r = makeTraceSlide(L.text, id, name, taken, "branch", settings().traceButton);
        const nm = r.name;
        lastTrace.current = `${id}:${nm}`;
        setTraces((t) => { const c = Object.fromEntries(Object.entries(t).filter(([k]) => k !== key)); c[`${id}:${nm}`] = { frames, code: code.text, lang: code.lang, src: id, name: nm }; return c; });
        editor.current?.replaceAll(r.text);
        return `trace slide ${slideLabels(parseDeck(r.text).slides)[r.at]} created: edit it like any slide`;
      }
      if (frames.length) lastTrace.current = key;
      setTraces((t) => { const c = { ...t }; if (frames.length) c[key] = { frames, code: code.text, lang: code.lang, src: id, name }; else delete c[key]; return c; });
    },
    trace: (from) => { const t = live.current.traces; return from ? Object.values(t).find((x) => x.name === from) : t[lastTrace.current]; },
    traceSlide: (from) => live.current.claims.get(from),
    makeTraceSlide: (src, name) => {
      const taken = new Set(live.current.deck.slides.flatMap((s) => [...s.src.matchAll(/\bid=(\w+)/g)].map((m) => m[1])));
      const r = makeTraceSlide(live.current.text, src, name, taken, settings().traceSlide === "branch" ? "branch" : "next", settings().traceButton);
      editor.current?.replaceAll(r.text); setTimeout(() => editor.current?.reveal(parseDeck(r.text).slides[r.at].line + 1), 60);
    },
    sound: sfx,
    tracePlayer: players,
    splitTrace: (id, blk) => commit(splitTraceBlock(live.current.text, id, blk)),
    branch: enterBranch, proceed: proceedBranch, back: leaveBranch,
    mediaUrl: async (ref) => { const p = resolveRef(ref); await invoke("allow_media", { path: p }); return convertFileSrc(p); },
    };
  }, [go, inputs, assets, sfx, enterBranch, proceedBranch, leaveBranch]);
  // Every Next (key or button) first offers the press to a waiting when-next flash region; otherwise it advances.
  // While presenting it follows the main line (branch slides are skipped); the editor's own Next button steps through every slide.
  const advance = () => { if (triggers.consumeNext()) return; const { view, cur, presenting } = live.current; go(presenting ? mainNext(view.slides, cur) : cur + 1); };

  const discardOk = () => !live.current.dirty || window.confirm("Discard unsaved changes?");
  const reset = () => { scriptOk.current = null; edits.current.clear(); inputs.clear(); setTraces({}); lastTrace.current = ""; setIdx(0); };
  const load = async (p: string) => { const t = await invoke<string>("read_deck", { path: p }); setText(t); setSaved(t); setPath(p); reset(); addRecent(p); };
  const openFromHome = async (p: string) => { if (!discardOk()) return; try { await load(p); setHome(false); if (isMobileViewport()) present(true, true); } catch (e) { window.alert(`Couldn't open ${p}: ${e}`); } };
  const pickFromHome = async () => { if (!discardOk()) return; const p = await open({ filters }); if (typeof p === "string") { await load(p); setHome(false); if (isMobileViewport()) present(true, true); } };
  const newDeck = () => { if (discardOk()) { setText(STARTER); setSaved(STARTER); setPath(null); reset(); } };
  const openDeck = async () => { if (!discardOk()) return; const p = await open({ filters }); if (typeof p === "string") await load(p); };
  const saveDeck = async (as = false) => {
    let p = as ? null : live.current.path;
    if (!p) p = await save({ defaultPath: wsInfo.current ? `${wsInfo.current.workspace}/Decks/talk.itsd` : "talk.itsd", filters });
    if (!p) return null;
    await invoke("write_deck", { path: p, content: live.current.text });
    setPath(p); live.current.path = p; setSaved(live.current.text); addRecent(p);
    return p;
  };
  // ---- pictures: files are copied into an assets folder next to the deck and referenced by relative path ----
  const refreshAssets = async (deckPath = live.current.path) => {
    setListed(deckPath ? await invoke<string[]>("list_assets", { deck: deckPath }).catch(() => []) : []);
  };
  const importPaths = async (paths: string[]): Promise<string[]> => {
    const files = paths.filter(isImagePath);
    if (!files.length) return [];
    // Relative references need a home, so an unsaved deck is saved first.
    const deckPath = live.current.path ?? (await saveDeck());
    if (!deckPath) return [];
    const refs: string[] = [];
    for (const src of files) {
      try { refs.push(await invoke<string>("import_asset", { deck: deckPath, src })); }
      catch (e) { window.alert(`Couldn't import ${src}: ${e}`); }
    }
    await refreshAssets(deckPath);
    return refs;
  };
  const pickImages = async () => {
    const r = await open({ multiple: true, filters: [{ name: "Images", extensions: IMG_EXT }] });
    return importPaths(r == null ? [] : Array.isArray(r) ? r : [r]);
  };
  const commit = (next: string) => { if (next !== live.current.text) editor.current?.replaceAll(next); };
  const media = useMemo(() => {
    const used = deck.slides.flatMap((s) => [...scanImages(s.src).map((i) => i.def.src), ...(backdropOf(s.opts).image ? [backdropOf(s.opts).image!] : [])]);
    return [...new Set([...listed, ...used])];
  }, [listed, deck]);

  const [side, setSide] = useState<null | "transitions" | "animations">(null);
  const openSide = (k: "transitions" | "animations") => { setSide(k); setPrefs((p) => (p.canvas ? p : { ...p, canvas: true })); };
  // Transitions: `transition:` and `duration:` live in the deck's frontmatter (whole deck) or in a slide's options comment (that slide).
  const applyTransition = (scope: "slide" | "deck" | "all", t: string | null, d: string | null) => {
    let txt = live.current.text; const id = live.current.view.slides[live.current.cur].id;
    if (scope === "slide") { txt = setSlideOpt(setSlideOpt(txt, id, "transition", t), id, "duration", d); }
    else {
      txt = setMeta(setMeta(txt, "transition", t), "duration", d);
      if (scope === "all") for (let k = parseDeck(txt).slides.length - 1; k >= 0; k--) txt = setSlideOpt(setSlideOpt(txt, k, "transition", null), k, "duration", null);
    }
    commit(txt);
  };
  const quickTransition = (t: string) => applyTransition("slide", t, live.current.view.slides[live.current.cur] ? (parseDeck(live.current.text).slides[live.current.view.slides[live.current.cur].id]?.opts.duration ?? null) : null);
  const present = (on: boolean, fromStart = false) => {
    if (on) { triggers.newRun(); inputs.clear(); startedAt.current = Date.now(); } // a new run of the presentation: at-start regions are fresh again, variables and input boxes are back to their defaults, the clock restarts
    if (on && fromStart) setIdx(0);
    setPresenting(on);
    if (!on && isMobileViewport()) setHome(true);
    if (on && settings().presenter) void openPresenter();
    if (!on) { bus.current?.send({ t: "end" }); void closePresenter(); }
    setWindowFs(on ? true : live.current.fs); // leaving Present returns to whatever the app was before
  };
  const toggleFs = () => { const v = !live.current.fs; setFs(v); if (!live.current.presenting) setWindowFs(v); };
  const toggle = (k: "outline" | "source" | "canvas") => setPrefs((p) => { const n = { ...p, [k]: !p[k] }; return !n.outline && !n.source && !n.canvas ? p : n; });
  // Slide operations rewrite the source through the editor, so Ctrl+Z undoes them. The cursor follows after the re-render.
  const land = (line: number) => setTimeout(() => editor.current?.reveal(line), 60);
  const addAfter = () => {
    const id = live.current.view.slides[live.current.cur].id;
    const next = addSlide(live.current.text, id);
    editor.current?.replaceAll(next); land(parseDeck(next).slides[id + 1].line + 1);
  };
  const dupSlide = (id: number) => {
    const next = duplicateSlide(live.current.text, id);
    editor.current?.replaceAll(next); land(parseDeck(next).slides[id + 1].line);
  };
  const delSlide = (id: number) => editor.current?.replaceAll(deleteSlide(live.current.text, id));

  // ---- Slides panel right-click menu, and beautifying the .itsd file ----
  const [slideMenuAt, setSlideMenuAt] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [note, setNote] = useState("");
  const noteTimer = useRef(0);
  const say = (m: string) => { setNote(m); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(""), 4000); };
  const slideClip = useRef<string | null>(null);
  const slideApi = () => ({
    deck: live.current.deck, text: () => live.current.text, note: say, clip: { get: () => slideClip.current, set: (v: string) => { slideClip.current = v; } },
    replace: (next: string, line?: number) => { editor.current?.replaceAll(next); if (line !== undefined) land(line + 1); },
    select: (id: number) => editor.current?.reveal(live.current.deck.slides[id].line),
  });
  const openSlideMenu = (e: React.MouseEvent, id: number | null) => {
    const api = slideApi();
    setSlideMenuAt({ x: e.clientX, y: e.clientY, items: id === null ? panelMenu(api) : slideMenu(api, id) });
  };
  const beautify = (scope: "deck" | "slide") => {
    const r = scope === "deck" ? beautifyDeck(live.current.text) : beautifySlide(live.current.text, live.current.view.slides[live.current.cur].id);
    if (r.changed) editor.current?.replaceAll(r.text);
    say(r.summary);
  };
  const setDeckOpt = (key: string, v: string | null) => editor.current?.replaceAll(setMeta(live.current.text, key, v));
  const setHereOpt = (key: string, v: string | null) => editor.current?.replaceAll(setSlideOpt(live.current.text, live.current.view.slides[live.current.cur].id, key, v));
  /** A setting that can be given to the whole deck or to just this slide. */
  const scoped = (key: string, label: string, values: string[]): Item => {
    const mine = view.slides[cur]?.opts[key], deckV = deck.meta[key];
    const list = (now: string | undefined, dflt: string, set: (v: string | null) => void): Item[] => [{ label: dflt, checked: !now, run: () => set(null) }, ...values.map((v): Item => ({ label: v, checked: now === v, run: () => set(v) }))];
    return { label, sub: [{ label: "Whole deck", sub: list(deckV, "Built-in default", (v) => setDeckOpt(key, v)) }, { label: "This slide", sub: list(mine, "Deck default", (v) => setHereOpt(key, v)) }] };
  };
  const moveHere = (d: "up" | "down") => { const id = live.current.view.slides[live.current.cur].id; const next = moveSmart(live.current.text, id, d); if (next !== live.current.text) editor.current?.replaceAll(next); };
  // In the Edit view a snippet goes at the cursor; in the Visual view there is no cursor, so it goes at the end of the slide.
  const put = (snip: string) => {
    if (live.current.mode === "visual") commit(appendBlock(live.current.text, live.current.view.slides[live.current.cur].id, snip));
    else editor.current?.insert(snip);
  };
  const insert = (k: Snippet) => (k === "slide" ? addAfter() : put(SNIPPETS[k]));
  // Video / audio: the file is copied into assets/ next to the deck (a copy on disk, not in memory) and a block pointing at it is inserted.
  const addMedia = async (kind: "video" | "audio") => {
    const r = await open({ filters: [{ name: kind === "video" ? "Video" : "Audio", extensions: kind === "video" ? VIDEO_EXT : AUDIO_EXT }] });
    if (typeof r !== "string") return;
    const deckPath = live.current.path ?? (await saveDeck()); if (!deckPath) return;
    try { const ref = await invoke<string>("import_media", { deck: deckPath, src: r }); put(`::: ${kind} "${ref}"\n\n`); }
    catch (e) { window.alert(`Couldn't add ${r}: ${e}`); }
  };
  void MEDIA_EXT; void isVideo;
  // The trace stylesheet from Settings: one <style> before the deck's own, read again when the window gets focus so edits in your editor show up.
  const loadTraceCss = useCallback(async () => {
    let el = document.getElementById("trace-style") as HTMLStyleElement | null;
    if (!el) { el = document.createElement("style"); el.id = "trace-style"; const d = document.getElementById("deck-style"); document.head.insertBefore(el, d); }
    const { traceCss, traceCssOn } = settings();
    if (!traceCss || !traceCssOn) { el.textContent = ""; setCssNote(""); return; }
    try { el.textContent = await invoke<string>("read_deck", { path: traceCss }); setCssNote(`loaded ${traceCss.split(/[\\/]/).pop()}`); }
    catch (e) { el.textContent = ""; setCssNote(`Couldn't read ${traceCss}: ${e}`); }
  }, []);
  useEffect(() => { void loadTraceCss(); }, [st.traceCss, st.traceCssOn, loadTraceCss]);
  useEffect(() => { const f = () => void loadTraceCss(); window.addEventListener("focus", f); return () => window.removeEventListener("focus", f); }, [loadTraceCss]);
  const pickTraceCss = async () => {
    const f = await open({ title: "Choose a CSS file for the trace", filters: [{ name: "Stylesheet", extensions: ["css"] }] });
    if (typeof f === "string") setSettings({ traceCss: f });
  };
  const pickSoundFolder = async () => {
    const d = await open({ directory: true, title: "Choose the folder that holds your sound effects" });
    if (typeof d === "string") await sfx.setFolder(d);
  };
  const insertFlash = (start: Trigger) => put(flashBlock({ id: "flash1", start }) + "\n\n");
  const onOpt = (key: string, value: string) => {
    const s = live.current.view.slides[live.current.cur];
    const next = setSlideOpt(live.current.text, s.id, key, value || null);
    if (next !== live.current.text) editor.current?.replaceAll(next);
  };
  // Relative picture paths mean something different once the deck lives somewhere else.
  useEffect(() => { assets.clear(); sfx.clearCache(); refreshAssets(path); }, [path]);
  const h = useRef({ advance, go, enterBranch, newDeck, openDeck, saveDeck, present, toggle, toggleFs }); h.current = { advance, go, enterBranch, newDeck, openDeck, saveDeck, present, toggle, toggleFs };

  const bus = useRef<ReturnType<typeof openBus<ToMain>> | null>(null);
  const pstate = (): PState => {
    const { view, cur, presenting, path } = live.current, lab = slideLabels(view.slides);
    return {
      slides: view.slides.map((s, k) => ({ src: s.src, title: s.virtual ? "Trace" : titleOf(s), label: lab[k] ?? String(k + 1), notes: s.virtual ? "" : notesOf(s.src), branch: bnum(s) > 0 })),
      idx: cur, next: mainNext(view.slides, cur), align: view.meta.align, path, presenting, name: path ? path.split(/[\\/]/).pop()! : "Untitled.itsd",
    };
  };
  useEffect(() => {
    bus.current = openBus<ToMain>((m) => {
      if (m.t !== "cmd") return;
      const L = live.current, f = h.current;
      if (m.cmd === "hello") bus.current?.send({ t: "state", s: pstate() });
      else if (!L.presenting) return;
      else if (m.cmd === "next") f.advance();
      else if (m.cmd === "prev") f.go(mainPrev(L.view.slides, L.cur));
      else if (m.cmd === "goto" && m.idx !== undefined) f.go(m.idx);
      else if (m.cmd === "end") f.present(false);
    });
    return () => bus.current?.close();
  }, []);
  useEffect(() => { bus.current?.send({ t: "state", s: pstate() }); }, [view, cur, presenting, path]);

  const dragSplit = (e: React.MouseEvent) => {
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const move = (ev: MouseEvent) => setPrefs((p) => ({ ...p, split: Math.max(20, Math.min(80, ((ev.clientX - box.left) / box.width) * 100)) }));
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };

  // Optional deck stylesheet: `style: deck.css` in the frontmatter, resolved next to the .itsd file.
  useEffect(() => {
    let el = document.getElementById("deck-style") as HTMLStyleElement | null;
    if (!el) { el = document.createElement("style"); el.id = "deck-style"; document.head.appendChild(el); }
    const f = deck.meta.style;
    if (!f) { el.textContent = ""; return; }
    api.readFile(f).then((t) => { el!.textContent = t; }).catch(() => { el!.textContent = ""; });
  }, [deck.meta.style, path]);

  useEffect(() => {
    (async () => {
      setTools(await invoke<Record<string, boolean>>("check_toolchains").catch(() => ({})));
      if (!settings().homeAtStart) setHome(false);
      void wsInit(settings().workspace).then((i) => { // the ITSD folder exists from the first start; its Sounds folder is the sound folder until you choose another
        wsInfo.current = i;
        try { if (!sfx.folder && !localStorage.getItem("itsd.sfx.auto")) { localStorage.setItem("itsd.sfx.auto", "1"); void sfx.setFolder(`${i.workspace}/Sounds`); } } catch { /* storage may be unavailable */ }
      }).catch(() => {});
      const launch = await invoke<string | null>("launch_file").catch(() => null);
      if (launch) { await load(launch); setHome(false); if (isMobileViewport()) present(true, true); }
      else { const t = await fetch("/demo.itsd").then((r) => r.text()).catch(() => STARTER); setText(t); setSaved(t); }
    })();
    const onKey = (e: KeyboardEvent) => {
      const typing = !!(e.target as HTMLElement).closest?.(".monaco-editor, input, select");
      const { go, advance, enterBranch, newDeck, openDeck, saveDeck, present, toggle, toggleFs } = h.current;
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && k === "s") { e.preventDefault(); saveDeck(e.shiftKey); }
      else if (mod && k === "o") { e.preventDefault(); openDeck(); }
      else if (mod && k === "n") { e.preventDefault(); newDeck(); }
      else if (mod && k === "z" && live.current.mode === "visual" && !live.current.presenting && !typing) { e.preventDefault(); e.shiftKey ? editor.current?.redo() : editor.current?.undo(); }
      else if (mod && k === "y" && live.current.mode === "visual" && !live.current.presenting && !typing) { e.preventDefault(); editor.current?.redo(); }
      else if (mod && e.shiftKey && k === "h") { e.preventDefault(); setHome((v) => !v); }
      else if (mod && k === ",") { e.preventDefault(); setSettingsOpen((v) => !v); }
      else if (mod && k === "b") { e.preventDefault(); toggle("outline"); }
      else if (e.key === "F2" && !live.current.presenting) { e.preventDefault(); setWiki((v) => !v); }
      else if (e.key === "F1" && !live.current.presenting) { e.preventDefault(); setManual((v) => !v); }
      else if (e.key === "F11") { e.preventDefault(); toggleFs(); }
      else if (e.key === "F5") { e.preventDefault(); present(!live.current.presenting, e.shiftKey); }
      else if (live.current.presenting && e.key === "Escape") { typing ? (document.activeElement as HTMLElement)?.blur() : present(false); }
      else if (live.current.presenting && !typing) {
        if (mod) { // Ctrl+Right / Ctrl+Enter / Ctrl+Space: branch 1 / 2 / 3 of this slide
          const n = ({ ArrowRight: 1, Enter: 2, " ": 3 } as Record<string, number>)[e.key];
          if (n) { e.preventDefault(); enterBranch(n); }
        } else {
          if (["ArrowRight", "PageDown", " "].includes(e.key)) advance();
          if (["ArrowLeft", "PageUp"].includes(e.key)) go(mainPrev(live.current.view.slides, live.current.cur));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- fonts: files copied into assets/fonts and listed in the frontmatter (`fonts:`), plus deck and slide font choices ----
  const addFont = async (): Promise<string[]> => {
    const r = await open({ multiple: true, filters: [{ name: "Fonts", extensions: FONT_EXT }] });
    const files = r == null ? [] : Array.isArray(r) ? r : [r];
    if (!files.length) return [];
    const deckPath = live.current.path ?? (await saveDeck()); // relative references need a home, so an unsaved deck is saved first
    if (!deckPath) return [];
    const refs: string[] = [];
    for (const src of files) {
      try { refs.push(await invoke<string>("import_font", { deck: deckPath, src })); }
      catch (e) { window.alert(`Couldn't add ${src}: ${e}`); }
    }
    await refreshAssets(deckPath);
    const have = fontRefs(parseDeck(live.current.text).meta), next = [...have, ...refs.filter((x) => !have.includes(x))];
    if (refs.length) commit(setMeta(live.current.text, "fonts", next.join(", ")));
    return refs;
  };
  const [sysFonts, setSysFonts] = useState<string[]>([]);
  useEffect(() => { invoke<string[]>("list_system_fonts").then((r) => setSysFonts(Array.isArray(r) ? r : [])).catch(() => {}); }, []);
  const fontsHere = fontRefs(deck.meta).map(fontName);
  useEffect(() => { void syncFonts(fontRefs(deck.meta), assets); }, [deck.meta.fonts, path, assets]);
  useEffect(() => {
    const r = document.documentElement.style, set = (k: string, v?: string) => (v ? r.setProperty(k, v) : r.removeProperty(k));
    set("--body-font", resolveFamily(deck.meta.font)); set("--head-font", resolveFamily(deck.meta.headingfont)); set("--code-font", resolveFamily(deck.meta.codefont));
  }, [deck.meta.font, deck.meta.headingfont, deck.meta.codefont]);
  const slideId = view.slides[cur]?.id ?? 0;
  /** The font choices for one role (body / heading / code), as menu items, applied to the whole deck or to this slide. */
  const fontItems = (key: "font" | "headingfont" | "codefont", scope: "deck" | "slide"): Item[] => {
    const cur_ = scope === "deck" ? deck.meta[key] : view.slides[cur] && deck.slides[Math.min(view.slides[cur].id, deck.slides.length - 1)]?.opts[key];
    const pick = (v: string | null) => commit(scope === "deck" ? setMeta(live.current.text, key, v) : setSlideOpt(live.current.text, slideId, key, v));
    const same = (v: string) => (cur_ ?? "").trim().toLowerCase() === v.toLowerCase();
    return [
      { label: scope === "deck" ? "Default" : "Same as the deck", checked: !cur_, run: () => pick(null) },
      ...FAMILIES.slice(1).map((o): Item => ({ label: o.label, checked: same(o.label), run: () => pick(o.label) })),
      ...(fontsHere.length ? ["-" as const, ...fontsHere.map((n): Item => ({ label: n, checked: same(n), run: () => pick(n) }))] : []),
      ...(sysFonts.length ? [{ label: "Installed fonts", scroll: true, sub: sysFonts.map((n): Item => ({ label: n, checked: same(n), run: () => pick(n) })) } as Item] : []),
      "-", { label: "Add font file…", run: () => { void addFont().then((r) => r[0] && pick(fontName(r[0]))); } },
    ];
  };
  const fontMenu = (scope: "deck" | "slide"): Item[] => [
    { label: "Body text", sub: fontItems("font", scope) }, { label: "Headings", sub: fontItems("headingfont", scope) }, { label: "Code", sub: fontItems("codefont", scope) },
  ];

  const here = view.slides[cur];
  const srcSlide = deck.slides[Math.min(here.id, deck.slides.length - 1)];
  const menus: { name: string; items: Item[]; run?: () => void; on?: boolean; title?: string }[] = [
    { name: "Home", items: [], run: () => setHome((v) => !v), on: home, title: "Your decks and templates (Ctrl+Shift+H)" },
    { name: "File", items: [
      { label: "New", hint: "Ctrl+N", run: newDeck }, { label: "Open…", hint: "Ctrl+O", run: openDeck }, "-",
      { label: "Home", hint: "Ctrl+Shift+H", run: () => setHome(true) }, "-",
      { label: "Save", hint: "Ctrl+S", run: () => saveDeck() }, { label: "Save As…", hint: "Ctrl+Shift+S", run: () => saveDeck(true) }, "-",
      { label: "Settings…", hint: "Ctrl+,", run: () => setSettingsOpen(true) }] },
    { name: "Insert", items: [
      { label: "Slide", run: () => insert("slide") }, { label: "Code block", run: () => insert("code") },
      { label: "Button", run: () => insert("button") }, { label: "Sound button", run: () => insert("sound") },
      { label: "Script", sub: [
        { label: "Event rule (on key / enter / change)", run: () => insert("on") }, { label: "Macro (reusable actions)", run: () => insert("macro") }, { label: "JavaScript block", run: () => insert("script") }] },
      { label: "Trace (separate parts)", run: () => insert("trace") }, { label: "Trace (one block)", run: () => insert("traceOne") },
      { label: "Video…", run: () => void addMedia("video") }, { label: "Audio…", run: () => void addMedia("audio") }, { label: "Input box", run: () => insert("input") }, { label: "Speaker notes", run: () => insert("notes") }, { label: "Hidden source", run: () => insert("source") }, "-",
      { label: "Action (on Next)", run: () => put("<!-- @on next: rotate this 90 -> fade this 0.5 -->\n") },
      { label: "Flash region", sub: [
        { label: "Starts every time I arrive", run: () => insertFlash("new-slide") }, { label: "Starts the first time only", run: () => insertFlash("at-start") },
        { label: "Starts when I press Next", run: () => insertFlash("when-next") }, { label: "Starts from a button or click", run: () => insertFlash("manual") }] },
      ...(effectGroups().length ? [{ label: "Effect", sub: effectGroups().map((g): Item => ({ label: g.label, sub: g.entries.map((e): Item => ({ label: e.effect.label, hint: fromModule(e), run: () => put(fxSnippet(e.full) + "\n\n") })) })) } as Item] : [])] },
    { name: "Format", items: [
      { label: "Beautify deck", hint: "Shift+Alt+F", run: () => beautify("deck") },
      { label: "Beautify this slide", run: () => beautify("slide") }, "-",
      { label: "Transition…", run: () => openSide("transitions") }, scoped("reveal", "Reveal", ["stagger", "none"]), scoped("align", "Align text", ["left", "center", "right", "justify"]), "-",
      { label: "Fonts for the whole deck", sub: fontMenu("deck") }, { label: "Fonts for this slide", sub: fontMenu("slide") },
      { label: "Add font file…", run: () => { void addFont(); } }, "-",
      { label: "This slide", sub: [
        { label: "Move up", run: () => moveHere("up") }, { label: "Move down", run: () => moveHere("down") },
        { label: "Reset its settings to the deck's", run: () => { let t = live.current.text; const id = live.current.view.slides[live.current.cur].id; for (const k of ["transition", "reveal", "align"]) t = setSlideOpt(t, id, k, null); editor.current?.replaceAll(t); } }] },
      { label: "Text styling: right-click in the Source pane", hint: "" }] },
    { name: "Transitions", items: [
      { label: "Transitions panel…", run: () => openSide("transitions") }, "-",
      ...(["Subtle", "Exciting", "Dynamic"] as const).map((g): Item => ({ label: g, sub: TRANSITIONS.filter((t) => t.group === g).map((t): Item => ({ label: t.label, hint: t.hint.length < 30 ? t.hint : "", checked: parseTransition(srcSlide.opts.transition ?? deck.meta.transition).id === t.id, run: () => quickTransition(t.dirs ? joinTransition(t.id, "left") : t.id) })) })), "-",
      { label: "Duration", sub: ["0.3", "0.5", "0.8", "1.2", "2"].map((v): Item => ({ label: `${v} s`, checked: (srcSlide.opts.duration ?? deck.meta.duration) === v, run: () => applyTransition("slide", srcSlide.opts.transition ?? null, v) })) },
      { label: "Apply this slide's to all slides", run: () => applyTransition("all", srcSlide.opts.transition ?? deck.meta.transition ?? null, srcSlide.opts.duration ?? deck.meta.duration ?? null) },
      { label: "Use the deck's transition on this slide", run: () => applyTransition("slide", null, null) }] },
    { name: "Animations", items: [
      { label: "Animation pane…", run: () => openSide("animations") }, "-",
      ...(["entrance", "emphasis", "exit"] as const).map((k): Item => ({ label: k[0].toUpperCase() + k.slice(1), sub: EFFECTS.filter((e) => e.kind === k).map((e): Item => ({ label: e.label, run: () => {
        const ln = pos.ln - 1, id = live.current.view.slides[live.current.cur].id;
        commit(addAnim(live.current.text, id, objectAt(live.current.text, id, ln), { effect: e.id, dir: e.dirs ? e.defDir : "", dur: e.dur, delay: 0, start: "click" })); } })) }))] },
    { name: "View", items: [
      { label: "Edit view", checked: mode === "edit", run: () => setMode("edit") },
      { label: "Visual view", checked: mode === "visual", run: () => setMode("visual") }, "-",
      { label: "Slides panel", hint: "Ctrl+B", checked: prefs.outline, run: () => toggle("outline") },
      { label: "Source", checked: prefs.source, run: () => toggle("source") },
      { label: "Canvas", checked: prefs.canvas, run: () => toggle("canvas") }, "-",
      { label: "Speaker notes box", checked: prefs.notes, run: () => setPrefs((p) => ({ ...p, notes: !p.notes })) }, "-",
      { label: "Full screen", hint: "F11", checked: fs, run: toggleFs }] },
    { name: "Present", items: [
      { label: "From current slide", hint: "F5", run: () => present(true) },
      { label: "From first slide", hint: "Shift+F5", run: () => present(true, true) }, "-",
      { label: "Presenter View (notes, next slide, timer)", checked: st.presenter, run: () => setSettings({ presenter: !st.presenter }) }] },
    { name: "Vendor", items: [
      ...SOURCES.map((s): Item => ({ label: `${s.name}…`, run: () => setVendorOpen(s.id) }))] },
    { name: "Sound", items: [
      { label: "Set sound folder…", run: pickSoundFolder },
      { label: sfx.folder ? `Folder: ${sfx.folder}` : "No folder set (built-in sounds only)" },
      ...(sfx.folder ? [{ label: `Reload folder (${sfx.files.length} sounds)`, run: () => void sfx.refresh() }, { label: "Forget folder", run: () => void sfx.setFolder(null) } as Item] : []), "-",
      { label: "Volume", sub: [["Full", 1], ["70%", 0.7], ["40%", 0.4], ["Muted", 0]].map(([l, v]): Item => ({ label: l as string, checked: Math.abs(sfx.volume - (v as number)) < 0.01, run: () => sfx.setVolume(v as number) })) },
      { label: "Try a built-in sound", sub: BUILTIN_NAMES.map((n): Item => ({ label: n, run: () => void sfx.play(n) })) },
      ...(sfx.files.length ? [{ label: "Try a sound from the folder", sub: sfx.files.slice(0, 60).map((f): Item => ({ label: f, run: () => void sfx.play(f) })) } as Item] : [])] },
    { name: "Help", items: [{ label: "Wiki: where is everything?", hint: "F2", run: () => setWiki(true) }, { label: "Check for Updates…", run: () => void checkForUpdate(true) }, { label: "Manual", hint: "F1", run: () => setManual(true) }] },
  ];

  const wikiActions: Record<string, (arg?: string) => void> = {
    newDeck: () => newDeck(), openDeck: () => openDeck(), home: () => setHome(true), manual: () => setManual(true), settings: () => setSettingsOpen(true),
    visual: () => { setHome(false); setMode("visual"); }, edit: () => { setHome(false); setMode("edit"); },
    newSlide: () => { setHome(false); addAfter(); }, panelSlides: () => { setHome(false); toggle("outline"); }, fullscreen: () => toggleFs(),
    transitions: () => { setHome(false); setMode("edit"); openSide("transitions"); }, animations: () => { setHome(false); setMode("edit"); openSide("animations"); },
    beautify: () => { setHome(false); beautify("deck"); }, addFont: () => { void addFont(); }, soundFolder: () => { void pickSoundFolder(); },
    present: () => { setHome(false); present(true); }, format: () => setHome(false),
    vendor: (a) => setVendorOpen(a ?? SOURCES[0].id),
    insert: (a) => { setHome(false); setMode("edit"); if (a === "next") put("<!-- @on next: rotate this 90 -> fade this 0.5 -->\n"); else insert(a as Snippet); },
  };
  const runWiki = (key: string) => { const [k, arg] = key.split(":"); wikiActions[k]?.(arg); };

  const name = path ? path.split(/[\\/]/).pop() : "Untitled.itsd";
  const count = where(view.slides, cur);
  const stripBtn = (k: "outline" | "source" | "canvas", icon: "slides" | "source" | "canvas", label: string) => (
    <button className={prefs[k] ? "on" : ""} title={label} onClick={() => toggle(k)}><Icon n={icon} /></button>
  );

  const touchStart = useRef<number | null>(null);
  const touchEnd = (x: number) => {
    if (!mobile || touchStart.current === null) return;
    const delta = x - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < 45) return;
    if (delta < 0) advance(); else go(mainPrev(view.slides, cur));
  };

  return (
    <DeckCtx.Provider value={api}>
      <div className="shell" hidden={presenting || mobile}>
        <MenuBar menus={menus} right={
          <div className="seg">
            <button className={mode === "edit" ? "on" : ""} onClick={() => setMode("edit")}>Edit</button>
            <button className={mode === "visual" ? "on" : ""} onClick={() => setMode("visual")}>Visual</button>
            <button onClick={() => present(true)}>Present</button>
          </div>} />
        <ContextBar onPanel={openSide} deckTransition={deck.meta.transition} slide={srcSlide} sounds={sfx.names()} onPreview={(n) => void sfx.play(n)} onOpt={onOpt} onInsert={insert} visual={mode === "visual"}
          onUndo={() => editor.current?.undo()} onRedo={() => editor.current?.redo()} />
        <div className="work">
          <nav className="strip">{stripBtn("outline", "slides", "Slides (Ctrl+B)")}{mode === "edit" && <>{stripBtn("source", "source", "Source")}{stripBtn("canvas", "canvas", "Canvas")}</>}</nav>
          {prefs.outline && (
            <Outline grid={!prefs.source && !prefs.canvas} deck={deck} labels={slideLabels(deck.slides)} activeId={here.id} traced={tracedIds} onSelect={(s) => editor.current?.reveal(s.line)}
              onMove={(a, b) => editor.current?.replaceAll(moveSlide(live.current.text, a, b))}
              onAdd={addAfter} onDup={dupSlide} onDel={delSlide} onMenu={openSlideMenu} />
          )}
          <div className="docs" hidden={mode === "visual"}>
            <div className="tabs"><div className="tab">{name}{dirty && <i className="dot" />}</div></div>
            <div className="panes">
              <div className="pane" style={{ width: prefs.canvas ? `${prefs.split}%` : "100%" }} hidden={!prefs.source}>
                <SourceEditor ref={editor} onBeautify={() => beautify("deck")} value={text} problems={problems} onSave={() => saveDeck()} fonts={fontsHere} system={sysFonts} onAddFont={() => { void addFont(); }}
                  onChange={(v) => { edits.current.clear(); setTraces((t) => Object.fromEntries(Object.entries(t).filter(([, x]) => x.name))); setText(v); }}
                  onCursor={(l, c) => { setPos({ ln: l + 1, col: c }); atLine(l); }} />
              </div>
              {prefs.source && prefs.canvas && <div className="divider" onMouseDown={dragSplit} />}
              <div className="pane canvas" hidden={!prefs.canvas}>
                <div className="fit">
                  {!presenting && <Stage deck={view} idx={cur} dir={dir.current} tools={tools} edits={edits.current} />}
                  <div className="nav">
                    <button onClick={() => go(cur - 1)}>Previous</button><span>{count}</span><button onClick={() => advance()}>Next</button>
                  </div>
                  {prefs.notes && <NotesBox slideId={srcSlide.id} value={notesOf(srcSlide.src)} onCommit={(v) => commit(setNotes(live.current.text, srcSlide.id, v))} />}
                </div>
              </div>
            </div>
          </div>
          {side === "transitions" && <TransitionsPanel slideNo={srcSlide.id + 1} slideTransition={srcSlide.opts.transition} slideDuration={srcSlide.opts.duration} deckTransition={deck.meta.transition} deckDuration={deck.meta.duration} onApply={applyTransition} onClose={() => setSide(null)} />}
          {side === "animations" && <AnimationsPanel text={text} slideId={srcSlide.id} slideNo={srcSlide.id + 1} cursorLine={pos.ln - 1 - srcSlide.line}
            onAdd={(index, o) => commit(addAnim(live.current.text, srcSlide.id, index, o))} onRemove={(l) => commit(removeAnim(live.current.text, l))} onSwap={(a, b) => commit(swapAnim(live.current.text, a, b))}
            onJump={(l) => editor.current?.reveal(l)} onClose={() => setSide(null)} />}
          {mode === "visual" && (
            <VisualView deck={deck} slide={srcSlide} onSlide={(id) => editor.current?.reveal(deck.slides[id].line)}
              text={text} commit={commit} undo={() => editor.current?.undo()} redo={() => editor.current?.redo()}
              media={media} importPaths={importPaths} pickImages={pickImages} tools={tools} edits={edits.current} />
          )}
        </div>
        <StatusBar dirty={dirty} path={path} tools={tools} problems={problems} ln={pos.ln} col={pos.col} cur={cur + 1} total={view.slides.length} note={note} />
      </div>
      {presenting && (
        <div id="stage" className={mobile ? "mobile-stage" : ""} onTouchStart={(e) => { touchStart.current = e.changedTouches[0]?.clientX ?? null; }} onTouchEnd={(e) => touchEnd(e.changedTouches[0]?.clientX ?? 0)}>
          <Stage deck={view} idx={cur} dir={dir.current} tools={tools} edits={edits.current} />
          <div id="hud">{count}</div>
          {mobile && <div className="mobile-present-controls">
            <button onClick={() => go(mainPrev(view.slides, cur))} aria-label="Previous slide">‹</button>
            <span>{count}</span>
            <button onClick={() => advance()} aria-label="Next slide">›</button>
            <button className="mobile-present-exit" onClick={() => present(false)} aria-label="End presentation">×</button>
          </div>}
        </div>
      )}
    {slideMenuAt && <ContextMenu x={slideMenuAt.x} y={slideMenuAt.y} items={slideMenuAt.items} onClose={() => setSlideMenuAt(null)} />}
    {vendorOpen && <VendorDialog sourceId={vendorOpen} onClose={() => setVendorOpen(null)} />}
      {wiki && <Wiki onClose={() => setWiki(false)} go={runWiki} can={(k) => k in wikiActions} onManual={() => { setWiki(false); setManual(true); }} />}
      {home && !presenting && <Dashboard canClose={!mobile} onClose={() => setHome(false)} onOpen={(p) => void openFromHome(p)} onOpenFile={() => void pickFromHome()} onSettings={() => setSettingsOpen(true)} onManual={() => setManual(true)} />}
      {manual && <Manual onClose={() => setManual(false)} />}
      {settingsOpen && <SettingsDialog sfx={sfx} onClose={() => setSettingsOpen(false)} pickFolder={pickSoundFolder} pickCss={pickTraceCss} cssNote={cssNote} onReloadCss={() => void loadTraceCss()} />}
    </DeckCtx.Provider>
  );
}
