import { describe, expect, it } from "vitest";
import { normalizeReviewInput } from "./repository";
import type { ReviewInput } from "./types";

function baseInput(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return {
    problemSlug: "two-sum",
    problemTitle: "Two Sum",
    difficulty: "Easy",
    mastery: 9,
    assistance: "NONE",
    ...overrides,
  };
}

describe("normalizeReviewInput", () => {
  it("caps mastery to the assistance SRS weight", () => {
    expect(normalizeReviewInput(baseInput({ mastery: 9, assistance: "HINT" }))).toMatchObject({
      mastery: 7,
      assistance: "HINT",
    });
    expect(
      normalizeReviewInput(baseInput({ mastery: 9, assistance: "SOLUTION_PEEK" })),
    ).toMatchObject({ mastery: 4 });
    expect(
      normalizeReviewInput(
        baseInput({ mastery: 9, assistance: "SOLUTION_COPIED" }),
      ),
    ).toMatchObject({ mastery: 1 });
  });

  it("leaves mastery alone when already under the cap", () => {
    expect(
      normalizeReviewInput(baseInput({ mastery: 3, assistance: "HINT" })),
    ).toMatchObject({ mastery: 3 });
  });

  it("rejects invalid assistance even if mastery looks fine", () => {
    expect(
      normalizeReviewInput(
        baseInput({ assistance: "GPT_HELP" as ReviewInput["assistance"] }),
      ),
    ).toBeNull();
  });

  it("bounds raw mastery into 1..10 before applying the assistance cap", () => {
    expect(
      normalizeReviewInput(baseInput({ mastery: 99, assistance: "NONE" })),
    ).toMatchObject({ mastery: 10 });
    expect(
      normalizeReviewInput(baseInput({ mastery: 0, assistance: "NONE" })),
    ).toMatchObject({ mastery: 1 });
  });
});
