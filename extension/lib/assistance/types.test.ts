import { describe, expect, it } from "vitest";
import { ASSISTANCE_SRS_WEIGHTS, cappedMasteryForSrs } from "./config";
import { pickPrimaryAssistance } from "./types";

describe("pickPrimaryAssistance", () => {
  it("prefers SOLUTION_PEEK over HINT", () => {
    expect(pickPrimaryAssistance(["HINT", "SOLUTION_PEEK"])).toBe(
      "SOLUTION_PEEK",
    );
  });

  it("returns NONE when nothing detected", () => {
    expect(pickPrimaryAssistance([])).toBe("NONE");
  });
});

describe("ASSISTANCE_SRS_WEIGHTS", () => {
  it("matches the four-level model", () => {
    expect(ASSISTANCE_SRS_WEIGHTS).toEqual({
      NONE: 10,
      HINT: 7,
      SOLUTION_PEEK: 4,
      SOLUTION_COPIED: 1,
    });
  });
});

describe("cappedMasteryForSrs", () => {
  it("caps slider mastery by assistance tier", () => {
    expect(cappedMasteryForSrs(9, "NONE")).toBe(9);
    expect(cappedMasteryForSrs(9, "HINT")).toBe(7);
    expect(cappedMasteryForSrs(9, "SOLUTION_PEEK")).toBe(4);
    expect(cappedMasteryForSrs(9, "SOLUTION_COPIED")).toBe(1);
  });

  it("does not raise mastery above the slider", () => {
    expect(cappedMasteryForSrs(3, "HINT")).toBe(3);
    expect(cappedMasteryForSrs(1, "SOLUTION_COPIED")).toBe(1);
  });
});
