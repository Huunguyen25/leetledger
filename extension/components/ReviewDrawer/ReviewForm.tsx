import "./style.css";
interface ReviewFormProps {
  // submissionData: {
  //   status: string;
  //   runtime: string;
  //   memory: string;
  //   runtimePercentile: number;
  //   memoryPercentile: number;
  //   problemSlug: string;
  // };
  onCancel: () => void;
}

export default function ReviewForm({ onCancel }: ReviewFormProps) {
  return (
    <div className="review-drawer">
      <h2>Review drawer</h2>
      <button>Submit</button>
      <button>Skip</button>
      <button onClick={() => onCancel()}>cancel</button>
      <p>If you see this, the drawer is showing.</p>
      <div></div>
    </div>
  );
}
