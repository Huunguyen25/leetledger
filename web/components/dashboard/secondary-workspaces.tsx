"use client";

import { useMemo } from "react";
import {
  ASSISTANCE_CAP,
  ASSISTANCE_LABEL,
  effectiveMastery,
  reviewStatus,
  topicStats,
} from "@/lib/dashboard/reviews";
import type {
  AssistanceLevel,
  ProblemReview,
  ReviewStatus,
} from "@/lib/dashboard/types";
import { useDashboard } from "./dashboard-provider";
import {
  Accordion,
  DashboardDataNotice,
  PageHeading,
  Panel,
  ProfileSelector,
  ReviewCard,
  TopicBars,
} from "./ui";

const reviewGroups: Array<[string, ReviewStatus]> = [
  ["Overdue", "overdue"],
  ["Due Today", "today"],
  ["Due Soon", "soon"],
  ["Scheduled", "scheduled"],
];

export function ReviewsWorkspace() {
  const { problems } = useDashboard();

  return (
    <div className="content">
      <PageHeading
        title="Reviews"
        description="Your spaced-repetition queue remains separate from future recommendation ranking, so urgency and profile relevance never become one opaque score."
        action={<ProfileSelector compact />}
      />
      <DashboardDataNotice />
      <div className="two-column-route">
        <Panel
          title="Needs review"
          subtitle="Presentation groups derived from the server-owned next review date"
          padded={false}
        >
          {reviewGroups.map(([label, status]) => {
            const matching = problems.filter(
              (problem) => reviewStatus(problem.nextReviewDate) === status,
            );
            return (
              <Accordion
                title={label}
                count={matching.length}
                defaultOpen={status !== "scheduled"}
                key={status}
              >
                {matching.length ? (
                  matching.map((problem) => (
                    <ReviewCard key={problem.problemSlug} problem={problem} />
                  ))
                ) : (
                  <div className="empty-inline">No problems in this group.</div>
                )}
              </Accordion>
            );
          })}
        </Panel>
        <Panel
          title="Recommended problems"
          subtitle="Future feature · no recommendation source configured"
          action={<span className="future-label">Future</span>}
        >
          <div className="notice">
            Production recommendations require an eligible problem source,
            profile requirements, and an explainable scoring model. These
            examples are not part of your SRS schedule.
          </div>
          <div className="empty-inline">
            No recommendation records are available in the current schema.
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function InsightsWorkspace() {
  const { problems } = useDashboard();
  const topics = useMemo(
    () =>
      topicStats(problems).sort(
        (a, b) => a.average - b.average || b.count - a.count,
      ),
    [problems],
  );
  const due = problems.filter((problem) =>
    ["overdue", "today"].includes(reviewStatus(problem.nextReviewDate)),
  ).length;
  const assisted = problems.filter(
    (problem) => problem.assistance !== "NONE",
  ).length;
  const effectiveAverage = problems.length
    ? problems.reduce(
        (total, problem) => total + effectiveMastery(problem),
        0,
      ) / problems.length
    : 0;
  const percentage = (count: number) =>
    problems.length ? Math.round((count / problems.length) * 100) : 0;
  const levels: AssistanceLevel[] = [
    "NONE",
    "HINT",
    "SOLUTION_PEEK",
    "SOLUTION_COPIED",
  ];

  return (
    <div className="content">
      <PageHeading
        title="Insights"
        description="Actionable signals about weak topics, review workload, mastery, and assistance dependency."
        action={<ProfileSelector compact />}
      />
      <DashboardDataNotice />
      <div className="mini-stat-grid">
        <MiniStat label="Due workload" value={String(due)} />
        <MiniStat label="Weakest topic" value={topics[0]?.name ?? "—"} />
        <MiniStat
          label="Any assistance used"
          value={`${percentage(assisted)}%`}
        />
        <MiniStat
          label="Avg effective SRS mastery"
          value={effectiveAverage.toFixed(1)}
        />
      </div>
      <div className="two-column-route insights-grid">
        <Panel
          title="Mastery map"
          subtitle="Average raw mastery by topic, with sample size"
        >
          <TopicBars topics={topics} />
        </Panel>
        <Panel
          title="Assistance dependency"
          subtitle="Neutral usage view using the extension's four categories"
        >
          <div className="data-list">
            {levels.map((level) => {
              const matching = problems.filter(
                (problem) => problem.assistance === level,
              );
              return (
                <div className="data-row" key={level}>
                  <span>
                    <strong>{ASSISTANCE_LABEL[level]}</strong>
                    <small>SRS cap {ASSISTANCE_CAP[level]}/10</small>
                  </span>
                  <span>
                    {matching.length} problems ·{" "}
                    {percentage(matching.length)}%
                  </span>
                </div>
              );
            })}
          </div>
          <div className="notice">
            Raw mastery and effective SRS mastery are shown separately.
            Assistance is a learning signal, not a penalty.
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function ProfilesWorkspace() {
  const {
    profiles,
    activeProfile,
    setActiveProfileId,
  } = useDashboard();
  return (
    <div className="content">
      <PageHeading
        title="Profiles"
        description="Preparation profiles are lenses over one global review history—not duplicate mastery records."
        action={
          <button className="button" type="button" disabled title="Requires profile tables">
            + New custom profile
          </button>
        }
      />
      <div className="notice">
        <strong>Future backend work:</strong> company requirements, custom
        profiles, active-profile persistence, and recommendation logic require
        versioned profile tables and RLS policies. General Practice works today
        as the unfiltered default.
      </div>
      <div className="profile-grid">
        {profiles.map((profile) => {
          const active = profile.id === activeProfile.id;
          return (
            <article
              className={`profile-card${active ? " active" : ""}`}
              key={profile.id}
            >
              <header>
                <h2>{profile.name}</h2>
                <span className="future-label">{profile.type}</span>
              </header>
              <p>{profile.description}</p>
              <div className="chip-row">
                {profile.topics.length ? (
                  profile.topics.map((topic) => (
                    <span className="chip" key={topic}>
                      {topic}
                    </span>
                  ))
                ) : (
                  <span className="chip">All tracked topics</span>
                )}
              </div>
              <button
                className={`button${active ? " primary" : ""}`}
                type="button"
                onClick={() => setActiveProfileId(profile.id)}
              >
                {active ? "Active profile" : "Preview profile"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <article className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function matchingStatus(
  problems: ProblemReview[],
  status: ReviewStatus,
) {
  return problems.filter(
    (problem) => reviewStatus(problem.nextReviewDate) === status,
  );
}
