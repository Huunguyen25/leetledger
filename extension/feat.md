# LeetLedger Extension — Session Summary

> Code-review handoff for work completed in this session. Use this to walk the diff and pick up where we left off.

---

## Overview

Two major feature areas shipped:

1. **Auth toast behavior** — deduped, non-spammy sign-in notifications aligned with leet-tracker patterns.
2. **Automated assistance tracking** — passive detection of hints / solution peek during a problem attempt, pre-filled into ReviewForm (editable, no lock), with a clean session model and simplified 4-level taxonomy tied to SRS caps.

---

## 1. Auth toast (`AuthToast` + identity gate)



### What we achieved

- **Visual polish** — white card, yellow accent bar, amber icon, bold heading, muted body, top-right close (see `components/AuthToast/style.css`).
- **Auto-dismiss** — 15s timer via `durationMs` prop on `AuthToast`.
- **No spam on navigation** — replaced boolean `toastDismissed` with keyed state machine:
  - `shownToastKey` / `dismissedToastKey` in `entrypoints/content.tsx`
  - `applyAuthState(key, message)` — same key = no re-mount; dismissed key = stay quiet until reason changes or user goes fully active again.
- **Multi-checker dedup** — `authToastKey(reasons)` in `lib/identity/auth-messages.ts` collapses LeetCode + extension failures into one stable key.
- **Transient suppression** — `fetchLeetCodeUsername()` in `lib/identity/leetcode-user.ts` uses bounded retry/backoff (3 attempts) before reporting `signed_out`.



### Key files


| File                                 | Role                                                      |
| ------------------------------------ | --------------------------------------------------------- |
| `components/AuthToast/AuthToast.tsx` | Toast UI + auto-dismiss                                   |
| `components/AuthToast/style.css`     | Visual design                                             |
| `lib/identity/auth-messages.ts`      | `authToastKey`, messages, `ACCOUNT_CHANGED_KEY`           |
| `lib/identity/leetcode-user.ts`      | Retry/backoff for LC sign-in check                        |
| `entrypoints/content.tsx`            | `applyAuthState`, identity gate, `runIdentityGate` on nav |




### Design decisions (locked in)

- Prefill-only toast UX; user dismisses or waits 15s.
- Re-show after dismiss only when failing reason set **changes** or user becomes active then signs out again.
- Network-only failures never toast (`shouldShowAuthToast` filters `network_error`).

---



## 2. Automated assistance tracking



### What we achieved

Replaced manual-only assistance dropdown with **auto-detect + prefill** (user can always override).

#### Taxonomy (final — 4 levels)


| DB value          | Label         | SRS cap | Auto-detect                                         |
| ----------------- | ------------- | ------- | --------------------------------------------------- |
| `NONE`            | None          | 10      | —                                                   |
| `HINT`            | Hint          | 7       | Hint section click                                  |
| `SOLUTION_PEEK`   | Solution Peek | 4       | Editorial / solutions / submissions tabs + Ask Leet |
| `SOLUTION_COPIED` | Solution Copy | 1       | Manual only                                         |


**Removed:** `LOGIC_PEEK`, `GPT_HELP`, `OUTSIDE_SOURCE` (GPT merged into peek; tab-away detection removed).

#### Detection sources


| Signal                   | Mechanism                                         | File                                                        |
| ------------------------ | ------------------------------------------------- | ----------------------------------------------------------- |
| Hint                     | Click on hint disclosure                          | `lib/assistance/detectors.ts`                               |
| Solution Peek (Ask Leet) | Click `[aria-label="Ask Leet"]`                   | `lib/assistance/detectors.ts`                               |
| Solution Peek (tabs)     | URL path on SPA nav: `/problems/{slug}/{editorial | solutions                                                   |
| Solution Peek (network)  | Optional GraphQL/fetch hook in page world         | `entrypoints/fetch-bridge.ts` + `lib/assistance/network.ts` |


**Important fix:** GraphQL `operationName` matching was **unreliable** for solution peek. Primary detection is now **URL-based** via `classifyAssistancePath()` on every `wxt:locationchange`.

#### Session model

- `createAssistanceSession()` in `lib/assistance/session.ts` — single active slug + `Set<AssistanceLevel>` (not a multi-slug Map).
- **Reset on nav:** leaving problem slug or `/problems/` clears signals; fresh attempt per visit.
- **Preserve on** `/submissions/detail/...` (same as review-drawer teardown rules).
- **Clear after submit:** `onSubmitted` → `clearAfterSubmit()`.
- **Stale protection:** `record()` ignores signals whose slug ≠ `activeSlug`.



#### ReviewForm wiring

- Prop `detectedAssistance` pre-selects dropdown (`useState(detectedAssistance ?? "NONE")`).
- `(auto-detected)` label when prefill ≠ `NONE`.
- **No lock** — dropdown always editable (explicit product decision).



#### Config hub (tweak here)

All knobs in `lib/assistance/config.ts`:

- `ASSISTANCE_SRS_WEIGHTS` — 10 / 7 / 4 / 1
- `cappedMasteryForSrs(slider, assistance)` — `Math.min(slider, cap)`; mirrors Supabase `LEAST`
- `ASSISTANCE_OPTIONS` — dropdown
- `AUTO_DETECT_PRECEDENCE` — `SOLUTION_PEEK` > `HINT`
- `SOLUTION_PEEK_PATH_TABS` — URL segments for peek



### Architecture

```
wxt:locationchange / bootstrap
        ↓
