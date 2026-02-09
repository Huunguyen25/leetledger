export default defineBackground(() => {
  const processedSubmissions = new Set<string>();
  const processing = new Set<string>();
  const MAX_STORED: number = 100;

  browser.webRequest.onCompleted.addListener(
    async (details) => {
      // if not the url just return.
      if (!details.url.includes("/check/")) return;
      try {
        const match = details.url.match(
          /\/submissions\/detail\/([^/]+)\/check\//,
        );
        if (!match) return;
        const submissionId = match[1];

        // ignore run code or test case.
        if (!/^\d+$/.test(submissionId)) {
          console.log("🚫 Ignoring 'Run Code' or Test Case:", submissionId);
          return;
        }
        // prevent duplicate processing, if already processed or being processed, skip.
        if (
          processedSubmissions.has(submissionId) ||
          processing.has(submissionId)
        ) {
          return;
        }

        processing.add(submissionId);

        // 
        const response = await fetch(details.url);
        const data = await response.json();
        if (data.state !== "SUCCESS") {
          processing.delete(submissionId);
          return;
        }
        processing.delete(submissionId);
        processedSubmissions.add(submissionId);

        if (processedSubmissions.size > MAX_STORED) {
          const firstItem: string | undefined = processedSubmissions
            .values()
            .next().value;
          if (firstItem !== undefined) {
            processedSubmissions.delete(firstItem);
          }
        }
        console.log(
          "🎯 VALID SUBMISSION DETECTED!, ID: " +
            submissionId +
            " Status: " +
            data.status_msg,
        );

        // Update the lock so we don't process this again

        // NOW: Trigger your save logic
        if (data.status_msg === "Accepted") {
          // handleAcceptedSubmission(data, submissionId);
        } else {
          // handleFailedSubmission(data, submissionId);
        }
      } catch (err) {
        console.error("Error in network listener:", err);
      }
    },
    { urls: ["*://leetcode.com/submissions/detail/*/check/*"] },
  );
});
