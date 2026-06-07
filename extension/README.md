# LeetLedger extension

Browser extension (WXT + React) for **leetcode.com**. When you get an **Accepted** submission, it can capture context, open a quick **review** UI on the page, and **track** problems and revisit timing. Optional **Supabase** sync backs up cloud-side data.

## Pieces

- **Content script** — Runs on LeetCode; observes the page and talks to the background worker.
- **Background** — Handles messaging, LeetCode fetches (GraphQL, etc.), and coordination with storage.
- **Popup** — Small dashboard for recent activity and review reminders.

## Todo

**Review form — capture / show:**

- [x] Problem number
- [x] Topics
- [x] Replace raw “difficulty” with a **mastery** level (user-rated scale)
- [x] Time & space complexity
- [x] Solved date
- [ ] **[*future fix if needed*]** lift fetchProblemMetadata to a standalone module to fetch topics and difficulties before submission.
- [ ] fancy form up

**Database - wire up / create:**
- [ ] make database schema
- [ ] wire review form to database and create data

**Popup**
- [x] mute review form w/ duration
- [x] open dashboard
- [x] solved history

make sure extension does not leak storage

From this directory:

```bash
npm install
npm run dev
```

Load the unpacked build Chrome reports (usually under `.output/` after `wxt dev` starts; pick the dev folder the CLI prints).

Other scripts: `npm run build`, `npm run compile`, `npm test`. Firefox: `npm run dev:firefox` / `npm run build:firefox`.
