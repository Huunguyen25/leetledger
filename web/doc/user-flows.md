# Dashboard user flows

## New user

1. Sign into the dashboard with email OTP.
2. Follow the three-step setup guide.
3. Install the extension and use the same email.
4. Solve a LeetCode problem and save its review.
5. Return to the dashboard and check for reviews.

The guide appears only after a successful empty data response. It can be
dismissed and reopened from **Setup help**.

## Returning user

1. The dashboard checks the saved Supabase session.
2. User-keyed cached reviews may appear first.
3. Live reviews replace the cache after refresh.
4. Loading failures show cached-data or retry messaging.

## Review workflow

1. Overview summarizes due work and weak topics.
2. Problems searches and filters the tracked library.
3. Reviews groups problems by their next review date.
4. Insights summarizes mastery and assistance usage.

## History workflow

1. History starts from reviewed problems.
2. It checks which problems have private code archives.
3. Selecting a problem downloads its newest archive.
4. The archive is validated and reconstructed for playback.

History is not a complete LeetCode submission log. It distinguishes no recorded
archive, a missing archive, and a failed download.

## Account change

1. Session state changes.
2. Previous in-flight requests become stale.
3. Displayed reviews, drawers, and archive state are cleared.
4. Safe persistent caches remain separated by user ID.
5. The new account loads its own cache and live data.

## Release-critical checks

See [`../../DASHBOARD_PUBLIC_READINESS.md`](../../DASHBOARD_PUBLIC_READINESS.md)
for Supabase isolation and end-to-end acceptance tests.
