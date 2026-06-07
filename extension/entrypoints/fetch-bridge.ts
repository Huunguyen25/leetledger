/**
 * Injected into the LeetCode page to intercept the submission check request.
 *
 * Configuration is passed via the <script> tag's data attributes:
 * - data-token: random token to correlate with the content script
 * - data-client-id: ID for this content script instance
 *
 * The script:
 * - Wraps window.fetch
 * - Intercepts POST /submit/ requests to capture typed_code, lang, and titleSlug
 * - Issues a narrow GraphQL request for problem metadata (topicTags + difficulty)
 *   in parallel with LeetCode's own polling, so they're ready when SUCCESS hits.
 *   CSRF-protected via the csrftoken cookie echoed as x-csrftoken; per-slug
 *   promise cache dedupes concurrent and repeat calls.
 * - Detects /submissions/detail/{id}/check/ responses
 * - Correlates the three via a Map keyed on submission_id
 * - Posts a structured message back to the page (and then to the content script)
 */

import constants from "@/constants";
import { parseProblemSlugFromPathname } from "@/lib/problem-slug";
import type { TopicTag } from "@/types/submission";

interface PendingCodeInfo {
  typedCode: string;
  lang: string;
  titleSlug: string | null;
}

interface ProblemMetadata {
  topicTags: TopicTag[] | null;
  difficulty: string | null;
}

const PROBLEM_METADATA_QUERY = `query leetledgerProblemMetadata($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    difficulty
    topicTags { name slug }
  }
}`;

const METADATA_FETCH_TIMEOUT_MS = 3000;

const EMPTY_METADATA: ProblemMetadata = { topicTags: null, difficulty: null };

// Django sets csrftoken on the auth domain. We need to echo it in
// X-CSRFToken on POSTs so the GraphQL endpoint accepts our request.
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default defineUnlistedScript(() => {
  const originalFetch = window.fetch;

  // Retrieve tokens passed from the content script via the script tag's dataset
  const scriptTag = document.currentScript as HTMLScriptElement;
  const { token, clientId } = scriptTag.dataset;

  // submission_id -> { typedCode, lang, titleSlug } captured from the submit POST
  const pendingSubmissions = new Map<string, PendingCodeInfo>();

  // Promise cache keyed by titleSlug. Problem metadata is immutable per problem,
  // so one resolved promise is reused for every subsequent submission of the
  // same problem in this page session. Promises (not values) are cached so
  // concurrent callers dedupe to a single network request.
  const metadataCache = new Map<string, Promise<ProblemMetadata>>();

  function fetchProblemMetadata(titleSlug: string): Promise<ProblemMetadata> {
    const cached = metadataCache.get(titleSlug);
    if (cached) return cached;

    const promise = (async (): Promise<ProblemMetadata> => {
      try {
        const csrfToken = getCsrfToken();
        const headers: Record<string, string> = {
          "content-type": "application/json",
        };
        if (csrfToken) headers["x-csrftoken"] = csrfToken;

        const res = await originalFetch("/graphql/", {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            operationName: "leetledgerProblemMetadata",
            variables: { titleSlug },
            query: PROBLEM_METADATA_QUERY,
          }),
        });
        if (!res.ok) return EMPTY_METADATA;

        const json = (await res.json()) as {
          data?: {
            question?: {
              difficulty?: unknown;
              topicTags?: Array<{ name?: unknown; slug?: unknown }>;
            };
          };
        };
        const question = json?.data?.question;
        if (!question) return EMPTY_METADATA;

        const rawTags = question.topicTags;
        const topicTags = Array.isArray(rawTags)
          ? rawTags
              .filter((t) => typeof t?.name === "string" && typeof t?.slug === "string")
              .map((t) => ({ name: t.name as string, slug: t.slug as string }))
          : null;

        const difficulty =
          typeof question.difficulty === "string" ? question.difficulty : null;

        return { topicTags, difficulty };
      } catch {
        return EMPTY_METADATA;
      }
    })();

    metadataCache.set(titleSlug, promise);
    return promise;
  }

  function fetchProblemMetadataWithTimeout(
    titleSlug: string | null,
  ): Promise<ProblemMetadata> {
    if (!titleSlug) return Promise.resolve(EMPTY_METADATA);
    const metadata = fetchProblemMetadata(titleSlug);
    const timeout = new Promise<ProblemMetadata>((resolve) =>
      setTimeout(() => resolve(EMPTY_METADATA), METADATA_FETCH_TIMEOUT_MS),
    );
    return Promise.race([metadata, timeout]);
  }

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";

    // Intercept the submit POST to capture typed code before the check fires
    if (url.includes("/submit/")) {
      try {
        const init = args[1] as RequestInit | undefined;
        if (init?.body) {
          const body = JSON.parse(init.body as string) as {
            typed_code?: string;
            lang?: string;
          };
          const { typed_code: typedCode, lang } = body;
          if (typedCode) {
            const titleSlug = parseProblemSlugFromPathname(
              window.location.pathname,
            );

            // Warm the metadata cache in parallel with LeetCode's check polling.
            // Fire-and-forget: any rejection is swallowed inside fetchProblemMetadata.
            if (titleSlug) void fetchProblemMetadata(titleSlug);

            const clone = response.clone();
            clone.json().then((data: { submission_id?: number | string }) => {
              const submissionId = data.submission_id
                ? String(data.submission_id)
                : null;
              if (submissionId) {
                pendingSubmissions.set(submissionId, {
                  typedCode,
                  lang: lang ?? "",
                  titleSlug,
                });
              }
            });
          }
        }
      } catch (_err) {
      }
    }

    // Target the specific submission check URL in check/ network
    if (url.includes("/submissions/detail/") && url.includes("/check/")) {
      try {
        const clone = response.clone();
        clone.json().then(async (data) => {
          if (data.state !== "SUCCESS") return;

          const requestURLsubmissionID = url.match(constants.SUBMISSION_ID_EXTRACT_REGEX);
          const submissionId = requestURLsubmissionID ? requestURLsubmissionID[1] : null;
          // skip test runs and run code or invalid submission ids
          if (!submissionId || !constants.VALID_SUBMISSION_ID_REGEX.test(submissionId)) return;

          const codeInfo = pendingSubmissions.get(submissionId);
          pendingSubmissions.delete(submissionId);

          // Prefer the slug captured at /submit/ time over the live URL,
          // in case the user navigated mid-poll.
          const titleSlug =
            codeInfo?.titleSlug ??
            parseProblemSlugFromPathname(window.location.pathname);
          const { topicTags, difficulty } =
            await fetchProblemMetadataWithTimeout(titleSlug);

          window.postMessage(
            {
              type: constants.MESSAGE_TYPES.SUBMISSION_INTERCEPTED,
              token,
              clientId,
              attemptId: submissionId,
              submissionData: data,
              typedCode: codeInfo?.typedCode ?? null,
              lang: codeInfo?.lang ?? data.lang ?? null,
              topicTags,
              difficulty,
            },
            window.location.origin,
          );
        });
      } catch (_err) {
      }
    }
    return response;
  };
});
