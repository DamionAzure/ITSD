// The scoreboard is a function of a log of score updates, never hardcoded numbers:  standings = f(events, time).
// Every version (final-only, step-by-step replay, video-synced) is the same function called with a different time.
//
//   title: Finals, Game 3          (optional)
//   teams: Alpha, Bravo, Charlie   (optional: sets the unsorted order and lets a team start at 0)
//   0:45 Alpha +3                  time, team name (may have spaces), then the points
//   1:30 Bravo +2                  +n / -n change the score,  =n or a bare n sets the total
//   2:10 Alpha =10
//   // a comment
//
// Time is seconds, m:ss or h:mm:ss. Lines may come in any order: they are sorted by time.

export interface Ev { t: number; team: string; op: "add" | "set"; v: number; line: number }
export interface Board { title?: string; teams: string[]; events: Ev[]; problems: string[]; end: number }
export interface Standing { team: string; score: number; rank: number; pos: number }
export interface Snapshot { idx: number; rows: Standing[]; max: number }

export function parseTime(s: string): number | null {
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(s)) return null;
  return s.split(":").reduce((a, x) => a * 60 + parseFloat(x), 0);
}
export function fmtTime(t: number): string {
  const s = Math.max(0, Math.floor(t)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}

export function parseBoard(text: string): Board {
  const b: Board = { teams: [], events: [], problems: [], end: 0 };
  const known = new Set<string>();
  const addTeam = (n: string) => { if (n && !known.has(n)) { known.add(n); b.teams.push(n); } };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("//")) return;
    const head = line.match(/^(title|teams)\s*:\s*(.*)$/i);
    if (head) {
      if (head[1].toLowerCase() === "title") b.title = head[2].trim() || undefined;
      else head[2].split(",").map((s) => s.trim()).forEach(addTeam);
      return;
    }
    const tok = line.split(/\s+/);
    const t = parseTime(tok[0]);
    const val = tok.length >= 3 ? tok[tok.length - 1].match(/^([+\-=])?(\d+(?:\.\d+)?)$/) : null;
    if (t === null || !val) { b.problems.push(`line ${i + 1}: expected "time team points", e.g. 0:45 Alpha +3`); return; }
    const team = tok.slice(1, -1).join(" ");
    const n = parseFloat(val[2]);
    addTeam(team);
    b.events.push({ t, team, op: val[1] === "+" || val[1] === "-" ? "add" : "set", v: val[1] === "-" ? -n : n, line: i + 1 });
  });
  b.events.sort((x, y) => x.t - y.t); // Array.sort is stable: events at the same time keep the order they were written in
  b.end = b.events.length ? b.events[b.events.length - 1].t : 0;
  return b;
}

/** Rank teams from a score table. Order is by score, ties keep the team order; tied scores share a rank (1, 2, 2, 4). */
export function rankTeams(teams: string[], score: Map<string, number>, idx = -1): Snapshot {
  const order = new Map(teams.map((n, i) => [n, i]));
  const sorted = [...teams].sort((x, y) => (score.get(y) ?? 0) - (score.get(x) ?? 0) || order.get(x)! - order.get(y)!);
  const rankOf = new Map<string, number>();
  sorted.forEach((n, i) => rankOf.set(n, i > 0 && score.get(n) === score.get(sorted[i - 1]) ? rankOf.get(sorted[i - 1])! : i + 1));
  const rows: Standing[] = teams.map((n) => ({ team: n, score: score.get(n) ?? 0, rank: rankOf.get(n)!, pos: sorted.indexOf(n) }));
  return { idx, rows, max: Math.max(1, ...rows.map((r) => r.score)) };
}

/** Standings after every event with time <= t. `idx` is the last event applied (-1 = none yet). */
export function standingsAt(b: Board, t: number): Snapshot {
  const score = new Map(b.teams.map((n) => [n, 0]));
  let idx = -1;
  b.events.forEach((e, i) => {
    if (e.t > t + 1e-9) return;
    score.set(e.team, e.op === "add" ? (score.get(e.team) ?? 0) + e.v : e.v);
    idx = i;
  });
  return rankTeams(b.teams, score, idx);
}

/** The deck variable that holds a team's score in live mode (buttons use it: `add Alpha 3`). Characters that aren't letters, digits or _ become _. */
export function varName(team: string): string {
  const v = team.replace(/[^A-Za-z0-9_]+/g, "_");
  return /^[A-Za-z_]/.test(v) ? v : "_" + v;
}

/** The time of the update after the one at `t` (undefined when there is none). */
export function nextTime(b: Board, t: number): number | undefined {
  return b.events.find((e) => e.t > t + 1e-9)?.t;
}
/** The time of the update before the latest one applied at `t` (0 when at the first). */
export function prevTime(b: Board, t: number): number {
  const cur = standingsAt(b, t).idx;
  if (cur < 0) return 0;
  const before = b.events.filter((e) => e.t < b.events[cur].t - 1e-9);
  return before.length ? before[before.length - 1].t : 0;
}
