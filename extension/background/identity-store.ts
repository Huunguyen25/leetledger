import constants from "@/constants";
import type { IdentityReportMessage, IdentityReportResponse } from "@/lib/identity/messages";
import type { IdentitySnapshot, IdentityState } from "@/lib/identity/types";
import type { createSubmissionTracker } from "./submission-tracker";

type SubmissionTracker = ReturnType<typeof createSubmissionTracker>;

let cachedSnapshot: IdentitySnapshot | null = null;

function identitiesMatch(
  a: { leetcodeUsername: string; supabaseUid: string },
  b: { leetcodeUsername: string; supabaseUid: string },
): boolean {
  return (
    a.leetcodeUsername === b.leetcodeUsername &&
    a.supabaseUid === b.supabaseUid
  );
}

function buildSnapshot(
  state: IdentityState,
  leetcodeUsername: string | null,
  supabaseUid: string | null,
): IdentitySnapshot {
  return {
    state,
    leetcodeUsername,
    supabaseUid,
    updatedAt: Date.now(),
  };
}

async function persistSnapshot(snapshot: IdentitySnapshot): Promise<void> {
  cachedSnapshot = snapshot;
  await browser.storage.local.set({ [constants.IDENTITY_KEY]: snapshot });
}

export function getActiveIdentity(): IdentitySnapshot | null {
  if (cachedSnapshot?.state === "active") {
    return cachedSnapshot;
  }
  return null;
}

export async function loadIdentitySnapshot(): Promise<void> {
  const result = await browser.storage.local.get(constants.IDENTITY_KEY);
  const stored = result[constants.IDENTITY_KEY] as IdentitySnapshot | undefined;
  if (stored && typeof stored.state === "string") {
    cachedSnapshot = stored;
  }
}

async function handleIdentityReport(
  message: IdentityReportMessage,
  tracker: SubmissionTracker,
): Promise<IdentityReportResponse> {
  const { leetcodeUsername, supabaseUid } = message;
  const isFullySignedIn =
    typeof leetcodeUsername === "string" &&
    leetcodeUsername.length > 0 &&
    typeof supabaseUid === "string" &&
    supabaseUid.length > 0;

  if (!isFullySignedIn) {
    const snapshot = buildSnapshot("inactive", leetcodeUsername, supabaseUid);
    await persistSnapshot(snapshot);
    return { state: "inactive" };
  }

  const previous = cachedSnapshot;
  const hasPreviousActive =
    previous?.state === "active" &&
    previous.leetcodeUsername &&
    previous.supabaseUid;

  if (
    hasPreviousActive &&
    !identitiesMatch(
      {
        leetcodeUsername: previous.leetcodeUsername!,
        supabaseUid: previous.supabaseUid!,
      },
      { leetcodeUsername, supabaseUid },
    )
  ) {
    tracker.clearProcessing();
    const snapshot = buildSnapshot(
      "account_changed",
      leetcodeUsername,
      supabaseUid,
    );
    await persistSnapshot(snapshot);
    return { state: "account_changed" };
  }

  const snapshot = buildSnapshot("active", leetcodeUsername, supabaseUid);
  await persistSnapshot(snapshot);
  return { state: "active" };
}

export function registerIdentityStore(tracker: SubmissionTracker): void {
  void loadIdentitySnapshot();

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== constants.MESSAGE_TYPES.IDENTITY_REPORT) return;

    void handleIdentityReport(message as IdentityReportMessage, tracker).then(
      (response) => sendResponse(response),
    );
    return true;
  });
}
