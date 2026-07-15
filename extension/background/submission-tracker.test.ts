import { describe, expect, it } from "vitest";
import { createSubmissionTracker } from "./submission-tracker";

describe("createSubmissionTracker", () => {
  it("deduplicates in-flight and completed submissions", () => {
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

  it("evicts the oldest completed submission", () => {
    const tracker = createSubmissionTracker(1);

    tracker.startProcessing("1");
    tracker.completeProcessing("1");
    tracker.startProcessing("2");
    tracker.completeProcessing("2");

    expect(tracker.isDuplicate("1")).toBe(false);
    expect(tracker.isDuplicate("2")).toBe(true);
  });

  it("clears only in-flight submissions", () => {
    const tracker = createSubmissionTracker();
    tracker.startProcessing("in-flight");
    tracker.startProcessing("done");
    tracker.completeProcessing("done");

    tracker.clearProcessing();

    expect(tracker.isDuplicate("in-flight")).toBe(false);
    expect(tracker.isDuplicate("done")).toBe(true);
  });
});
