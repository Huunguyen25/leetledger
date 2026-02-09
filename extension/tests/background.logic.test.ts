import { describe, it, expect, beforeEach } from "vitest";
import {
  isSubmissionUrl,
  extractSubmissionId,
  isValidSubmissionId,
  createSubmissionTracker,
} from "../utils/background.logic";

describe("background.ts URL filtering", () => {
  describe("isSubmissionUrl", () => {
    it("should return true for URLs containing /check/", () => {
      expect(
        isSubmissionUrl(
          "https://leetcode.com/submissions/detail/123456/check/",
        ),
      ).toBe(true);
    });

    it("should return false for URLs not containing /check/", () => {
      expect(isSubmissionUrl("https://leetcode.com/problems/two-sum/")).toBe(
        false,
      );
      expect(
        isSubmissionUrl("https://leetcode.com/submissions/detail/123456/"),
      ).toBe(false);
      expect(isSubmissionUrl("https://google.com")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isSubmissionUrl("")).toBe(false);
    });
  });

  describe("extractSubmissionId", () => {
    it("should extract numeric submission ID from valid URL", () => {
      expect(
        extractSubmissionId(
          "https://leetcode.com/submissions/detail/123456/check/",
        ),
      ).toBe("123456");
    });

    it("should extract alphanumeric submission ID (test runs)", () => {
      expect(
        extractSubmissionId(
          "https://leetcode.com/submissions/detail/runcode_abc123/check/",
        ),
      ).toBe("runcode_abc123");
    });

    it("should return null for non-matching URLs", () => {
      expect(
        extractSubmissionId("https://leetcode.com/problems/two-sum/"),
      ).toBe(null);
      expect(extractSubmissionId("https://leetcode.com/check/")).toBe(null);
      expect(extractSubmissionId("")).toBe(null);
    });
  });

  describe("isValidSubmissionId", () => {
    it("should return true for numeric submission IDs", () => {
      expect(isValidSubmissionId("123456")).toBe(true);
      expect(isValidSubmissionId("1")).toBe(true);
      expect(isValidSubmissionId("99999999999")).toBe(true);
    });

    it("should return false for non-numeric submission IDs (test runs)", () => {
      expect(isValidSubmissionId("runcode_123")).toBe(false);
      expect(isValidSubmissionId("runcode_abc123_def")).toBe(false);
      expect(isValidSubmissionId("test")).toBe(false);
      expect(isValidSubmissionId("123abc")).toBe(false);
      expect(isValidSubmissionId("")).toBe(false);
    });
  });
});

describe("background.ts duplicate processing prevention", () => {
  let tracker: ReturnType<typeof createSubmissionTracker>;

  beforeEach(() => {
    tracker = createSubmissionTracker(3); // Small limit for testing
  });

  describe("isDuplicate", () => {
    it("should return false for new submission IDs", () => {
      expect(tracker.isDuplicate("123")).toBe(false);
      expect(tracker.isDuplicate("456")).toBe(false);
    });

    it("should return true for submissions currently being processed", () => {
      tracker.startProcessing("123");
      expect(tracker.isDuplicate("123")).toBe(true);
    });

    it("should return true for already processed submissions", () => {
      tracker.startProcessing("123");
      tracker.completeProcessing("123");
      expect(tracker.isDuplicate("123")).toBe(true);
    });

    it("should return false after processing is cancelled", () => {
      tracker.startProcessing("123");
      tracker.cancelProcessing("123");
      expect(tracker.isDuplicate("123")).toBe(false);
    });
  });

  describe("processing lifecycle", () => {
    it("should track processing state correctly", () => {
      expect(tracker.getProcessingCount()).toBe(0);

      tracker.startProcessing("123");
      expect(tracker.getProcessingCount()).toBe(1);

      tracker.completeProcessing("123");
      expect(tracker.getProcessingCount()).toBe(0);
      expect(tracker.getProcessedCount()).toBe(1);
    });

    it("should handle multiple concurrent processing submissions", () => {
      tracker.startProcessing("123");
      tracker.startProcessing("456");
      tracker.startProcessing("789");

      expect(tracker.getProcessingCount()).toBe(3);
      expect(tracker.isDuplicate("123")).toBe(true);
      expect(tracker.isDuplicate("456")).toBe(true);
      expect(tracker.isDuplicate("789")).toBe(true);

      tracker.completeProcessing("456");
      expect(tracker.getProcessingCount()).toBe(2);
      expect(tracker.getProcessedCount()).toBe(1);
    });
  });

  describe("eviction policy", () => {
    it("should evict oldest submission when exceeding maxStored", () => {
      // Max is 3 for this test
      tracker.startProcessing("1");
      tracker.completeProcessing("1");

      tracker.startProcessing("2");
      tracker.completeProcessing("2");

      tracker.startProcessing("3");
      tracker.completeProcessing("3");

      expect(tracker.getProcessedCount()).toBe(3);
      expect(tracker.isDuplicate("1")).toBe(true);

      // Adding 4th should evict "1"
      tracker.startProcessing("4");
      tracker.completeProcessing("4");

      expect(tracker.getProcessedCount()).toBe(3);
      expect(tracker.isDuplicate("1")).toBe(false); // Evicted
      expect(tracker.isDuplicate("2")).toBe(true);
      expect(tracker.isDuplicate("3")).toBe(true);
      expect(tracker.isDuplicate("4")).toBe(true);
    });
  });
});
