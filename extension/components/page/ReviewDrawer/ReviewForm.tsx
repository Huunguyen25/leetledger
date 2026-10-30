import { useState } from "react";
import { IoMdClose } from "react-icons/io";
import { browser } from "wxt/browser";
import Slider from "./Slider";
import type { SubmissionPayload, TopicTag } from "@/types/submission";
import { saveReview } from "@/lib/review/repository";
import type { ReviewInput } from "@/lib/review/types";
import {
  ASSISTANCE_OPTIONS,
  ASSISTANCE_SRS_WEIGHTS,
  isAssistanceLevel,
  type AssistanceLevel,
} from "@/lib/assistance/types";
import constants from "@/constants";
import "./ReviewDrawer.css";

export interface ReviewFormPrefill {
  mastery?: number;
  assistance?: AssistanceLevel;
  timeComplexity?: string;
  spaceComplexity?: string;
  notes?: string;
  problemTitle?: string;
}

interface ReviewFormProps {
  /** Submission payload (problem slug, difficulty badge, etc.). */
  submissionData: SubmissionPayload;
  onCancel: () => void;
  /** Auto-detected assistance, used to pre-select the dropdown (overridable). */
  detectedAssistance?: AssistanceLevel;
  /** Called once the review is successfully saved (used to reset detection). */
  onSubmitted?: () => void;
  /** Explicit skip / dismiss (persist incomplete + prompt gate). */
  onSkip?: () => void;
  /** Prefill when reopening an incomplete or cloud review. */
  prefill?: ReviewFormPrefill;
}

const COMPLEXITY_OPTIONS = [
  "O(1)",
  "O(log n)",
  "O(n)",
  "O(n log n)",
  "O(n^2)",
  "O(2^n)",
];

function titleFromSlug(slug: string | undefined): string {
  if (!slug) return "";
  return slug
    .split("-")
    .map((str) => str.charAt(0).toUpperCase() + str.slice(1))
    .join(" ");
}

function initialAssistance(
  prefill: ReviewFormPrefill | undefined,
  detected: AssistanceLevel | undefined,
): AssistanceLevel {
  if (prefill?.assistance && isAssistanceLevel(prefill.assistance)) {
    return prefill.assistance;
  }
  return detected ?? "NONE";
}

