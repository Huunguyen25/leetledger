import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import constants from "@/constants";

describe("createSubmissionTracker", () => {
  let stored: Record<string, unknown>;

  beforeEach(() => {
    vi.resetModules();
    stored = {};
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: vi.fn(async (key?: string) =>
            key ? { [key]: stored[key] } : { ...stored },
          ),
          set: vi.fn(async (values: Record<string, unknown>) => {
            Object.assign(stored, values);
          }),
          remove: vi.fn(async (key: string) => {
            delete stored[key];
          }),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deduplicates in-flight and completed submissions", async () => {
    const { createSubmissionTracker } = await import("./submission-tracker");
    const tracker = createSubmissionTracker();

    expect(tracker.isDuplicate("1")).toBe(false);
    tracker.startProcessing("1");
    expect(tracker.isDuplicate("1")).toBe(true);

    tracker.cancelProcessing("1");
    expect(tracker.isDuplicate("1")).toBe(false);

    tracker.startProcessing("1");
    tracker.completeProcessing("1");
    expect(tracker.isDuplicate("1")).toBe(true);
  });

  it("evicts the oldest completed submission", async () => {
    const { createSubmissionTracker } = await import("./submission-tracker");
    const tracker = createSubmissionTracker(1);

    tracker.startProcessing("1");
    tracker.completeProcessing("1");
    tracker.startProcessing("2");
    tracker.completeProcessing("2");

    expect(tracker.isDuplicate("1")).toBe(false);
    expect(tracker.isDuplicate("2")).toBe(true);
  });

  it("clears only in-flight submissions", async () => {
    const { createSubmissionTracker } = await import("./submission-tracker");
    const tracker = createSubmissionTracker();
    tracker.startProcessing("in-flight");
    tracker.startProcessing("done");
    tracker.completeProcessing("done");

    tracker.clearProcessing();

    expect(tracker.isDuplicate("in-flight")).toBe(false);
    expect(tracker.isDuplicate("done")).toBe(true);
  });

  it("persists processed attemptIds across hydrate", async () => {
    const { createSubmissionTracker } = await import("./submission-tracker");
    const first = createSubmissionTracker();
    first.startProcessing("99");
    first.completeProcessing("99");
    await vi.waitFor(() =>
      expect(stored[constants.PROCESSED_ATTEMPTS_KEY]).toEqual({
        attemptIds: ["99"],
      }),
    );

    const second = createSubmissionTracker();
    await second.hydrate();
    expect(second.isDuplicate("99")).toBe(true);
  });
});
