import { IoMdClose } from "react-icons/io";
import MasterySlider from "../Slider";
import { SubmissionPayload, TopicTag } from "@/types/submission";
import { clearHistoryCache } from "@/lib/history-cache";
import { upsertReview, type AssistanceLevel } from "@/lib/supabase/reviews";
import "./style.css";
interface ReviewFormProps {
  /** Submission payload (problem slug, difficulty badge, etc.). */
  submissionData: SubmissionPayload;
  onCancel: () => void;
}
interface UserReviewData {
  difficulty: number;
  assistanceLevel: AssistanceLevel;
  notes: string;
  timeSpentMinutes?: number;
  topicTags: TopicTag[];
}
// value = DB enum (matches the CHECK constraint), label = what the user sees.
const ASSISTANCE_LEVELS = [
  { value: "NONE", label: "None" },
  { value: "LOGIC_PEEK", label: "Logic Peek" },
  { value: "SOLUTION_COPIED", label: "Solution Copied" },
] as const;
const COMPLEXITY_OPTIONS = ["O(1)", "O(log n)","O(n)", "O(n log n)", "O(n^2)", "O(2^n)"];

function titleFromSlug(slug: string | undefined): string {
  if (!slug) return "";
  return slug
    .split("-")
    .map((str) => str.charAt(0).toUpperCase() + str.slice(1))
    .join(" ");
}

export default function ReviewForm({submissionData, onCancel}: ReviewFormProps) {
  const [masteryLevel, setMasteryLevel] = useState(1);
  const [assistanceLevel, setAssistanceLevel] = useState<AssistanceLevel>("NONE");

  const [timeComplexity, setTimeComplexity] = useState<string>("O(1)");
  const [spaceComplexity, setSpaceComplexity] = useState<string>("O(1)");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Topic tags arrive prefilled from LeetCode's GraphQL response and stay
  // read-only for now — the combobox UI lands in a follow-up.
  const [topicTags] = useState<TopicTag[]>(submissionData?.topicTags ?? []);


  const handleTimeComplexityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeComplexity(event.target.value);
  };
  const handleSpaceComplexityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSpaceComplexity(event.target.value);
  };
  const handleMasteryLevelChange = (value: number) => {
    setMasteryLevel(value);
  };
  const handleAssistanceLevelChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setAssistanceLevel(
      event.target.value as UserReviewData["assistanceLevel"],
    );
  };
  const [notes, setNotes] = useState("");
  const handleNotesChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(event.target.value);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const result = await upsertReview({
      problemSlug: submissionData.problemSlug,
      problemTitle: titleFromSlug(submissionData.problemSlug),
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

    setSubmitting(false);
    if (result.success) {
      void clearHistoryCache();
      onCancel();
    } else {
      setSubmitError(result.error);
    }
  };


  return (
    <div className="review-drawer">
      <IoMdClose className="close-icon" onClick={() => onCancel()} />
      <div className="problem-header">
        <div className="badge-container">
          <div className="difficulty-badge" data-difficulty={submissionData?.difficulty?.toLowerCase()}>
            <p>{submissionData?.difficulty}</p>
          </div>
        </div>
        <div className="problem-info">
        <h2>
          {submissionData?.questionId ? `${submissionData?.questionId}. ` : ""}
          {titleFromSlug(submissionData?.problemSlug)}
        </h2>
        </div>
      </div>
      <div className="complexity-metrics">
        <div className="complexity-wrapper">
          <div className="time-options">
          <p>Time Complexity: </p>
            <select value={timeComplexity} onChange={handleTimeComplexityChange}>
              {COMPLEXITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="space-options">
            <p>Space Complexity: </p>
            <select value={spaceComplexity} onChange={handleSpaceComplexityChange}>
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
        <p>Mastery Level:</p>
        <MasterySlider
          value={masteryLevel}
          onChange={handleMasteryLevelChange}
        />
      </div>
      <div className="assistance-level">
        <p>Assistance Level</p>
        <select value={assistanceLevel} onChange={handleAssistanceLevelChange}>
        {ASSISTANCE_LEVELS.map((level) => (
          <option key={level.value} value={level.value}>
            {level.label}
          </option>
        ))}
        </select>
      </div>
      <div className="topic-tags">
        <p>Topics</p>
        {topicTags.length === 0 ? (
          <p>—</p>
        ) : (
          <div>
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
        <textarea value={notes} onChange={handleNotesChange} placeholder="What was the approach you took to solve the problem?" wrap="hard"/>
      </div>
      {submitError && <p className="submit-error" role="alert">{submitError}</p>}
      <button onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Saving…" : "Submit"}
      </button>
    </div>
  );
}
