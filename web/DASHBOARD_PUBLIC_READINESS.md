# LeetLedger Dashboard — Public Soft-Launch Gates

Scope: the five useful dashboard sections—Overview, Problems, Reviews,
History, and Insights. Unified extension/website sessions, extension detection,
custom profiles, recommendations, and authentication redesign are deferred.

The dashboard is ready for a limited public soft launch only after all three
gates below pass.

## Release-candidate preparation

- [x] Extension version set to `0.1.0-beta.1`.
- [x] Root CI validates the extension and web projects.
- [x] Tag-driven Chrome prerelease workflow is ready.
- [x] Safe extension and web environment examples are tracked.
- [x] Extension compile, lint, tests, and production build pass locally.
- [x] Web compile, lint, six tests, and production build pass locally.
- [ ] Push the prepared release commit and configure GitHub workflow variables.

## Gate 1 — Account and data isolation

- [x] Reviews RLS is enabled and its ownership condition was inspected:
  `(SELECT auth.uid()) = user_id`.
- [x] Timeline Storage ownership policies were inspected and require the first
  object-path folder to match `auth.uid()`.
- [x] Confirm the `code-timelines` bucket is private in the deployed project.
- [x] Verify an anonymous client cannot select reviews or list timeline
  objects.
- [ ] Verify an anonymous client cannot download a known timeline object path.
- [ ] Verify account A cannot select account B reviews.
- [ ] Verify account A cannot list or download account B timeline objects,
  including requests made directly through the Supabase client.
- [x] Provider integration tests resolve stale review and archive requests after
  an A→B account switch and confirm account A does not return to state.
- [ ] Repeat the A→B account-switch check in the deployed UI.
- [x] Remove the unused Supabase secret key from extension configuration.
- [ ] Rotate that secret key in Supabase before inviting users.
- [x] Version the function-hardening SQL migration.
- [ ] Apply the migration and clear the two database advisor warnings.

The inspected policies do not need redesign unless a runtime check fails.
Runtime isolation failures block release.

Run the direct runtime checks with two disposable password-based users:

```bash
SUPABASE_URL=... \
SUPABASE_PUBLISHABLE_KEY=... \
TEST_USER_A_EMAIL=... TEST_USER_A_PASSWORD=... \
TEST_USER_B_EMAIL=... TEST_USER_B_PASSWORD=... \
npm run test:isolation
```

The migration is
`supabase/migrations/202611070001_harden_advised_functions.sql`.

## Gate 2 — First-user experience

- [ ] Publish and install a verified extension package from GitHub Releases.
- [x] A signed-in user with a successful empty review response sees the
  three-step setup guide.
- [x] The guide disappears when reviews exist, can be dismissed, and can be
  reopened from **Setup help**.
- [x] A failed fetch shows an error and retry action—not zero totals or
  first-time installation guidance.
- [x] Profiles, profile selectors, and recommendation placeholders are absent
  from public launch navigation and workspaces.
- [x] History says it contains reviewed/tracked problems and available code
  timelines, not every LeetCode submission.
- [x] History distinguishes no recorded archive, a missing archive, and an
  archive download failure.

## Gate 3 — Production journey

Automated checks:

```bash
cd web
make compile
make validate
make build
```

- [x] TypeScript, lint, six unit/integration tests, and the production build
  pass locally.
- [ ] Root GitHub CI passes on the published release commit.
- [ ] Production has the correct Supabase URL and publishable key.
- [ ] The production dashboard URL is allowed by Supabase Auth.
- [ ] Expired sessions return to sign-in without briefly showing dashboard
  data.
- [x] Offline/cached data is identified as cached and a failed refresh can be
  retried.

Fresh-account acceptance test:

1. Create a new account and sign into the dashboard.
2. Install the released extension and sign in with the same email.
3. Solve one LeetCode problem and save its review.
4. Confirm the review appears in Overview, Problems, and Reviews.
5. Confirm History either reconstructs the code timeline or gives the correct
   explicit archive state.
6. Sign out, switch to another account, and confirm no prior account data
   appears.

## Release decision

All three gates must pass. Automated checks alone are insufficient: deployed
Supabase isolation and the real extension-to-dashboard journey are release
blockers.
