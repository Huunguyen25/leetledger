import type {
  TimelineArchiveRef,
  TimelineRecord,
  TimelineStatus,
} from "@/types/evolution";
import { checksumCode } from "./timeline";

/**
 * LeetLedger's own IndexedDB: one `timelines` store where each record is a
 * bounded solving session. Every read-modify-write happens inside a single
 * transaction so concurrent tabs cannot interleave partial updates.
 */

const DB_NAME = "LeetLedgerLocal";
const DB_VERSION = 1;
const STORE = "timelines";

export interface TimelineIdentity {
  supabaseUid: string;
  leetcodeUsername: string;
}

export interface TimelineScope extends TimelineIdentity {
  problemSlug: string;
  language: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** Percent-encodes key parts so separators can never be ambiguous. */
function encodePart(part: string): string {
  return encodeURIComponent(part);
}

/** Stable per-account key: the folder that isolates one user's timelines. */
export function buildIdentityKey(identity: TimelineIdentity): string {
  return [
    "v1",
    encodePart(identity.supabaseUid),
    encodePart(identity.leetcodeUsername),
  ].join("|");
}

/** Stable per-editor key: identity plus the problem and language in view. */
export function buildScopeKey(scope: TimelineScope): string {
  return [
    buildIdentityKey(scope),
    encodePart(scope.problemSlug),
    encodePart(scope.language),
  ].join("|");
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function upgrade(db: IDBDatabase): void {
  if (db.objectStoreNames.contains(STORE)) return;

  const store = db.createObjectStore(STORE, { keyPath: "id" });
  store.createIndex("identityKey", "identityKey");
  store.createIndex("problemSlug", "problemSlug");
  store.createIndex("submissionId", "submissionId");
  store.createIndex("updatedAt", "updatedAt");
  // Only active records carry activeScopeKey, so this unique index both finds
  // and enforces the single active session per identity/problem/language.
  store.createIndex("activeScopeKey", "activeScopeKey", { unique: true });
}

export function openTimelineDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => upgrade(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("LeetLedger timeline upgrade blocked by another tab"));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

/** Drops the cached connection; used by tests and after a version change. */
export function closeTimelineDb(): void {
  const pending = dbPromise;
  dbPromise = null;
  void pending?.then((db) => db.close()).catch(() => undefined);
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openTimelineDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction([STORE], mode);
    let result: T;

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Timeline transaction aborted"));

    Promise.resolve(run(transaction.objectStore(STORE)))
      .then((value) => {
        result = value;
      })
      .catch((error) => {
        transaction.abort();
        reject(error);
      });
  });
}

function newTimeline(
  scope: TimelineScope,
  now: number,
): TimelineRecord {
  const scopeKey = buildScopeKey(scope);
  const sessionId = crypto.randomUUID();

  return {
    id: `${scopeKey}|${sessionId}`,
    schemaVersion: 1,
    identityKey: buildIdentityKey(scope),
    scopeKey,
    supabaseUid: scope.supabaseUid,
    leetcodeUsername: scope.leetcodeUsername,
    problemSlug: scope.problemSlug,
    language: scope.language,
    sessionId,
    status: "active",
    activeScopeKey: scopeKey,
    startedAt: now,
    updatedAt: now,
    headCode: "",
    headChecksum: checksumCode(""),
    snapshots: [],
  };
}

export interface TimelineMutation<T> {
  result: T;
  /** Omit to return a result without writing anything. */
  record?: TimelineRecord;
}

/**
 * Reads the active session for a scope, creates it when absent, hands it to
 * `mutate`, and persists the outcome in the same transaction. Returning `null`
 * (or a mutation without a record) leaves storage untouched.
 */
export async function updateActiveTimeline<T>(
  scope: TimelineScope,
  mutate: (timeline: TimelineRecord) => TimelineMutation<T> | null,
  now = Date.now(),
): Promise<T | null> {
  return withStore("readwrite", async (store) => {
    const scopeKey = buildScopeKey(scope);
    const existing = await promisify<TimelineRecord | undefined>(
      store.index("activeScopeKey").get(scopeKey),
    );

    const mutated = mutate(existing ?? newTimeline(scope, now));
    if (!mutated) return null;

    if (mutated.record) {
      await promisify(store.put({ ...mutated.record, updatedAt: now }));
    }
    return mutated.result;
  });
}

