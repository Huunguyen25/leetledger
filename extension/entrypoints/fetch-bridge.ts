/**
 * Injected into the LeetCode page to intercept the submission check request.
 *
 * Configuration is passed via the <script> tag's data attributes:
 * - data-token: random token to correlate with the content script
 * - data-client-id: ID for this content script instance
 * - data-problem-slug: the current problem slug
 *
 * The script:
 * - Wraps window.fetch
 * - Intercepts POST /submit/ requests to capture typed_code and lang
 * - Detects /submissions/detail/{id}/check/ responses
 * - Correlates the two via a Map keyed on submission_id
 * - Posts a structured message back to the page (and then to the content script)
 */

import constants from "@/constants";

interface PendingCodeInfo {
  typedCode: string;
  lang: string;
}

export default defineUnlistedScript(() => {
  const originalFetch = window.fetch;

  // Retrieve tokens passed from the content script via the script tag's dataset
  const scriptTag = document.currentScript as HTMLScriptElement;
  const { token, clientId } = scriptTag.dataset;

  // Correlates submission_id -> { typedCode, lang } captured from the submit POST
  const pendingSubmissions = new Map<string, PendingCodeInfo>();

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";

    // Intercept the submit POST to capture typed code before the check fires
    if (url.includes("/submit/")) {
      try {
        const init = args[1] as RequestInit | undefined;
        if (init?.body) {
          const body = JSON.parse(init.body as string) as {
            typed_code?: string;
            lang?: string;
          };
          const { typed_code: typedCode, lang } = body;
          if (typedCode) {
            const clone = response.clone();
            clone.json().then((data: { submission_id?: number | string }) => {
              const submissionId = data.submission_id
                ? String(data.submission_id)
                : null;
              if (submissionId) {
                pendingSubmissions.set(submissionId, {
                  typedCode,
                  lang: lang ?? "",
                });
              }
            });
          }
        }
      } catch (_err) {
        // Fail silently to ensure LeetCode functionality never breaks
      }
    }

    // Target the specific submission check URL in check/ network
    if (url.includes("/submissions/detail/") && url.includes("/check/")) {
      try {
        const clone = response.clone();
        clone.json().then((data) => {
          if (data.state === "SUCCESS") {
            const submissionIdMatch = url.match(
              constants.SUBMISSION_ID_EXTRACT_REGEX,
            );
            const submissionId = submissionIdMatch
              ? submissionIdMatch[1]
              : null;
            // skip test runs and run code or invalid submission ids
            if (
              !submissionId ||
              !constants.VALID_SUBMISSION_ID_REGEX.test(submissionId)
            )
              return;

            const codeInfo = pendingSubmissions.get(submissionId);
            pendingSubmissions.delete(submissionId);

            window.postMessage(
              {
                type: constants.MESSAGE_TYPES.SUBMISSION_INTERCEPTED,
                token,
                clientId,
                attemptId: submissionId,
                submissionData: data,
                typedCode: codeInfo?.typedCode ?? null,
                lang: codeInfo?.lang ?? data.lang ?? null,
              },
              window.location.origin,
            );
          }
        });
      } catch (_err) {
        // Fail silently to ensure LeetCode functionality never breaks
      }
    }
    return response;
  };
});
