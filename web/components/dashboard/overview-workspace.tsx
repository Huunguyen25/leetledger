"use client";

import { useMemo, useState } from "react";
import {
  compareByReviewDate,
  reviewStatus,
  topicStats,
} from "@/lib/dashboard/reviews";
import type { ReviewStatus } from "@/lib/dashboard/types";
import { useDashboard } from "./dashboard-provider";
import {
  Accordion,
  DashboardDataNotice,
  PageHeading,
  Panel,
  ProblemCollection,
  ProfileSelector,
  ReviewCard,
  StatusLegend,
  TextLink,
  TopicBars,
  ViewToggle,
} from "./ui";

export function OverviewWorkspace() {
  const { problems } = useDashboard();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ReviewStatus | "all">("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  const due = useMemo(
    () =>
      problems.filter((problem) =>
        ["overdue", "today"].includes(reviewStatus(problem.nextReviewDate)),
      ),
    [problems],
  );
  const queue = useMemo(
    () =>
      problems
        .filter((problem) =>
          ["overdue", "today", "soon"].includes(
            reviewStatus(problem.nextReviewDate),
          ),
        )
        .sort(compareByReviewDate)
        .slice(0, 7),
    [problems],
  );
  const topics = useMemo(
    () =>
      topicStats(problems).sort(
        (a, b) => a.average - b.average || b.count - a.count,
      ),
    [problems],
  );
  const preview = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return problems
      .filter(
        (problem) =>
          (!normalized ||
            problem.problemTitle.toLowerCase().includes(normalized) ||
            problem.topicTags.some((topic) =>
              topic.toLowerCase().includes(normalized),
            )) &&
          (status === "all" ||
            reviewStatus(problem.nextReviewDate) === status),
      )
      .slice(0, 9);
  }, [problems, query, status]);

  const average = problems.length
    ? problems.reduce((total, problem) => total + problem.mastery, 0) /
      problems.length
    : 0;
  const overdue = due.filter(
    (problem) => reviewStatus(problem.nextReviewDate) === "overdue",
  ).length;

  return (
    <div className="content">
      <PageHeading
        title="Review workspace"
        description="See what is due, inspect weak topics, and choose the next useful problem without turning your dashboard into a wall of vanity stats."
        action={<ProfileSelector />}
      />
      <DashboardDataNotice />

      <section className="summary-grid" aria-label="Review summary">
        <SummaryCard
          label="Total Problems Tracked"
          value={String(problems.length)}
          helper="Across all tracked reviews"
        />
        <SummaryCard
          label="Problems Due for Review"
          value={String(due.length)}
          helper={`${overdue} overdue · ${due.length - overdue} due today`}
        />
        <SummaryCard
          label="Average Mastery"
          value={`${average.toFixed(1)}/10`}
          helper="Raw mastery; effective SRS credit may be assistance-capped"
        />
      </section>

      <div className="workspace-grid">
        <div className="stack">
          <Panel
            title="Problem library"
            subtitle="A quick preview of tracked problems"
            action={<TextLink href="/problems">View all</TextLink>}
          >
            <div className="toolbar">
              <label className="grow-control">
                <span className="sr-only">Search problem preview</span>
                <input
                  type="search"
                  placeholder="Search title or topic"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label>
                <span className="sr-only">Filter by review status</span>
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as ReviewStatus | "all")
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="overdue">Overdue</option>
                  <option value="today">Due today</option>
                  <option value="soon">Due soon</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="unscheduled">Unscheduled</option>
                </select>
              </label>
              <ViewToggle value={view} onChange={setView} />
            </div>
            <StatusLegend />
            <div className="problem-preview-scroll">
              <ProblemCollection problems={preview} view={view} />
            </div>
          </Panel>

          <Panel
            title="Mastery by topic"
            subtitle="Weakest topics first · sample size included"
            action={<TextLink href="/insights">Open insights</TextLink>}
          >
            <TopicBars topics={topics} limit={7} />
          </Panel>
        </div>

        <div className="stack action-column">
          <Panel
            title="What to work on"
            subtitle="Review schedule first, recommendations second"
            padded={false}
          >
            <div className="review-scroll">
              <Accordion title="Needs Review" count={queue.length}>
                {queue.length ? (
                  queue.map((problem) => (
                    <ReviewCard key={problem.problemSlug} problem={problem} />
                  ))
                ) : (
                  <div className="empty-inline">
                    Nothing is currently overdue or due soon.
                  </div>
                )}
              </Accordion>
              <Accordion
                title="Recommended Problems"
                count={0}
                defaultOpen={false}
                future
              >
                <div className="empty-inline">
                  Recommendation data is not available in the current schema.
                </div>
              </Accordion>
            </div>
          </Panel>
          <div className="notice">
            <strong>Data boundary:</strong> Needs Review uses the existing{" "}
            <code>next_review_date</code>. Recommendation ranking and preparation
            profiles need backend tables and are shown as future UX only.
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}
