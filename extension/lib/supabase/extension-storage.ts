import { browser } from "wxt/browser";

/**
 * Supabase auth persists the session via a Storage-like adapter. The default
 * (window.localStorage) is per-origin, so a session created in the popup would
 * be invisible to the content script (which shares leetcode.com's localStorage).
 *
 * browser.storage.local is shared across every extension context (popup,
 * background, content scripts), so using it as the auth store lets the content
 * script reuse the session the user established when logging in via the popup.
 */
export const extensionStorage = {
  async getItem(key: string): Promise<string | null> {
    const result = await browser.storage.local.get(key);
    return (result[key] as string | undefined) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await browser.storage.local.set({ [key]: value });
  },
  async removeItem(key: string): Promise<void> {
    await browser.storage.local.remove(key);
  },
};
