/**
 * Serialized code-evolution contracts shared by the page bridge, content
 * script, background worker, IndexedDB records, and Supabase archives.
 */

/** Where an observed code version came from. */
export type EvolutionSource = "autosave" | "run" | "submit";

/** Lifecycle of one solving session. */
export type TimelineStatus =
  | "active"
  | "accepted"
  | "archived"
  | "archive_failed";

interface SnapshotBase {
  sequence: number;
  timestamp: number;
  source: EvolutionSource;
}

/** A complete code version; the entry point for every reconstruction. */
export interface CheckpointSnapshot extends SnapshotBase {
  kind: "checkpoint";
  fullCode: string;
  afterChecksum: string;
}

/** A diff-match-patch delta from the previous code version. */
export interface PatchSnapshot extends SnapshotBase {
  kind: "patch";
  patchText: string;
  beforeChecksum: string;
  afterChecksum: string;
}

/** A Run/Submit milestone that did not change the code. */
export interface MarkerSnapshot extends SnapshotBase {
  kind: "marker";
  source: "run" | "submit";
  codeChecksum: string;
  submissionId?: string;
}

export type TimelineSnapshot =
  | CheckpointSnapshot
  | PatchSnapshot
  | MarkerSnapshot;

/** Confirmed Supabase Storage backup of an accepted session. */
export interface TimelineArchiveRef {
  storagePath: string;
  checksum: string;
  archivedAt: number;
}

/** One solving session stored in LeetLedger's IndexedDB. */
export interface TimelineRecord {
  /** `{scopeKey}|{sessionId}` */
  id: string;
  schemaVersion: 1;

  identityKey: string;
  scopeKey: string;
  supabaseUid: string;
  leetcodeUsername: string;
  problemSlug: string;
  language: string;
  sessionId: string;

  status: TimelineStatus;
  /** Mirrors scopeKey while active so one scope has one active session. */
  activeScopeKey?: string;
  startedAt: number;
  updatedAt: number;
  acceptedAt?: number;
  submissionId?: string;

  headCode: string;
  headChecksum: string;
  snapshots: TimelineSnapshot[];

  archive?: TimelineArchiveRef;
}

/** Gzipped payload uploaded to Supabase Storage. */
export interface TimelineArchive {
  archiveVersion: 1;
  createdAt: number;
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

/** Page-world code milestone captured from a Run or Submit request. */
export interface CodeMilestoneMessage {
  type: string;
  token: string;
  clientId: string;
  source: "run" | "submit";
  code: string;
  language: string | null;
  problemSlug: string | null;
  timestamp: number;
  submissionId?: string;
}

/** Content-script observation forwarded to the background worker. */
export interface CodeObservedMessage {
  type: string;
  source: EvolutionSource;
  code: string;
  language: string;
  problemSlug: string;
  timestamp: number;
  submissionId?: string;
}

/** Background notification that a submission was accepted. */
export interface SessionAcceptedMessage {
  type: string;
  problemSlug: string;
  submissionId: string;
  code: string | null;
  language: string | null;
  timestamp: number;
}

export type CodeObservationResult =
  | { status: "stored"; timelineId: string; sequence: number }
  | { status: "ignored"; reason: "duplicate" | "below_threshold" }
  | {
      status: "rejected";
      reason: "identity_inactive" | "invalid_message";
    }
  | { status: "failed"; reason: "storage_error" };