export default function ReviewForm({
  submissionData,
  onCancel,
  detectedAssistance,
  onSubmitted,
  onSkip,
  prefill,
}: ReviewFormProps) {
  const assistanceSeed = initialAssistance(prefill, detectedAssistance);
  const masteryCapSeed = ASSISTANCE_SRS_WEIGHTS[assistanceSeed];

  const [masteryLevel, setMasteryLevel] = useState(() => {
    const seed = prefill?.mastery ?? 1;
    return Math.min(Math.max(1, Math.round(seed)), masteryCapSeed);
  });
  const [assistanceLevel, setAssistanceLevel] =
    useState<AssistanceLevel>(assistanceSeed);

  const [timeComplexity, setTimeComplexity] = useState<string>(
    prefill?.timeComplexity && COMPLEXITY_OPTIONS.includes(prefill.timeComplexity)
      ? prefill.timeComplexity
      : "O(1)",
  );
  const [spaceComplexity, setSpaceComplexity] = useState<string>(
    prefill?.spaceComplexity &&
      COMPLEXITY_OPTIONS.includes(prefill.spaceComplexity)
      ? prefill.spaceComplexity
      : "O(1)",
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState(false);

  // Topic tags arrive prefilled from LeetCode's GraphQL response and stay
  // read-only for now — the combobox UI lands in a follow-up.
  const [topicTags] = useState<TopicTag[]>(submissionData?.topicTags ?? []);
  const masteryCap = ASSISTANCE_SRS_WEIGHTS[assistanceLevel];
  const problemTitle =
    prefill?.problemTitle?.trim() || titleFromSlug(submissionData.problemSlug);

  const handleTimeComplexityChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setTimeComplexity(event.target.value);
  };
  const handleSpaceComplexityChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setSpaceComplexity(event.target.value);
  };
  const handleMasteryLevelChange = (value: number) => {
    setMasteryLevel(Math.min(value, masteryCap));
  };
  const handleAssistanceLevelChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const next = event.target.value as AssistanceLevel;
    const nextCap = ASSISTANCE_SRS_WEIGHTS[next];
    setAssistanceLevel(next);
    setMasteryLevel((current) => Math.min(current, nextCap));
  };
  const [notes, setNotes] = useState(prefill?.notes ?? "");
  const handleNotesChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(event.target.value);
  };

  const buildInput = (): ReviewInput => ({
    problemSlug: submissionData.problemSlug,
    problemTitle,
    difficulty: submissionData.difficulty,
    mastery: masteryLevel,
    assistance: assistanceLevel,
    timeComplexity,
    spaceComplexity,
    topicTags,
    questionId: submissionData.questionId
      ? Number(submissionData.questionId)
      : null,
    notes,
  });

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setOfflineNotice(false);

    const result = await saveReview(buildInput());

    setSubmitting(false);
    if (result.success) {
      if (result.offline) {
        setOfflineNotice(true);
        void browser.runtime.sendMessage({
          type: constants.MESSAGE_TYPES.DRAIN_PENDING_SYNC,
        });
        onSubmitted?.();
        // Brief offline confirmation before teardown.
        window.setTimeout(() => onCancel(), 900);
        return;
      }
      onSubmitted?.();
      onCancel();
    } else {
      setSubmitError(result.error);
    }
  };

  const handleClose = () => {
    onSkip?.();
    onCancel();
  };

  return (
    <div className="review-drawer">
      <IoMdClose className="close-icon" onClick={handleClose} />
      <div className="problem-header">
        <div className="badge-container">
          <div
            className="difficulty-badge"
            data-difficulty={submissionData.difficulty.toLowerCase()}
          >
            <p>{submissionData.difficulty}</p>
          </div>
        </div>
        <div className="problem-info">
          <h2>
            {submissionData.questionId ? `${submissionData.questionId}. ` : ""}
            {problemTitle}
          </h2>
        </div>
      </div>
      <div className="complexity-metrics">
        <div className="complexity-wrapper">
          <div className="time-options">
            <p>Time</p>
            <select value={timeComplexity} onChange={handleTimeComplexityChange}>
              {COMPLEXITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="space-options">
            <p>Space</p>
            <select
              value={spaceComplexity}
              onChange={handleSpaceComplexityChange}
            >
              {COMPLEXITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="mastery-slider">
        <p>Mastery</p>
        <Slider
          value={masteryLevel}
          onChange={handleMasteryLevelChange}
          max={10}
          valueMax={masteryCap}
        />
      </div>
      <div className="assistance-level">
        <p>
          Assistance
          {detectedAssistance && detectedAssistance !== "NONE" && (
            <span className="assistance-detected">auto-detected</span>
          )}
        </p>
        <select
          value={assistanceLevel}
          onChange={handleAssistanceLevelChange}
        >
          {ASSISTANCE_OPTIONS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </div>
      <div className="topic-tags">
        <p>Topics</p>
        {topicTags.length === 0 ? (
          <p className="topic-tags-empty">—</p>
        ) : (
          <div className="topic-tags-list">
            {topicTags.map((tag) => (
              <span key={tag.slug} className="topic-tag">
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="notes-textarea">
        <p>Notes</p>
        <textarea
          value={notes}
          onChange={handleNotesChange}
          placeholder="What was the approach you took to solve the problem?"
          wrap="hard"
        />
      </div>
      {offlineNotice && (
        <p className="submit-offline" role="status">
          Saved offline — will sync when you&apos;re back online.
        </p>
      )}
      {submitError && (
        <p className="submit-error" role="alert">
          {submitError}
        </p>
      )}
      <div className="review-actions">
        <button
          type="button"
          className="review-skip"
          onClick={handleClose}
          disabled={submitting}
        >
          Skip
        </button>
        <button type="button" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Saving…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
