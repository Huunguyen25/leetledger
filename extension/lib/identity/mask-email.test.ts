import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask-email";

describe("maskEmail", () => {
  it("keeps the first local character and full domain", () => {
    expect(maskEmail("skepzie.m@gmail.com")).toBe("s••••@gmail.com");
  });

  it("handles short local parts", () => {
    expect(maskEmail("ab@x.co")).toBe("a••••@x.co");
  });

  it("returns a fallback for invalid input", () => {
    expect(maskEmail("")).toBe("••••");
    expect(maskEmail("not-an-email")).toBe("••••");
  });
});
