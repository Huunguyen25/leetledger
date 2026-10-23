import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TimelineRecord } from "@/types/evolution";
import {
  buildArchive,
  buildStoragePath,
  gunzipArchive,
  gzipArchive,
  listArchivedPaths,
  restoreTimeline,
  validateArchive,
  archiveTimeline,
} from "./archive";
import {
  buildIdentityKey,
  buildScopeKey,
  closeTimelineDb,
  getTimeline,
  putTimeline,
} from "./storage";
import { appendObservation, checksumCode } from "./timeline";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  download: vi.fn(),
  list: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    storage: {
      from: () => ({
        upload: mocks.upload,
        download: mocks.download,
        list: mocks.list,
      }),
    },
  }),
}));

const IDENTITY = { supabaseUid: "uid-alice", leetcodeUsername: "alice" };
const SCOPE = { ...IDENTITY, problemSlug: "two-sum", language: "python3" };

const CODE_V1 = "class Solution:\n    def twoSum(self):\n        return []\n";
const CODE_V2 = `${CODE_V1}\n        # store complements while scanning\n`;

/** Builds an accepted timeline the way the handler would. */
function acceptedTimeline(): TimelineRecord {
  const scopeKey = buildScopeKey(SCOPE);
  const base: TimelineRecord = {
    id: `${scopeKey}|session-1`,
    schemaVersion: 1,
    identityKey: buildIdentityKey(SCOPE),
    scopeKey,
    ...SCOPE,
    sessionId: "session-1",
    status: "accepted",
    startedAt: 1_000,
    updatedAt: 5_000,
    acceptedAt: 5_000,
    submissionId: "4242",
    headCode: "",
    headChecksum: checksumCode(""),
    snapshots: [],
  };

  for (const [index, code] of [CODE_V1, CODE_V2].entries()) {
    const appended = appendObservation(base, {
      code,
      source: index === 1 ? "submit" : "autosave",
      timestamp: 1_000 + index,
    });
    if (appended.kind !== "appended") throw new Error("fixture not appended");
    base.snapshots.push(appended.snapshot);
    base.headCode = appended.headCode;
    base.headChecksum = appended.headChecksum;
  }

  return base;
}

