import { beforeEach, describe, expect, it, vi } from "vitest";
import constants from "@/constants";

const store = vi.hoisted(() => new Map<string, unknown>());

vi.mock("wxt/browser", () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
        set: vi.fn(async (values: Record<string, unknown>) => {
          Object.entries(values).forEach(([key, value]) => store.set(key, value));
        }),
        remove: vi.fn(async (key: string) => {
          store.delete(key);
        }),
      },
    },
  },
}));

import { getPendingOtpState, setPendingOtp } from "./pending-otp";

describe("pending OTP state", () => {
  beforeEach(() => {
    store.clear();
  });

  it("persists and restores the pending flow intent", async () => {
    await setPendingOtp("me@example.com", "sign-up");
    await expect(getPendingOtpState()).resolves.toMatchObject({
      email: "me@example.com",
      flow: "sign-up",
    });
  });

  it("defaults legacy records to sign-in flow", async () => {
    store.set(constants.PENDING_OTP_KEY, {
      email: "me@example.com",
      expiresAt: Date.now() + 60_000,
    });
    await expect(getPendingOtpState()).resolves.toMatchObject({
      email: "me@example.com",
      flow: "sign-in",
    });
  });
});
