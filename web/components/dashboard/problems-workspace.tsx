"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  compareByReviewDate,
  reviewStatus,
} from "@/lib/dashboard/reviews";
import type { Difficulty, ReviewStatus } from "@/lib/dashboard/types";
import { useDashboard } from "./dashboard-provider";
import {
  DashboardDataNotice,
  PageHeading,
  Panel,
  ProblemCollection,
  ProfileSelector,
  StatusLegend,
  ViewToggle,
} from "./ui";

type Sort = "due" | "mastery-low" | "mastery-high" | "title";

export function ProblemsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { problems } = useDashboard();
  const query = searchParams.get("q") ?? "";
  const status = (searchParams.get("status") ?? "all") as ReviewStatus | "all";
  const difficulty = (searchParams.get("difficulty") ?? "all") as
    | Difficulty
    | "all";
  const topic = searchParams.get("topic") ?? "all";
  const mastery = searchParams.get("mastery") ?? "all";
  const sort = (searchParams.get("sort") ?? "due") as Sort;
  const view = searchParams.get("view") === "list" ? "list" : "grid";

  const topics = useMemo(
    () =>
      [...new Set(problems.flatMap((problem) => problem.topicTags))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [problems],
  );

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    const result = problems.filter((problem) => {
      const masteryMatches =
        mastery === "all" ||
        (mastery === "low" && problem.mastery <= 4) ||
        (mastery === "medium" &&
          problem.mastery >= 5 &&
          problem.mastery <= 7) ||
        (mastery === "high" && problem.mastery >= 8);
      return (
        (!normalized ||
          problem.problemTitle.toLowerCase().includes(normalized) ||
          String(problem.questionId).includes(normalized) ||
          problem.topicTags.some((tag) =>
            tag.toLowerCase().includes(normalized),
          )) &&
        (status === "all" ||
          reviewStatus(problem.nextReviewDate) === status) &&
        (difficulty === "all" || problem.difficulty === difficulty) &&
        (topic === "all" || problem.topicTags.includes(topic)) &&
        masteryMatches
      );
    });
    return result.sort((a, b) => {
      if (sort === "mastery-low") return a.mastery - b.mastery;
      if (sort === "mastery-high") return b.mastery - a.mastery;
      if (sort === "title")
        return a.problemTitle.localeCompare(b.problemTitle);
      return compareByReviewDate(a, b);
    });
  }, [difficulty, mastery, problems, query, sort, status, topic]);

  function setParam(name: string, value: string, defaultValue = "all") {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === defaultValue) next.delete(name);
    else next.set(name, value);
    router.replace(`/problems${next.size ? `?${next.toString()}` : ""}`, {
      scroll: false,
    });
  }

  return (
    <div className="content">
      <PageHeading
        title="Problems"
        description="Search and filter your complete tracked library. Open details in place without losing the current view."
        action={<ProfileSelector compact />}
      />
      <DashboardDataNotice />
      <Panel
        className="library-panel"
        title="Tracked problem library"
        subtitle={`${filtered.length} ${filtered.length === 1 ? "problem" : "problems"}`}
      >
        <div className="toolbar sticky-toolbar">
          <label className="grow-control">
            <span className="sr-only">Search tracked problems</span>
            <input
              type="search"
              placeholder="Search title, number, or topic"
              value={query}
              onChange={(event) => setParam("q", event.target.value, "")}
            />
          </label>
          <Filter
            label="Review status"
            value={status}
            onChange={(value) => setParam("status", value)}
            options={[
              ["all", "All statuses"],
              ["overdue", "Overdue"],
              ["today", "Due today"],
              ["soon", "Due soon"],
              ["scheduled", "Scheduled"],
              ["unscheduled", "Unscheduled"],
            ]}
          />
          <Filter
            label="Topic"
            value={topic}
            onChange={(value) => setParam("topic", value)}
            options={[
              ["all", "All topics"],
              ...topics.map((value) => [value, value] as [string, string]),
            ]}
          />
          <Filter
            label="Difficulty"
            value={difficulty}
            onChange={(value) => setParam("difficulty", value)}
            options={[
              ["all", "All difficulty"],
              ["Easy", "Easy"],
              ["Medium", "Medium"],
              ["Hard", "Hard"],
            ]}
          />
          <Filter
            label="Mastery"
            value={mastery}
            onChange={(value) => setParam("mastery", value)}
            options={[
              ["all", "All mastery"],
              ["low", "1–4 mastery"],
              ["medium", "5–7 mastery"],
              ["high", "8–10 mastery"],
            ]}
          />
          <Filter
            label="Sort problems"
            value={sort}
            onChange={(value) => setParam("sort", value, "due")}
            options={[
              ["due", "Review date"],
              ["mastery-low", "Mastery: low to high"],
              ["mastery-high", "Mastery: high to low"],
              ["title", "Title A–Z"],
            ]}
          />
          <ViewToggle
            value={view}
            onChange={(value) => setParam("view", value, "grid")}
          />
        </div>
        <StatusLegend />
        <ProblemCollection problems={filtered} view={view} />
      </Panel>
    </div>
  );
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
