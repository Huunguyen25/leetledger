import constants from "@/constants";

/**
 * Keeps Accepted → at most one review prompt per problem/solution head, and
 * coordinates multi-tab claims so sibling tabs do not fight over the drawer.
 *
 * Completed/skipped heads are durable (keyed by checksum): a new prompt is
 * allowed only when the code checksum changes (or the caller forces open).
 * In-flight `open` claims still expire so a crashed tab cannot block forever.
 */

const OPEN_CLAIM_TTL_MS = 5 * 60 * 1000;

export type PromptDecision =
  | { open: true }
  | {
      open: false;
      reason: "recently_completed" | "skipped" | "same_head" | "opened_elsewhere";
    };

interface PromptEntry {
  problemSlug: string;
  /** Normalized code checksum when known; empty means problem-level only. */
  codeChecksum: string;
  status: "completed" | "skipped" | "open";
  clientId?: string;
  attemptId?: string;
  updatedAt: number;
}

interface PromptGateState {
  entries: PromptEntry[];
}

function isPromptEntry(value: unknown): value is PromptEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.problemSlug === "string" &&
    typeof candidate.codeChecksum === "string" &&
    (candidate.status === "completed" ||
      candidate.status === "skipped" ||
      candidate.status === "open") &&
    typeof candidate.updatedAt === "number"
  );
}

/** Only expire transient open claims; completed/skipped heads stay forever. */
function prune(entries: PromptEntry[], now = Date.now()): PromptEntry[] {
  return entries.filter((entry) => {
    if (entry.status === "open") {
      return now - entry.updatedAt < OPEN_CLAIM_TTL_MS;
    }
    return true;
  });
}

async function readState(): Promise<PromptGateState> {
  const result = await browser.storage.local.get(
    constants.REVIEW_PROMPT_GATE_KEY,
  );
  const raw = result[constants.REVIEW_PROMPT_GATE_KEY] as
    | PromptGateState
    | undefined;
  const entries = Array.isArray(raw?.entries)
    ? prune(raw.entries.filter(isPromptEntry))
    : [];
  return { entries };
}

async function writeState(state: PromptGateState): Promise<void> {
  const entries = prune(state.entries);
  if (entries.length === 0) {
    await browser.storage.local.remove(constants.REVIEW_PROMPT_GATE_KEY);
    return;
  }
  await browser.storage.local.set({
    [constants.REVIEW_PROMPT_GATE_KEY]: { entries },
  });
}

function matchesHead(entry: PromptEntry, codeChecksum: string | null): boolean {
  if (!codeChecksum) return entry.codeChecksum === "";
  return entry.codeChecksum === "" || entry.codeChecksum === codeChecksum;
}

/**
 * Decides whether this tab may mount the review drawer for an Accepted result.
 * Claiming `open` is atomic with the decision so a sibling tab loses the race.
 *
 * Pass `force: true` for explicit popup open requests (`ll_open_review`) so a
 * prior skip/complete does not block Complete / Edit.
 */
export async function claimReviewPrompt(input: {
  problemSlug: string;
  codeChecksum: string | null;
  clientId: string;
  attemptId: string;
  force?: boolean;
}): Promise<PromptDecision> {
  const state = await readState();
  const now = Date.now();

  if (!input.force) {
    const relevant = state.entries.filter(
      (entry) =>
        entry.problemSlug === input.problemSlug &&
        matchesHead(entry, input.codeChecksum),
    );

    for (const entry of relevant) {
      if (entry.status === "completed") {
        return { open: false, reason: "recently_completed" };
      }
      if (entry.status === "skipped") {
        return { open: false, reason: "skipped" };
      }
      if (
        entry.status === "open" &&
        entry.clientId &&
        entry.clientId !== input.clientId
      ) {
        return { open: false, reason: "opened_elsewhere" };
      }
    }
  }

  const nextEntries = [
    ...state.entries.filter((entry) => {
      if (entry.problemSlug !== input.problemSlug) return true;
      if (input.force) {
        // Drop prior open/skip/complete for this problem so Edit/Complete can remount.
        return false;
      }
      return !matchesHead(entry, input.codeChecksum);
    }),
    {
      problemSlug: input.problemSlug,
      codeChecksum: input.codeChecksum ?? "",
      status: "open" as const,
      clientId: input.clientId,
      attemptId: input.attemptId,
      updatedAt: now,
    },
  ];
  await writeState({ entries: nextEntries });
  return { open: true };
}

export async function markReviewCompleted(
  problemSlug: string,
  codeChecksum: string | null = null,
): Promise<void> {
  const state = await readState();
  const now = Date.now();
  const checksum = codeChecksum ?? "";
  await writeState({
    entries: [
      // Keep other heads for this problem; replace only this checksum / empty.
      ...state.entries.filter(
        (entry) =>
          entry.problemSlug !== problemSlug ||
          (checksum !== "" &&
            entry.codeChecksum !== "" &&
            entry.codeChecksum !== checksum),
      ),
      {
        problemSlug,
        codeChecksum: checksum,
        status: "completed",
        updatedAt: now,
      },
    ],
  });
}

/** Treat dismiss/skip as "do not reopen for this same Accepted head". */
export async function markReviewSkipped(
  problemSlug: string,
  codeChecksum: string | null = null,
): Promise<void> {
  const state = await readState();
  const now = Date.now();
  const checksum = codeChecksum ?? "";
  await writeState({
    entries: [
      ...state.entries.filter(
        (entry) =>
          entry.problemSlug !== problemSlug ||
          (checksum !== "" &&
            entry.codeChecksum !== "" &&
            entry.codeChecksum !== checksum),
      ),
      {
        problemSlug,
        codeChecksum: checksum,
        status: "skipped",
        updatedAt: now,
      },
    ],
  });
}

export async function releaseReviewClaim(
  problemSlug: string,
  clientId: string,
): Promise<void> {
  const state = await readState();
  await writeState({
    entries: state.entries.filter(
      (entry) =>
        !(
          entry.problemSlug === problemSlug &&
          entry.status === "open" &&
          entry.clientId === clientId
        ),
    ),
  });
}

export async function clearReviewPromptGate(): Promise<void> {
  await browser.storage.local.remove(constants.REVIEW_PROMPT_GATE_KEY);
}
