import { useContext, useSyncExternalStore, type CSSProperties } from "react";
import { DeckCtx } from "./ctx";
import { lookClass, lookStyle } from "./look";
import { lightness, type Backdrop as Back, type ImageDef } from "./images";

/** The object URL for a picture file, re-rendering the caller when it finishes loading. */
export function useAssetUrl(ref?: string): string | undefined {
  const { assets } = useContext(DeckCtx);
  useSyncExternalStore(assets.subscribe, assets.snapshot);
  return ref ? assets.url(ref) : undefined;
}

/** Slide background: a colour and/or a photo, with an optional dimming veil so text stays readable over photos. */
export function Backdrop({ back }: { back: Back }) {
  const url = useAssetUrl(back.image);
  if (!back.color && !back.image) return null;
  return (
    <div className="bg" style={{ backgroundColor: back.color, backgroundImage: url ? `url("${url}")` : undefined }}>
      {back.dim > 0 && back.image && <i style={{ opacity: back.dim / 100 }} />}
    </div>
  );
}

/** Text colour that stays readable on a light solid background (photos keep the default light text). */
export function inkStyle(back: Back): CSSProperties | undefined {
  const l = back.image ? undefined : lightness(back.color);
  return l !== undefined && l > 0.62 ? ({ color: "#171a2b", "--label": "#4a5070" } as CSSProperties) : undefined;
}

function Pic({ d, n, id }: { d: ImageDef; n: number; id?: string }) {
  const url = useAssetUrl(d.src);
  return (
    <div className={"pic" + (d.look ? " " + lookClass(d.look) : "")} data-pn={n} data-id={id} style={{ ...lookStyle(d.look), left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%`, ...(d.z !== undefined ? { zIndex: 10 + d.z } : null), ...(d.rot ? { rotate: `${d.rot}deg` } : null) }}>
      {url ? <img src={url} alt={d.alt} draggable={false} /> : <span>{d.src}</span>}
    </div>
  );
}

/** Pictures in stacking order (last = on top). Static: they never take mouse input. */
export function ImageLayer({ defs, ids }: { defs: ImageDef[]; ids?: (string | undefined)[] }) {
  if (!defs.length) return null;
  return <div className="layer">{defs.map((d, i) => <Pic key={i} d={d} n={i} id={ids?.[i]} />)}</div>;
}
