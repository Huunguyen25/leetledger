"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ASSISTANCE_CAP,
  ASSISTANCE_LABEL,
  effectiveMastery,
  formatReviewDate,
  reviewStatus,
  STATUS_LABEL,
} from "@/lib/dashboard/reviews";
import type {
  ProblemReview,
  ReviewStatus,
  TopicStat,
} from "@/lib/dashboard/types";
import { useDashboard } from "./dashboard-provider";
import { Icon } from "./icons";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function DashboardDataNotice({
  onboarding = false,
}: {
  onboarding?: boolean;
}) {
  const {
    dataStatus,
    dataError,
    problems,
    refreshData,
    sessionUserId,
  } = useDashboard();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [setupRequested, setSetupRequested] = useState(false);
  let notice: ReactNode = null;

  useEffect(() => {
    if (!onboarding || !sessionUserId) return;
    const frame = window.requestAnimationFrame(() => {
      setOnboardingDismissed(
        window.localStorage.getItem(
          `leetledger-onboarding-dismissed:${sessionUserId}`,
        ) === "1",
      );
      setSetupRequested(
        new URLSearchParams(window.location.search).get("setup") === "1",
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [onboarding, sessionUserId]);

  useEffect(() => {
    if (!onboarding) return;
    const openSetup = () => {
      setOnboardingDismissed(false);
      setSetupRequested(true);
    };
    window.addEventListener("leetledger:open-setup", openSetup);
    return () =>
      window.removeEventListener("leetledger:open-setup", openSetup);
  }, [onboarding]);

  function dismissOnboarding() {
    if (sessionUserId) {
      window.localStorage.setItem(
        `leetledger-onboarding-dismissed:${sessionUserId}`,
        "1",
      );
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("setup");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    setSetupRequested(false);
    setOnboardingDismissed(true);
  }

  if (dataStatus === "checking") {
    notice = (
      <div className="notice data-notice" role="status">
        Connecting to Supabase and loading your reviews…
      </div>
    );
  } else if (dataStatus === "signed-out") {
    notice = (
      <div className="notice data-notice">
        <strong>Sign in to load your LeetLedger data.</strong>{" "}
        <Link href="/signin">Go to the sign-in page</Link> and use the same
        email as the extension.
      </div>
    );
  } else if (dataStatus === "unconfigured") {
    notice = (
      <div className="notice data-notice" role="alert">
        <strong>Supabase is not configured.</strong> Add the public URL and
        publishable key from <code>.env.example</code> to <code>.env.local</code>.
      </div>
    );
  } else if (dataStatus === "error") {
    notice = (
      <div className="notice data-notice" role="alert">
        <span>
          <strong>Could not load reviews.</strong> {dataError} Your dashboard
          totals are hidden until data is available.
        </span>
        <button className="button" type="button" onClick={refreshData}>
          Retry
        </button>
      </div>
    );
  } else if (dataStatus === "cache" && dataError) {
    notice = (
      <div className="notice data-notice" role="status">
        <span>
          <strong>Could not refresh.</strong> Showing your cached reviews.{" "}
          {dataError}
        </span>
        <button className="button" type="button" onClick={refreshData}>
          Retry
        </button>
      </div>
    );
  } else if (
    dataStatus === "live" &&
    onboarding &&
    (setupRequested || (problems.length === 0 && !onboardingDismissed))
  ) {
    notice = (
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <div className="onboarding-heading">
          <div>
            <span className="eyebrow">First-time setup</span>
            <h2 id="onboarding-title">Start tracking with LeetLedger</h2>
            <p>
              The dashboard fills up after the browser extension saves your
              first review.
            </p>
          </div>
          <button
            className="button"
            type="button"
            onClick={dismissOnboarding}
          >
            Dismiss
          </button>
        </div>
        <ol className="onboarding-steps">
          <li>
            <strong>Install the extension</strong>
            <span>
              Download the latest package from{" "}
              <a
                href="https://github.com/Huunguyen25/leetledger/releases"
                target="_blank"
                rel="noreferrer"
              >
                GitHub Releases
              </a>{" "}
              and load it in Chrome.
            </span>
          </li>
          <li>
            <strong>Sign in with this email</strong>
            <span>Use the same account in the extension and dashboard.</span>
          </li>
          <li>
            <strong>Save your first review</strong>
            <span>
              Solve a LeetCode problem, complete the review, then retry the
              dashboard sync.
            </span>
          </li>
        </ol>
        <div className="onboarding-actions">
          <button className="button primary" type="button" onClick={refreshData}>
            Check for reviews
          </button>
          <span>
            Already using LeetLedger? Confirm both apps use the same email.
          </span>
        </div>
      </section>
    );
  } else if (dataStatus === "live" && problems.length === 0) {
    notice = (
      <div className="notice data-notice">
        <strong>No reviewed problems yet.</strong> Open Setup help from the
        account menu for extension installation and sync instructions.
      </div>
    );
  }

  return (
    <div className={`data-notice-slot${notice ? "" : " empty"}`}>
      {notice}
    </div>
  );
}

export function ProfileSelector({ compact = false }: { compact?: boolean }) {
  const {
    profiles,
    activeProfile,
    setActiveProfileId,
  } = useDashboard();
  return (
    <label className={`profile-selector${compact ? " compact" : ""}`}>
      <span>{compact ? "Profile" : "Preparing for"}</span>
      <select
        value={activeProfile.id}
        onChange={(event) => setActiveProfileId(event.target.value)}
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function StatusDot({
  status,
  label = true,
}: {
  status: ReviewStatus;
  label?: boolean;
}) {
  return (
    <span
      className={`status-dot status-${status}`}
      aria-label={label ? STATUS_LABEL[status] : undefined}
      title={STATUS_LABEL[status]}
    />
  );
}

const statusOrder: ReviewStatus[] = [
  "overdue",
  "today",
  "soon",
  "scheduled",
  "unscheduled",
];

export function StatusLegend() {
  return (
    <div className="status-legend" aria-label="Review status legend">
      {statusOrder.map((status) => (
        <span key={status}>
          <StatusDot status={status} label={false} />
          {STATUS_LABEL[status]}
        </span>
      ))}
    </div>
  );
}

export function ViewToggle({
  value,
  onChange,
}: {
  value: "grid" | "list";
  onChange: (value: "grid" | "list") => void;
}) {
  return (
    <div className="segmented" role="group" aria-label="Problem view">
      <button
        type="button"
        className={value === "grid" ? "active" : ""}
        aria-label="Grid view"
        aria-pressed={value === "grid"}
        onClick={() => onChange("grid")}
      >
        <Icon name="grid" size={17} />
      </button>
      <button
        type="button"
        className={value === "list" ? "active" : ""}
        aria-label="List view"
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
      >
        <Icon name="list" size={17} />
      </button>
    </div>
  );
}

export function ProblemCard({ problem }: { problem: ProblemReview }) {
  const { openProblem } = useDashboard();
  const status = reviewStatus(problem.nextReviewDate);
  const visibleTopics = problem.topicTags.slice(0, 3);
  return (
    <button
      className="problem-card"
      type="button"
      onClick={() => openProblem(problem)}
      aria-label={`Open details for ${problem.problemTitle}`}
    >
      <span className="problem-title-row">
        <StatusDot status={status} />
        <strong>
          {problem.questionId ? `${problem.questionId}. ` : ""}
          {problem.problemTitle}
        </strong>
      </span>
      <span className="mastery-row">
        <b>{problem.mastery}/10</b>
        <span className="mastery-track" aria-hidden="true">
          <span style={{ width: `${problem.mastery * 10}%` }} />
        </span>
      </span>
      <span className="chip-row">
        {visibleTopics.map((topic) => (
          <span className="chip" key={topic}>
            {topic}
          </span>
        ))}
        {problem.topicTags.length > visibleTopics.length && (
          <span className="chip">
            +{problem.topicTags.length - visibleTopics.length}
          </span>
        )}
      </span>
      <span className="problem-meta">
        <span>
          {STATUS_LABEL[status]} · {formatReviewDate(problem.nextReviewDate)}
        </span>
        <span className={`difficulty ${problem.difficulty.toLowerCase()}`}>
          {problem.difficulty}
        </span>
      </span>
    </button>
  );
}

export function ProblemCollection({
  problems,
  view,
  emptyMessage = "No tracked problems match these filters.",
}: {
  problems: ProblemReview[];
  view: "grid" | "list";
  emptyMessage?: string;
}) {
  if (!problems.length) return <div className="empty-state">{emptyMessage}</div>;
  return (
    <div className={`problem-collection ${view}`}>
      {problems.map((problem) => (
        <ProblemCard key={problem.problemSlug} problem={problem} />
      ))}
    </div>
  );
}

export function TopicBars({
  topics,
  limit,
}: {
  topics: TopicStat[];
  limit?: number;
}) {
  const visible = typeof limit === "number" ? topics.slice(0, limit) : topics;
  return (
    <div className="topic-bars">
      {visible.map((topic) => (
        <div className="topic-row" key={topic.name}>
          <div>
            <strong>{topic.name}</strong>
            <span>
              {topic.count} {topic.count === 1 ? "problem" : "problems"} ·{" "}
              {topic.due} due
            </span>
          </div>
          <div
            className="topic-track"
            role="img"
            aria-label={`${topic.name}: ${topic.average.toFixed(1)} out of 10 across ${topic.count} problems`}
          >
            <span style={{ width: `${topic.average * 10}%` }} />
          </div>
          <span className="topic-score">{topic.average.toFixed(1)}/10</span>
        </div>
      ))}
    </div>
  );
}

export function ReviewCard({
  problem,
  recommended = false,
}: {
  problem: ProblemReview;
  recommended?: boolean;
}) {
  const { openProblem } = useDashboard();
  const status = reviewStatus(problem.nextReviewDate);
  return (
    <button
      className="review-card"
      type="button"
      onClick={() => openProblem(problem)}
    >
      <span className="review-card-top">
        <span>
          <strong>
            {problem.questionId ? `${problem.questionId}. ` : ""}
            {problem.problemTitle}
          </strong>
          <small>{problem.topicTags.slice(0, 2).join(" · ")}</small>
        </span>
        <span className={`priority ${recommended ? "recommended" : status}`}>
          {recommended ? "Future" : STATUS_LABEL[status]}
        </span>
      </span>
      <span className="review-card-meta">
        <span>
          {recommended
            ? "Profile and weakness weighted"
            : `Review ${formatReviewDate(problem.nextReviewDate)}`}
        </span>
        <span>
          Mastery <b>{problem.mastery}/10</b>
        </span>
      </span>
    </button>
  );
}

export function Accordion({
  title,
  count,
  children,
  defaultOpen = true,
  future = false,
}: {
  title: string;
  count: number;
  children: ReactNode;
  defaultOpen?: boolean;
  future?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <section className={`accordion${open ? " open" : ""}`}>
      <button
        className="accordion-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <b>{title}</b>
          <span className="count-pill">{count}</span>
          {future && <span className="future-label">Future</span>}
        </span>
        <Icon name="chevron" size={17} />
      </button>
      <div className="accordion-content" id={contentId}>
        <div>
          <div className="review-list">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
  padded = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className={padded ? "panel-body" : ""}>{children}</div>
    </section>
  );
}

export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="button" href={href}>
      {children}
    </Link>
  );
}

export function ProblemDrawer() {
  const { selectedProblem: problem, closeProblem } = useDashboard();
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!problem) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeProblem();
      if (event.key !== "Tab") return;
      const drawer = closeButton.current?.closest("[role=dialog]");
      const focusable = drawer?.querySelectorAll<HTMLElement>(
        "button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [closeProblem, problem]);

  if (!problem) return null;
  const status = reviewStatus(problem.nextReviewDate);
  const cap = ASSISTANCE_CAP[problem.assistance];
  return (
    <>
      <button
        className="modal-backdrop"
        onClick={closeProblem}
        aria-label="Close problem details"
      />
      <aside
        className="problem-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="problem-drawer-title"
      >
        <header>
          <h2 id="problem-drawer-title">Problem details</h2>
          <button
            ref={closeButton}
            type="button"
            className="icon-button"
            onClick={closeProblem}
            aria-label="Close problem details"
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="drawer-scroll">
          <div className="detail-hero">
            <div>
              <span className="detail-kicker">
                {problem.questionId ? `${problem.questionId} · ` : ""}
                <span className={`difficulty ${problem.difficulty.toLowerCase()}`}>
                  {problem.difficulty}
                </span>
              </span>
              <h3>{problem.problemTitle}</h3>
              <span className="detail-status">
                <StatusDot status={status} label={false} />
                {STATUS_LABEL[status]} ·{" "}
                {formatReviewDate(problem.nextReviewDate)}
              </span>
            </div>
            <b>{problem.mastery}/10</b>
          </div>
          <div className="detail-grid">
            <Detail label="Raw mastery" value={`${problem.mastery}/10`} />
            <Detail
              label="Effective SRS mastery"
              value={`${effectiveMastery(problem)}/10`}
            />
            <Detail
              label="Assistance"
              value={ASSISTANCE_LABEL[problem.assistance]}
            />
            <Detail label="Assistance cap" value={`${cap}/10`} />
            <Detail
              label="Last solved"
              value={formatReviewDate(problem.lastSolvedAt)}
            />
            <Detail
              label="Next review"
              value={formatReviewDate(problem.nextReviewDate)}
            />
            <Detail label="Time complexity" value={problem.timeComplexity} />
            <Detail label="Space complexity" value={problem.spaceComplexity} />
          </div>
          <section className="detail-section">
            <span className="detail-kicker">Topics</span>
            <div className="chip-row">
              {problem.topicTags.map((topic) => (
                <span className="chip" key={topic}>
                  {topic}
                </span>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <span className="detail-kicker">Notes</span>
            <p className="detail-note">{problem.notes}</p>
          </section>
          <a
            className="button primary"
            href={`https://leetcode.com/problems/${problem.problemSlug}/`}
            target="_blank"
            rel="noreferrer"
          >
            Open on LeetCode <Icon name="external" size={16} />
          </a>
        </div>
      </aside>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
