"use client";

import { diff_match_patch } from "diff-match-patch";
import type {
  EvolutionEvent,
  EvolutionEventKind,
  SubmissionArchive,
} from "./types";

type SnapshotSource = "autosave" | "run" | "submit";

interface SnapshotBase {
  sequence: number;
  timestamp: number;
  source: SnapshotSource;
}

interface CheckpointSnapshot extends SnapshotBase {
  kind: "checkpoint";
  fullCode: string;
  afterChecksum: string;
}

interface PatchSnapshot extends SnapshotBase {
  kind: "patch";
  patchText: string;
  beforeChecksum: string;
  afterChecksum: string;
}

interface MarkerSnapshot extends SnapshotBase {
  kind: "marker";
  source: "run" | "submit";
  codeChecksum: string;
  submissionId?: string;
}

type TimelineSnapshot =
  | CheckpointSnapshot
  | PatchSnapshot
  | MarkerSnapshot;

interface StoredTimelineArchive {
  archiveVersion: 1;
  identity: {
    supabaseUid: string;
    leetcodeUsername: string;
  };
  problemSlug: string;
  language: string;
  sessionId: string;
  submissionId: string;
  startedAt: number;
  acceptedAt: number;
  headChecksum: string;
  snapshots: TimelineSnapshot[];
}

const dmp = new diff_match_patch();

export async function decodeTimelineArchive(
  payload: Blob,
  expectedUserId: string,
  storagePath: string,
): Promise<SubmissionArchive> {
  let parsed: unknown;
  try {
    const decompressed = payload
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    parsed = JSON.parse(await new Response(decompressed).text());
  } catch {
    throw new Error("The code timeline archive could not be decompressed.");
  }

  const archive = validateArchive(parsed, expectedUserId);
  const events = reconstructEvents(archive);
  return {
    problemSlug: archive.problemSlug,
    sessionId: archive.sessionId,
    language: archive.language,
    startedAt: archive.startedAt,
    acceptedAt: archive.acceptedAt,
    storagePath,
    events,
  };
}

function validateArchive(
  value: unknown,
  expectedUserId: string,
): StoredTimelineArchive {
  if (!isRecord(value) || value.archiveVersion !== 1) {
    throw new Error("Unsupported code timeline archive.");
  }
  const identity = value.identity;
  if (
    !isRecord(identity) ||
    identity.supabaseUid !== expectedUserId ||
    typeof identity.leetcodeUsername !== "string"
  ) {
    throw new Error("The code timeline belongs to a different account.");
  }
  if (
    typeof value.problemSlug !== "string" ||
    typeof value.language !== "string" ||
    typeof value.sessionId !== "string" ||
    typeof value.submissionId !== "string" ||
    typeof value.startedAt !== "number" ||
    typeof value.acceptedAt !== "number" ||
    typeof value.headChecksum !== "string" ||
    !Array.isArray(value.snapshots)
  ) {
    throw new Error("The code timeline metadata is incomplete.");
  }

  const snapshots = value.snapshots.map(validateSnapshot);
  if (!snapshots.length || snapshots[0].kind !== "checkpoint") {
    throw new Error("The code timeline has no initial checkpoint.");
  }
  for (let index = 1; index < snapshots.length; index++) {
    if (snapshots[index].sequence <= snapshots[index - 1].sequence) {
      throw new Error("The code timeline event order is invalid.");
    }
  }

  return {
    archiveVersion: 1,
    identity: {
      supabaseUid: identity.supabaseUid,
      leetcodeUsername: identity.leetcodeUsername,
    },
    problemSlug: value.problemSlug,
    language: value.language,
    sessionId: value.sessionId,
    submissionId: value.submissionId,
    startedAt: value.startedAt,
    acceptedAt: value.acceptedAt,
    headChecksum: value.headChecksum,
    snapshots,
  };
}

