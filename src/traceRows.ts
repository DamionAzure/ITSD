// Row identity for the trace table. A trace frame only holds the array's values, so "which row moved where" has to be worked out by comparing
// one frame with the one before it: a value that is still at its index stays put, the rest are matched to the nearest unused slot holding the
// same value (so duplicates don't swap places for nothing), and a value that was overwritten (merge sort) takes the nearest slot that is left.
// The result is stable ids: ids[frame][position] = the id of the row sitting at that position, where an id is the position the row had at step 1.
import type { Frame } from "./ctx";

export function rowIds(frames: Frame[]): number[][] {
  const out: number[][] = [];
  let prevA: number[] | null = null, prev: number[] = [];
  for (const fr of frames) {
    const a = fr.a, n = a.length;
    let ids: number[];
    if (!prevA || prevA.length !== n) ids = a.map((_, k) => k); // first frame, or the array grew / shrank: start again
    else if (a.every((v, k) => v === prevA![k])) ids = prev;
    else {
      ids = new Array(n).fill(-1);
      const used = new Set<number>();
      for (let k = 0; k < n; k++) if (a[k] === prevA[k]) { ids[k] = prev[k]; used.add(k); }
      const nearest = (k: number, ok: (j: number) => boolean) => {
        let best = -1;
        for (let j = 0; j < n; j++) if (!used.has(j) && ok(j) && (best < 0 || Math.abs(j - k) < Math.abs(best - k))) best = j;
        return best;
      };
      for (let k = 0; k < n; k++) if (ids[k] < 0) { const j = nearest(k, (j) => prevA![j] === a[k]); if (j >= 0) { ids[k] = prev[j]; used.add(j); } }
      for (let k = 0; k < n; k++) if (ids[k] < 0) { const j = nearest(k, () => true); ids[k] = prev[j]; used.add(j); }
    }
    out.push(ids); prevA = a; prev = ids;
  }
  return out;
}

/** The position each id sits at in one frame: pos[id] = index. */
export function positions(ids: number[]): number[] { const p: number[] = []; ids.forEach((id, k) => { p[id] = k; }); return p; }
