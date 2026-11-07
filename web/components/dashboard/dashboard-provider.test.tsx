// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import type {
  ProblemReview,
  SubmissionArchive,
} from "@/lib/dashboard/types";
import {
  DashboardProvider,
  useDashboard,
} from "./dashboard-provider";

const repository = vi.hoisted(() => ({
  authCallback: null as ((session: Session | null) => void) | null,
  clearDashboardMemoryCaches: vi.fn(),
  getDashboardSession: vi.fn(),
  isDashboardConfigured: vi.fn(() => true),
  listDashboardReviews: vi.fn(),
  loadLatestTimelineArchive: vi.fn(),
  readCachedReviews: vi.fn(() => null),
  sendDashboardOtp: vi.fn(),
  signOutDashboard: vi.fn(),
  verifyDashboardOtp: vi.fn(),
}));

vi.mock("@/lib/dashboard/repository", () => ({
  clearDashboardMemoryCaches: repository.clearDashboardMemoryCaches,
  getDashboardSession: repository.getDashboardSession,
  isDashboardConfigured: repository.isDashboardConfigured,
  listDashboardReviews: repository.listDashboardReviews,
  loadLatestTimelineArchive: repository.loadLatestTimelineArchive,
  readCachedReviews: repository.readCachedReviews,
  sendDashboardOtp: repository.sendDashboardOtp,
  signOutDashboard: repository.signOutDashboard,
  subscribeToDashboardAuth: vi.fn(
    (callback: (session: Session | null) => void) => {
      repository.authCallback = callback;
      return vi.fn();
    },
  ),
  verifyDashboardOtp: repository.verifyDashboardOtp,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function session(userId: string): Session {
  return {
    access_token: `${userId}-token`,
    refresh_token: `${userId}-refresh`,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date(0).toISOString(),
      email: `${userId}@example.com`,
    },
  };
}

function review(userId: string): ProblemReview {
  return {
    id: 1,
    questionId: 1,
    problemSlug: `${userId}-problem`,
    problemTitle: `${userId} problem`,
    difficulty: "Easy",
    mastery: 5,
    assistance: "NONE",
    topicTags: [],
    lastSolvedAt: new Date(0).toISOString(),
    nextReviewDate: null,
    timeComplexity: "O(1)",
    spaceComplexity: "O(1)",
    notes: "",
  };
}

function archive(userId: string): SubmissionArchive {
  return {
    problemSlug: `${userId}-problem`,
    sessionId: `${userId}-session`,
    language: "typescript",
    startedAt: 1,
    acceptedAt: 2,
    storagePath: `${userId}/archive.json.gz`,
    events: [],
  };
}

function Probe() {
  const {
    archives,
    loadArchive,
    problems,
    sessionUserId,
  } = useDashboard();
  return (
    <div>
      <span data-testid="user">{sessionUserId ?? "none"}</span>
      <span data-testid="problems">
        {problems.map((problem) => problem.problemTitle).join(",")}
      </span>
      <span data-testid="archives">
        {archives.map((item) => item.problemSlug).join(",")}
      </span>
      <button
        type="button"
        onClick={() => void loadArchive("account-a-problem")}
      >
        Load archive
      </button>
    </div>
  );
}

describe("DashboardProvider account isolation", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    repository.authCallback = null;
    const storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
  });

  it("ignores a stale review response after switching accounts", async () => {
    const accountA = deferred<ProblemReview[]>();
    const accountB = deferred<ProblemReview[]>();
    repository.getDashboardSession.mockResolvedValue(session("account-a"));
    repository.listDashboardReviews.mockImplementation((userId: string) =>
      userId === "account-a" ? accountA.promise : accountB.promise,
    );

    render(
      <DashboardProvider>
        <Probe />
      </DashboardProvider>,
    );

    await waitFor(() =>
      expect(repository.listDashboardReviews).toHaveBeenCalledWith("account-a"),
    );
    await act(async () => {
      repository.authCallback?.(session("account-b"));
    });
    accountB.resolve([review("account-b")]);
    await waitFor(() =>
      expect(screen.getByTestId("problems").textContent).toContain(
        "account-b problem",
      ),
    );

    accountA.resolve([review("account-a")]);
    await act(async () => {
      await accountA.promise;
    });

    expect(screen.getByTestId("user").textContent).toBe("account-b");
    expect(screen.getByTestId("problems").textContent).not.toContain(
      "account-a problem",
    );
  });

  it("ignores an archive downloaded for the previous account", async () => {
    const accountAArchive = deferred<SubmissionArchive | null>();
    repository.getDashboardSession.mockResolvedValue(session("account-a"));
    repository.listDashboardReviews.mockImplementation((userId: string) =>
      Promise.resolve([review(userId)]),
    );
    repository.loadLatestTimelineArchive.mockReturnValue(
      accountAArchive.promise,
    );

    render(
      <DashboardProvider>
        <Probe />
      </DashboardProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("problems").textContent).toContain(
        "account-a problem",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Load archive" }));
    await waitFor(() =>
      expect(repository.loadLatestTimelineArchive).toHaveBeenCalledWith(
        "account-a",
        "account-a-problem",
      ),
    );

    await act(async () => {
      repository.authCallback?.(session("account-b"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("account-b"),
    );

    accountAArchive.resolve(archive("account-a"));
    await act(async () => {
      await accountAArchive.promise;
    });

    expect(screen.getByTestId("archives").textContent).toBe("");
  });
});
