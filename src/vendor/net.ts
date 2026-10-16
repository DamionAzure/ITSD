// Downloads for the Vendor menu. Inside the desktop app they go through Tauri's HTTP plugin, which is not bound by CORS (many
// registries don't send CORS headers, and a web view refuses to read their answer). In a plain browser (npm run dev) it is a normal fetch.
const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function netFetch(url: string): Promise<Response> {
  if (inTauri()) {
    try { const { fetch: f } = await import("@tauri-apps/plugin-http"); return await f(url); }
    catch { /* plugin missing or URL not allowed in capabilities/default.json: try the web view's own fetch below */ }
  }
  return fetch(url);
}

export class HttpError extends Error { constructor(public url: string, public status: number) { super(`${url.split("/").pop()}: ${status}`); } }

export async function getJson(url: string) {
  const r = await netFetch(url);
  if (!r.ok) throw new HttpError(url, r.status);
  return r.json();
}

export async function getText(url: string) {
  const r = await netFetch(url);
  if (!r.ok) throw new HttpError(url, r.status);
  return r.text();
}
