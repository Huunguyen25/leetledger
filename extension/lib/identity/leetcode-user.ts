const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql/";
const USER_STATUS_TIMEOUT_MS = 3000;

// Bounded confirmation: LeetCode's userStatus can briefly report a signed-out
// state right after navigation/boot, so a single check is not authoritative.
// We retry (treating both signed_out and network errors as retryable) and only
// conclude a failure once it persists, mirroring the sync extension's behavior.
const MAX_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 8000;

const USER_STATUS_QUERY = `query leetledgerUserStatus {
  userStatus { isSignedIn username }
}`;

export type LeetCodeUserResult =
  | { ok: true; username: string }
  | { ok: false; reason: "signed_out" | "network_error" };

interface UserStatusResponse {
  data?: {
    userStatus?: {
      isSignedIn?: boolean;
      username?: string | null;
    };
  };
}

async function fetchUserStatusOnce(): Promise<LeetCodeUserResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), USER_STATUS_TIMEOUT_MS);

  try {
    const response = await fetch(LEETCODE_GRAPHQL_URL, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: USER_STATUS_QUERY }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: "network_error" };
    }

    const json = (await response.json()) as UserStatusResponse;
    const status = json.data?.userStatus;
    const username = status?.username?.trim();

    if (status?.isSignedIn === true && username) {
      return { ok: true, username };
    }

    return { ok: false, reason: "signed_out" };
  } catch {
    return { ok: false, reason: "network_error" };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchLeetCodeUsername(
  maxAttempts = MAX_ATTEMPTS,
): Promise<LeetCodeUserResult> {
  let delay = INITIAL_RETRY_DELAY_MS;
  let last: LeetCodeUserResult = { ok: false, reason: "network_error" };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await fetchUserStatusOnce();
    if (last.ok) return last;

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
    }
  }

  return last;
}
