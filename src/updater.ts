import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateResult = "updated" | "available" | "none";

/** Check the configured release endpoint and offer a signed update when one is available. */
export async function checkForUpdate(interactive: boolean): Promise<UpdateResult> {
  try {
    const update = await check();
    if (!update) {
      if (interactive) window.alert("ITSD is up to date.");
      return "none";
    }
    const install = window.confirm(`ITSD ${update.version} is available.\n\nInstall it now and restart ITSD?`);
    if (!install) return "available";
    await update.downloadAndInstall();
    await relaunch();
    return "updated";
  } catch (error) {
    if (interactive) window.alert(`Couldn't check for ITSD updates: ${String(error)}`);
    return "none";
  }
}
