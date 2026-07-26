import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import constants from "@/constants";
import { createSubmissionTracker } from "./submission-tracker";

const { getActiveIdentity } = vi.hoisted(() => ({
  getActiveIdentity: vi.fn(),
}));

vi.mock("@/background/identity-store", () => ({ getActiveIdentity }));

type RuntimeListener = (message: Record<string, unknown>) => void;

describe("submission handler boundary", () => {
  let runtimeListener: RuntimeListener | undefined;
  let storageSet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    runtimeListener = undefined;
    storageSet = vi.fn(async () => undefined);
    getActiveIdentity.mockReset();

    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          remove: vi.fn(async () => undefined),
          set: storageSet,
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener: RuntimeListener) => {
            runtimeListener = listener;
          }),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores submission messages while identity is inactive", async () => {
    getActiveIdentity.mockReturnValue(null);
    const { registerSubmissionHandler } = await import("./submission-handler");
    registerSubmissionHandler(createSubmissionTracker());

    runtimeListener?.({
      type: constants.MESSAGE_TYPES.SUBMISSION_RESULT,
      attemptId: "123",
      clientId: "client-1",
      submissionData: { status_msg: "Accepted" },
    });

    expect(storageSet).not.toHaveBeenCalled();
  });

  it("normalizes and persists an accepted submission", async () => {
    getActiveIdentity.mockReturnValue({
      state: "active",
      leetcodeUsername: "alice",
      supabaseUid: "user-1",
      updatedAt: Date.now(),
    });
    const { registerSubmissionHandler } = await import("./submission-handler");
    registerSubmissionHandler(createSubmissionTracker());

    runtimeListener?.({
      type: constants.MESSAGE_TYPES.SUBMISSION_RESULT,
      attemptId: "123",
      clientId: "client-1",
      problemSlug: "two-sum",
      difficulty: "Easy",
      typedCode: "return [0, 1]",
      lang: "typescript",
      topicTags: [{ name: "Array", slug: "array" }],
      submissionData: {
        status_msg: "Accepted",
        question_id: 1,
      },
    });

    await vi.waitFor(() => expect(storageSet).toHaveBeenCalledOnce());
    expect(storageSet).toHaveBeenCalledWith({
      [`${constants.STORAGE_PREFIX}client-1:123`]: {
        data: {
          status: "Accepted",
          problemSlug: "two-sum",
          difficulty: "Easy",
          questionId: "1",
          code: "return [0, 1]",
          lang: "typescript",
          topicTags: [{ name: "Array", slug: "array" }],
        },
      },
    });
  });

  it("cancels rejected submissions so a later result can be processed", async () => {
    getActiveIdentity.mockReturnValue({
      state: "active",
      leetcodeUsername: "alice",
      supabaseUid: "user-1",
      updatedAt: Date.now(),
    });
    const tracker = createSubmissionTracker();
    const cancelProcessing = vi.spyOn(tracker, "cancelProcessing");
    const { registerSubmissionHandler } = await import("./submission-handler");
    registerSubmissionHandler(tracker);

    runtimeListener?.({
      type: constants.MESSAGE_TYPES.SUBMISSION_RESULT,
      attemptId: "123",
      clientId: "client-1",
      submissionData: { status_msg: "Wrong Answer" },
    });

    expect(cancelProcessing).toHaveBeenCalledWith("123");
    expect(tracker.isDuplicate("123")).toBe(false);
    expect(storageSet).not.toHaveBeenCalled();
  });
});
