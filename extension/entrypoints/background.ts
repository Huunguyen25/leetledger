import { createSubmissionTracker } from "@/background/submission-tracker";
import { registerIdentityStore } from "@/background/identity-store";
import {
  clearStaleResults,
  registerSubmissionHandler,
} from "@/background/submission-handler";

export default defineBackground(() => {
  const tracker = createSubmissionTracker(100);
  registerIdentityStore(tracker);
  registerSubmissionHandler(tracker);
  void clearStaleResults();
});
