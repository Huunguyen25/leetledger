import { IoMdClose } from "react-icons/io";
import MasterySlider from "../Slider";
import { SubmissionPayload, TopicTag } from "@/types/submission";
import "./style.css";
interface ReviewFormProps {
  /** Submission payload (problem slug, difficulty badge, etc.). */
  submissionData: SubmissionPayload;
  onCancel: () => void;
}
interface UserReviewData {
  difficulty: number;
  assistanceLevel: "NONE" | "LOGIC_PEEK" | "SOLUTION_COPIED";
  notes: string;
  timeSpentMinutes?: number;
  topicTags: TopicTag[];
}
const ASSISTANCE_LEVELS = ["None", "Logic Peek", "Solution Copied"] as const;
const COMPLEXITY_OPTIONS = ["O(1)", "O(log n)","O(n)", "O(n log n)", "O(n^2)", "O(2^n)"];

export default function ReviewForm({submissionData, onCancel}: ReviewFormProps) {
  const [masteryLevel, setMasteryLevel] = useState(1);
  const [assistanceLevel, setAssistanceLevel] = useState<string>("NONE");

  const [timeComplexity, setTimeComplexity] = useState<string>("O(1)");
  const [spaceComplexity, setSpaceComplexity] = useState<string>("O(1)");

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
          {submissionData?.problemSlug
            ?.split("-")
            .map((str) => str.charAt(0).toUpperCase() + str.slice(1))
            .join(" ")}
        </h2>
        </div>
      </div>
      <div className="complexity-metrics">
        <div className="complexity-wrapper">
          <div className="time-options">
          <p>Space Complexity: </p>
            <select value={timeComplexity} onChange={handleTimeComplexityChange}>
              {COMPLEXITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="space-options">
            <p>Time Complexity: </p>
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
          <option key={level} value={level}>
            {level}
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
      <button>Submit</button>
    </div>
  );
}
