// Downloaded components live in the webview's own database, so they survive restarts and work offline.
import type { Stored } from "./types";

const NAME = "itsd-vendors", STORE = "components";
const db = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open(NAME, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "key" });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const run = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => {
  const d = await db();
  return new Promise<T>((res, rej) => { const r = f(d.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }).finally(() => d.close());
};
export const all = () => run<Stored[]>("readonly", (s) => s.getAll());
export const put = (c: Stored) => run("readwrite", (s) => s.put(c));
export const remove = (key: string) => run("readwrite", (s) => s.delete(key));
