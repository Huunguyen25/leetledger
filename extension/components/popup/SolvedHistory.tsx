import { useEffect, useState } from "react";
import {
  getReview,
  listReviewsCached,
  type SolvedReview,
} from "@/lib/review/repository";
import {
  listIncompleteReviews,
  type IncompleteReview,
} from "@/lib/review/incomplete";
import { requestReviewOnProblem } from "@/lib/review/open-request";
import "./SolvedHistory.css";

interface SolvedHistoryProps {
  userId: string;
}

type HistoryState =
  | { status: "loading" }
  | { status: "error"; error: string; reviews: SolvedReview[] }
  | { status: "ready"; reviews: SolvedReview[]; refreshing: boolean };

const TAB_LABEL_MAX = 14;

function tabLabel(review: SolvedReview): string {
  const title = review.problemTitle || review.problemSlug;
  const prefix = review.questionId ? `${review.questionId}. ` : "";
  const full = prefix + title;
  if (full.length <= TAB_LABEL_MAX) return full;
  return `${full.slice(0, TAB_LABEL_MAX)}…`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Cached solved history with horizontal scroll tabs and a detail panel. */
export default function SolvedHistory({ userId }: SolvedHistoryProps) {
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const [activeIndex, setActiveIndex] = useState(0);
  const [incomplete, setIncomplete] = useState<IncompleteReview[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const [result, incompleteRows] = await Promise.all([
        listReviewsCached(userId),
        listIncompleteReviews(),
      ]);
      if (!active) return;
      setIncomplete(incompleteRows);

      if (result.success) {
        setState({
          status: "ready",
          reviews: result.reviews,
          refreshing: result.needsRefresh,
        });
        setActiveIndex(0);

        if (result.needsRefresh) {
          const refreshed = await listReviewsCached(userId, { force: true });
          if (!active) return;
          if (refreshed.success) {
            setState({
              status: "ready",
              reviews: refreshed.reviews,
              refreshing: false,
            });
          } else {
            setState((prev) =>
              prev.status === "ready"
                ? { ...prev, refreshing: false }
                : prev,
            );
          }
        }
        return;
      }

      if (result.reviews?.length) {
        setState({
          status: "error",
          error: result.error,
          reviews: result.reviews,
        });
        setActiveIndex(0);
        return;
      }

      setState({ status: "error", error: result.error, reviews: [] });
    };

    void load();

    return () => {
      active = false;
    };
  }, [userId]);

  const reviews =
    state.status === "ready" || state.status === "error"
      ? state.reviews
      : [];
  const selected = reviews[activeIndex] ?? null;

  const handleTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActiveIndex(Math.min(index + 1, reviews.length - 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActiveIndex(Math.max(index - 1, 0));
    }
  };

  const openIncomplete = async (row: IncompleteReview) => {
    setActionError(null);
    setBusySlug(row.problemSlug);
    try {
      await requestReviewOnProblem({
        problemSlug: row.problemSlug,
        submissionData: row.submissionData,
        draft: row.draft,
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to open review",
      );
    } finally {
      setBusySlug(null);
    }
  };

  const openEdit = async (review: SolvedReview) => {
    setActionError(null);
    setBusySlug(review.problemSlug);
    try {
      const full = await getReview(review.problemSlug);
      const topicTags =
        full.success && full.review.topicTags
          ? full.review.topicTags.map((slug) => ({
              slug,
              name: slug,
            }))
          : undefined;

      await requestReviewOnProblem({
        problemSlug: review.problemSlug,
        submissionData: {
          status: "Accepted",
          problemSlug: review.problemSlug,
          difficulty: review.difficulty,
          questionId:
            review.questionId != null ? String(review.questionId) : undefined,
          topicTags,
        },
        existing: full.success
          ? {
              problemSlug: full.review.problemSlug,
              problemTitle: full.review.problemTitle,
              difficulty: full.review.difficulty,
              mastery: full.review.mastery,
              assistance: full.review.assistance,
              timeComplexity: full.review.timeComplexity ?? undefined,
              spaceComplexity: full.review.spaceComplexity ?? undefined,
              notes: full.review.notes ?? undefined,
              questionId: full.review.questionId,
            }
          : {
              problemSlug: review.problemSlug,
              problemTitle: review.problemTitle,
              difficulty: review.difficulty,
              mastery: review.mastery,
              assistance: "NONE",
              questionId: review.questionId,
            },
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to open review",
      );
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <section className="panel history-panel">
      <div className="history-panel-header">
        <h2 className="panel-title">Solved history</h2>
        {state.status === "ready" && state.refreshing && (
          <span className="history-refreshing">Updating…</span>
        )}
      </div>

      {state.status === "loading" && (
        <p className="history-muted">Loading…</p>
      )}

      {state.status === "error" && reviews.length === 0 && (
        <p className="history-error" role="alert">
          {state.error}
        </p>
      )}

      {incomplete.length > 0 && (
        <div className="history-incomplete">
          <p className="history-incomplete-label">Incomplete reviews</p>
          <ul>
            {incomplete.map((row) => (
              <li key={row.problemSlug}>
                <span>{row.problemSlug}</span>
                <button
                  type="button"
                  className="history-action"
                  disabled={busySlug === row.problemSlug}
                  onClick={() => void openIncomplete(row)}
                >
                  {busySlug === row.problemSlug ? "Opening…" : "Complete"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reviews.length === 0 && state.status === "ready" && (
        <p className="history-muted">No solved problems yet.</p>
      )}

      {reviews.length > 0 && (
        <>
          <div
            className="history-tabs"
            role="tablist"
            aria-label="Solved problems"
          >
            {reviews.map((review, index) => (
              <button
                key={review.problemSlug}
                type="button"
                role="tab"
                className={`history-tab${index === activeIndex ? " active" : ""}`}
                aria-selected={index === activeIndex}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <span
                  className="history-tab-dot"
                  data-difficulty={review.difficulty.toLowerCase()}
                  aria-hidden
                />
                {tabLabel(review)}
              </button>
            ))}
          </div>

          {selected && (
            <div
              className="history-tab-panel"
              role="tabpanel"
              aria-label={selected.problemTitle || selected.problemSlug}
            >
              <div className="history-panel-title">
                <span>
                  {selected.questionId ? `${selected.questionId}. ` : ""}
                  {selected.problemTitle || selected.problemSlug}
                </span>
                <span
                  className="history-difficulty"
                  data-difficulty={selected.difficulty.toLowerCase()}
                >
                  {selected.difficulty}
                </span>
              </div>
              <div className="history-meta">
                <span>Mastery {selected.mastery}/10</span>
                <span>Solved {formatDate(selected.lastSolvedAt)}</span>
              </div>
              <div className="history-meta">
                <span>Next review {formatDate(selected.nextReviewDate)}</span>
              </div>
              <button
                type="button"
                className="history-action"
                disabled={busySlug === selected.problemSlug}
                onClick={() => void openEdit(selected)}
              >
                {busySlug === selected.problemSlug ? "Opening…" : "Edit review"}
              </button>
              {state.status === "error" && (
                <p className="history-error" role="alert">
                  {state.error}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {actionError && (
        <p className="history-error" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}
