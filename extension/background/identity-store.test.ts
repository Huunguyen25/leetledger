import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import constants from "@/constants";
import { createSubmissionTracker } from "./submission-tracker";

type RuntimeListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean | void;

describe("identity store boundary", () => {
  let runtimeListener: RuntimeListener | undefined;
  let stored: Record<string, unknown>;
  let storageGet: ReturnType<typeof vi.fn>;
  let storageSet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    stored = {};
    storageGet = vi.fn(async (key?: string) =>
      key ? { [key]: stored[key] } : { ...stored },
    );
    storageSet = vi.fn(async (values: Record<string, unknown>) => {
      Object.assign(stored, values);
    });

    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: storageGet,
          set: storageSet,
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener: RuntimeListener) => {
            runtimeListener = listener;
          }),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function reportIdentity(message: Record<string, unknown>) {
    const response = vi.fn();
    expect(
      runtimeListener?.(
        {
          type: constants.MESSAGE_TYPES.IDENTITY_REPORT,
          reasons: [],
          ...message,
        },
        {},
        response,
      ),
    ).toBe(true);
    await vi.waitFor(() => expect(response).toHaveBeenCalledOnce());
    return response.mock.calls[0][0];
  }

  it("persists active identity and detects account changes", async () => {
    const tracker = createSubmissionTracker();
    const clearProcessing = vi.spyOn(tracker, "clearProcessing");
    const { registerIdentityStore, getActiveIdentity } = await import(
      "./identity-store"
    );

    registerIdentityStore(tracker);
    await vi.waitFor(() => expect(storageGet).toHaveBeenCalled());

    await expect(
      reportIdentity({
        leetcodeUsername: "alice",
        supabaseUid: "user-1",
      }),
    ).resolves.toEqual({ state: "active" });
    expect(getActiveIdentity()).toMatchObject({
      state: "active",
      leetcodeUsername: "alice",
      supabaseUid: "user-1",
    });

    await expect(
      reportIdentity({
        leetcodeUsername: "bob",
        supabaseUid: "user-2",
      }),
    ).resolves.toEqual({ state: "account_changed" });
    expect(clearProcessing).toHaveBeenCalledOnce();
    expect(getActiveIdentity()).toBeNull();
    expect(storageSet).toHaveBeenLastCalledWith({
      [constants.IDENTITY_KEY]: expect.objectContaining({
        state: "account_changed",
        leetcodeUsername: "bob",
        supabaseUid: "user-2",
      }),
    });
  });

  it("persists an inactive snapshot when either identity is missing", async () => {
    const tracker = createSubmissionTracker();
    const { registerIdentityStore, getActiveIdentity } = await import(
      "./identity-store"
    );

    registerIdentityStore(tracker);
    await vi.waitFor(() => expect(storageGet).toHaveBeenCalled());

    await expect(
      reportIdentity({
        leetcodeUsername: "alice",
        supabaseUid: null,
      }),
    ).resolves.toEqual({ state: "inactive" });
    expect(getActiveIdentity()).toBeNull();
    expect(storageSet).toHaveBeenLastCalledWith({
      [constants.IDENTITY_KEY]: expect.objectContaining({
        state: "inactive",
        leetcodeUsername: "alice",
        supabaseUid: null,
      }),
    });
  });
});
