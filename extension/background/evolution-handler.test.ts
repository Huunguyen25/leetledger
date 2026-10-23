import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import constants from "@/constants";
import {
  getActiveTimeline,
  listTimelines,
  closeTimelineDb,
} from "@/lib/evolution/storage";
import type { IdentitySnapshot } from "@/types/identity";

const mocks = vi.hoisted(() => ({
  getActiveIdentity: vi.fn(),
  archiveTimeline: vi.fn(),
}));

vi.mock("@/background/identity-store", () => ({
  getActiveIdentity: mocks.getActiveIdentity,
}));

vi.mock("@/lib/evolution/archive", () => ({
  archiveTimeline: mocks.archiveTimeline,
}));

const ALICE: IdentitySnapshot = {
  state: "active",
  supabaseUid: "uid-alice",
  leetcodeUsername: "alice",
  updatedAt: 0,
};

const IDENTITY = {
  supabaseUid: "uid-alice",
  leetcodeUsername: "alice",
  problemSlug: "two-sum",
  language: "python3",
};

const CODE_V1 = "class Solution:\n    def twoSum(self):\n        return []\n";
const CODE_V2 = `${CODE_V1}\n        # remember complements in a dict\n`;

function observed(code: string, source = "autosave", submissionId?: string) {
  return {
    type: constants.MESSAGE_TYPES.CODE_OBSERVED,
    source,
    code,
    language: "python3",
    problemSlug: "two-sum",
    timestamp: Date.now(),
    ...(submissionId && { submissionId }),
  };
}

