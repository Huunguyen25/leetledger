/**
 * LeetCode page-world fetch bridge.
 *
 * This module is bundled into the unlisted fetch-bridge script, so it must not
 * depend on extension APIs or other runtime-specific modules.
 */
import constants from "@/constants";
import {
  classifyAssistanceRequest,
  extractOperationName,
} from "@/lib/assistance/network";
import {
  extractSubmissionId,
  isValidSubmissionId,
  parseProblemSlugFromPathname,
} from "@/lib/leetcode/routes";
import type { AssistanceSignalMessage } from "@/types/assistance";
import type { CodeMilestoneMessage } from "@/types/evolution";
import type {
  SubmissionInterceptedMessage,
  TopicTag,
} from "@/types/submission";

interface PendingCodeInfo {
  typedCode: string;
  lang: string;
  titleSlug: string | null;
}

export interface ProblemMetadata {
  topicTags: TopicTag[] | null;
  difficulty: string | null;
}

export interface FetchBridgeConfig {
  token: string;
  clientId: string;
}

interface MetadataLoaderOptions {
  getCookie?: () => string;
  timeoutMs?: number;
}

const PROBLEM_METADATA_QUERY = `query leetledgerProblemMetadata($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    difficulty
    topicTags { name slug }
  }
}`;

const METADATA_FETCH_TIMEOUT_MS = 3000;
const EMPTY_METADATA: ProblemMetadata = {
  topicTags: null,
  difficulty: null,
};

