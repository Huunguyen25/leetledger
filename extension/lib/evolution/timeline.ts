import { diff_match_patch } from "diff-match-patch";
import type {
  EvolutionSource,
  TimelineSnapshot,
} from "@/types/evolution";

/**
 * Code-evolution logic: normalization, checksums, diff-match-patch handling,
 * and reconstruction. This is the only module allowed to touch
 * `diff-match-patch`, so normalization and verification rules stay consistent.
 */

/** Single tweak point for capture granularity and checkpoint frequency. */
export const TIMELINE_POLICY = {
  /** Changed characters that make an autosave poll worth storing. */
  minChangedChars: 30,
  /** Changed lines that make an autosave poll worth storing. */
  minChangedLines: 2,
  /** Patches allowed after a checkpoint before forcing a new one. */
  maxPatchesPerCheckpoint: 25,
  /** Store a checkpoint once a patch reaches this share of the full code. */
  maxPatchSizeRatio: 0.9,
} as const;

const dmp = new diff_match_patch();

export interface TimelineHead {
  headCode: string;
  headChecksum: string;
  snapshots: TimelineSnapshot[];
}

export interface CodeObservation {
  code: string;
  source: EvolutionSource;
  timestamp: number;
  submissionId?: string;
}

export type AppendResult =
  | {
      kind: "appended";
      snapshot: TimelineSnapshot;
      headCode: string;
      headChecksum: string;
    }
  | { kind: "ignored"; reason: "duplicate" | "below_threshold" };

export type ReconstructResult =
  | { ok: true; code: string }
  | {
      ok: false;
      reason: "no_checkpoint" | "patch_failed" | "checksum_mismatch";
      sequence?: number;
    };

export type PatchApplyResult =
  | { ok: true; code: string }
  | { ok: false; reason: "patch_failed" | "checksum_mismatch"; code: string };

/**
 * Deterministic text form used for every checksum and diff. Line endings and
 * Unicode composition are unified; indentation and trailing whitespace are
 * preserved because they are meaningful in submitted code.
 */
export function normalizeCode(code: string): string {
  return code.replace(/\r\n?/g, "\n").normalize("NFC");
}

/**
 * Fast non-cryptographic content fingerprint (cyrb64 plus length). It exists to
 * detect duplicate observations and silent patch drift, not to resist attacks.
 */
export function checksumCode(code: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
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

/** Serializes a diff-match-patch delta between two normalized versions. */
export function createPatch(before: string, after: string): string {
  const diffs = dmp.diff_main(before, after);
  dmp.diff_cleanupSemantic(diffs);
  return dmp.patch_toText(dmp.patch_make(before, diffs));
}

/**
 * Applies a patch and confirms it reproduced the expected version. Callers must
 * treat a failure as "store a full checkpoint instead".
 */
export function applyAndVerifyPatch(
  before: string,
  patchText: string,
  expectedAfterChecksum?: string,
): PatchApplyResult {
  let code: string;
  let applied: boolean[];

  try {
    const [result, results] = dmp.patch_apply(
      dmp.patch_fromText(patchText),
      before,
    );
    code = result;
    applied = results;
  } catch {
    return { ok: false, reason: "patch_failed", code: before };
  }

  if (applied.length === 0 || !applied.every(Boolean)) {
    return { ok: false, reason: "patch_failed", code };
  }
  if (expectedAfterChecksum && checksumCode(code) !== expectedAfterChecksum) {
    return { ok: false, reason: "checksum_mismatch", code };
  }

  return { ok: true, code };
}

/** Counts changed characters and lines between two normalized versions. */
export function measureChange(
  before: string,
  after: string,
): { changedChars: number; changedLines: number } {
  let changedChars = 0;
  let changedLines = 0;

  for (const [operation, text] of dmp.diff_main(before, after)) {
    if (operation === 0) continue;
    changedChars += text.length;
    changedLines += (text.match(/\n/g) ?? []).length;
  }

  return { changedChars, changedLines };
}

/** Whether an autosave poll cleared the configured capture threshold. */
export function isMeaningfulChange(before: string, after: string): boolean {
  if (before === after) return false;
  if (before.length === 0 || after.length === 0) return true;

  const { changedChars, changedLines } = measureChange(before, after);
  return (
    changedChars >= TIMELINE_POLICY.minChangedChars ||
    changedLines >= TIMELINE_POLICY.minChangedLines
  );
}

function nextSequence(snapshots: TimelineSnapshot[]): number {
  const last = snapshots[snapshots.length - 1];
  return last ? last.sequence + 1 : 0;
}

function patchesSinceCheckpoint(snapshots: TimelineSnapshot[]): number {
  let patches = 0;
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const snapshot = snapshots[i];
    if (snapshot.kind === "checkpoint") break;
    if (snapshot.kind === "patch") patches++;
  }
  return patches;
}

