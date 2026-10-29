"use client";

import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type {
  AssistanceLevel,
  Difficulty,
  ProblemReview,
  SubmissionArchive,
} from "./types";
import { decodeTimelineArchive } from "./timeline";

const CACHE_TTL = 10 * 60 * 1000;
const TIMELINE_BUCKET = "code-timelines";
const ASSISTANCE = new Set<AssistanceLevel>([
  "NONE",
  "HINT",
  "SOLUTION_PEEK",
  "SOLUTION_COPIED",
]);
const DIFFICULTIES = new Set<Difficulty>(["Easy", "Medium", "Hard"]);

let client: SupabaseClient | null | undefined;
const usernameFolderCache = new Map<string, Promise<string[]>>();
const timelineCache = new Map<string, Promise<SubmissionArchive | null>>();

interface ReviewRow {
  problem_slug: string;
  problem_title: string;
  leetcode_difficulty: string;
  mastery: number;
  assistance: string | null;
  time_complexity: string | null;
  space_complexity: string | null;
  topic_tags: string[] | null;
  question_id: number | null;
  notes: string | null;
  last_solved_at: string | null;
  next_review_date: string | null;
}

interface CachedReviews {
  userId: string;
  storedAt: number;
  reviews: ProblemReview[];
}

export function getDashboardClient() {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client =
    url && key
      ? createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        })
      : null;
  return client;
}

export function isDashboardConfigured() {
  return getDashboardClient() !== null;
}

export async function getDashboardSession(): Promise<Session | null> {
  const supabase = getDashboardClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function subscribeToDashboardAuth(
  callback: (session: Session | null) => void,
) {
  const supabase = getDashboardClient();
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    callback(session),
  );
  return () => data.subscription.unsubscribe();
}

export async function requestDashboardSignInOtp(
  email: string,
  password: string,
) {
  const supabase = getDashboardClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error: passwordError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (passwordError) throw passwordError;
  // Do not keep the intermediate password-only session.
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) throw signOutError;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function requestDashboardSignUpOtp(
  email: string,
  password: string,
) {
  const supabase = getDashboardClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function verifyDashboardOtp(
  email: string,
  token: string,
  type: "email" | "signup",
) {
  const supabase = getDashboardClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type,
  });
  if (error) throw error;
}

export async function signOutDashboard() {
  const supabase = getDashboardClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function readCachedReviews(userId: string) {
  try {
    const raw = window.localStorage.getItem(`leetledger-reviews:${userId}`);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedReviews;
    if (cached.userId !== userId || !Array.isArray(cached.reviews)) return null;
    return {
      reviews: cached.reviews,
      fresh: Date.now() - cached.storedAt < CACHE_TTL,
    };
  } catch {
    return null;
  }
}

export async function listDashboardReviews(userId: string) {
  const supabase = getDashboardClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("reviews")
    .select(
      "problem_slug, problem_title, leetcode_difficulty, mastery, assistance, time_complexity, space_complexity, topic_tags, question_id, notes, last_solved_at, next_review_date",
    )
    .eq("user_id", userId)
    .order("last_solved_at", { ascending: false, nullsFirst: false });

  if (error) throw error;
  const reviews = ((data ?? []) as ReviewRow[]).map(mapReview);
  const cache: CachedReviews = {
    userId,
    storedAt: Date.now(),
    reviews,
  };
  window.localStorage.setItem(
    `leetledger-reviews:${userId}`,
    JSON.stringify(cache),
  );
  return reviews;
}

/** Lists problem slugs with at least one private timeline object. */
export async function listTimelineProblemSlugs(userId: string) {
  const supabase = getDashboardClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const usernames = await listUsernameFolders(userId);
  const folders = await Promise.all(
    usernames.map(async (username) => {
      const prefix = `${userId}/${username}`;
      const { data, error } = await supabase.storage
        .from(TIMELINE_BUCKET)
        .list(prefix, { limit: 1000 });
      if (error) throw error;
      return (data ?? [])
        .filter((entry) => entry.id === null || entry.id === undefined)
        .map((entry) => decodePathSegment(entry.name));
    }),
  );
  return new Set(folders.flat());
}

/** Downloads and validates the newest archived solve for one problem. */
export function loadLatestTimelineArchive(userId: string, problemSlug: string) {
  const cacheKey = `${userId}:${problemSlug}`;
  const cached = timelineCache.get(cacheKey);
  if (cached) return cached;
  const request = downloadLatestTimelineArchive(userId, problemSlug);
  timelineCache.set(cacheKey, request);
  return request;
}

async function downloadLatestTimelineArchive(
  userId: string,
  problemSlug: string,
) {
  const supabase = getDashboardClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const usernames = await listUsernameFolders(userId);
  const encodedSlug = encodeURIComponent(problemSlug);
  const candidates = (
    await Promise.all(
      usernames.map(async (username) => {
        const prefix = `${userId}/${username}/${encodedSlug}`;
        const { data, error } = await supabase.storage
          .from(TIMELINE_BUCKET)
          .list(prefix, {
            limit: 100,
            sortBy: { column: "created_at", order: "desc" },
          });
        if (error) throw error;
        return (data ?? [])
          .filter((entry) => entry.name.endsWith(".json.gz"))
          .map((entry) => ({
            path: `${prefix}/${entry.name}`,
            createdAt: entry.created_at ?? entry.updated_at ?? "",
          }));
      }),
    )
  )
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const latest = candidates[0];
  if (!latest) return null;
  const { data, error } = await supabase.storage
    .from(TIMELINE_BUCKET)
    .download(latest.path);
  if (error || !data) {
    throw new Error(error?.message ?? "The code timeline could not be downloaded.");
  }
  return decodeTimelineArchive(data, userId, latest.path);
}

function listUsernameFolders(userId: string) {
  const cached = usernameFolderCache.get(userId);
  if (cached) return cached;
  const request = (async () => {
    const supabase = getDashboardClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.storage
      .from(TIMELINE_BUCKET)
      .list(userId, { limit: 100 });
    if (error) throw error;
    return (data ?? [])
      .filter((entry) => entry.id === null || entry.id === undefined)
      .map((entry) => entry.name);
  })();
  usernameFolderCache.set(userId, request);
  return request;
}

function mapReview(row: ReviewRow, index: number): ProblemReview {
  const difficulty = DIFFICULTIES.has(row.leetcode_difficulty as Difficulty)
    ? (row.leetcode_difficulty as Difficulty)
    : "Medium";
  const assistance = ASSISTANCE.has(row.assistance as AssistanceLevel)
    ? (row.assistance as AssistanceLevel)
    : "NONE";
  return {
    id: index + 1,
    questionId: row.question_id ?? 0,
    problemSlug: row.problem_slug,
    problemTitle: row.problem_title || titleCase(row.problem_slug),
    difficulty,
    mastery: Math.max(1, Math.min(10, Number(row.mastery) || 1)),
    assistance,
    topicTags: (row.topic_tags ?? []).map(titleCase),
    lastSolvedAt: row.last_solved_at ?? new Date(0).toISOString(),
    nextReviewDate: row.next_review_date,
    timeComplexity: row.time_complexity ?? "Not recorded",
    spaceComplexity: row.space_complexity ?? "Not recorded",
    notes: row.notes ?? "No review notes recorded.",
  };
}

function titleCase(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
