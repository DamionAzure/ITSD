import { useContext, useEffect, useState } from "react";
import { DeckCtx } from "./ctx";

/** A playable URL for a media file. Normally it is streamed straight from disk (Tauri's asset protocol: the player asks for the parts it
 *  needs, so seeking is instant and memory stays flat). If the webview refuses that URL, `onError` switches to reading the whole file into
 *  memory, which still plays but only suits short clips. */
export function useMediaUrl(ref?: string) {
  const api = useContext(DeckCtx);
  const [s, set] = useState<{ ref?: string; url?: string; blob?: boolean; missing?: boolean }>({});
  const viaMemory = (r: string, live: () => boolean) => api.assets.ready(r).then((u) => { if (live()) set(u ? { ref: r, url: u, blob: true } : { ref: r, missing: true }); });
  useEffect(() => {
    set({}); if (!ref) return;
    let alive = true; const live = () => alive;
    api.mediaUrl(ref).then((u) => { if (alive) set({ ref, url: u }); }).catch(() => viaMemory(ref, live));
    return () => { alive = false; };
  }, [ref]);
  const cur = s.ref === ref ? s : {};
  return { url: cur.url, missing: !!cur.missing, onError: () => { if (ref && cur.url && !cur.blob) { set({}); void viaMemory(ref, () => true); } } };
}
