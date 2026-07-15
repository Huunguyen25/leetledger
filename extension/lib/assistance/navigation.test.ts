import { describe, expect, it } from "vitest";
import { classifyAssistancePath } from "./navigation";

describe("classifyAssistancePath", () => {
  it("maps answer-bearing tabs to SOLUTION_PEEK", () => {
    expect(classifyAssistancePath("/problems/two-sum/editorial/")).toBe(
      "SOLUTION_PEEK",
    );
    expect(classifyAssistancePath("/problems/two-sum/solutions/")).toBe(
      "SOLUTION_PEEK",
    );
    expect(
      classifyAssistancePath("/problems/two-sum/solutions/12345/my-writeup/"),
    ).toBe("SOLUTION_PEEK");
    expect(classifyAssistancePath("/problems/two-sum/submissions/")).toBe(
      "SOLUTION_PEEK",
    );
  });

  it("returns null for the description tab and bare problem URLs", () => {
    expect(classifyAssistancePath("/problems/two-sum/")).toBeNull();
    expect(classifyAssistancePath("/problems/two-sum/description/")).toBeNull();
  });

  it("returns null for non-problem routes", () => {
    expect(classifyAssistancePath("/problemset/all/")).toBeNull();
    expect(classifyAssistancePath("/submissions/detail/123/")).toBeNull();
  });
});
