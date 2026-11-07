import { describe, expect, it } from "vitest";
import { isCurrentSessionRequest } from "./request-guard";

describe("isCurrentSessionRequest", () => {
  it("accepts a response from the active account and generation", () => {
    expect(
      isCurrentSessionRequest(
        { generation: 3, userId: "account-a" },
        3,
        "account-a",
      ),
    ).toBe(true);
  });

  it("rejects a response started before the latest auth transition", () => {
    expect(
      isCurrentSessionRequest(
        { generation: 2, userId: "account-a" },
        3,
        "account-a",
      ),
    ).toBe(false);
  });

  it("rejects a response from another account", () => {
    expect(
      isCurrentSessionRequest(
        { generation: 3, userId: "account-a" },
        3,
        "account-b",
      ),
    ).toBe(false);
  });

  it("rejects a response after sign-out", () => {
    expect(
      isCurrentSessionRequest(
        { generation: 3, userId: "account-a" },
        4,
        null,
      ),
    ).toBe(false);
  });
});