export async function getTimeline(id: string): Promise<TimelineRecord | null> {
  return withStore("readonly", async (store) => {
    const record = await promisify<TimelineRecord | undefined>(store.get(id));
    return record ?? null;
  });
}

export async function getActiveTimeline(
  scope: TimelineScope,
): Promise<TimelineRecord | null> {
  return withStore("readonly", async (store) => {
    const record = await promisify<TimelineRecord | undefined>(
      store.index("activeScopeKey").get(buildScopeKey(scope)),
    );
    return record ?? null;
  });
}

/**
 * Most recently updated closed session for a scope. Used to ignore post-accept
 * autosave polls that would otherwise open a ghost session with the same head.
 */
export async function getLatestClosedTimeline(
  scope: TimelineScope,
): Promise<TimelineRecord | null> {
  return withStore("readonly", async (store) => {
    const scopeKey = buildScopeKey(scope);
    const records = await promisify<TimelineRecord[]>(
      store.index("identityKey").getAll(buildIdentityKey(scope)),
    );
    const closed = records
      .filter((record) => record.scopeKey === scopeKey && !record.activeScopeKey)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return closed[0] ?? null;
  });
}

export async function listTimelines(
  identity: TimelineIdentity,
): Promise<TimelineRecord[]> {
  return withStore("readonly", async (store) => {
    const records = await promisify<TimelineRecord[]>(
      store.index("identityKey").getAll(buildIdentityKey(identity)),
    );
    return records.sort((a, b) => b.updatedAt - a.updatedAt);
  });
}

export async function listTimelinesByStatus(
  status: TimelineStatus,
): Promise<TimelineRecord[]> {
  return withStore("readonly", async (store) => {
    const records = await promisify<TimelineRecord[]>(store.getAll());
    return records.filter((record) => record.status === status);
  });
}

export async function putTimeline(record: TimelineRecord): Promise<void> {
  await withStore("readwrite", (store) => promisify(store.put(record)));
}

/**
 * Closes the active session for an accepted submission. `activeScopeKey` is
 * dropped so the next attempt at the same problem starts a new session instead
 * of extending this one.
 */
export async function markTimelineAccepted(
  scope: TimelineScope,
  submissionId: string,
  now = Date.now(),
): Promise<TimelineRecord | null> {
  return updateActiveTimeline(
    scope,
    (timeline) => {
      if (timeline.snapshots.length === 0) return null;

      const { activeScopeKey: _dropped, ...rest } = timeline;
      const record: TimelineRecord = {
        ...rest,
        status: "accepted",
        acceptedAt: now,
        submissionId,
      };
      return { record, result: record };
    },
    now,
  );
}

/** Records a confirmed Supabase backup for an accepted session. */
export async function markTimelineArchived(
  id: string,
  archive: TimelineArchiveRef,
): Promise<void> {
  await withStore("readwrite", async (store) => {
    const record = await promisify<TimelineRecord | undefined>(store.get(id));
    if (!record) return;

    await promisify(
      store.put({
        ...record,
        status: "archived",
        archive,
        updatedAt: Date.now(),
      } satisfies TimelineRecord),
    );
  });
}

/** Flags a failed upload so the background can retry without losing data. */
export async function markTimelineArchiveFailed(id: string): Promise<void> {
  await withStore("readwrite", async (store) => {
    const record = await promisify<TimelineRecord | undefined>(store.get(id));
    if (!record || record.status === "archived") return;

    await promisify(
      store.put({
        ...record,
        status: "archive_failed",
        updatedAt: Date.now(),
      } satisfies TimelineRecord),
    );
  });
}

/** Removes every timeline for one account, used by data-deletion controls. */
export async function deleteTimelinesForIdentity(
  identity: TimelineIdentity,
): Promise<number> {
  return withStore("readwrite", async (store) => {
    const keys = await promisify<IDBValidKey[]>(
      store.index("identityKey").getAllKeys(buildIdentityKey(identity)),
    );
    await Promise.all(keys.map((key) => promisify(store.delete(key))));
    return keys.length;
  });
}
