import { browser } from "wxt/browser";
import constants from "@/constants";

/**
 * Read-only adapter over LeetCode's own editor database.
 *
 * LeetCode autosaves the complete editor document for its own use, which is far
 * more reliable than scraping a virtualized Monaco DOM. Every assumption about
 * LeetCode's undocumented database name, store name, and record-key format is
 * confined to this module, so a LeetCode schema change is a one-file fix.
 *
 * LeetLedger must never create, upgrade, or write this database.
 */

const LEETCODE_DB_NAME = "LeetCode-problems";
const CODE_STORE = "problem_code";
/** `{questionId}_{leetcodeUserId}_{languageSlug}` */
const CODE_KEY_PATTERN = /^(\d+)_(\d+)_(.+)$/;
const LANGUAGE_STORAGE_PATTERN = /^global_lang/;
const QUESTION_ID_TIMEOUT_MS = 3000;

const QUESTION_ID_QUERY = `query leetledgerQuestionId($titleSlug: String!) {
  question(titleSlug: $titleSlug) { questionId }
}`;

export type EditorCodeResult =
  | {
      ok: true;
      code: string;
      language: string;
      questionId: string;
    }
  | {
      ok: false;
      reason:
        | "database_missing"
        | "store_missing"
        | "context_unresolved"
        | "record_missing"
        | "read_failed";
    };

const questionIdCache = new Map<string, string>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readPersistedQuestionIds(): Promise<Record<string, string>> {
  try {
    const stored = await browser.storage.local.get(
      constants.PROBLEM_ID_MAP_KEY,
    );
    const map = stored[constants.PROBLEM_ID_MAP_KEY];
    return typeof map === "object" && map !== null
      ? (map as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Resolves a problem slug to LeetCode's numeric question ID, which is part of
 * the editor record key. Cached in memory and in extension storage because it
 * never changes for a given problem.
 */
export async function resolveQuestionId(
  problemSlug: string,
): Promise<string | null> {
  const cached = questionIdCache.get(problemSlug);
  if (cached) return cached;

  const persisted = await readPersistedQuestionIds();
  if (persisted[problemSlug]) {
    questionIdCache.set(problemSlug, persisted[problemSlug]);
    return persisted[problemSlug];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    QUESTION_ID_TIMEOUT_MS,
  );

  try {
    const response = await fetch("/graphql/", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operationName: "leetledgerQuestionId",
        variables: { titleSlug: problemSlug },
        query: QUESTION_ID_QUERY,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const json = (await response.json()) as {
      data?: { question?: { questionId?: unknown } };
    };
    const questionId = json.data?.question?.questionId;
    if (typeof questionId !== "string" || !questionId) return null;

    questionIdCache.set(problemSlug, questionId);
    await browser.storage.local.set({
      [constants.PROBLEM_ID_MAP_KEY]: {
        ...persisted,
        [problemSlug]: questionId,
      },
    });
    return questionId;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Reads LeetCode's selected language from its own page storage. */
export function detectSelectedLanguage(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !LANGUAGE_STORAGE_PATTERN.test(key)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = raw.startsWith('"') ? JSON.parse(raw) : raw;
      if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
    }
  } catch {
    // Language detection is a hint; key scanning can still disambiguate.
  }
  return null;
}

/**
 * Opens LeetCode's database without ever requesting a version. `databases()` is
 * checked first because `indexedDB.open()` would otherwise create an empty
 * database under LeetCode's name.
 */
async function openLeetCodeDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    if (typeof indexedDB.databases === "function") {
      const databases = await indexedDB.databases();
      const exists = databases.some(
        (database) => database.name === LEETCODE_DB_NAME,
      );
      if (!exists) return null;
    }

    return new Promise<IDBDatabase | null>((resolve, reject) => {
      const request = indexedDB.open(LEETCODE_DB_NAME);
      let creating = false;

      request.onupgradeneeded = () => {
        // The database did not exist after all; abandon it instead of taking
        // ownership of LeetCode's schema.
        creating = true;
        request.transaction?.abort();
      };
      request.onerror = () => (creating ? resolve(null) : reject(request.error));
      request.onblocked = () => resolve(null);
      request.onsuccess = () => {
        const db = request.result;
        if (creating) {
          db.close();
          resolve(null);
          return;
        }

        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
    });
  })().catch(() => {
    dbPromise = null;
    return null;
  });

  return dbPromise;
}

interface EditorRecordKey {
  key: string;
  language: string;
}

function pickRecordKey(
  keys: IDBValidKey[],
  questionId: string,
  preferredLanguage: string | null,
): EditorRecordKey | null {
  const candidates: EditorRecordKey[] = [];

  for (const key of keys) {
    if (typeof key !== "string") continue;
    const match = key.match(CODE_KEY_PATTERN);
    if (!match || match[1] !== questionId) continue;
    candidates.push({ key, language: match[3] });
  }

  if (preferredLanguage) {
    const preferred = candidates.find(
      (candidate) => candidate.language === preferredLanguage,
    );
    if (preferred) return preferred;
  }

  // Without a language hint, a single record is unambiguous; several are not.
  return candidates.length === 1 ? candidates[0] : null;
}

function extractCode(value: unknown): string | null {
  if (typeof value === "string") return value.length > 0 ? value : null;
  if (value && typeof value === "object" && "code" in value) {
    const code = (value as { code?: unknown }).code;
    return typeof code === "string" && code.length > 0 ? code : null;
  }
  return null;
}

/** Reads the complete autosaved code for one problem, or explains why it could not. */
export async function readEditorCode(options: {
  questionId: string;
  preferredLanguage?: string | null;
}): Promise<EditorCodeResult> {
  try {
    const db = await openLeetCodeDb();
    if (!db) return { ok: false, reason: "database_missing" };
    if (!db.objectStoreNames.contains(CODE_STORE)) {
      return { ok: false, reason: "store_missing" };
    }

    const store = db
      .transaction([CODE_STORE], "readonly")
      .objectStore(CODE_STORE);
    const keys = await promisify(store.getAllKeys());
    const target = pickRecordKey(
      keys,
      options.questionId,
      options.preferredLanguage ?? detectSelectedLanguage(),
    );
    if (!target) return { ok: false, reason: "context_unresolved" };

    const code = extractCode(
      await promisify(
        db
          .transaction([CODE_STORE], "readonly")
          .objectStore(CODE_STORE)
          .get(target.key),
      ),
    );
    if (code === null) return { ok: false, reason: "record_missing" };

    return {
      ok: true,
      code,
      language: target.language,
      questionId: options.questionId,
    };
  } catch {
    return { ok: false, reason: "read_failed" };
  }
}

/** Convenience path used by the content poller: slug in, complete code out. */
export async function readCurrentEditorCode(
  problemSlug: string,
): Promise<EditorCodeResult> {
  const questionId = await resolveQuestionId(problemSlug);
  if (!questionId) return { ok: false, reason: "context_unresolved" };
  return readEditorCode({ questionId });
}

/** Drops the cached LeetCode connection (teardown and tests). */
export function closeLeetCodeDb(): void {
  const pending = dbPromise;
  dbPromise = null;
  void pending?.then((db) => db?.close()).catch(() => undefined);
}
