/**
 * This script is injected into the LeetCode page to intercept the submission check request and send the data to the content script.
 * @param token - The token passed from the content script via the script tag's dataset.
 * @param clientId - The client ID passed from the content script via the script tag's dataset.
 * @param problemSlug - The problem slug passed from the content script via the script tag's dataset.
 * @returns The original fetch function.
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
