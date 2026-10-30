import constants from "@/constants";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  EvolutionSource,
  TimelineArchive,
  TimelineRecord,
  TimelineSnapshot,
} from "@/types/evolution";
import {
  buildIdentityKey,
  buildScopeKey,
  markTimelineArchiveFailed,
  markTimelineArchived,
  putTimeline,
  type TimelineIdentity,
} from "./storage";
import { checksumCode, reconstructCode, verifyTimelineIntegrity } from "./timeline";

/**
 * Durable backup for accepted sessions: gzip the snapshot chain, upload it to a
 * private Supabase bucket, and restore it if LeetLedger's IndexedDB is ever
 * cleared. Local data is only ever marked archived after a confirmed upload.
 */

export const ARCHIVE_VERSION = 1;
const ARCHIVE_CONTENT_TYPE = "application/gzip";

/**
 * Upgrades an on-disk archive to the current `ARCHIVE_VERSION`, or soft-rejects
 * with a clear reason when the version is unknown / unsupported.
 */
export type ArchiveUpgradeResult =
  | { ok: true; archive: TimelineArchive }
  | {
      ok: false;
      reason: "unsupported_version" | "corrupt_archive";
      message: string;
    };

/**
 * Step-up transforms keyed by *source* version. When bumping ARCHIVE_VERSION,
 * add `N: (archive) => next` for every prior version still found in Storage,
 * and keep reading those payloads until the chain reaches ARCHIVE_VERSION.
 */
const ARCHIVE_MIGRATIONS: Record<
  number,
  (archive: TimelineArchive) => TimelineArchive
> = {
  // Example when ARCHIVE_VERSION becomes 2:
  // 1: (archive) => ({ ...archive, archiveVersion: 2, /* field renames */ }),
};

export function upgradeArchive(value: unknown): ArchiveUpgradeResult {
  if (!value || typeof value !== "object") {
    return {
      ok: false,
      reason: "corrupt_archive",
      message: "Archive payload is missing or not an object",
    };
  }

  let archive = value as TimelineArchive;
  let version = archive.archiveVersion;

  if (typeof version !== "number" || !Number.isFinite(version)) {
    return {
      ok: false,
      reason: "corrupt_archive",
      message: "Archive is missing archiveVersion",
    };
  }

  while (version < ARCHIVE_VERSION) {
    const migrate = ARCHIVE_MIGRATIONS[version];
    if (!migrate) {
      return {
        ok: false,
        reason: "unsupported_version",
        message: `Archive version ${version} cannot step up to ${ARCHIVE_VERSION} (missing migrator). Re-download after upgrading LeetLedger, or restore from a newer backup.`,
      };
    }
    archive = migrate(archive);
    version = archive.archiveVersion;
  }

  if (version !== ARCHIVE_VERSION) {
    return {
      ok: false,
      reason: "unsupported_version",
      message: `Archive version ${version} is newer than this extension (current=${ARCHIVE_VERSION}). Update LeetLedger to restore it.`,
    };
  }

  return { ok: true, archive };
}

export type ArchiveResult =
  | { ok: true; storagePath: string; checksum: string }
  | {
      ok: false;
      reason: "not_accepted" | "corrupt_timeline" | "upload_failed";
    };

export type RestoreResult =
  | { ok: true; timeline: TimelineRecord }
  | {
      ok: false;
      reason:
        | "not_found"
        | "download_failed"
        | "corrupt_archive"
        | "identity_mismatch";
    };

/** Deterministic object path so retries overwrite instead of duplicating. */
export function buildStoragePath(
  timeline: Pick<
    TimelineRecord,
    "supabaseUid" | "leetcodeUsername" | "problemSlug" | "sessionId"
  >,
): string {
  return [
    timeline.supabaseUid,
    encodeURIComponent(timeline.leetcodeUsername),
    encodeURIComponent(timeline.problemSlug),
    `${timeline.sessionId}.json.gz`,
  ].join("/");
}

export function buildArchive(timeline: TimelineRecord): TimelineArchive | null {
  if (!timeline.submissionId || !timeline.acceptedAt) return null;

  return {
    archiveVersion: ARCHIVE_VERSION,
    createdAt: Date.now(),
    identity: {
      supabaseUid: timeline.supabaseUid,
      leetcodeUsername: timeline.leetcodeUsername,
    },
    problemSlug: timeline.problemSlug,
    language: timeline.language,
    sessionId: timeline.sessionId,
    submissionId: timeline.submissionId,
    startedAt: timeline.startedAt,
    acceptedAt: timeline.acceptedAt,
    headChecksum: timeline.headChecksum,
    snapshots: timeline.snapshots,
  };
}

