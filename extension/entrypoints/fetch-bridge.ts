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
 * - Detects /submissions/detail/{id}/check/ requests
 * - Posts a structured message back to the page (and then to the content script)
 */

import constants from "@/constants";

export default defineUnlistedScript(() => {
  const originalFetch = window.fetch;

  // Retrieve tokens passed from the content script via the script tag's dataset
  const scriptTag = document.currentScript as HTMLScriptElement;
  const { token, clientId, problemSlug } = scriptTag.dataset;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const url =
      typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";

    // Target the specific submission check URL
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

            window.postMessage(
              {
                type: constants.MESSAGE_TYPES.SUBMISSION_INTERCEPTED,
                token,
                clientId,
                problemSlug,
                attemptId: submissionId,
                submissionData: data,
              },
              window.location.origin,
            );
          }
        });
      } catch (err) {
        // Fail silently to ensure LeetCode functionality never breaks
      }
    }
    return response;
  };
});