describe("evolution handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    closeTimelineDb();
    indexedDB = new IDBFactory();
    mocks.getActiveIdentity.mockReturnValue(ALICE);
    mocks.archiveTimeline.mockResolvedValue({ ok: true });
  });

  it("rejects observations when no identity is active", async () => {
    mocks.getActiveIdentity.mockReturnValue(null);
    const { handleCodeObserved } = await import("./evolution-handler");

    await expect(handleCodeObserved(observed(CODE_V1) as never)).resolves.toEqual(
      { status: "rejected", reason: "identity_inactive" },
    );
    expect(await listTimelines(IDENTITY)).toHaveLength(0);
  });

  it("stores the first version and reports ignored repeats", async () => {
    const { handleCodeObserved } = await import("./evolution-handler");

    await expect(
      handleCodeObserved(observed(CODE_V1) as never),
    ).resolves.toMatchObject({ status: "stored", sequence: 0 });
    await expect(
      handleCodeObserved(observed(CODE_V1) as never),
    ).resolves.toEqual({ status: "ignored", reason: "duplicate" });

    const active = await getActiveTimeline(IDENTITY);
    expect(active?.snapshots).toHaveLength(1);
  });

  it("assigns sequences in order when observations overlap", async () => {
    const { handleCodeObserved } = await import("./evolution-handler");

    const results = await Promise.all([
      handleCodeObserved(observed(CODE_V1) as never),
      handleCodeObserved(observed(CODE_V2) as never),
    ]);

    expect(results).toEqual([
      expect.objectContaining({ status: "stored", sequence: 0 }),
      expect.objectContaining({ status: "stored", sequence: 1 }),
    ]);
    const active = await getActiveTimeline(IDENTITY);
    expect(active?.snapshots.map((snapshot) => snapshot.sequence)).toEqual([
      0, 1,
    ]);
    expect(active?.headCode).toBe(CODE_V2);
  });

  it("ignores identity supplied by the message itself", async () => {
    const { handleCodeObserved } = await import("./evolution-handler");

    await handleCodeObserved({
      ...observed(CODE_V1),
      supabaseUid: "uid-attacker",
      leetcodeUsername: "attacker",
    } as never);

    const timelines = await listTimelines(IDENTITY);
    expect(timelines).toHaveLength(1);
    expect(timelines[0]).toMatchObject({
      supabaseUid: "uid-alice",
      leetcodeUsername: "alice",
    });
  });

  it("closes and archives the session on an accepted submission", async () => {
    const { handleCodeObserved, handleSessionAccepted } = await import(
      "./evolution-handler"
    );
    await handleCodeObserved(observed(CODE_V1) as never);

    await handleSessionAccepted({
      type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
      problemSlug: "two-sum",
      submissionId: "4242",
      code: CODE_V2,
      language: "python3",
      timestamp: Date.now(),
    } as never);

    expect(await getActiveTimeline(IDENTITY)).toBeNull();
    const [timeline] = await listTimelines(IDENTITY);
    expect(timeline).toMatchObject({
      status: "accepted",
      submissionId: "4242",
      headCode: CODE_V2,
    });
    expect(mocks.archiveTimeline).toHaveBeenCalledWith(
      expect.objectContaining({ id: timeline.id, status: "accepted" }),
    );
  });

  it("does not open a ghost session from post-accept autosave of the same code", async () => {
    const { handleCodeObserved, handleSessionAccepted } = await import(
      "./evolution-handler"
    );
    await handleCodeObserved(observed(CODE_V1) as never);
    await handleSessionAccepted({
      type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
      problemSlug: "two-sum",
      submissionId: "4242",
      code: CODE_V1,
      language: "python3",
      timestamp: Date.now(),
    } as never);

    await expect(
      handleCodeObserved(observed(CODE_V1) as never),
    ).resolves.toEqual({ status: "ignored", reason: "duplicate" });

    expect(await getActiveTimeline(IDENTITY)).toBeNull();
    expect(await listTimelines(IDENTITY)).toHaveLength(1);
  });

  it("does not open a ghost session from post-accept submit of the same code", async () => {
    const { handleCodeObserved, handleSessionAccepted } = await import(
      "./evolution-handler"
    );
    await handleCodeObserved(observed(CODE_V1) as never);
    await handleSessionAccepted({
      type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
      problemSlug: "two-sum",
      submissionId: "4242",
      code: CODE_V1,
      language: "python3",
      timestamp: Date.now(),
    } as never);
    mocks.archiveTimeline.mockClear();

    await expect(
      handleCodeObserved(observed(CODE_V1, "submit", "9999") as never),
    ).resolves.toEqual({ status: "ignored", reason: "duplicate" });

    expect(await getActiveTimeline(IDENTITY)).toBeNull();
    expect(await listTimelines(IDENTITY)).toHaveLength(1);
  });

  it("does not archive again when Accept repeats the latest closed head", async () => {
    const { handleCodeObserved, handleSessionAccepted } = await import(
      "./evolution-handler"
    );
    await handleCodeObserved(observed(CODE_V1) as never);
    await handleSessionAccepted({
      type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
      problemSlug: "two-sum",
      submissionId: "4242",
      code: CODE_V1,
      language: "python3",
      timestamp: Date.now(),
    } as never);
    mocks.archiveTimeline.mockClear();

    await handleSessionAccepted({
      type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
      problemSlug: "two-sum",
      submissionId: "9999",
      code: CODE_V1,
      language: "python3",
      timestamp: Date.now(),
    } as never);

    expect(mocks.archiveTimeline).not.toHaveBeenCalled();
    expect(await getActiveTimeline(IDENTITY)).toBeNull();
    const timelines = await listTimelines(IDENTITY);
    expect(timelines).toHaveLength(1);
    expect(timelines[0]).toMatchObject({
      submissionId: "4242",
      headCode: CODE_V1,
    });
  });

  it("still opens a new session after accept when the code actually changes", async () => {
    const { handleCodeObserved, handleSessionAccepted } = await import(
      "./evolution-handler"
    );
    await handleCodeObserved(observed(CODE_V1) as never);
    await handleSessionAccepted({
      type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
      problemSlug: "two-sum",
      submissionId: "4242",
      code: CODE_V1,
      language: "python3",
      timestamp: Date.now(),
    } as never);

    await expect(
      handleCodeObserved(observed(CODE_V2) as never),
    ).resolves.toMatchObject({ status: "stored", sequence: 0 });

    const active = await getActiveTimeline(IDENTITY);
    expect(active?.headCode).toBe(CODE_V2);
    expect(await listTimelines(IDENTITY)).toHaveLength(2);
  });

  it("does not add a second submit marker when Accept repeats the same code", async () => {
    const { handleCodeObserved, handleSessionAccepted } = await import(
      "./evolution-handler"
    );
    await handleCodeObserved(observed(CODE_V1) as never);
    await handleCodeObserved(observed(CODE_V1, "submit", "4242") as never);

    await handleSessionAccepted({
      type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
      problemSlug: "two-sum",
      submissionId: "4242",
      code: CODE_V1,
      language: "python3",
      timestamp: Date.now(),
    } as never);

    const [timeline] = await listTimelines(IDENTITY);
    const submitMarkers = timeline.snapshots.filter(
      (snapshot) => snapshot.kind === "marker" && snapshot.source === "submit",
    );
    expect(submitMarkers).toHaveLength(1);
    expect(timeline).toMatchObject({
      status: "accepted",
      submissionId: "4242",
      headCode: CODE_V1,
    });
  });

  it("does not archive when no session was recorded", async () => {
    const { handleSessionAccepted } = await import("./evolution-handler");

    await handleSessionAccepted({
      type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
      problemSlug: "two-sum",
      submissionId: "4242",
      code: null,
      language: "python3",
      timestamp: Date.now(),
    } as never);

    expect(mocks.archiveTimeline).not.toHaveBeenCalled();
  });

  it("closes the open session when Accept language is null", async () => {
    const { handleCodeObserved, handleSessionAccepted } = await import(
      "./evolution-handler"
    );
    await handleCodeObserved(observed(CODE_V1) as never);

    await handleSessionAccepted({
      type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
      problemSlug: "two-sum",
      submissionId: "4242",
      code: CODE_V1,
      language: null,
      timestamp: Date.now(),
    } as never);

    expect(await getActiveTimeline(IDENTITY)).toBeNull();
    const [timeline] = await listTimelines(IDENTITY);
    expect(timeline).toMatchObject({
      status: "accepted",
      submissionId: "4242",
      language: "python3",
    });
    expect(mocks.archiveTimeline).toHaveBeenCalledOnce();
  });

  it("closes the open session when Accept language is blank", async () => {
    const { handleCodeObserved, handleSessionAccepted } = await import(
      "./evolution-handler"
    );
    await handleCodeObserved(observed(CODE_V1) as never);

    await handleSessionAccepted({
      type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
      problemSlug: "two-sum",
      submissionId: "4242",
      code: CODE_V1,
      language: "   ",
      timestamp: Date.now(),
    } as never);

    expect(await getActiveTimeline(IDENTITY)).toBeNull();
    expect(mocks.archiveTimeline).toHaveBeenCalledOnce();
  });

  it("picks the matching language when multiple active sessions exist", async () => {
    const { handleCodeObserved, handleSessionAccepted } = await import(
      "./evolution-handler"
    );
    const cppCode = "class Solution { public: vector<int> twoSum() { return {}; } };";

    await handleCodeObserved(observed(CODE_V1) as never);
    await handleCodeObserved({
      ...observed(cppCode),
      language: "cpp",
    } as never);

    await handleSessionAccepted({
      type: constants.MESSAGE_TYPES.SESSION_ACCEPTED,
      problemSlug: "two-sum",
      submissionId: "4242",
      code: cppCode,
      language: null,
      timestamp: Date.now(),
    } as never);

    expect(await getActiveTimeline(IDENTITY)).toMatchObject({
      language: "python3",
      status: "active",
    });
    expect(
      await getActiveTimeline({ ...IDENTITY, language: "cpp" }),
    ).toBeNull();

    const timelines = await listTimelines(IDENTITY);
    const accepted = timelines.find((timeline) => timeline.status === "accepted");
    expect(accepted).toMatchObject({
      language: "cpp",
      submissionId: "4242",
      headCode: cppCode,
    });
  });
});