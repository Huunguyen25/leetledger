import { createSubmissionTracker } from "@/background/background.logic";
import { registerSubmissionHandler } from "@/background/submission-handler";

export default defineBackground(() => {
  const tracker = createSubmissionTracker(100);
  registerSubmissionHandler(tracker);
});
