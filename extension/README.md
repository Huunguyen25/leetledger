# LeetLedger extension

Browser extension (WXT + React) for **leetcode.com**. When you get an **Accepted** submission, it can capture context, open a quick **review** UI on the page, and **track** problems and revisit timing. Optional **Supabase** sync backs up cloud-side data.

## Pieces

- **Page bridge** — Runs in LeetCode's page world, intercepts submissions, and reads problem metadata.
- **Content script** — Resolves identity, tracks assistance, and mounts the on-page review UI.
- **Background** — Validates and deduplicates submissions, then coordinates extension storage.
- **Popup** — Small dashboard for recent activity and review reminders.

## Code organization

- `entrypoints/` contains thin WXT bootstraps for each extension runtime.
- `content/` contains content-script controllers for identity and submission tracking.
- `background/` contains service-worker identity and submission handlers.
- `components/page/` contains React UI injected into LeetCode pages.
- `components/popup/` contains popup-only React UI.
- `lib/assistance/` owns assistance detection and attempt lifecycle rules.
- `lib/leetcode/` owns route parsing and the page-world fetch bridge.
- `lib/review/` owns review persistence, caching, and mute state.
- `lib/identity/` owns identity resolution and user-facing auth state.
- `lib/supabase/` contains the shared client, auth API, and browser storage adapter.
- `types/` contains serialized message and storage contracts shared by runtimes.

Runtime flow:

```text
fetch bridge → content controller → background worker → storage
                    ↓                              ↓
             assistance session             review drawer
```

## Todo

**Review form — capture / show:**

- [x] Problem number
- [x] Topics
- [x] Replace raw “difficulty” with a **mastery** level (user-rated scale)
- [x] Time & space complexity
- [x] Solved date
- [x] Lift fetch interception and problem metadata loading into `lib/leetcode/bridge.ts`.
- [ ] fancy form up
- [ ] additional topic tags
- [ ] add star feature to a favorite a problem.

**Database — wire up / create:**

- [ ] make database schema
- [x] wire review form to database and create data

**Popup**

- [x] mute review form w/ duration
- [x] open dashboard button
- [ ] pass the current session to the dashboard
- [x] solved history

**New features**

- [ ] popup will have a button to manually add the review
- [ ] manually add button will retrieve leet problem as well.

**Logic flow from submissions to the review form**

Use [Sequence Diagram viewer](https://sequencediagram.org/)

```
sequenceDiagram
  participant FB as fetch-bridge (page)
  participant CS as content script
  participant BG as background SW
  participant ST as storage.local

  FB->>FB: intercept /submit/ + /check/
  FB->>CS: postMessage (SUCCESS)
  CS->>BG: SUBMISSION_RESULT
  BG->>ST: set ll_result:{clientId}:{attemptId}
  ST->>CS: onChanged
  CS->>ST: remove(key)
  CS->>CS: show ReviewForm (maybe)
```

From this directory:

```bash
npm install
npm run dev
```

Load the unpacked build Chrome reports (usually under `.output/` after `wxt dev` starts; pick the dev folder the CLI prints).

Other scripts: `npm run build`, `npm run compile`, `npm test`. Firefox: `npm run dev:firefox` / `npm run build:firefox`.
