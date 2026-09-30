import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import constants from "@/constants";

type RuntimeListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean | void;

const mocks = vi.hoisted(() => {
  const stored: Record<string, unknown> = {};
  const storage = {
    local: {
      get: vi.fn(async (key?: string) => {
        await Promise.resolve();
        return key ? { [key]: stored[key] } : { ...stored };
      }),
      set: vi.fn(async (values: Record<string, unknown>) => {
        Object.assign(stored, values);
      }),
    },
  };
  return { stored, storage };
});

vi.mock("wxt/browser", () => ({
  browser: {
    storage: mocks.storage,
  },
}));

describe("question-id background writer", () => {
  let runtimeListener: RuntimeListener | undefined;

  beforeEach(() => {
    vi.resetModules();
    runtimeListener = undefined;
    for (const key of Object.keys(mocks.stored)) {
      delete mocks.stored[key];
    }
    mocks.storage.local.get.mockClear();
    mocks.storage.local.set.mockClear();

    vi.stubGlobal("browser", {
      storage: mocks.storage,
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

  async function persist(problemSlug: string, questionId: string) {
    const response = vi.fn();
    expect(
      runtimeListener?.(
        {
          type: constants.MESSAGE_TYPES.PERSIST_QUESTION_ID,
          problemSlug,
          questionId,
        },
        {},
        response,
      ),
    ).toBe(true);
    await vi.waitFor(() => expect(response).toHaveBeenCalledOnce());
    return response.mock.calls[0]![0];
  }

  it("keeps concurrent slug writes instead of letting the later overwrite the earlier", async () => {
    const { registerQuestionIdHandler } = await import("./question-id-handler");
    registerQuestionIdHandler();

    await Promise.all([
      persist("two-sum", "1"),
      persist("add-two-numbers", "2"),
    ]);

    expect(mocks.stored[constants.PROBLEM_ID_MAP_KEY]).toEqual({
      "two-sum": "1",
      "add-two-numbers": "2",
    });
  });

  it("ignores malformed persist messages", async () => {
    const { registerQuestionIdHandler } = await import("./question-id-handler");
    registerQuestionIdHandler();

    const response = vi.fn();
    expect(
      runtimeListener?.(
        {
          type: constants.MESSAGE_TYPES.PERSIST_QUESTION_ID,
          problemSlug: "two-sum",
        },
        {},
        response,
      ),
    ).toBeUndefined();
    expect(response).not.toHaveBeenCalled();
  });
});
