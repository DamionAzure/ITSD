import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { DeckCtx } from "../../ctx";
import { useMediaUrl } from "../../media";
import { fmtTime, nextTime, parseBoard, prevTime, rankTeams, standingsAt, varName, type Ev } from "./data";
import "./board.css";

interface Props {
  children?: string;   // the score log, written inside the ::: wrap block
  src?: string;        // or a text file next to the deck holding the log
  title?: string;
  video?: string;      // a video file next to the deck (e.g. assets/game.mp4): the board follows its clock
  offset?: number;     // video time (seconds) that counts as 0:00 on the score log
  speed?: number;      // replay speed when there is no video
  start?: "begin" | "end"; // end = show the final standings at once (the static version)
  sorted?: boolean;    // sort rows by score (they slide into place); off keeps the team order
  autoplay?: boolean;  // start the replay by itself
  keys?: boolean;      // while presenting, the Next key steps one update before moving on to the next slide
  live?: boolean;      // scores are deck variables (one per team) that buttons change: `add Alpha 3`. The log only supplies the teams
  // look (see FORMAT.md): every one is optional; a preset sets the defaults and these override it
  look?: string; accent?: string; bg?: string; rowbg?: string; text?: string; border?: string; bar?: string; gain?: string; colors?: string[];
  teamcolor?: string; bars?: string; rank?: string; hot?: string; leader?: string; font?: string; case?: string; titlealign?: string; shadow?: string;
  size?: number; rowh?: number; gap?: number; radius?: number; pad?: number; width?: number; bw?: number; top?: number; anim?: number;
  prefix?: string; suffix?: string; head?: boolean; clock?: boolean; delta?: boolean; step?: boolean; controls?: string;
}

const label = (e: Pick<Ev, "op" | "v">) => (e.op === "add" ? (e.v >= 0 ? `+${e.v}` : `${e.v}`) : `= ${e.v}`);
const SPEEDS = [0.5, 1, 2, 4, 8];

const FONTS: Record<string, string> = {
  sans: "system-ui, 'Segoe UI', sans-serif", serif: "var(--serif, Georgia, serif)", mono: "var(--mono, ui-monospace, monospace)",
  rounded: "'Nunito', 'Varela Round', ui-rounded, system-ui, sans-serif", condensed: "'Arial Narrow', 'Roboto Condensed', 'Segoe UI', sans-serif",
};
const LOOKS = ["classic", "minimal", "broadcast", "neon", "retro", "glass", "paper"];
const pos = (v: number | undefined, d: number, min = 0.1, max = 6) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);

