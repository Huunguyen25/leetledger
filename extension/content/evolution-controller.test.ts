import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import constants from "@/constants";
import type { CodeMilestoneMessage } from "@/types/evolution";
import { startEvolutionTracking } from "./evolution-controller";

const mocks = vi.hoisted(() => ({ sendMessage: vi.fn() }));

vi.mock("wxt/browser", () => ({
  browser: { runtime: { sendMessage: mocks.sendMessage } },
}));

const CODE_V1 = "class Solution:\n    def twoSum(self):\n        return []\n";
const CODE_V2 = `${CODE_V1}\n        # use a hash map for complements\n`;

describe("evolution controller", () => {
  const sendMessage = mocks.sendMessage;
  let pathname: string;

  function start(
    readCode: ReturnType<typeof vi.fn>,
    intervalMs = 1000,
  ) {
    return startEvolutionTracking({
      intervalMs,
      getPathname: () => pathname,
      readCode: readCode as never,
    });
  }

  function observations() {
    return sendMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === constants.MESSAGE_TYPES.CODE_OBSERVED);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    pathname = "/problems/two-sum/";
    sendMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("forwards the first read and skips unchanged polls", async () => {
    const readCode = vi
      .fn()
      .mockResolvedValue({ ok: true, code: CODE_V1, language: "python3" });
    const controls = start(readCode);

    await vi.advanceTimersByTimeAsync(2100);
    controls.teardown();

    expect(readCode.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(observations()).toEqual([
      expect.objectContaining({
        source: "autosave",
        code: CODE_V1,
        language: "python3",
        problemSlug: "two-sum",
      }),
    ]);
  });

  it("forwards a changed version on a later tick", async () => {
    const readCode = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, code: CODE_V1, language: "python3" })
      .mockResolvedValue({ ok: true, code: CODE_V2, language: "python3" });
    const controls = start(readCode);

    await vi.advanceTimersByTimeAsync(1100);
    controls.teardown();

    expect(observations().map((message) => message.code)).toEqual([
      CODE_V1,
      CODE_V2,
    ]);
  });

  it("never runs two reads at once", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const readCode = vi.fn(async () => {
      maxInFlight = Math.max(maxInFlight, ++inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2500));
      inFlight--;
      return { ok: true, code: CODE_V1, language: "python3" };
    });
    const controls = start(readCode);

    await vi.advanceTimersByTimeAsync(6000);
    controls.teardown();

    expect(maxInFlight).toBe(1);
  });

  it("ignores non-problem routes and re-sends after returning", async () => {
    const readCode = vi
      .fn()
      .mockResolvedValue({ ok: true, code: CODE_V1, language: "python3" });
    const controls = start(readCode);

    await vi.advanceTimersByTimeAsync(1100);
    expect(observations()).toHaveLength(1);

    pathname = "/problemset/all/";
    controls.onNavigate();
    await vi.advanceTimersByTimeAsync(2100);
    expect(observations()).toHaveLength(1);

    // Returning to the problem resets local dedupe, so the head is re-reported
    // and the background can decide whether it is a duplicate.
    pathname = "/problems/two-sum/";
    controls.onNavigate();
    await vi.advanceTimersByTimeAsync(1100);
    controls.teardown();

    expect(observations()).toHaveLength(2);
  });

  it("forwards run milestones from the page bridge", async () => {
    const readCode = vi.fn().mockResolvedValue({ ok: false, reason: "read_failed" });
    const controls = start(readCode);
    const milestone: CodeMilestoneMessage = {
      type: constants.MESSAGE_TYPES.CODE_MILESTONE,
      token: "token",
      clientId: "client",
      source: "run",
      code: CODE_V2,
      language: "python3",
      problemSlug: "two-sum",
      timestamp: 1_700_000_000_000,
    };

    controls.recordMilestone(milestone);
    controls.teardown();

    expect(observations()).toEqual([
      expect.objectContaining({ source: "run", code: CODE_V2 }),
    ]);
  });

  it("asks the background to close an accepted session", async () => {
    const readCode = vi.fn().mockResolvedValue({ ok: false, reason: "read_failed" });
    const controls = start(readCode);

    controls.recordAcceptedSubmission({
      problemSlug: "two-sum",
      submissionId: "4242",
      code: CODE_V2,
      language: "python3",
    });
    controls.teardown();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
        problemSlug: "two-sum",
        submissionId: "4242",
        language: "python3",
      }),
    );
  });

  it("treats blank Accept language as missing and uses page detection", async () => {
    vi.stubGlobal("localStorage", {
      length: 1,
      key: (index: number) => (index === 0 ? "global_lang" : null),
      getItem: (key: string) => (key === "global_lang" ? '"python3"' : null),
    });

    const readCode = vi.fn().mockResolvedValue({ ok: false, reason: "read_failed" });
    const controls = start(readCode);

    controls.recordAcceptedSubmission({
      problemSlug: "two-sum",
      submissionId: "4242",
      code: CODE_V2,
      language: "",
    });
    controls.teardown();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
        language: "python3",
      }),
    );
  });

  it("does not re-send unchanged editor code after Accept", async () => {
    const readCode = vi
      .fn()
      .mockResolvedValue({ ok: true, code: CODE_V1, language: "python3" });
    const controls = start(readCode);

    await vi.advanceTimersByTimeAsync(1100);
    expect(observations()).toHaveLength(1);

    controls.recordAcceptedSubmission({
      problemSlug: "two-sum",
      submissionId: "4242",
      code: CODE_V1,
      language: "python3",
    });

    await vi.advanceTimersByTimeAsync(2100);
    controls.teardown();

    expect(observations()).toHaveLength(1);
  });

  it("stops reading and reporting after teardown", async () => {
    const readCode = vi
      .fn()
      .mockResolvedValue({ ok: true, code: CODE_V1, language: "python3" });
    const controls = start(readCode);

    await vi.advanceTimersByTimeAsync(1100);
    const readsBeforeTeardown = readCode.mock.calls.length;
    controls.teardown();
    await vi.advanceTimersByTimeAsync(5000);

    expect(readCode.mock.calls.length).toBe(readsBeforeTeardown);
    controls.recordMilestone({
      type: constants.MESSAGE_TYPES.CODE_MILESTONE,
      token: "token",
      clientId: "client",
      source: "submit",
      code: CODE_V2,
      language: "python3",
      problemSlug: "two-sum",
      timestamp: 1,
    });
    expect(observations()).toHaveLength(1);
  });
});
