import { IoMdClose } from "react-icons/io";
import DifficultySlider from "../Slider";
import { SubmissionPayload } from "@/types/submission";
import "./style.css";
interface ReviewFormProps {
  /**
   * Submission interface:
   * status: string
   * runtime: string
   * memory: string
   * runtimePercentile: number
   * memoryPercentile: number
   * problemSlug: string
   */
  submissionData: SubmissionPayload;
  onCancel: () => void;
}
interface UserReviewData {
  // 1. The Core SRS Metric 1/10 slider
  difficulty: number;

  // 2. The Assistance Metric dropdown
  assistanceLevel: "SOLO" | "LOGIC_PEEK" | "SOLUTION_COPIED";

  // 3. The Context textarea
  notes: string; // e.g., "Sort intervals by end time, not start time!"

  // Optional but highly recommended for analytics later number field
  timeSpentMinutes?: number; // e.g., 25
}

export default function ReviewForm({
  submissionData,
  onCancel,
}: ReviewFormProps) {
  const [difficulty, setDifficulty] = useState(5);
  const [assistanceLevel, setAssistanceLevel] = useState<string>("SOLO");
  const handleDifficultyChange = (value: number) => {
    setDifficulty(value);
  };
  const handleAssistanceLevelChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setAssistanceLevel(
      event.target.value as "SOLO" | "LOGIC_PEEK" | "SOLUTION_COPIED",
    );
  };
  return (
    <div className="review-drawer">
      <IoMdClose className="close-icon" onClick={() => onCancel()} />
      <div className="problem-header">
        <h2>
          {submissionData?.problemSlug
            ?.split("-")
            .map((str) => str.charAt(0).toUpperCase() + str.slice(1))
            .join(" ")}
        </h2>
        <div
          className="difficulty-badge"
          data-difficulty={submissionData?.difficulty?.toLowerCase()}
        >
          <p>{submissionData?.difficulty}</p>
        </div>
      </div>

      <div className="complexity-metrics">
        <div className="complexity-metric">
          <p>Runtime: {submissionData?.runtime}</p>
          <p>Memory: {submissionData?.memory}</p>
        </div>
      </div>
      <div className="difficulty-slider">
        <p>Difficulty: {difficulty}</p>
        <DifficultySlider
          value={difficulty}
          onChange={handleDifficultyChange}
        />
      </div>
      <div className="assistance-level">
        <p>Assistance Level</p>
        <select value={assistanceLevel} onChange={handleAssistanceLevelChange}>
          <option value="SOLO">Solo</option>
          <option value="LOGIC_PEEK">Logic Peek</option>
          <option value="SOLUTION_COPIED">Solution Copied</option>
        </select>
      </div>
      <button>Submit</button>
    </div>
  );
}