function validateSnapshot(value: unknown): TimelineSnapshot {
  if (
    !isRecord(value) ||
    typeof value.sequence !== "number" ||
    typeof value.timestamp !== "number" ||
    !isSource(value.source)
  ) {
    throw new Error("The code timeline contains an invalid event.");
  }

  const base = {
    sequence: value.sequence,
    timestamp: value.timestamp,
    source: value.source,
  };
  if (
    value.kind === "checkpoint" &&
    typeof value.fullCode === "string" &&
    typeof value.afterChecksum === "string"
  ) {
    return {
      ...base,
      kind: "checkpoint",
      fullCode: value.fullCode,
      afterChecksum: value.afterChecksum,
    };
  }
  if (
    value.kind === "patch" &&
    typeof value.patchText === "string" &&
    typeof value.beforeChecksum === "string" &&
    typeof value.afterChecksum === "string"
  ) {
    return {
      ...base,
      kind: "patch",
      patchText: value.patchText,
      beforeChecksum: value.beforeChecksum,
      afterChecksum: value.afterChecksum,
    };
  }
  if (
    value.kind === "marker" &&
    (value.source === "run" || value.source === "submit") &&
    typeof value.codeChecksum === "string" &&
    (value.submissionId === undefined ||
      typeof value.submissionId === "string")
  ) {
    return {
      ...base,
      kind: "marker",
      source: value.source,
      codeChecksum: value.codeChecksum,
      ...(value.submissionId ? { submissionId: value.submissionId } : {}),
    };
  }
  throw new Error("The code timeline contains an unsupported event.");
}

function reconstructEvents(archive: StoredTimelineArchive): EvolutionEvent[] {
  let code = "";
  const events: EvolutionEvent[] = [];

  for (const snapshot of archive.snapshots) {
    if (snapshot.kind === "checkpoint") {
      code = snapshot.fullCode;
      if (checksumCode(code) !== snapshot.afterChecksum) {
        throw new Error("A code timeline checkpoint failed verification.");
      }
    } else if (snapshot.kind === "patch") {
      if (checksumCode(code) !== snapshot.beforeChecksum) {
        throw new Error("A code timeline patch has an invalid starting state.");
      }
      const [nextCode, applied] = dmp.patch_apply(
        dmp.patch_fromText(snapshot.patchText),
        code,
      );
      if (!applied.length || !applied.every(Boolean)) {
        throw new Error("A code timeline patch could not be reconstructed.");
      }
      code = nextCode;
      if (checksumCode(code) !== snapshot.afterChecksum) {
        throw new Error("A reconstructed code timeline patch is corrupt.");
      }
    } else if (checksumCode(code) !== snapshot.codeChecksum) {
      throw new Error("A code timeline marker does not match its source.");
    }

    events.push({
      sequence: snapshot.sequence,
      kind: eventKind(snapshot),
      timestamp: elapsedLabel(snapshot.timestamp - archive.startedAt),
      code,
    });
  }

  if (checksumCode(code) !== archive.headChecksum) {
    throw new Error("The final code timeline checksum does not match.");
  }
  return events;
}

function eventKind(snapshot: TimelineSnapshot): EvolutionEventKind {
  if (snapshot.source === "run") return "run";
  if (snapshot.source === "submit") return "submit";
  return snapshot.kind === "checkpoint" ? "checkpoint" : "autosave";
}

function elapsedLabel(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function checksumCode(code: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < code.length; index++) {
    const charCode = code.charCodeAt(index);
    h1 = Math.imul(h1 ^ charCode, 2654435761);
    h2 = Math.imul(h2 ^ charCode, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const high = (h2 >>> 0).toString(16).padStart(8, "0");
  const low = (h1 >>> 0).toString(16).padStart(8, "0");
  return `${code.length.toString(36)}-${high}${low}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isSource(value: unknown): value is SnapshotSource {
  return value === "autosave" || value === "run" || value === "submit";
}
