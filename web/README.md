# LeetLedger dashboard

The LeetLedger dashboard displays reviews and code timelines created by the
LeetLedger browser extension. The extension and dashboard use separate browser
sessions, but users must sign into both with the same Supabase email account.

## Local setup

Requirements: Node.js 20+, npm, and a Supabase project containing the
LeetLedger `reviews` table and private `code-timelines` Storage bucket.

```bash
cp .env.example .env.local
npm install
make dev
```

Set these public client values in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Open [http://localhost:3000](http://localhost:3000). Useful checks:

```bash
make compile
make validate
make build
```

## First-user flow

1. Download the extension from
   [GitHub Releases](https://github.com/Huunguyen25/leetledger/releases).
2. In Chrome, open `chrome://extensions`, enable Developer mode, choose
   **Load unpacked**, and select the extracted extension directory.
3. Sign into the extension and dashboard with the same email.
4. Solve a LeetCode problem and save its review.
5. Return to the dashboard and choose **Check for reviews**.

The History page lists reviewed problems and their newest available code
timeline. It is not a complete submission-by-submission LeetCode history.

## Deployment

Configure the two public Supabase variables on the hosting platform, then run
`npm run build` and `npm run start`. Add the production dashboard URL to the
allowed redirect URLs in Supabase Auth.

Before release, complete the checks in
[`DASHBOARD_PUBLIC_READINESS.md`](DASHBOARD_PUBLIC_READINESS.md).

## Data and privacy boundary

- The browser uses the public Supabase key; row and object isolation therefore
  depends on RLS and private Storage policies.
- Review reads are scoped to the authenticated user ID.
- Timeline objects are expected under an authenticated user-owned path in the
  private `code-timelines` bucket.
- Review caches remain in that browser under user-specific local-storage keys.
- Signing out clears displayed in-memory data. It does not erase that
  user-keyed local cache.

## Troubleshooting

- **No reviews:** confirm both apps use the same email and that a review was
  saved after an accepted solve.
- **Could not load reviews:** retry from the dashboard and inspect Supabase RLS,
  environment variables, and browser network errors.
- **Missing timeline:** a review may exist without a recorded archive.
- **Timeline download failed:** confirm the bucket is private and its ownership
  policy permits the signed-in user's path.
