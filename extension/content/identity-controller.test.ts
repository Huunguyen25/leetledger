import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import constants from "@/constants";

const mocks = vi.hoisted(() => ({
  addStorageListener: vi.fn(),
  createShadowRootUi: vi.fn(),
  resolveIdentity: vi.fn(),
  sendMessage: vi.fn(),
  startContentTracking: vi.fn(),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: { sendMessage: mocks.sendMessage },
    storage: {
      local: {
        onChanged: { addListener: mocks.addStorageListener },
      },
    },
  },
}));

vi.mock("wxt/utils/content-script-ui/shadow-root", () => ({
  createShadowRootUi: mocks.createShadowRootUi,
}));

vi.mock("@/lib/identity/resolve", () => ({
  resolveIdentity: mocks.resolveIdentity,
}));

vi.mock("./tracking-controller", () => ({
  startContentTracking: mocks.startContentTracking,
}));

describe("identity controller boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createShadowRootUi.mockResolvedValue({
      mount: vi.fn(),
      remove: vi.fn(),
    });
  });

  it("starts tracking once and tears it down on an account-change snapshot", async () => {
    const teardown = vi.fn();
    const onNavigate = vi.fn();
    let storageListener:
      | ((changes: Record<string, { newValue?: unknown }>) => void)
      | undefined;
    let navigationListener: (() => void) | undefined;

    mocks.resolveIdentity.mockResolvedValue({
      ok: true,
      identity: {
        leetcodeUsername: "alice",
        supabaseUid: "user-1",
      },
    });
    mocks.sendMessage.mockResolvedValue({ state: "active" });
    mocks.startContentTracking.mockReturnValue({ teardown, onNavigate });
    mocks.addStorageListener.mockImplementation((listener) => {
      storageListener = listener;
    });

    const ctx = {
      addEventListener: vi.fn(
        (_target: Window, _type: string, listener: () => void) => {
          navigationListener = listener;
        },
      ),
    } as unknown as ContentScriptContext;

    const { startIdentityController } = await import("./identity-controller");
    await startIdentityController(ctx);

    expect(mocks.sendMessage).toHaveBeenCalledWith({
      type: constants.MESSAGE_TYPES.IDENTITY_REPORT,
      leetcodeUsername: "alice",
      supabaseUid: "user-1",
      reasons: [],
    });
    expect(mocks.startContentTracking).toHaveBeenCalledOnce();

    navigationListener?.();
    await vi.waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledTimes(2));
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(mocks.startContentTracking).toHaveBeenCalledOnce();

    storageListener?.({
      [constants.IDENTITY_KEY]: {
        newValue: { state: "account_changed" },
      },
    });
    expect(teardown).toHaveBeenCalledOnce();
    await vi.waitFor(() =>
      expect(mocks.createShadowRootUi).toHaveBeenCalledOnce(),
    );
  });
});
