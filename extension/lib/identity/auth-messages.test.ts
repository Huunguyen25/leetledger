import { describe, expect, it } from "vitest";
import { authToastKey, authToastMessage } from "./auth-messages";

describe("auth toast messages", () => {
  it("ignores transient network-only failures", () => {
    expect(authToastKey(["network_error"])).toBeNull();
  });

  it("creates a stable key regardless of reason order", () => {
    expect(
      authToastKey(["leetcode_signed_out", "extension_signed_out"]),
    ).toBe("extension_signed_out|leetcode_signed_out");
    expect(
      authToastKey(["extension_signed_out", "leetcode_signed_out"]),
    ).toBe("extension_signed_out|leetcode_signed_out");
  });

  it("describes the missing accounts", () => {
    expect(authToastMessage(["leetcode_signed_out"])).toContain("LeetCode");
    expect(authToastMessage(["extension_signed_out"])).toContain(
      "extension popup",
    );
  });
});
