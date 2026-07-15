import { describe, expect, it } from "vitest";
import {
  extractSubmissionId,
  getLeetCodeRouteContext,
  isValidSubmissionId,
  parseProblemSlugFromPathname,
} from "./routes";

describe("LeetCode problem routes", () => {
  it("extracts a problem slug", () => {
    expect(parseProblemSlugFromPathname("/problems/two-sum/")).toBe("two-sum");
    expect(parseProblemSlugFromPathname("/problemset/all/")).toBeNull();
  });

  it("classifies problem and submission-detail routes", () => {
    expect(getLeetCodeRouteContext("/problems/two-sum/")).toEqual({
      kind: "problem",
      slug: "two-sum",
    });
    expect(
      getLeetCodeRouteContext("/submissions/detail/123/check/"),
    ).toEqual({ kind: "submission_detail" });
    expect(getLeetCodeRouteContext("/problemset/all/")).toEqual({
      kind: "other",
    });
  });
});

describe("LeetCode submission routes", () => {
  it("extracts IDs from current and versioned check URLs", () => {
    expect(
      extractSubmissionId("/submissions/detail/123/check/"),
    ).toBe("123");
    expect(
      extractSubmissionId("/submissions/detail/456/v2/check/"),
    ).toBe("456");
  });

  it("rejects missing and non-numeric submission IDs", () => {
    expect(extractSubmissionId("/problems/two-sum/")).toBeNull();
    expect(isValidSubmissionId("123")).toBe(true);
    expect(isValidSubmissionId("run-code")).toBe(false);
  });
});
