import { browser } from "wxt/browser";
import constants from "@/constants";

/** Preset durations offered by the popup. */
export const MUTE_DURATIONS: ReadonlyArray<{ label: string; ms: number }> = [
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "4 hours", ms: 4 * 60 * 60 * 1000 },
  { label: "1 day", ms: 24 * 60 * 60 * 1000 },
];

export async function getMuteUntil(): Promise<number | null> {
  const result = await browser.storage.local.get(constants.MUTE_KEY);
  const until = result[constants.MUTE_KEY];
  return typeof until === "number" ? until : null;
}

/** Clears expired state while reporting whether review reminders are muted. */
export async function isMuted(): Promise<boolean> {
  const until = await getMuteUntil();
  if (until === null) return false;
  if (until <= Date.now()) {
    await clearMute();
    return false;
  }
  return true;
}

export async function muteFor(durationMs: number): Promise<number> {
  const until = Date.now() + durationMs;
  await browser.storage.local.set({ [constants.MUTE_KEY]: until });
  return until;
}

export async function clearMute(): Promise<void> {
  await browser.storage.local.remove(constants.MUTE_KEY);
}
