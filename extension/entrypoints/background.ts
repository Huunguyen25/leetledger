import {
  isSubmissionUrl,
  extractSubmissionId,
  isValidSubmissionId,
  createSubmissionTracker,
} from "@/utils/background.logic";

export default defineBackground(() => {
  const tracker = createSubmissionTracker(100);

  browser.webRequest.onCompleted.addListener(
    async (details) => {
      // if not the url just return.
      if (!isSubmissionUrl(details.url)) return;

      try {
        const submissionId = extractSubmissionId(details.url);
        if (!submissionId) return;

        // ignore run code or test case.
        if (!isValidSubmissionId(submissionId)) {
          console.log("🚫 Ignoring 'Run Code' or Test Case:", submissionId);
          return;
        }

        // prevent duplicate processing, if already processed or being processed, skip.
        if (tracker.isDuplicate(submissionId)) {
          return;
        }

        tracker.startProcessing(submissionId);

        // 
        const response = await fetch(details.url);
        const data = await response.json();
        if (data.state !== "SUCCESS") {
          tracker.cancelProcessing(submissionId);
          return;
        }
        tracker.completeProcessing(submissionId);
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
