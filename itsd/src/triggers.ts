// Bookkeeping for when a flash region activates (kept separate from React so it can be tested on its own).
export function createTriggers() {
  let seen = new Set<string>();
  const armed = new Set<() => void>(); // insertion order = the order the regions appear on the slide
  return {
    /** at-start: true the first time a region is reached in this presentation run. While editing it is always true. */
    firstVisit(key: string, presenting: boolean): boolean {
      if (!presenting) return true;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    },
    /** Called when a presentation starts, so at-start regions are fresh again. */
    newRun() { seen = new Set(); },
    /** when-next: a region registers here and waits. Returns a function that withdraws it. */
    armNext(f: () => void) { armed.add(f); return () => { armed.delete(f); }; },
    /** Called by every Next. Starts the first waiting region and says whether the press was used up by it. */
    consumeNext(): boolean {
      const f = armed.values().next().value as (() => void) | undefined;
      if (!f) return false;
      armed.delete(f); f();
      return true;
    },
  };
}
