import { createSubmissionTracker } from "@/background/background.logic";
import {
  clearStaleResults,
  registerSubmissionHandler,
} from "@/background/submission-handler";

export default defineBackground(() => {
  const tracker = createSubmissionTracker(100);
  registerSubmissionHandler(tracker);
  void clearStaleResults();
});
