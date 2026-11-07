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

## Current scope

Launch UI includes Overview, Problems, Reviews, History, and Insights.
Profiles, recommendations, extension detection, and shared extension/web
sessions are deferred.
