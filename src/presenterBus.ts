export interface PSlide { src: string; title: string; label: string; notes: string; branch: boolean }
export interface PState { slides: PSlide[]; idx: number; next: number; align?: string; path: string | null; presenting: boolean; name: string }
export type ToPresenter = { t: "state"; s: PState } | { t: "end" };
export type ToMain = { t: "cmd"; cmd: "next" | "prev" | "end" | "hello" | "goto"; idx?: number };

export function openBus<T>(onMsg: (m: T) => void) {
  const c = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("itsd-presenter");
  if (c) c.onmessage = (e) => onMsg(e.data as T);
  return { send: (m: ToPresenter | ToMain) => c?.postMessage(m), close: () => c?.close() };
}

export async function openPresenter() {
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const have = await WebviewWindow.getByLabel("presenter");
    if (have) { await have.setFocus(); return; }
    const w = new WebviewWindow("presenter", { url: "index.html?presenter=1", title: "ITSD Presenter View", width: 1240, height: 780 });
    w.once("tauri://error", () => { window.open("/?presenter=1", "itsd-presenter", "width=1240,height=780"); });
  } catch { window.open("/?presenter=1", "itsd-presenter", "width=1240,height=780"); }
}

export async function closePresenter() {
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    await (await WebviewWindow.getByLabel("presenter"))?.close();
  } catch { /* The presenter window may already be closed. */ }
}
