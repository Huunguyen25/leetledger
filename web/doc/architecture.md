# Dashboard architecture

## Purpose

The dashboard reads reviews and code timelines created by the LeetLedger
extension. Both clients use the same Supabase account but keep separate sessions.

## Structure

- `app/` — Next.js routes and root layout.
- `components/dashboard/` — shell, session state, shared UI, and workspaces.
- `components/history/` — code-timeline archive playback.
- `lib/dashboard/repository.ts` — Supabase auth, review queries, Storage access,
  and browser caches.
- `lib/dashboard/timeline.ts` — archive validation and reconstruction.
- `lib/dashboard/types.ts` — dashboard data contracts.
- `scripts/verify-supabase-isolation.mjs` — operator-run anonymous and
  cross-account checks.
- `../../supabase/migrations/` — versioned database hardening.

## Data flow

1. `DashboardProvider` resolves the Supabase session.
2. A user-keyed local cache may render while live reviews load.
3. Live review data replaces cached data.
4. History lists private timeline objects and downloads the newest archive on
   demand.
5. Workspaces derive schedules, mastery, and topic summaries from reviews.

## Safety rules

- Supabase RLS and private Storage policies enforce ownership.
- Auth changes invalidate outstanding request generations.
- Async review and archive responses update state only for the active user.
- Persistent review caches remain user-keyed.
- Account-scoped in-memory archive state is cleared during account changes.
- Provider integration tests cover stale review and archive responses.
- Extension builds receive only the Supabase URL, publishable key, and
  dashboard URL—never a secret key.

## Release path

1. Root CI validates extension and web builds.
2. Vercel hosts `web/` with public Supabase configuration.
3. A `v*` Git tag builds the Chrome zip and creates a GitHub prerelease.
4. Runtime isolation and fresh-account checks decide launch readiness.

## Current scope

Launch UI includes Overview, Problems, Reviews, History, and Insights.
Profiles, recommendations, extension detection, and shared extension/web
sessions are deferred.
