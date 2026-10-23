import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import type { TimelineRecord } from "@/types/evolution";
import {
  buildIdentityKey,
  buildScopeKey,
  closeTimelineDb,
  deleteTimelinesForIdentity,
  getActiveTimeline,
  getActiveTimelinesForProblem,
  getLatestClosedTimeline,
  getTimeline,
  listTimelines,
  listTimelinesByStatus,
  markTimelineAccepted,
  markTimelineArchiveFailed,
  markTimelineArchived,
  updateActiveTimeline,
  type TimelineScope,
} from "./storage";
import { appendObservation, checksumCode } from "./timeline";

const ALICE: TimelineScope = {
  supabaseUid: "uid-alice",
  leetcodeUsername: "alice",
  problemSlug: "two-sum",
  language: "python3",
};

const BOB: TimelineScope = {
  ...ALICE,
  supabaseUid: "uid-bob",
  leetcodeUsername: "bob",
};

const CODE_V1 = "class Solution:\n    def twoSum(self):\n        return []\n";
const CODE_V2 = `${CODE_V1}\n        # scan once with a hash map lookup\n`;

/** Mirrors the background write loop: append one observation, persist result. */
async function record(
  scope: TimelineScope,
  code: string,
  source: "autosave" | "run" | "submit" = "autosave",
) {
  return updateActiveTimeline(scope, (timeline) => {
    const appended = appendObservation(timeline, {
      code,
      source,
      timestamp: Date.now(),
    });
    if (appended.kind === "ignored") return null;

    return {
      record: {
        ...timeline,
        headCode: appended.headCode,
        headChecksum: appended.headChecksum,
        snapshots: [...timeline.snapshots, appended.snapshot],
      },
      result: { id: timeline.id, sequence: appended.snapshot.sequence },
    };
  });
}

describe("timeline storage", () => {
  beforeEach(() => {
    closeTimelineDb();
    indexedDB = new IDBFactory();
  });

  it("builds account-scoped keys that cannot collide across separators", () => {
    expect(buildIdentityKey(ALICE)).not.toBe(buildIdentityKey(BOB));
    expect(buildScopeKey(ALICE)).toContain(buildIdentityKey(ALICE));
    expect(
      buildScopeKey({ ...ALICE, problemSlug: "a|b", language: "c" }),
    ).not.toBe(buildScopeKey({ ...ALICE, problemSlug: "a", language: "b|c" }));
  });

  it("creates one active session per scope and appends to it", async () => {
    const first = await record(ALICE, CODE_V1);
    const second = await record(ALICE, CODE_V2);

    expect(first).toMatchObject({ sequence: 0 });
    expect(second).toMatchObject({ id: first?.id, sequence: 1 });

    const active = await getActiveTimeline(ALICE);
    expect(active).toMatchObject({
      status: "active",
      headCode: CODE_V2,
      headChecksum: checksumCode(CODE_V2),
    });
    expect(active?.snapshots.map((snapshot) => snapshot.kind)).toEqual([
      "checkpoint",
      "patch",
    ]);
  });

  it("stores nothing when the observation is ignored", async () => {
    await record(ALICE, CODE_V1);

    expect(await record(ALICE, CODE_V1)).toBeNull();

    const active = await getActiveTimeline(ALICE);
    expect(active?.snapshots).toHaveLength(1);
  });

  it("keeps accounts and languages isolated", async () => {
    await record(ALICE, CODE_V1);
    await record(BOB, CODE_V2);
    await record({ ...ALICE, language: "java" }, CODE_V1);

    const aliceTimelines = await listTimelines(ALICE);
    const bobTimelines = await listTimelines(BOB);

    expect(aliceTimelines).toHaveLength(2);
    expect(bobTimelines).toHaveLength(1);
    expect(bobTimelines[0]).toMatchObject({ leetcodeUsername: "bob" });
    expect(await getActiveTimeline(BOB)).toMatchObject({ headCode: CODE_V2 });
  });

  it("lists active timelines for a problem across languages", async () => {
    await record(ALICE, CODE_V1);
    await record({ ...ALICE, language: "java" }, CODE_V2);
    await record({ ...ALICE, problemSlug: "add-two-numbers" }, CODE_V1);
    await markTimelineAccepted(ALICE, "9001");

    const active = await getActiveTimelinesForProblem(ALICE, "two-sum");

    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      language: "java",
      problemSlug: "two-sum",
      status: "active",
    });
  });

  it("closes the accepted session so the next attempt starts a new one", async () => {
    await record(ALICE, CODE_V1);
    const accepted = await markTimelineAccepted(ALICE, "9001");

    expect(accepted).toMatchObject({
      status: "accepted",
      submissionId: "9001",
    });
    expect(accepted?.activeScopeKey).toBeUndefined();
    expect(await getActiveTimeline(ALICE)).toBeNull();
    expect(await getLatestClosedTimeline(ALICE)).toMatchObject({
      id: accepted?.id,
      headCode: CODE_V1,
    });

    await record(ALICE, CODE_V2);
    const nextActive = await getActiveTimeline(ALICE);

    expect(nextActive?.id).not.toBe(accepted?.id);
    expect(nextActive?.snapshots[0].kind).toBe("checkpoint");
    expect(await listTimelines(ALICE)).toHaveLength(2);
  });

  it("refuses to accept an empty session", async () => {
    expect(await markTimelineAccepted(ALICE, "9002")).toBeNull();
    expect(await listTimelines(ALICE)).toHaveLength(0);
  });

  it("tracks archive success and failure states", async () => {
    await record(ALICE, CODE_V1);
    const accepted = await markTimelineAccepted(ALICE, "9003");
    const id = accepted?.id ?? "";

    await markTimelineArchiveFailed(id);
    expect(await listTimelinesByStatus("archive_failed")).toHaveLength(1);

    await markTimelineArchived(id, {
      storagePath: "uid-alice/alice/two-sum/session.json.gz",
      checksum: "archive-checksum",
      archivedAt: 1_700_000_000_000,
    });
    const archived = await getTimeline(id);

    expect(archived).toMatchObject({
      status: "archived",
      archive: { checksum: "archive-checksum" },
    });

    // A late failure must not overwrite a confirmed backup.
    await markTimelineArchiveFailed(id);
    expect(await getTimeline(id)).toMatchObject({ status: "archived" });
  });

  it("leaves storage unchanged when a mutation throws", async () => {
    await record(ALICE, CODE_V1);

    await expect(
      updateActiveTimeline<TimelineRecord>(ALICE, () => {
        throw new Error("mutation failed");
      }),
    ).rejects.toThrow("mutation failed");

    expect(await getActiveTimeline(ALICE)).toMatchObject({
      headCode: CODE_V1,
      status: "active",
    });
  });

  it("survives reopening the database", async () => {
    await record(ALICE, CODE_V1);
    await record(ALICE, CODE_V2);
    closeTimelineDb();

    const reopened = await getActiveTimeline(ALICE);
    expect(reopened?.headCode).toBe(CODE_V2);
  });

  it("deletes only the requested account's timelines", async () => {
    await record(ALICE, CODE_V1);
    await record(BOB, CODE_V1);

    expect(await deleteTimelinesForIdentity(ALICE)).toBe(1);
    expect(await listTimelines(ALICE)).toHaveLength(0);
    expect(await listTimelines(BOB)).toHaveLength(1);
  });
});
