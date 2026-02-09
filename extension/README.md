# LeetLedger — Chrome Extension

A WXT/React Chrome extension that detects accepted LeetCode submissions, prompts you with a review form, and tracks your progress + revisit schedule.

---

## TODO

### Phase 1: Core Detection & Data Acquisition

#### 1. `wxt.config.ts` & Environment Setup

- [ ] **Permissions** — Define `storage` (local caching) and `webNavigation` (to detect when the user moves between problems without a page reload)
- [ ] **Host Permissions** — Grant access to `https://leetcode.com/*` so the Background Script can bypass CORS when hitting the GraphQL endpoint
- [ ] **Tailwind Integration** — Configure the WXT build to output a raw CSS string that we can inject into the Shadow DOM
- [ ] **Supabase Env** — Wire up `SUPABASE_URL` and `SUPABASE_ANON_KEY` via env vars / config

---

#### 2. The DOM Observer — `leetcode.content.ts`

- [ ] **SPA Navigation Logic** — LeetCode uses Next.js so the page doesn't refresh. Use `browser.webNavigation.onHistoryStateUpdated` or watch `window.location.href` to re-initialize the observer when the URL changes
- [ ] **The Success Sniffer:**
  - [ ] Implement a `MutationObserver` targeting the specific parent container where submission results appear (usually a `div` with a class starting with `result-container`)
  - [ ] **Filter logic:** Check `addedNodes` — if a node contains the string `"Accepted"` and has the specific green color class, fire the "Solve Detected" event
- [ ] **Debouncing** — Prevent duplicate triggers by storing the current `submissionId` or a timestamp and ignoring repeats within a 5-second window

---

#### 3. The Data Bridge — `background.ts`

- [ ] **Message Listener** — Set up `browser.runtime.onMessage.addListener` to wait for the "Solve Detected" signal from the content script
- [ ] **The GraphQL Pipeline:**
  - [ ] **Step A:** Fetch the "Recent Submissions" list for the specific problem slug to find the most recent ID where `statusDisplay === "Accepted"`
  - [ ] **Step B:** Use that ID to execute a detailed `submissionDetails` query:
    ```graphql
    query getSubmissionDetails($sid: Int!) {
      submissionDetail(id: $sid) {
        code
        lang
        runtimeDisplay
        runtimePercentile
        memoryDisplay
        memoryPercentile
        timestamp
        question {
          title
          difficulty
          topicTags {
            name
          }
        }
      }
    }
    ```
- [ ] **Header Management** — Ensure the fetch call includes `Referer: https://leetcode.com` and `Content-Type: application/json`. The browser will handle cookies (authentication) automatically

---

### Phase 2: The User Interface (Shadow DOM)

#### 4. Shadow DOM Injection Logic

- [ ] **Host Element** — Create a `<div>` with a random ID (to avoid detection by ad-blockers) and append it to `document.body`
- [ ] **Encapsulation** — Use `element.attachShadow({ mode: 'closed' })`. This prevents LeetCode's styles from leaking in **and** prevents LeetCode's scripts from messing with your React state
- [ ] **Style Injection** — Take the compiled Tailwind CSS string and inject it into a `<style>` tag inside the Shadow Root

---

#### 5. The React Review Form — `ReviewForm.tsx`

- [ ] **State Initialization** — Use `useEffect` to populate the form with the "Beats X%" data received from the background script
- [ ] **Component Logic:**
  - [ ] **Difficulty Slider** — A 1–5 scale (1: Easy/Intuitive → 5: Total struggle)
  - [ ] **Tag Suggestion** — Auto-populate tags based on the GraphQL data (e.g. if the API returns "Binary Search", highlight that tag)
  - [ ] **Spaced Repetition Calculator** — A function that takes the current date and the user's difficulty rating to suggest a `nextReviewDate` (e.g. $\text{Difficulty} = 5 \Rightarrow \text{Today} + 1\text{ day}$, $\text{Difficulty} = 1 \Rightarrow \text{Today} + 14\text{ days}$)
  - [ ] Textarea for approach notes
  - [ ] Submit & Skip buttons
- [ ] **Cleanup** — On submit/skip, unmount the React root and remove the host `<div>` from the DOM

---

### Phase 3: Data Persistence & Hand-off

#### 6. Local Storage & Sync

- [ ] **Schema Versioning** — Store data in `chrome.storage.local` using a versioned key (e.g. `v1_submissions`). This allows you to update your data format later without breaking user data
- [ ] **The "Sync" Trigger** — Create a logic gate: if the user is logged into Supabase, push local data to the cloud. If not, keep it local
- [ ] **Conflict Resolution** — If a user solves the same problem twice, create a new `attempt_id` linked to the same `problem_id` (for the history view)

---

#### 7. The Popup Dashboard — `popup/App.tsx`

- [ ] **Data Retrieval** — On mount, pull the last 10 entries from `chrome.storage.local`
- [ ] **Review Alert** — Check if any `nextReviewDate` $\le$ `Date.now()`. If so, add a "Due for Review" badge to that item
- [ ] **Item Display** — Problem title (linked to LeetCode), perceived difficulty, approach tags as pills, days until revisit
- [ ] **Actions** — "Mark as Reviewed" (recalculates next date) and "Delete" buttons

---

### Phase 4: The Web Dashboard (Next.js — future)

#### 8. The "Proof of Work" Dashboard

- [ ] **Heatmap** — Contribution graph (like GitHub) pulling from the Supabase `attempts` table
- [ ] **Spaced Repetition View** — Filter problems where `next_review_date <= today`
- [ ] **Code Playback** — Clean code-block viewer (Prism.js or similar) to review past solutions without opening LeetCode