/**
 * Decides what a single observation contributes to a timeline. Run and Submit
 * milestones bypass the autosave threshold because they are exactly what the
 * user executed.
 */
export function appendObservation(
  head: TimelineHead,
  observation: CodeObservation,
): AppendResult {
  const code = normalizeCode(observation.code);
  const checksum = checksumCode(code);
  const { snapshots } = head;
  const sequence = nextSequence(snapshots);
  const milestoneSource =
    observation.source === "autosave" ? null : observation.source;

  if (snapshots.length === 0) {
    if (code.length === 0) return { kind: "ignored", reason: "duplicate" };
    return {
      kind: "appended",
      snapshot: {
        kind: "checkpoint",
        sequence,
        timestamp: observation.timestamp,
        source: observation.source,
        fullCode: code,
        afterChecksum: checksum,
      },
      headCode: code,
      headChecksum: checksum,
    };
  }

  if (checksum === head.headChecksum) {
    if (!milestoneSource) return { kind: "ignored", reason: "duplicate" };
    return {
      kind: "appended",
      snapshot: {
        kind: "marker",
        sequence,
        timestamp: observation.timestamp,
        source: milestoneSource,
        codeChecksum: checksum,
        ...(observation.submissionId && {
          submissionId: observation.submissionId,
        }),
      },
      headCode: head.headCode,
      headChecksum: head.headChecksum,
    };
  }

  if (!milestoneSource && !isMeaningfulChange(head.headCode, code)) {
    return { kind: "ignored", reason: "below_threshold" };
  }

  const patchText = createPatch(head.headCode, code);
  const verified = applyAndVerifyPatch(head.headCode, patchText, checksum);
  const patchTooLarge =
    patchText.length >= code.length * TIMELINE_POLICY.maxPatchSizeRatio;
  const checkpointDue =
    patchesSinceCheckpoint(snapshots) >= TIMELINE_POLICY.maxPatchesPerCheckpoint;

  const snapshot: TimelineSnapshot =
    verified.ok && !patchTooLarge && !checkpointDue
      ? {
          kind: "patch",
          sequence,
          timestamp: observation.timestamp,
          source: observation.source,
          patchText,
          beforeChecksum: head.headChecksum,
          afterChecksum: checksum,
        }
      : {
          kind: "checkpoint",
          sequence,
          timestamp: observation.timestamp,
          source: observation.source,
          fullCode: code,
          afterChecksum: checksum,
        };

  return {
    kind: "appended",
    snapshot,
    headCode: code,
    headChecksum: checksum,
  };
}

/**
 * Rebuilds the code at `targetSequence` by replaying patches from the nearest
 * preceding checkpoint. Markers annotate the timeline without changing text.
 */
export function reconstructCode(
  snapshots: TimelineSnapshot[],
  targetSequence?: number,
): ReconstructResult {
  if (snapshots.length === 0) return { ok: false, reason: "no_checkpoint" };

  const target = targetSequence ?? snapshots[snapshots.length - 1].sequence;
  const upTo = snapshots.filter((snapshot) => snapshot.sequence <= target);
  if (upTo.length === 0) return { ok: false, reason: "no_checkpoint" };

  let baseIndex = -1;
  for (let i = upTo.length - 1; i >= 0; i--) {
    if (upTo[i].kind === "checkpoint") {
      baseIndex = i;
      break;
    }
  }
  if (baseIndex === -1) return { ok: false, reason: "no_checkpoint" };

  let code = (upTo[baseIndex] as { fullCode: string }).fullCode;

  for (let i = baseIndex + 1; i < upTo.length; i++) {
    const snapshot = upTo[i];
    if (snapshot.kind !== "patch") continue;

    if (checksumCode(code) !== snapshot.beforeChecksum) {
      return {
        ok: false,
        reason: "checksum_mismatch",
        sequence: snapshot.sequence,
      };
    }

    const applied = applyAndVerifyPatch(
      code,
      snapshot.patchText,
      snapshot.afterChecksum,
    );
    if (!applied.ok) {
      return {
        ok: false,
        reason: applied.reason,
        sequence: snapshot.sequence,
      };
    }
    code = applied.code;
  }

  return { ok: true, code };
}

/** Confirms a snapshot chain still reproduces its recorded head checksum. */
export function verifyTimelineIntegrity(
  snapshots: TimelineSnapshot[],
  headChecksum: string,
): boolean {
  const reconstructed = reconstructCode(snapshots);
  return reconstructed.ok && checksumCode(reconstructed.code) === headChecksum;
}