AssistanceSession.handleNavigation(pathname)
        ├─ bindProblem / reset
        └─ classifyAssistancePath → record SOLUTION_PEEK

fetch-bridge (page world) ──postMessage──► session.record()
detectors (click) ────────────────────────► session.record()

Accepted submit → ReviewForm(detectedAssistance = session.getPrimary())
```



### Key files


| File                                     | Role                                                   |
| ---------------------------------------- | ------------------------------------------------------ |
| `lib/assistance/config.ts`               | Single tweak point (weights, labels, tabs, precedence) |
| `lib/assistance/types.ts`                | `isAssistanceLevel`, `pickPrimaryAssistance`           |
| `lib/assistance/navigation.ts`           | `getProblemNavContext`, `classifyAssistancePath`       |
| `lib/assistance/session.ts`              | Session lifecycle + nav reset                          |
| `lib/assistance/detectors.ts`            | Click-based hint + Ask Leet                            |
| `lib/assistance/network.ts`              | Fetch classification (secondary)                       |
| `entrypoints/fetch-bridge.ts`            | Injects fetch hook, posts `ASSISTANCE_SIGNAL`          |
| `entrypoints/content.tsx`                | Wires session, detectors, ReviewForm                   |
| `components/ReviewDrawer/ReviewForm.tsx` | Prefill + editable select                              |
| `lib/supabase/reviews.ts`                | Re-exports `AssistanceLevel` from assistance module    |
| `constants.ts`                           | `MESSAGE_TYPES.ASSISTANCE_SIGNAL`                      |




### Tests (21 passing)

- `lib/assistance/navigation.test.ts` — path context + peek tabs
- `lib/assistance/session.test.ts` — nav reset matrix, stale slug, path peek
- `lib/assistance/types.test.ts` — precedence + SRS weights + `cappedMasteryForSrs`

Run: `npm test` / `npm run compile`

---



## 3. Supabase (not in repo — run manually)

Schema lives in Supabase project, not this repo. Apply migration in SQL editor:

1. Backfill: `LOGIC_PEEK` → `HINT`; `GPT_HELP` / `OUTSIDE_SOURCE` → `SOLUTION_PEEK`
2. CHECK constraint: `NONE | HINT | SOLUTION_PEEK | SOLUTION_COPIED`
3. Replace `calculate_srs_metrics()`:
  - `effective_mastery = LEAST(NEW.mastery, assistance_cap)` where caps are 10/7/4/1
  - Hard reset only when `NEW.mastery < 3` (not on `SOLUTION_COPIED` alone)

**Status:** SQL was provided in chat; confirm it has been applied to your Supabase project before shipping extension to users with new enum values.

---



## 4. Out of scope / deferred

- [ ] Web dashboard: render new assistance labels if it displays raw enum strings
- [ ] Style `(auto-detected)` badge — class exists, minimal CSS
- [ ] Remove dead GraphQL solution matchers in `network.ts` if URL detection is sufficient
- [ ] Memoize identity gate on nav (assistance session already dedupes; identity still re-fetches)
- [ ] E2E manual QA checklist on real LeetCode (see below)

---



## 5. Manual QA checklist (continue here)

Use this when picking up testing:

### Auth toast

- [ ] Signed out: toast shows once per distinct reason, not on every SPA nav
- [ ] Dismiss / 15s timeout: stays hidden until reason changes or full sign-in
- [ ] LC transient signed-out during boot: no flash toast (retry absorbs it)



### Assistance prefill

- [ ] Open **Hint** on a problem → submit Accepted → ReviewForm shows **Hint** (auto-detected)
- [ ] Open **Editorial** or **Solutions** or **Submissions** tab → submit → **Solution Peek**
- [ ] Click **Ask Leet** → submit → **Solution Peek**
- [ ] Nav A → peek on A → nav B → solve B → prefill uses B only (not A)
- [ ] Peek on A → nav to `/submissions/detail/...` → signals preserved for review
- [ ] Override dropdown manually → saves chosen value to Supabase
- [ ] After successful review submit → session cleared for that slug



### SRS (after Supabase migration)

- [ ] Insert review with mastery 9 + HINT → spacing uses effective 7
- [ ] mastery 9 + SOLUTION_COPIED → effective 1
- [ ] mastery 2 → 1-day reset regardless of assistance

---



## 6. Suggested code review focus

1. `session.handleNavigation` — reset semanticds vs review-drawer `shouldTeardownReviewForm` (intentionally aligned?)
2. `SOLUTION_PEEK_PATH_TABS` **includes** `submissions` — may over-detect if user opens submissions tab without copying (acceptable; user can override)
3. **Hint click heuristic** — `isHintToggle` text match; fragile if LC changes hint UI
4. **Auth** `applyAuthState` vs assistance session — two parallel nav handlers in `onNavigate`; clear separation but worth a read-through
5. **Supabase migration applied?** — extension will write new enum values; old CHECK constraint will reject inserts if not migrated

---



## 7. Quick commands

```bash
cd extension
npm run compile   # typecheck
npm test          # 21 tests
npm run dev       # load unpacked extension for manual QA
```

---



## 8. Related reference

- leet-tracker-extension inspiration: `src/injection/page_hint_tracker.js` (DOM-heavy hint/solution/GPT detection)
- Prior plan docs (Cursor): automated assistance tracking, assistance session refactor

