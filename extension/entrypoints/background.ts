import { createSubmissionTracker } from "@/background/submission-tracker";
import {
  registerEvolutionHandler,
  retryPendingArchives,
} from "@/background/evolution-handler";
import { registerIdentityStore } from "@/background/identity-store";
import { registerQuestionIdHandler } from "@/background/question-id-handler";
import {
  clearStaleResults,
  registerSubmissionHandler,
} from "@/background/submission-handler";

export default defineBackground(() => {
  const tracker = createSubmissionTracker(100);
  registerIdentityStore(tracker);
  registerSubmissionHandler(tracker);
  registerEvolutionHandler();
  registerQuestionIdHandler();
  void clearStaleResults();
  void retryPendingArchives();
});
