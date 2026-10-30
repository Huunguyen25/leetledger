import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import constants from "@/constants";

const mocks = vi.hoisted(() => ({
  addStorageListener: vi.fn(),
  assistanceRecord: vi.fn(),
  assistanceHandleNavigation: vi.fn(),
  assistanceGetPrimary: vi.fn(() => "NONE"),
  assistanceClearAfterSubmit: vi.fn(),
  createShadowRootUi: vi.fn(),
  detectorTeardown: vi.fn(),
  getUrl: vi.fn(() => "chrome-extension://test/fetch-bridge.js"),
  isMuted: vi.fn(),
  removeStorageListener: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: {
      getURL: mocks.getUrl,
      sendMessage: mocks.sendMessage,
    },
    storage: {
      local: {
        onChanged: {
          addListener: mocks.addStorageListener,
          removeListener: mocks.removeStorageListener,
        },
        remove: vi.fn(),
      },
    },
  },
}));

vi.mock("wxt/utils/content-script-ui/shadow-root", () => ({
  createShadowRootUi: mocks.createShadowRootUi,
}));

vi.mock("@/components/page/ReviewDrawer/ReviewForm", () => ({
  default: () => null,
}));

vi.mock("@/lib/assistance/detectors", () => ({
  setupAssistanceDetectors: vi.fn(() => ({
    teardown: mocks.detectorTeardown,
  })),
}));

vi.mock("@/lib/assistance/session", () => ({
  createAssistanceSession: vi.fn(() => ({
    record: mocks.assistanceRecord,
    handleNavigation: mocks.assistanceHandleNavigation,
    getPrimary: mocks.assistanceGetPrimary,
    clearAfterSubmit: mocks.assistanceClearAfterSubmit,
  })),
}));

vi.mock("@/lib/review/mute", () => ({
  isMuted: mocks.isMuted,
}));

vi.mock("@/lib/review/open-request", () => ({
  consumeOpenReviewRequest: vi.fn(async () => null),
}));

vi.mock("@/lib/review/prompt-gate", () => ({
  claimReviewPrompt: vi.fn(async () => ({ open: true })),
  markReviewCompleted: vi.fn(async () => undefined),
  markReviewSkipped: vi.fn(async () => undefined),
  releaseReviewClaim: vi.fn(async () => undefined),
}));

vi.mock("@/lib/review/incomplete", () => ({
  upsertIncompleteReview: vi.fn(async () => undefined),
}));

vi.mock("@/lib/review/result-handoff", () => ({
  listPendingResultsForProblem: vi.fn(async () => []),
}));

describe("tracking controller page-message boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("bridge-token")
        .mockReturnValueOnce("client-1"),
    });
    window.history.replaceState({}, "", "/problems/two-sum/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.head.querySelectorAll("script").forEach((script) => script.remove());
  });

  it("forwards only trusted submission messages to the background worker", async () => {
    const { startContentTracking } = await import("./tracking-controller");
    const controls = startContentTracking({} as ContentScriptContext);

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: "https://unexpected.example",
        data: {
          type: constants.MESSAGE_TYPES.SUBMISSION_INTERCEPTED,
          token: "bridge-token",
          clientId: "client-1",
          attemptId: "123",
        },
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          type: constants.MESSAGE_TYPES.SUBMISSION_INTERCEPTED,
          token: "wrong-token",
          clientId: "client-1",
          attemptId: "123",
        },
      }),
    );
    expect(mocks.sendMessage).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          type: constants.MESSAGE_TYPES.SUBMISSION_INTERCEPTED,
          token: "bridge-token",
          clientId: "client-1",
          attemptId: "123",
          difficulty: "Easy",
          typedCode: "return [0, 1]",
          lang: "typescript",
          topicTags: [{ name: "Array", slug: "array" }],
          submissionData: { status_msg: "Accepted" },
        },
      }),
    );

    expect(mocks.sendMessage).toHaveBeenCalledWith({
      type: constants.MESSAGE_TYPES.SUBMISSION_RESULT,
      clientId: "client-1",
      attemptId: "123",
      problemSlug: "two-sum",
      submissionData: { status_msg: "Accepted" },
      difficulty: "Easy",
      typedCode: "return [0, 1]",
      lang: "typescript",
      topicTags: [{ name: "Array", slug: "array" }],
    });

    controls.teardown();
    expect(mocks.removeStorageListener).toHaveBeenCalledOnce();
    expect(mocks.detectorTeardown).toHaveBeenCalledOnce();
  });

  it("records trusted assistance signals without forwarding them", async () => {
    const { startContentTracking } = await import("./tracking-controller");
    const controls = startContentTracking({} as ContentScriptContext);

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          type: constants.MESSAGE_TYPES.ASSISTANCE_SIGNAL,
          token: "bridge-token",
          clientId: "client-1",
          level: "HINT",
          problemSlug: "two-sum",
          timestamp: Date.now(),
        },
      }),
    );

    expect(mocks.assistanceRecord).toHaveBeenCalledWith("HINT", "two-sum");
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    controls.teardown();
  });
});
