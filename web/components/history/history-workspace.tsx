"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ASSISTANCE_LABEL,
  formatLongDate,
} from "@/lib/dashboard/reviews";
import {
  listTimelineProblemSlugs,
} from "@/lib/dashboard/repository";
import type { EvolutionEvent } from "@/lib/dashboard/types";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { Icon } from "@/components/dashboard/icons";
import {
  DashboardDataNotice,
  PageHeading,
} from "@/components/dashboard/ui";

export function HistoryWorkspace() {
  const {
    problems,
    archives,
    loadArchive,
    sessionUserId,
  } = useDashboard();
  const submissions = useMemo(
    () =>
      problems
        .map((problem) => ({
          problem,
          archive:
            archives.find(
              (archive) => archive.problemSlug === problem.problemSlug,
            ) ?? null,
        }))
        .sort(
          (a, b) =>
            new Date(b.problem.lastSolvedAt).getTime() -
            new Date(a.problem.lastSolvedAt).getTime(),
        ),
    [archives, problems],
  );
  const [activeSlug, setActiveSlug] = useState(
    submissions[0]?.problem.problemSlug ?? "",
  );
  const [query, setQuery] = useState("");
  const [evolution, setEvolution] = useState("all");
  const [eventIndex, setEventIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1500);
  const [copied, setCopied] = useState(false);
  const [availableSlugs, setAvailableSlugs] = useState<Set<string> | null>(
    null,
  );
  const [missingArchives, setMissingArchives] = useState<Set<string>>(
    () => new Set(),
  );
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const active = submissions.find(
    ({ problem }) => problem.problemSlug === activeSlug,
  ) ?? submissions[0];
  const events = active?.archive?.events ?? [];
  const selectedEvent = events[eventIndex] ?? null;
  const archiveLoading = Boolean(
    active &&
      !active.archive &&
      !missingArchives.has(active.problem.problemSlug) &&
      !archiveError &&
      ((sessionUserId && availableSlugs === null) ||
        availableSlugs?.has(active.problem.problemSlug)),
  );

  const filtered = submissions.filter(({ problem }) => {
    const haystack =
      `${problem.questionId} ${problem.problemTitle} ${problem.topicTags.join(" ")}`.toLowerCase();
    const hasEvolution = availableSlugs?.has(problem.problemSlug) ?? false;
    return (
      haystack.includes(query.trim().toLowerCase()) &&
      (evolution === "all" ||
        (evolution === "yes" ? hasEvolution : !hasEvolution))
    );
  });

  useEffect(() => {
    if (!sessionUserId) {
      const frame = window.requestAnimationFrame(() => setAvailableSlugs(null));
      return () => window.cancelAnimationFrame(frame);
    }
    let activeRequest = true;
    void listTimelineProblemSlugs(sessionUserId)
      .then((slugs) => {
        if (activeRequest) setAvailableSlugs(slugs);
      })
      .catch((error: unknown) => {
        if (activeRequest) {
          setArchiveError(
            error instanceof Error
              ? error.message
              : "Could not list code timelines.",
          );
          setAvailableSlugs(new Set());
        }
      });
    return () => {
      activeRequest = false;
    };
  }, [sessionUserId]);

  useEffect(() => {
    const problemSlug = active?.problem.problemSlug;
    if (
      !problemSlug ||
      active.archive ||
      missingArchives.has(problemSlug) ||
      !availableSlugs?.has(problemSlug)
    ) {
      return;
    }
    let activeRequest = true;
    void loadArchive(problemSlug)
      .then((archive) => {
        if (!activeRequest) return;
        if (!archive) {
          setMissingArchives((current) => new Set(current).add(problemSlug));
          return;
        }
        setEventIndex(Math.max(0, (archive?.events.length ?? 1) - 1));
      })
      .catch((error: unknown) => {
        if (activeRequest) {
          setArchiveError(
            error instanceof Error
              ? error.message
              : "Could not load the code timeline.",
          );
        }
      });
    return () => {
      activeRequest = false;
    };
  }, [active, availableSlugs, loadArchive, missingArchives]);

  useEffect(() => {
    if (!playing || events.length < 2) return;
    const timer = window.setInterval(() => {
      setEventIndex((current) => {
        if (current >= events.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, speed);
    return () => window.clearInterval(timer);
  }, [events.length, playing, speed]);

  function choose(slug: string) {
    setPlaying(false);
    setActiveSlug(slug);
    const archive = submissions.find(
      ({ problem }) => problem.problemSlug === slug,
    )?.archive;
    setEventIndex(Math.max(0, (archive?.events.length ?? 1) - 1));
    setArchiveError(null);
  }

  function move(target: number) {
    setPlaying(false);
    setEventIndex(Math.max(0, Math.min(events.length - 1, target)));
  }

  async function copyCode() {
    if (!selectedEvent) return;
    try {
      await navigator.clipboard.writeText(selectedEvent.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  if (!active) {
    return (
      <div className="content">
        <PageHeading
          eyebrow="Your coding journey"
          title="Submission history"
          description="Replay accepted solutions and revisit your solve notes."
        />
        <DashboardDataNotice />
      </div>
    );
  }

  const { problem } = active;
  const lineCount = selectedEvent?.code.split("\n").length ?? 0;

  return (
    <div className="content history-content">
      <PageHeading
        eyebrow="Your coding journey"
        title="Submission history"
        description="Replay how your solutions developed, inspect the final accepted code, and revisit your solve notes."
        action={
          <button
            type="button"
            className="button"
            onClick={() => choose(submissions[0].problem.problemSlug)}
          >
            Latest accepted
          </button>
        }
      />
      <div className="history-layout">
        <aside className="panel history-sidebar">
          <header className="panel-heading">
            <div>
              <h2>Accepted submissions</h2>
              <p>
                {filtered.length} matching of {submissions.length} recent solves
              </p>
            </div>
            <span className="badge">Supabase</span>
          </header>
          <div className="history-filters">
            <label>
              <span className="sr-only">Search submissions</span>
              <input
                type="search"
                placeholder="Search problems…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="single-filter">
              <label>
                <span className="sr-only">Filter by evolution availability</span>
                <select
                  value={evolution}
                  disabled={availableSlugs === null}
                  onChange={(event) => setEvolution(event.target.value)}
                >
                  <option value="all">
                    {availableSlugs === null
                      ? "Checking code archives…"
                      : "All submissions"}
                  </option>
                  <option value="yes">With evolution</option>
                  <option value="no">Without evolution</option>
                </select>
              </label>
            </div>
          </div>
          <div className="history-list" aria-label="Accepted submissions list">
            {filtered.length ? (
              filtered.map(({ problem: item, archive: itemArchive }) => (
                <button
                  type="button"
                  className={`history-item${item.problemSlug === problem.problemSlug ? " active" : ""}`}
                  key={item.problemSlug}
                  aria-pressed={item.problemSlug === problem.problemSlug}
                  onClick={() => choose(item.problemSlug)}
                >
                  <strong>
                    {item.questionId ? `${item.questionId}. ` : ""}
                    {item.problemTitle}
                  </strong>
                  <span className="history-badges">
                    <span className="badge accepted">Accepted</span>
                    {itemArchive && (
                      <span className="badge">{itemArchive.language}</span>
                    )}
                    {availableSlugs?.has(item.problemSlug) && (
                      <span className="badge">↻ Code archive</span>
                    )}
                  </span>
                  <span className="history-item-meta">
                    <span>{formatLongDate(item.lastSolvedAt)}</span>
                    <span>Mastery {item.mastery}/10</span>
                  </span>
                </button>
              ))
            ) : (
              <div className="empty-state">No submissions match these filters.</div>
            )}
          </div>
        </aside>

        <div className="history-details">
          <section className="panel problem-heading-card">
            <div className="accepted-row">
              <span className="badge accepted">✓ Accepted</span>
              <span>{formatLongDate(problem.lastSolvedAt)}</span>
            </div>
            <h2>
              {problem.questionId ? `${problem.questionId}. ` : ""}
              {problem.problemTitle}
            </h2>
            <div className="history-badges">
              <span className="badge">{problem.difficulty}</span>
              {active.archive && (
                <span className="badge">{active.archive.language}</span>
              )}
              <span className="muted">{problem.topicTags.join(" · ")}</span>
            </div>
            <div className="history-stats">
              <HistoryStat
                label="Latest acceptance"
                value={formatLongDate(problem.lastSolvedAt)}
              />
              <HistoryStat
                label="Code timeline"
                value={
                  archiveLoading
                    ? "Loading…"
                    : events.length
                      ? `${events.length} events`
                      : "Unavailable"
                }
              />
              <HistoryStat label="Mastery" value={`${problem.mastery} / 10`} />
              <HistoryStat
                label="Assistance"
                value={ASSISTANCE_LABEL[problem.assistance]}
              />
            </div>
          </section>

          <section className="panel code-panel">
            <header className="panel-heading">
              <div>
                <h2>Code evolution</h2>
                <p>Explore checkpoints, edits, runs, and the accepted submission</p>
              </div>
              <span className="badge">
                {events.length ? `${events.length} events` : "No evolution"}
              </span>
            </header>
            {archiveLoading ? (
              <div className="evolution unavailable" role="status">
                Downloading and reconstructing the code timeline…
              </div>
            ) : archiveError ? (
              <div className="evolution unavailable" role="alert">
                {archiveError}
              </div>
            ) : events.length ? (
              <div className="evolution">
                <div className="timeline-heading">
                  <strong>{eventName(selectedEvent)}</strong>
                  <span>{selectedEvent?.timestamp}</span>
                </div>
                <div className="timeline-track">
                  <span
                    className="timeline-fill"
                    style={{
                      width: `${events.length === 1 ? 100 : (eventIndex / (events.length - 1)) * 100}%`,
                    }}
                  />
                  {events.map((event, index) => (
                    <button
                      type="button"
                      key={`${event.timestamp}-${index}`}
                      className={`timeline-event ${event.kind}${eventIndex === index ? " selected" : ""}`}
                      style={{
                        left: `${events.length === 1 ? 50 : (index / (events.length - 1)) * 100}%`,
                      }}
                      onClick={() => move(index)}
                      aria-label={`View ${eventName(event)} at ${event.timestamp}`}
                      aria-pressed={eventIndex === index}
                    />
                  ))}
                </div>
                <div className="timeline-ends">
                  <span>{events[0].timestamp}</span>
                  <span>{events.at(-1)?.timestamp}</span>
                </div>
                <div className="play-controls">
                  <PlaybackButton
                    label="First event"
                    icon="first"
                    onClick={() => move(0)}
                  />
                  <PlaybackButton
                    label="Previous event"
                    icon="previous"
                    onClick={() => move(eventIndex - 1)}
                  />
                  <button
                    type="button"
                    className="button primary play-button"
                    onClick={() => {
                      if (eventIndex === events.length - 1) setEventIndex(0);
                      setPlaying((value) => !value);
                    }}
                  >
                    <Icon name={playing ? "pause" : "play"} size={15} />
                    {playing ? "Pause" : "Play"}
                  </button>
                  <PlaybackButton
                    label="Next event"
                    icon="next"
                    onClick={() => move(eventIndex + 1)}
                  />
                  <PlaybackButton
                    label="Final submission"
                    icon="last"
                    onClick={() => move(events.length - 1)}
                  />
                  <label>
                    <span className="sr-only">Playback speed</span>
                    <select
                      className="button"
                      value={speed}
                      onChange={(event) => setSpeed(Number(event.target.value))}
                    >
                      <option value={1500}>1× speed</option>
                      <option value={750}>2× speed</option>
                      <option value={375}>4× speed</option>
                    </select>
                  </label>
                  <span className="event-counter">
                    {eventIndex + 1} of {events.length}
                  </span>
                </div>
              </div>
            ) : (
              <div className="evolution unavailable">
                This accepted submission does not have a stored evolution archive.
              </div>
            )}
            <div className="code-heading">
              <div>
                <strong>Submission code</strong>
                {active.archive && (
                  <span className="badge">{active.archive.language}</span>
                )}
              </div>
              <div>
                <button
                  type="button"
                  className="button"
                  disabled={!selectedEvent}
                  onClick={copyCode}
                >
                  {copied ? "Copied!" : "Copy code"}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={!events.length}
                  onClick={() => move(events.length - 1)}
                >
                  Final code
                </button>
              </div>
            </div>
            <div className="code-viewport">
              {selectedEvent ? (
                <pre>
                  <code>
                    {selectedEvent.code.split("\n").map((line, index) => (
                      <span className="code-line" key={index}>
                        <span>{index + 1}</span>
                        {line || " "}
                      </span>
                    ))}
                  </code>
                </pre>
              ) : (
                <div className="code-placeholder">
                  Final code is not available without an evolution archive.
                </div>
              )}
            </div>
            <div className="code-footer">
              <span>
                {selectedEvent
                  ? `${lineCount} lines · ${selectedEvent.code.length} characters · ${eventName(selectedEvent).toLowerCase()} at ${selectedEvent.timestamp}`
                  : "No archived source"}
              </span>
              <span>Read-only preview</span>
            </div>
          </section>

          <div className="history-extra-grid">
            <section className="panel small-history-panel">
              <header className="panel-heading">
                <h2>Solve details</h2>
                <span className="badge">From review</span>
              </header>
              <div className="data-list">
                <DetailRow
                  label="Time complexity"
                  value={problem.timeComplexity}
                />
                <DetailRow
                  label="Space complexity"
                  value={problem.spaceComplexity}
                />
                <DetailRow
                  label="Review mastery"
                  value={`${problem.mastery}/10`}
                />
                <DetailRow
                  label="Assistance used"
                  value={ASSISTANCE_LABEL[problem.assistance]}
                />
              </div>
            </section>
            <section className="panel small-history-panel">
              <header className="panel-heading">
                <h2>Learning notes</h2>
                <span className="badge">Review context</span>
              </header>
              <div className="learning-notes">
                <strong>What to remember</strong>
                <p>{problem.notes}</p>
              </div>
            </section>
          </div>
          <div className="notice">
            <strong>Archive integrity:</strong> this view downloads the newest
            authenticated <code>code-timelines</code> object on demand, gunzips
            it, validates its account and metadata, replays verified patches, and
            checks the final checksum before showing source.
          </div>
        </div>
      </div>
    </div>
  );
}

function eventName(event: EvolutionEvent | null) {
  if (!event) return "Code unavailable";
  if (event.kind === "submit") return "Final accepted submission";
  if (event.kind === "run") return "Code run";
  if (event.kind === "autosave") return "Autosave snapshot";
  return "Checkpoint";
}

function HistoryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PlaybackButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: "first" | "previous" | "next" | "last";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="button square"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
