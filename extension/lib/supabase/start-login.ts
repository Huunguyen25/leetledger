import { browser } from "wxt/browser";

/** Extension login page URL (WXT unlisted HTML → `/login.html`). */
export function loginPageUrl(): string {
  return browser.runtime.getURL("/login.html");
}

/**
 * Opens the extension login tab. Swap this body later for website-based
 * sign-in + session handoff without changing popup callers.
 */
export async function startLogin(): Promise<void> {
  const url = loginPageUrl();

  try {
    const existing = await browser.tabs.query({ url });
    const tab = existing.find((t) => t.id != null);
    if (tab?.id != null) {
      await browser.tabs.update(tab.id, { active: true });
      if (tab.windowId != null) {
        await browser.windows.update(tab.windowId, { focused: true });
      }
      return;
    }
  } catch {
    // tabs.query may be unavailable without the "tabs" permission — fall through.
  }

  await browser.tabs.create({ url });
}
