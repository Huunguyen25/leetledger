import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import constants from "@/constants";

const mocks = vi.hoisted(() => ({
  addStorageListener: vi.fn(),
  removeStorageListener: vi.fn(),
  assistanceRecord: vi.fn(),
  assistanceHandleNavigation: vi.fn(),
  assistanceGetPrimary: vi.fn(() => "NONE"),
  assistanceClearAfterSubmit: vi.fn(),
  createShadowRootUi: vi.fn(),
  detectorTeardown: vi.fn(),
  evolutionOnNavigate: vi.fn(),
  evolutionTeardown: vi.fn(),
  evolutionRecordAccepted: vi.fn(),
  evolutionRecordMilestone: vi.fn(),
  getUrl: vi.fn(() => "chrome-extension://test/fetch-bridge.js"),
  isMuted: vi.fn(async () => false),
  sendMessage: vi.fn(),
  claimReviewPrompt: vi.fn(async () => ({ open: true })),
  markReviewCompleted: vi.fn(async () => undefined),
  markReviewSkipped: vi.fn(async () => undefined),
  releaseReviewClaim: vi.fn(async () => undefined),
  consumeOpenReviewRequest: vi.fn(async () => null),
  upsertIncompleteReview: vi.fn(async () => undefined),
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

vi.mock("@/lib/review/prompt-gate", () => ({
  claimReviewPrompt: mocks.claimReviewPrompt,
  markReviewCompleted: mocks.markReviewCompleted,
  markReviewSkipped: mocks.markReviewSkipped,
  releaseReviewClaim: mocks.releaseReviewClaim,
}));

vi.mock("@/lib/review/open-request", () => ({
  consumeOpenReviewRequest: mocks.consumeOpenReviewRequest,
}));

vi.mock("@/lib/review/incomplete", () => ({
  upsertIncompleteReview: mocks.upsertIncompleteReview,
}));

vi.mock("@/lib/review/result-handoff", () => ({
  listPendingResultsForProblem: vi.fn(async () => []),
}));

vi.mock("./evolution-controller", () => ({
  startEvolutionTracking: vi.fn(() => ({
    onNavigate: mocks.evolutionOnNavigate,
    teardown: mocks.evolutionTeardown,
    recordAcceptedSubmission: mocks.evolutionRecordAccepted,
    recordMilestone: mocks.evolutionRecordMilestone,
  })),
}));

describe("tracking controller reinject smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "uuid"),
    });
    window.history.replaceState({}, "", "/problems/two-sum/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.head.querySelectorAll("script").forEach((script) => script.remove());
  });

  it("survives teardown + reinject and forwards location-driven navigate", async () => {
    const { startContentTracking, trackingControllerTestUtils } = await import(
      "./tracking-controller"
    );

    const first = startContentTracking({} as ContentScriptContext);
    first.teardown();
    expect(mocks.removeStorageListener).toHaveBeenCalledOnce();
    expect(mocks.evolutionTeardown).toHaveBeenCalledOnce();

    const second = startContentTracking({} as ContentScriptContext);
    second.onNavigate();
    expect(mocks.evolutionOnNavigate).toHaveBeenCalled();
    expect(mocks.assistanceHandleNavigation).toHaveBeenCalled();
    second.teardown();

    expect(
      trackingControllerTestUtils.shouldTeardownReviewForm(
        "/problems/add-two-numbers/",
        "two-sum",
      ),
    ).toBe(true);
    expect(
      trackingControllerTestUtils.shouldTeardownReviewForm(
        "/problems/two-sum/submissions/123/",
        "two-sum",
      ),
    ).toBe(false);

    // Keep the storage prefix contract visible in smoke coverage.
    expect(constants.STORAGE_PREFIX).toBe("ll_result:");
  });
});
