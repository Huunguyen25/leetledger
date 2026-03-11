import {
  isSubmissionUrl,
  extractSubmissionId,
  isValidSubmissionId,
  createSubmissionTracker,
} from "@/utils/background.logic";

export default defineBackground(() => {
  const tracker = createSubmissionTracker(100);

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SUBMISSION_RESULT") {
      const { submissionData, problemSlug, clientId, attemptId } = message;

      if (!clientId || !attemptId) {
        console.warn("⚠️ Missing clientId or attemptId in SUBMISSION_RESULT");
        return;
      }

      // 1. Normalize the payload for the UI
      const normalizedPayload = {
        status: submissionData.status_msg || submissionData.status,
        runtime: submissionData.status_runtime,
        memory: submissionData.status_memory,
        runtimePercentile: submissionData.runtime_percentile,
        memoryPercentile: submissionData.memory_percentile,
        problemSlug: problemSlug,
      };

      const storageKey = `ll_result:${clientId}:${attemptId}`;
      const storageValue = {
        data: normalizedPayload,
        timestamp: Date.now(),
      };

      // 2. Write to local storage
      browser.storage.local.set({ [storageKey]: storageValue })
        .then(() => console.log(`💾 Saved result to storage [${storageKey}]`))
        .catch((err) => console.error("Storage write failed:", err));
    }
  });
  
  // browser.webRequest.onCompleted.addListener(
  //   async (details) => {
  //     if (!isSubmissionUrl(details.url)) return;

  //     try {
  //       const submissionId = extractSubmissionId(details.url);
  //       if (!submissionId) return;

  //       if (!isValidSubmissionId(submissionId)) {
  //         console.log("🚫 Ignoring 'Run Code' or Test Case:", submissionId);
  //         return;
  //       }

  //       // prevent duplicate processing, if already processed or being processed, skip.
  //       if (tracker.isDuplicate(submissionId)) {
  //         return;
  //       }
  //       tracker.startProcessing(submissionId);

  //       const response = await fetch(details.url);
  //       const data = await response.json();
  //       if (data.state !== "SUCCESS") {
  //         tracker.cancelProcessing(submissionId);
  //         return;
  //       }
  //       tracker.completeProcessing(submissionId);
  //       console.log(
  //         "🎯 VALID SUBMISSION DETECTED!, ID: " +
  //           submissionId +
  //           " Status: " +
  //           data.status_msg,
  //       );

  //       if (data.status_msg === "Accepted") {
  //         console.log("Accepted submission detected, sending to content script", data, submissionId, details.tabId);
  //         await handleAcceptedSubmission(data, submissionId, details.tabId);
  //       }
  //       // else {
  //       //   await handleFailedSubmission(data, submissionId);
  //       // }
  //     } catch (err) {
  //       console.error("Error in network listener:", err);
  //     }
  //   },
  //   { urls: ["*://leetcode.com/submissions/detail/*/check/*"] },
  // );
});