export default function Scoreboard({ children, src, title, video, offset = 0, speed: sp = 1, start = "begin", sorted = true, autoplay = false, keys = false, live = false,
  look = "classic", accent, bg, rowbg, text: textColor, border, bar, gain, colors, teamcolor = "bar", bars = "fill", rank: rankStyle = "circle", hot = "border", leader = "badge",
  font = "default", case: cased = "normal", titlealign = "left", shadow = "none", size, rowh, gap, radius, pad, width, bw, top = 0, anim, prefix = "", suffix = "",
  head = true, clock: showClock = true, delta: showDelta = true, step: showStep = true, controls = "full" }: Props) {
  const api = useContext(DeckCtx);
  const [file, setFile] = useState<string>();
  useEffect(() => { setFile(undefined); if (src) api.readFile(src).then(setFile).catch(() => setFile("")); }, [src, api]);
  const text = src && file !== undefined ? file : typeof children === "string" ? children : "";
  const board = useMemo(() => parseBoard(text), [text]);

  const [t, setT] = useState(start === "end" ? Infinity : 0);
  const [playing, setPlaying] = useState(autoplay && !video);
  const [speed, setSpeed] = useState(sp);
  const [sort, setSort] = useState(sorted);
  const tRef = useRef(t);
  const clock = Math.min(t, board.end); // "end" is stored as Infinity so it follows a log that is still loading
  // Live mode: every team's score is a deck variable, so buttons (`add Alpha 3`) and {{Alpha}} references see the same number.
  useSyncExternalStore(api.subscribe, api.snapshot);
  const liveScores = new Map(board.teams.map((n) => { const x = parseFloat(api.input(varName(n)) ?? ""); return [n, Number.isFinite(x) ? x : 0] as [string, number]; }));
  const prevLive = useRef<Map<string, number> | undefined>(undefined);
  const lastLive = useRef<{ team: string; d: number; n: number }>({ team: "", d: 0, n: 0 });
  if (live) {
    if (prevLive.current) for (const [n, v] of liveScores) { const o = prevLive.current.get(n); if (o !== undefined && o !== v) lastLive.current = { team: n, d: v - o, n: lastLive.current.n + 1 }; }
    prevLive.current = liveScores;
  }
  const snap = useMemo(() => (live ? { ...rankTeams(board.teams, liveScores), idx: lastLive.current.n - 1 } : standingsAt(board, clock)), [live, board, clock, api.snapshot()]);
  const goto = (x: number) => { tRef.current = x; setT(x); };

  // Replay clock (no video): advances the time with the real clock.
  useEffect(() => {
    if (!playing || video) return;
    let raf = 0, last = performance.now();
    tRef.current = Math.min(tRef.current, board.end);
    if (tRef.current >= board.end) tRef.current = 0;
    const tick = (now: number) => {
      tRef.current = Math.min(board.end, tRef.current + ((now - last) / 1000) * speed); last = now;
      setT(tRef.current);
      if (tRef.current >= board.end) setPlaying(false); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, video, board.end]);

  // Video clock: the numbers are read off the video's own position, so scrubbing, pausing and replaying all stay in step.
  const { url: vurl, missing, onError } = useMediaUrl(video); // streamed from disk, not held in memory
  const vid = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = vid.current; if (!v || !vurl) return;
    let raf = 0;
    const sync = () => goto(Math.round(Math.max(0, v.currentTime - offset) * 20) / 20);
    const loop = () => { sync(); raf = requestAnimationFrame(loop); };
    const go = () => { cancelAnimationFrame(raf); loop(); };
    const stop = () => { cancelAnimationFrame(raf); sync(); };
    const on: [string, () => void][] = [["play", go], ["pause", stop], ["ended", stop], ["seeked", sync], ["loadedmetadata", sync]];
    on.forEach(([n, f]) => v.addEventListener(n, f));
    if (!v.paused) go();
    return () => { cancelAnimationFrame(raf); on.forEach(([n, f]) => v.removeEventListener(n, f)); };
  }, [vurl, offset]);

  // keys: while presenting, each Next press shows the next update; once all are shown, Next moves on to the next slide.
  const more = nextTime(board, clock) !== undefined;
  useEffect(() => {
    if (!keys || video || !more) return;
    return api.armNext(() => { setPlaying(false); const n = nextTime(board, Math.min(tRef.current, board.end)); if (n !== undefined) goto(n); });
  }, [keys, video, more, board, clock, api]);

  const last = live ? (lastLive.current.n ? { team: lastLive.current.team, op: "add" as const, v: lastLive.current.d } : undefined)
    : snap.idx >= 0 ? board.events[snap.idx] : undefined;
  const n = snap.rows.length;
  const gone = video && !vurl && missing;
  const warn = board.problems.length && !api.presenting() ? board.problems.slice(0, 2).join(" · ") : "";
  const shown = top > 0 ? Math.min(n, Math.floor(top)) : n; // top=3: only the first three rows are visible
  const style = { "--n": shown } as CSSProperties;
  const lk = LOOKS.includes(look) ? look : "classic";
  const v: Record<string, string | number> = {};
  if (accent) v["--sb-accent"] = accent; if (bg) v["--sb-bg"] = bg; if (rowbg) v["--sb-row-bg"] = rowbg; if (textColor) v["--sb-text"] = textColor;
  if (border) v["--sb-line"] = border; if (bar) v["--sb-bar"] = bar; if (gain) v["--sb-gain"] = gain;
  if (size !== undefined) v["--sz"] = pos(size, 1, 0.3, 4); if (rowh !== undefined) v["--rh"] = pos(rowh, 1, 0.4, 3); if (gap !== undefined) v["--gp"] = pos(gap, 1, 0, 8);
  if (radius !== undefined) v["--rd"] = pos(radius, 1, 0, 8); if (pad !== undefined) v["--pd"] = pos(pad, 1, 0, 6); if (bw !== undefined) v["--bw"] = pos(bw, 1, 0, 8);
  if (anim !== undefined) v["--an"] = pos(anim, 1, 0, 6);
  if (width !== undefined) v.width = `${pos(width, 100, 20, 100)}%`;
  if (font !== "default" && FONTS[font]) v["--sb-font"] = FONTS[font];
  const cls = ["sb", `look-${lk}`, `rk-${rankStyle}`, `bars-${bars}`, `hot-${hot}`, `tc-${colors?.length ? teamcolor : "off"}`, `ld-${leader}`, cased === "upper" ? "upper" : "", shadow !== "none" ? `sh-${shadow}` : "", anim === 0 ? "noanim" : ""].filter(Boolean).join(" ");
  const fmt = (x: number) => `${prefix}${x}${suffix}`;
  const tcol = (team: string) => colors?.length ? colors[board.teams.indexOf(team) % colors.length] : undefined;

  const board_ = (
    <div className="sb-main">
      {(head || showClock) && <div className={"sb-head ta-" + titlealign}>
        {head && <h3>{title ?? board.title ?? "Scoreboard"}</h3>}
        {showClock && !live && <span className="sb-clock">{fmtTime(clock)}</span>}
      </div>}
      {n === 0 ? (
        <p className="sb-empty">No score lines yet. Write one update per line inside the block, like <code>0:45 Alpha +3</code>.</p>
      ) : (
        <ol className="sb-rows" style={style}>
          {snap.rows.map((r) => (
            <li key={r.team} className={(last?.team === r.team ? "hot " : "") + (r.rank === 1 && r.score > 0 ? "lead " : "") + ((sort ? r.pos : board.teams.indexOf(r.team)) >= shown ? "sb-out" : "")}
              style={{ "--pos": sort ? r.pos : board.teams.indexOf(r.team), "--fill": r.score > 0 ? r.score / snap.max : 0, ...(tcol(r.team) ? { "--tc": tcol(r.team) } : null) } as CSSProperties}>
              <i className="sb-bar" />
              {rankStyle !== "none" && <span className="sb-rank">{r.rank}</span>}
              <span className="sb-team">{leader === "crown" && r.rank === 1 && r.score > 0 && <em className="sb-crown">♛</em>}{r.team}</span>
              {showDelta && last?.team === r.team && <span className="sb-delta" key={snap.idx}>{label(last)}</span>}
              <b className="sb-score" key={r.score}>{fmt(r.score)}</b>
            </li>
          ))}
        </ol>
      )}
      {warn && <p className="sb-warn">{warn}</p>}
      {controls !== "none" && <div className="sb-ctl">
        {live && <button title="Set every team back to 0" onClick={() => board.teams.forEach((n) => api.setInput(varName(n), "0"))}>Reset</button>}
        {!video && !live && controls === "min" && (
          <>
            <button title="Previous update" onClick={() => { setPlaying(false); goto(prevTime(board, clock)); }}>◀</button>
            <button className="primary" title="Play the replay" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
            <button title="Next update" disabled={!more} onClick={() => { setPlaying(false); const x = nextTime(board, clock); if (x !== undefined) goto(x); }}>▶</button>
          </>
        )}
        {!video && !live && controls === "full" && (
          <>
            <button title="Back to the start" onClick={() => { setPlaying(false); goto(0); }}>⏮</button>
            <button title="Previous update" onClick={() => { setPlaying(false); goto(prevTime(board, clock)); }}>◀</button>
            <button className="primary" title="Play the replay" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
            <button title="Next update" disabled={!more} onClick={() => { setPlaying(false); const x = nextTime(board, clock); if (x !== undefined) goto(x); }}>▶</button>
            <button title="Jump to the final standings" onClick={() => { setPlaying(false); goto(board.end); }}>Final</button>
            <input type="range" min={0} max={Math.max(board.end, 1)} step={0.05} value={clock} aria-label="Time" onChange={(e) => { setPlaying(false); goto(+e.target.value); }} />
            <select value={speed} onChange={(e) => setSpeed(+e.target.value)} aria-label="Speed">{[...new Set([...SPEEDS, sp])].sort((a, b) => a - b).map((s) => <option key={s} value={s}>{s}x</option>)}</select>
          </>
        )}
        {controls === "full" && <button aria-pressed={sort} title="Rows slide into rank order, or stay in team order" onClick={() => setSort((s) => !s)}>{sort ? "Sorted" : "Unsorted"}</button>}
        {showStep && <span className="sb-step">{live ? "live" : <>{snap.idx + 1} / {board.events.length}{keys && !video && more ? " · Next ▸" : ""}</>}</span>}
      </div>}
    </div>
  );

  if (!video) return <div className={cls} style={v as CSSProperties}>{board_}</div>;
  return (
    <div className={cls + " sb-split"} style={v as CSSProperties}>
      <div className="sb-video">
        {vurl ? <video ref={vid} src={vurl} controls playsInline preload="auto" onError={onError} />
          : <p className="sb-empty">{gone ? <>Can't read <code>{video}</code>. Put the video next to the deck (for example in <code>assets/</code>) and check the name.</> : <>Loading <code>{video}</code>…</>}</p>}
      </div>
      {board_}
    </div>
  );
}
