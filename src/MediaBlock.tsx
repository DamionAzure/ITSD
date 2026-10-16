import { useContext, useEffect, useRef } from "react";
import { DeckCtx, RegCtx } from "./ctx";
import { useMediaUrl } from "./media";
import type { MediaDef } from "./mediaDef";

// A video or audio block. Autoplay only happens while presenting, so editing stays quiet. A `start`/`stop` button action (by id) controls it.
export function MediaBlock({ def }: { def: MediaDef }) {
  const api = useContext(DeckCtx), reg = useContext(RegCtx);
  const { url, missing, onError } = useMediaUrl(def.src);
  const poster = useMediaUrl(def.poster).url;
  const el = useRef<HTMLVideoElement & HTMLAudioElement>(null);

  useEffect(() => {
    const v = el.current; if (!v) return;
    v.volume = def.vol; v.muted = def.muted; v.loop = def.loop;
    const begin = () => { if (def.start > 0 && v.currentTime < def.start) v.currentTime = def.start; };
    v.addEventListener("loadedmetadata", begin);
    if (def.autoplay && api.presenting()) { begin(); v.play().catch(() => { /* the webview may need a click first */ }); }
    return () => { v.removeEventListener("loadedmetadata", begin); v.pause(); };
  }, [url, def.vol, def.muted, def.loop, def.start, def.autoplay]);

  useEffect(() => {
    if (!def.id) return;
    reg.set(def.id, {
      setCode: () => {}, run: async () => {}, note: () => {},
      start: () => { const v = el.current; if (v) { if (v.ended || v.currentTime < def.start) v.currentTime = def.start; v.play().catch(() => {}); } },
      stop: () => { const v = el.current; if (v) { v.pause(); v.currentTime = def.start; } },
      show: (on) => { const v = el.current?.parentElement; if (v) v.hidden = !on; if (!on) el.current?.pause(); },
    });
    return () => { reg.delete(def.id!); };
  }, [def.id, def.start]);

  if (!url) return <div className={`media ${def.kind} empty`}><p>{missing ? <>Can't read <code>{def.src}</code>. Put the file next to the deck (for example in <code>assets/</code>) and check the name.</> : <>Loading <code>{def.src}</code>…</>}</p></div>;
  return def.kind === "audio"
    ? <div className="media audio"><audio ref={el} src={url} controls={def.controls} preload="metadata" onError={onError} /></div>
    : <div className="media video"><video ref={el} src={url} poster={poster} controls={def.controls} playsInline preload="metadata" onError={onError} style={{ objectFit: def.fit }} /></div>;
}
