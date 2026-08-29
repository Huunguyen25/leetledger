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
- `lib/evolution/` owns the code-evolution timeline: patches, IndexedDB, archives.
- `lib/leetcode/` owns route parsing, the page-world fetch bridge, and the
read-only reader for LeetCode's own editor database.
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



## CORE TODO

**Review form — capture / show:**

- [x] Problem number
- [x] Topics
- [x] Replace raw “difficulty” with a **mastery** level (user-rated scale)
- [x] Time & space complexity
- [x] Solved date
- [x] Lift fetch interception and problem metadata loading into `lib/leetcode/bridge.ts`.

**Database — wire up / create:**

- [x] Review table finished 
- [ ] refine srs function in supabase to pick assistance level from review form.
- [x] wire review form to database and create data 
- [x] Storage bucket for code evolution finished

**Popup**

- [x] mute review form w/ duration
- [x] open dashboard button
- [ ] pass the current session to the dashboard (so user do not have to signed in twice)
- [x] solved history

**Code evolution timeline** (see `.cursor/code-evolution-timeline-architecture.md`)

- [x] patch/checkpoint timeline logic with Google diff-match-patch
- [x] `LeetLedgerLocal` IndexedDB store for solving sessions
- [x] poll LeetCode's own editor database, plus exact Run/Submit code
- [x] gzip accepted sessions into a private Supabase bucket, restore on demand
- [x] create the `code-timelines` bucket and `auth.uid()` Storage policies
- [ ] dashboard query bridge and timeline slider UI
- [x] live QA of the editor record-key assumptions on [leetcode.com](http://leetcode.com) (QA passed)



## TODOs

- [ ] fancy review form up
- [ ] additional topic tags
- [ ] add star feature to a favorite a problem
- [x] Cap mastery slider based on automatic assistance detection 
- [ ] Popup resend OTP code (60 second cooldown)

- [ ] 1) **Manual add review** = popup button that opens a review **and** auto-fills the LeetCode problem (title, number, topics, etc.) so you’re not starting from a blank form.
- [ ] 2) notification for next solve date (add in backend?) 

- [x] fix form to not open/archive a new session when Submit/Accept matches the latest closed head for that scope. Thus subsequent submits with exact solution is excluded. 
- [ ] run a db clear logic to remove old timeline submission on browswer startup.
- [ ] lookup latest session, attach to reviews, upsert that reviews with the latest session
- [ ] Skipped reviews can be completed from the popup or history.



## **Logic flow from submissions to the review form**

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

## viewing indexedDB dumb for active elements

```js
const db = await new Promise((ok, no) => {
  const r = indexedDB.open("LeetLedgerLocal");
  r.onsuccess = () => ok(r.result);
  r.onerror = () => no(r.error);
});
const all = await new Promise((ok, no) => {
  const r = db.transaction("timelines").objectStore("timelines").getAll();
  r.onsuccess = () => ok(r.result);
  r.onerror = () => no(r.error);
});

console.table(all.map(t => ({
  problem: t.problemSlug,
  lang: t.language,
  status: t.status,
  session: t.sessionId?.slice(0, 8),
  submissionId: t.submissionId,
  started: new Date(t.startedAt).toISOString(),
  snapshots: t.snapshots.length,
  checkpoints: t.snapshots.filter(s => s.kind === "checkpoint").length,
  patches: t.snapshots.filter(s => s.kind === "patch").length,
  markers: t.snapshots.filter(s => s.kind === "marker").length,
  headChars: t.headCode.length,
})));
```

c