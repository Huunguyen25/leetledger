export async function handleAcceptedSubmission(
  data: any,
  submissionId: string,
  tabId: number,
) {
  console.log("handleAcceptedSubmission", data, submissionId, tabId);
  if (!tabId || tabId === -1) {
    console.error("Failed to send message to tab", tabId);
    return;
  }
  try {
    await browser.tabs.sendMessage(tabId, {
      type: "SHOW_REVIEW_DRAWER",
      payload: data,
    });
  } catch (err) {
    console.error(`[Handler] Failed to contact tab ${tabId}:`, err);
  }
}

export async function handleFailedSubmission(data: any, submissionId: string) {
  console.log("Failed submission:", data, submissionId);
}
