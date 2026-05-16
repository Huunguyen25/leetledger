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
  difficulty: number;
  assistanceLevel: "NONE" | "LOGIC_PEEK" | "SOLUTION_COPIED";
  notes: string;
  timeSpentMinutes?: number;
}
const ASSISTANCE_LEVELS = ["None", "Logic Peek", "Solution Copied"] as const;

export default function ReviewForm({
  submissionData,
  onCancel,
}: ReviewFormProps) {
  const [difficulty, setDifficulty] = useState(1);
  const [assistanceLevel, setAssistanceLevel] = useState<string>("NONE");
  const handleDifficultyChange = (value: number) => {
    setDifficulty(value);
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
        <p>Difficulty:</p>
        <DifficultySlider
          value={difficulty}
          onChange={handleDifficultyChange}
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
      <div className="notes-textarea">
        <p>Notes</p>
        <textarea value={notes} onChange={handleNotesChange} placeholder="What was the approach you took to solve the problem?" wrap="hard"/>
      </div>
      <button>Submit</button>
    </div>
  );
}