describe("timeline archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    closeTimelineDb();
    indexedDB = new IDBFactory();
    mocks.upload.mockResolvedValue({ error: null });
  });

  it("packs and unpacks an archive losslessly", async () => {
    const archive = buildArchive(acceptedTimeline());
    expect(archive).not.toBeNull();

    const gzipped = await gzipArchive(archive!);
    const restored = await gunzipArchive(gzipped);

    expect(restored).toEqual(archive);
    expect(gzipped.byteLength).toBeLessThan(
      JSON.stringify(archive).length,
    );
  });

  it("builds a deterministic per-session storage path", () => {
    expect(buildStoragePath(acceptedTimeline())).toBe(
      "uid-alice/alice/two-sum/session-1.json.gz",
    );
  });

  it("accepts a sound archive and rejects tampered ones", () => {
    const archive = buildArchive(acceptedTimeline())!;

    expect(validateArchive(archive, IDENTITY)).toEqual(archive);
    expect(
      validateArchive(archive, {
        supabaseUid: "uid-bob",
        leetcodeUsername: "bob",
      }),
    ).toBeNull();
    expect(
      validateArchive({ ...archive, archiveVersion: 2 }, IDENTITY),
    ).toBeNull();
    expect(
      validateArchive({ ...archive, headChecksum: "tampered" }, IDENTITY),
    ).toBeNull();
    expect(
      validateArchive({ ...archive, snapshots: archive.snapshots.slice(1) }, IDENTITY),
    ).toBeNull();
  });

  it("rejects malformed snapshot payloads without throwing", () => {
    const archive = buildArchive(acceptedTimeline())!;

    const cases = [
      [{ kind: "checkpoint", sequence: 0 }],
      [
        {
          kind: "checkpoint",
          sequence: 0,
          timestamp: 1,
          source: "autosave",
          afterChecksum: "abc",
        },
      ],
      [
        {
          kind: "patch",
          sequence: 1,
          timestamp: 2,
          source: "autosave",
          beforeChecksum: "a",
          afterChecksum: "b",
        },
      ],
      [
        {
          kind: "marker",
          sequence: 1,
          timestamp: 2,
          source: "autosave",
          codeChecksum: "abc",
        },
      ],
    ] as const;

    for (const snapshots of cases) {
      expect(() =>
        validateArchive({ ...archive, snapshots }, IDENTITY),
      ).not.toThrow();
      expect(validateArchive({ ...archive, snapshots }, IDENTITY)).toBeNull();
    }
  });

  it("marks the timeline archived after a confirmed upload", async () => {
    const timeline = acceptedTimeline();
    await putTimeline(timeline);

    const result = await archiveTimeline(timeline);

    expect(result).toMatchObject({
      ok: true,
      storagePath: "uid-alice/alice/two-sum/session-1.json.gz",
    });
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(await getTimeline(timeline.id)).toMatchObject({
      status: "archived",
      archive: { storagePath: "uid-alice/alice/two-sum/session-1.json.gz" },
    });
  });

  it("keeps local snapshots and flags retry when upload fails", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "offline" } });
    const timeline = acceptedTimeline();
    await putTimeline(timeline);

    expect(await archiveTimeline(timeline)).toEqual({
      ok: false,
      reason: "upload_failed",
    });

    const stored = await getTimeline(timeline.id);
    expect(stored).toMatchObject({ status: "archive_failed" });
    expect(stored?.snapshots).toHaveLength(timeline.snapshots.length);
    expect(stored?.headCode).toBe(CODE_V2);
  });

  it("refuses to archive an active session", async () => {
    const timeline = { ...acceptedTimeline(), status: "active" as const };

    expect(await archiveTimeline(timeline)).toEqual({
      ok: false,
      reason: "not_accepted",
    });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("restores a cleared timeline from its archive", async () => {
    const original = acceptedTimeline();
    const path = buildStoragePath(original);
    const gzipped = await gzipArchive(buildArchive(original)!);
    mocks.download.mockResolvedValue({ data: new Blob([gzipped]), error: null });

    const result = await restoreTimeline(path, IDENTITY);

    expect(result).toMatchObject({ ok: true });
    const restored = await getTimeline(original.id);
    expect(restored).toMatchObject({
      status: "archived",
      submissionId: "4242",
      headCode: CODE_V2,
      headChecksum: original.headChecksum,
    });
    expect(restored?.snapshots).toHaveLength(original.snapshots.length);
  });

  it("refuses to restore another account's object path", async () => {
    expect(
      await restoreTimeline("uid-bob/bob/two-sum/session-1.json.gz", IDENTITY),
    ).toEqual({ ok: false, reason: "identity_mismatch" });
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("lists only archive objects under the account's own prefix", async () => {
    mocks.list.mockResolvedValue({
      data: [{ name: "session-1.json.gz" }, { name: "notes.txt" }],
      error: null,
    });

    expect(await listArchivedPaths(IDENTITY, "two-sum")).toEqual([
      "uid-alice/alice/two-sum/session-1.json.gz",
    ]);
    expect(mocks.list).toHaveBeenCalledWith(
      "uid-alice/alice/two-sum",
      expect.anything(),
    );
  });

  it("rejects a corrupt download instead of writing it", async () => {
    mocks.download.mockResolvedValue({
      data: new Blob(["not-gzip"]),
      error: null,
    });

    expect(
      await restoreTimeline("uid-alice/alice/two-sum/session-1.json.gz", IDENTITY),
    ).toEqual({ ok: false, reason: "corrupt_archive" });
    expect(
      await getTimeline(`${buildScopeKey(SCOPE)}|session-1`),
    ).toBeNull();
  });
});
