import { createSubmissionTracker } from "@/background/submission-tracker";
import { registerEvolutionHandler } from "@/background/evolution-handler";
import { registerIdentityStore } from "@/background/identity-store";
import { registerQuestionIdHandler } from "@/background/question-id-handler";
import {
  clearStaleResults,
  registerSubmissionHandler,
} from "@/background/submission-handler";
import {
  drainPendingSync,
  registerSyncDrain,
} from "@/background/sync-drain";

export default defineBackground(() => {
  const tracker = createSubmissionTracker(100);
  registerIdentityStore(tracker);
  registerSubmissionHandler(tracker);
  registerEvolutionHandler();
  registerQuestionIdHandler();
  registerSyncDrain();

  void (async () => {
    await tracker.hydrate();
    await clearStaleResults();
    await drainPendingSync();
  })();
});