function getCsrfToken(cookie: string): string | null {
  const match = cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Creates a per-page metadata cache around LeetCode's GraphQL endpoint. */
export function createProblemMetadataLoader(
  originalFetch: typeof window.fetch,
  {
    getCookie = () => document.cookie,
    timeoutMs = METADATA_FETCH_TIMEOUT_MS,
  }: MetadataLoaderOptions = {},
) {
  const metadataCache = new Map<string, Promise<ProblemMetadata>>();

  function fetchProblemMetadata(titleSlug: string): Promise<ProblemMetadata> {
    const cached = metadataCache.get(titleSlug);
    if (cached) return cached;

    const promise = (async (): Promise<ProblemMetadata> => {
      try {
        const csrfToken = getCsrfToken(getCookie());
        const headers: Record<string, string> = {
          "content-type": "application/json",
        };
        if (csrfToken) headers["x-csrftoken"] = csrfToken;

        const response = await originalFetch("/graphql/", {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            operationName: "leetledgerProblemMetadata",
            variables: { titleSlug },
            query: PROBLEM_METADATA_QUERY,
          }),
        });
        if (!response.ok) return EMPTY_METADATA;

        const json = (await response.json()) as {
          data?: {
            question?: {
              difficulty?: unknown;
              topicTags?: Array<{ name?: unknown; slug?: unknown }>;
            };
          };
        };
        const question = json.data?.question;
        if (!question) return EMPTY_METADATA;

        const rawTags = question.topicTags;
        const topicTags = Array.isArray(rawTags)
          ? rawTags
              .filter(
                (tag) =>
                  typeof tag?.name === "string" &&
                  typeof tag?.slug === "string",
              )
              .map((tag) => ({
                name: tag.name as string,
                slug: tag.slug as string,
              }))
          : null;
        const difficulty =
          typeof question.difficulty === "string"
            ? question.difficulty
            : null;

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
      setTimeout(() => resolve(EMPTY_METADATA), timeoutMs),
    );
    return Promise.race([metadata, timeout]);
  }

  return {
    fetch: fetchProblemMetadata,
    fetchWithTimeout: fetchProblemMetadataWithTimeout,
  };
}

/** Installs the page-world fetch interceptor and returns a safe teardown. */
export function installFetchBridge({
  token,
  clientId,
}: FetchBridgeConfig): () => void {
  const originalFetch = window.fetch;
  const pendingSubmissions = new Map<string, PendingCodeInfo>();
  const metadata = createProblemMetadataLoader(originalFetch);

  function reportAssistanceSignal(
    url: string,
    init: RequestInit | undefined,
  ) {
    try {
      const operationName = extractOperationName(init?.body);
      const level = classifyAssistanceRequest(url, operationName);
      if (!level) return;

      const message: AssistanceSignalMessage = {
        type: constants.MESSAGE_TYPES.ASSISTANCE_SIGNAL,
        token,
        clientId,
        level,
        problemSlug: parseProblemSlugFromPathname(window.location.pathname),
        timestamp: Date.now(),
      };
      window.postMessage(
        message,
        window.location.origin,
      );
    } catch {
      // Assistance classification is best-effort and must never block fetch.
    }
  }

  /**
   * Reports the exact code LeetCode was asked to execute. This is stronger
   * evidence than an autosaved draft, so the timeline records it even when the
   * autosave poll would have skipped the change.
   */
  function reportCodeMilestone(
    source: "run" | "submit",
    typedCode: string,
    lang: string | null,
    titleSlug: string | null,
  ) {
    const message: CodeMilestoneMessage = {
      type: constants.MESSAGE_TYPES.CODE_MILESTONE,
      token,
      clientId,
      source,
      code: typedCode,
      language: lang,
      problemSlug: titleSlug,
      timestamp: Date.now(),
    };
    window.postMessage(message, window.location.origin);
  }

  const bridgeFetch: typeof window.fetch = async function (...args) {
    const response = await originalFetch(...args);
    const url =
      typeof args[0] === "string"
        ? args[0]
        : (args[0] as Request)?.url || "";

    // Passively classify assistance-bearing requests. Deduplication happens in
    // the content script.
    reportAssistanceSignal(url, args[1] as RequestInit | undefined);

    if (url.includes("/interpret_solution/")) {
      try {
        const init = args[1] as RequestInit | undefined;
        const body = init?.body
          ? (JSON.parse(init.body as string) as {
              typed_code?: string;
              lang?: string;
            })
          : null;
        if (body?.typed_code) {
          reportCodeMilestone(
            "run",
            body.typed_code,
            body.lang ?? null,
            parseProblemSlugFromPathname(window.location.pathname),
          );
        }
      } catch {
        // Run capture is best-effort and must not alter LeetCode fetches.
      }
    }

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

            if (titleSlug) void metadata.fetch(titleSlug);
            reportCodeMilestone("submit", typedCode, lang ?? null, titleSlug);

            const clone = response.clone();
            void clone
              .json()
              .then((data: { submission_id?: number | string }) => {
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
      } catch {
        // Submission capture is best-effort and must not alter LeetCode fetches.
      }
    }

    if (
      url.includes("/submissions/detail/") &&
      url.includes("/check/")
    ) {
      try {
        const clone = response.clone();
        void clone.json().then(async (data) => {
          if (data.state !== "SUCCESS") return;

          const submissionId = extractSubmissionId(url);
          if (!submissionId || !isValidSubmissionId(submissionId)) return;

          const codeInfo = pendingSubmissions.get(submissionId);
          pendingSubmissions.delete(submissionId);

          const titleSlug =
            codeInfo?.titleSlug ??
            parseProblemSlugFromPathname(window.location.pathname);
          const { topicTags, difficulty } =
            await metadata.fetchWithTimeout(titleSlug);

          const message: SubmissionInterceptedMessage = {
            type: constants.MESSAGE_TYPES.SUBMISSION_INTERCEPTED,
            token,
            clientId,
            attemptId: submissionId,
            submissionData: data,
            typedCode: codeInfo?.typedCode ?? null,
            lang: codeInfo?.lang ?? data.lang ?? null,
            topicTags,
            difficulty,
          };
          window.postMessage(
            message,
            window.location.origin,
          );
        });
      } catch {
        // Submission capture is best-effort and must not alter LeetCode fetches.
      }
    }

    return response;
  };

  window.fetch = bridgeFetch;

  return () => {
    if (window.fetch === bridgeFetch) window.fetch = originalFetch;
  };
}
