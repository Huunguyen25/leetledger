import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import AuthToast from "@/components/AuthToast/AuthToast";
import constants from "@/constants";
import {
  ACCOUNT_CHANGED_KEY,
  ACCOUNT_CHANGED_MESSAGE,
  authToastKey,
  authToastMessage,
} from "@/lib/identity/auth-messages";
import type { IdentityReportResponse } from "@/lib/identity/messages";
import { resolveIdentity } from "@/lib/identity/resolve";
import type { IdentityFailureReason } from "@/lib/identity/types";
import { startContentTracking } from "./tracking-controller";

const AUTH_TOAST_DURATION_MS = 15_000;

async function reportIdentity(
  leetcodeUsername: string | null,
  supabaseUid: string | null,
  reasons: IdentityFailureReason[],
): Promise<IdentityReportResponse> {
  return browser.runtime.sendMessage({
    type: constants.MESSAGE_TYPES.IDENTITY_REPORT,
    leetcodeUsername,
    supabaseUid,
    reasons,
  });
}

/** Reconciles identity state with tracking and the on-page auth toast. */
export async function startIdentityController(
  ctx: ContentScriptContext,
): Promise<void> {
  let trackingTeardown: (() => void) | null = null;
  let trackingNavigate: (() => void) | null = null;
  let authToastUi: { remove: () => void } | null = null;
  let shownToastKey: string | null = null;
  let dismissedToastKey: string | null = null;
  let identityCheckInFlight = false;

  function hideAuthToast() {
    authToastUi?.remove();
    authToastUi = null;
  }

  async function showAuthToast(key: string, message: string) {
    shownToastKey = key;
    hideAuthToast();

    const ui = await createShadowRootUi(ctx, {
      name: "leetcode-auth-toast",
      position: "overlay",
      anchor: "body",
      onMount(uiContainer) {
        const root = ReactDOM.createRoot(uiContainer);
        root.render(
          <AuthToast
            message={message}
            durationMs={AUTH_TOAST_DURATION_MS}
            onDismiss={() => {
              dismissedToastKey = key;
              hideAuthToast();
              shownToastKey = null;
            }}
          />,
        );
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });

    authToastUi = ui;
    ui.mount();
  }

  function applyAuthState(key: string | null, message?: string) {
    if (key === null) {
      if (shownToastKey) {
        hideAuthToast();
        shownToastKey = null;
      }
      return;
    }
    if (key === dismissedToastKey || key === shownToastKey) return;
    void showAuthToast(key, message ?? "");
  }

  function stopTracking() {
    trackingTeardown?.();
    trackingTeardown = null;
    trackingNavigate = null;
  }

  async function runIdentityGate(): Promise<void> {
    if (identityCheckInFlight) return;
    identityCheckInFlight = true;

    try {
      const result = await resolveIdentity();
      const response = await reportIdentity(
        result.ok ? result.identity.leetcodeUsername : result.leetcodeUsername,
        result.ok ? result.identity.supabaseUid : result.supabaseUid,
        result.ok ? [] : result.reasons,
      );

      if (response.state === "account_changed") {
        stopTracking();
        applyAuthState(ACCOUNT_CHANGED_KEY, ACCOUNT_CHANGED_MESSAGE);
        return;
      }

      if (!result.ok || response.state !== "active") {
        stopTracking();
        if (!result.ok) {
          const key = authToastKey(result.reasons);
          applyAuthState(key, key ? authToastMessage(result.reasons) : undefined);
        } else {
          applyAuthState(null);
        }
        return;
      }

      dismissedToastKey = null;
      applyAuthState(null);
      if (!trackingTeardown) {
        const tracking = startContentTracking(ctx);
        trackingTeardown = tracking.teardown;
        trackingNavigate = tracking.onNavigate;
      }
    } finally {
      identityCheckInFlight = false;
    }
  }

  browser.storage.local.onChanged.addListener((changes) => {
    const identityChange = changes[constants.IDENTITY_KEY];
    if (!identityChange?.newValue) return;

    const snapshot = identityChange.newValue as { state?: string };
    if (snapshot.state === "account_changed") {
      stopTracking();
      applyAuthState(ACCOUNT_CHANGED_KEY, ACCOUNT_CHANGED_MESSAGE);
    }
  });

  ctx.addEventListener(window, "wxt:locationchange", () => {
    trackingNavigate?.();
    void runIdentityGate();
  });

  await runIdentityGate();
}
