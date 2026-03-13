// entrypoints/inject.ts
export default defineUnlistedScript(() => {
  const originalFetch = window.fetch;

  // Retrieve tokens passed from the content script via the script tag's dataset
  const scriptTag = document.currentScript as HTMLScriptElement;
  const { token, clientId, problemSlug } = scriptTag.dataset;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";

    // Target the specific submission check URL
    if (url.includes("/submissions/detail/") && url.includes("/check/")) {
      try {
        const clone = response.clone();
        clone.json().then((data) => {
          if (data.state === "SUCCESS") {
            const attemptId = url.match(/detail\/(\d+)/)?.[1] || Date.now().toString();
            
            window.postMessage({
              type: "LEETCODE_SUBMISSION_INTERCEPTED",
              token,
              clientId,
              problemSlug,
              attemptId,
              submissionData: data,
            }, window.location.origin);
          }
        });
      } catch (err) {
        // Fail silently to ensure LeetCode functionality never breaks
      }
    }
    return response;
  };
});