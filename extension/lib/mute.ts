import { browser } from "wxt/browser";
import constants from "@/constants";

/**
 * Review-drawer muting.
 *
 * The popup lets the user silence the on-page review drawer for a chosen
 * duration. We persist a single epoch-ms "muted until" timestamp in
 * browser.storage.local (shared across popup / content script / background),
 * and the content script consults it before mounting a drawer.
 *
 * The key is self-healing: once the deadline passes it is removed on the next
 * read, so a one-off mute never lingers in storage (no slow leak).
 */

/** Preset mute durations surfaced in the popup, in ascending order. */
export const MUTE_DURATIONS: ReadonlyArray<{ label: string; ms: number }> = [
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "4 hours", ms: 4 * 60 * 60 * 1000 },
  { label: "1 day", ms: 24 * 60 * 60 * 1000 },
];

/** Returns the active "muted until" timestamp, or null when not muted. */
export async function getMuteUntil(): Promise<number | null> {
  const result = await browser.storage.local.get(constants.MUTE_KEY);
  const until = result[constants.MUTE_KEY];
  return typeof until === "number" ? until : null;
}

/** True while a mute is set and has not yet elapsed; clears stale entries. */
export async function isMuted(): Promise<boolean> {
  const until = await getMuteUntil();
  if (until === null) return false;
  if (until <= Date.now()) {
    await clearMute();
    return false;
  }
  return true;
}

/** Mutes the review drawer for `durationMs`; returns the new deadline. */
export async function muteFor(durationMs: number): Promise<number> {
  const until = Date.now() + durationMs;
  await browser.storage.local.set({ [constants.MUTE_KEY]: until });
  return until;
}

/** Clears any active mute. */
export async function clearMute(): Promise<void> {
  await browser.storage.local.remove(constants.MUTE_KEY);
}