async function drain(readable: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

/**
 * Streams bytes through gzip compression or decompression. The writer is not
 * awaited before reading starts, because a single large chunk would otherwise
 * block on backpressure until the reader consumes it.
 */
async function transform(
  bytes: BufferSource,
  stream: CompressionStream | DecompressionStream,
): Promise<ArrayBuffer> {
  const writer = stream.writable.getWriter();
  // Corrupt input errors both sides; the read side is what callers observe.
  void writer
    .write(bytes)
    .then(() => writer.close())
    .catch(() => undefined);
  return drain(stream.readable as ReadableStream<Uint8Array>);
}

/** Copies into a fresh buffer so the bytes are always ArrayBuffer-backed. */
function toBytes(payload: ArrayBuffer | Uint8Array) {
  return payload instanceof Uint8Array
    ? new Uint8Array(payload)
    : new Uint8Array(payload);
}

/** Packs an archive into gzip bytes using the platform's own compressor. */
export async function gzipArchive(
  archive: TimelineArchive,
): Promise<ArrayBuffer> {
  const json = new TextEncoder().encode(JSON.stringify(archive));
  return transform(json, new CompressionStream("gzip"));
}

export async function gunzipArchive(
  payload: ArrayBuffer | Uint8Array | Blob,
): Promise<TimelineArchive> {
  const bytes =
    payload instanceof Blob
      ? new Uint8Array(await payload.arrayBuffer())
      : toBytes(payload);
  const json = await transform(bytes, new DecompressionStream("gzip"));
  return JSON.parse(new TextDecoder().decode(json)) as TimelineArchive;
}

function isEvolutionSource(value: unknown): value is EvolutionSource {
  return value === "autosave" || value === "run" || value === "submit";
}

function isMilestoneSource(value: unknown): value is "run" | "submit" {
  return value === "run" || value === "submit";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

/**
 * Checks if the given value is a valid TimelineSnapshot.
 * Used before replaying a snapshot or integrity checks.
 * Returns true if the value:
 *   - Is an object,
 *   - Has a numeric sequence and timestamp,
 *   - Has a valid source ("autosave", "run", or "submit"),
 *   - Has a kind of "checkpoint", "patch", or "marker", each with required fields:
 *     * For "checkpoint": has string fullCode and afterChecksum.
 *     * For "patch": has string patchText, beforeChecksum, and afterChecksum.
 *     * For "marker": source must be "run" or "submit", has string codeChecksum, and optional string submissionId if present.
 */
function isValidSnapshot(value: unknown): value is TimelineSnapshot {
  if (!isRecord(value)) return false;

  const { sequence, timestamp, source, kind } = value;
  if (typeof sequence !== "number") return false;
  if (typeof timestamp !== "number") return false;
  if (!isEvolutionSource(source)) return false;

  if (kind === "checkpoint") {
    return (
      typeof value.fullCode === "string" &&
      typeof value.afterChecksum === "string"
    );
  }

  if (kind === "patch") {
    return (
      typeof value.patchText === "string" &&
      typeof value.beforeChecksum === "string" &&
      typeof value.afterChecksum === "string"
    );
  }

  if (kind === "marker") {
    if (!isMilestoneSource(source)) return false;
    if (typeof value.codeChecksum !== "string") return false;
    if (
      value.submissionId !== undefined &&
      typeof value.submissionId !== "string"
    ) {
      return false;
    }
    return true;
  }

  return false;
}

function isSnapshotChainValid(snapshots: unknown): snapshots is TimelineSnapshot[] {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return false;

  let previousSequence = -1;
  for (const snapshot of snapshots) {
    if (!isValidSnapshot(snapshot)) return false;
    if (snapshot.sequence <= previousSequence) return false;
    previousSequence = snapshot.sequence;
  }

  return snapshots[0].kind === "checkpoint";
}

/** Rejects anything that would poison IndexedDB on restore. */
export function validateArchive(
  value: unknown,
  identity: TimelineIdentity,
): TimelineArchive | null {
  const upgraded = upgradeArchive(value);
  if (!upgraded.ok) return null;
  const archive = upgraded.archive;

  if (
    archive.identity?.supabaseUid !== identity.supabaseUid ||
    archive.identity?.leetcodeUsername !== identity.leetcodeUsername
  ) {
    return null;
  }
  if (
    !archive.problemSlug ||
    !archive.language ||
    !archive.sessionId ||
    !archive.submissionId ||
    typeof archive.headChecksum !== "string"
  ) {
    return null;
  }
  if (!isSnapshotChainValid(archive.snapshots)) return null;
  if (!verifyTimelineIntegrity(archive.snapshots, archive.headChecksum)) {
    return null;
  }

  return archive;
}

/**
 * Packs an accepted session and uploads it. On failure the timeline is flagged
 * for retry and its local snapshots are left untouched.
 */
export async function archiveTimeline(
  timeline: TimelineRecord,
): Promise<ArchiveResult> {
  const archive = buildArchive(timeline);
  if (timeline.status === "active" || !archive) {
    return { ok: false, reason: "not_accepted" };
  }
  if (!verifyTimelineIntegrity(timeline.snapshots, timeline.headChecksum)) {
    return { ok: false, reason: "corrupt_timeline" };
  }

  const storagePath = buildStoragePath(timeline);

  try {
    const bytes = await gzipArchive(archive);
    const checksum = checksumCode(JSON.stringify(archive));

    const { error } = await getSupabaseClient()
      .storage.from(constants.TIMELINE_BUCKET)
      .upload(storagePath, new Blob([bytes], { type: ARCHIVE_CONTENT_TYPE }), {
        contentType: ARCHIVE_CONTENT_TYPE,
        upsert: true,
      });
    if (error) {
      await markTimelineArchiveFailed(timeline.id);
      return { ok: false, reason: "upload_failed" };
    }

    await markTimelineArchived(timeline.id, {
      storagePath,
      checksum,
      archivedAt: Date.now(),
    });
    return { ok: true, storagePath, checksum };
  } catch {
    await markTimelineArchiveFailed(timeline.id);
    return { ok: false, reason: "upload_failed" };
  }
}

function timelineFromArchive(
  archive: TimelineArchive,
  headCode: string,
  storagePath: string,
): TimelineRecord {
  const scope = {
    supabaseUid: archive.identity.supabaseUid,
    leetcodeUsername: archive.identity.leetcodeUsername,
    problemSlug: archive.problemSlug,
    language: archive.language,
  };
  const scopeKey = buildScopeKey(scope);

  return {
    id: `${scopeKey}|${archive.sessionId}`,
    schemaVersion: 1,
    identityKey: buildIdentityKey(scope),
    scopeKey,
    supabaseUid: archive.identity.supabaseUid,
    leetcodeUsername: archive.identity.leetcodeUsername,
    problemSlug: archive.problemSlug,
    language: archive.language,
    sessionId: archive.sessionId,
    status: "archived",
    startedAt: archive.startedAt,
    updatedAt: Date.now(),
    acceptedAt: archive.acceptedAt,
    submissionId: archive.submissionId,
    headCode,
    headChecksum: archive.headChecksum,
    snapshots: archive.snapshots,
    archive: {
      storagePath,
      checksum: checksumCode(JSON.stringify(archive)),
      archivedAt: archive.createdAt,
    },
  };
}

/**
 * Downloads, validates, and reinstates one archived session. Used when the
 * dashboard asks for a timeline that is no longer in IndexedDB.
 */
export async function restoreTimeline(
  storagePath: string,
  identity: TimelineIdentity,
): Promise<RestoreResult> {
  // Only the authenticated user's own folder may be restored.
  if (!storagePath.startsWith(`${identity.supabaseUid}/`)) {
    return { ok: false, reason: "identity_mismatch" };
  }

  let raw: unknown;
  try {
    const { data, error } = await getSupabaseClient()
      .storage.from(constants.TIMELINE_BUCKET)
      .download(storagePath);
    if (error || !data) return { ok: false, reason: "download_failed" };

    raw = await gunzipArchive(data);
  } catch {
    return { ok: false, reason: "corrupt_archive" };
  }

  const archive = validateArchive(raw, identity);
  if (!archive) return { ok: false, reason: "corrupt_archive" };

  const reconstructed = reconstructCode(archive.snapshots);
  if (!reconstructed.ok) return { ok: false, reason: "corrupt_archive" };

  const timeline = timelineFromArchive(
    archive,
    reconstructed.code,
    storagePath,
  );
  await putTimeline(timeline);
  return { ok: true, timeline };
}

/** Lists archived object paths for one account, newest folders first. */
export async function listArchivedPaths(
  identity: TimelineIdentity,
  problemSlug?: string,
): Promise<string[]> {
  const prefix = [
    identity.supabaseUid,
    encodeURIComponent(identity.leetcodeUsername),
    ...(problemSlug ? [encodeURIComponent(problemSlug)] : []),
  ].join("/");

  const { data, error } = await getSupabaseClient()
    .storage.from(constants.TIMELINE_BUCKET)
    .list(prefix, { sortBy: { column: "created_at", order: "desc" } });
  if (error || !data) return [];

  return data
    .filter((entry) => entry.name.endsWith(".json.gz"))
    .map((entry) => `${prefix}/${entry.name}`);
}
