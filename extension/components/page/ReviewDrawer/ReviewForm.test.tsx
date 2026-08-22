import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { upsertReview } = vi.hoisted(() => ({ upsertReview: vi.fn() }));

vi.mock("@/lib/review/repository", () => ({ upsertReview }));
vi.mock("./Slider", () => ({
  default: ({ value, onChange }: { value: number; onChange: (value: number) => void }) => (
    <input
      aria-label="Mastery Level"
      type="range"
      value={value}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
    />
  ),
}));
vi.mock("./ReviewDrawer.css", () => ({}));

import ReviewForm from "./ReviewForm";

const submissionData = {
  status: "Accepted",
  problemSlug: "two-sum",
  difficulty: "Easy",
  questionId: "1",
  topicTags: [{ name: "Array", slug: "array" }],
};

describe("ReviewForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onCancel = vi.fn();
  const onSubmitted = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <ReviewForm
          submissionData={submissionData}
          onCancel={onCancel}
          onSubmitted={onSubmitted}
        />,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function change(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function submitButton() {
    return [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Submit" || button.textContent === "Saving…",
    )!;
  }

  it("submits human inputs using the normalized review shape", async () => {
    upsertReview.mockResolvedValue({ success: true });

    const selects = container.querySelectorAll("select");
    await act(async () => {
      change(selects[0], "O(n)");
      change(selects[1], "O(log n)");
      change(selects[2], "SOLUTION_PEEK");
      change(container.querySelector('input[aria-label="Mastery Level"]')!, "4");
      change(container.querySelector("textarea")!, "Use a hash map");
      submitButton().click();
    });

    expect(upsertReview).toHaveBeenCalledWith({
      problemSlug: "two-sum",
      problemTitle: "Two Sum",
      difficulty: "Easy",
      mastery: 4,
      assistance: "SOLUTION_PEEK",
      timeComplexity: "O(n)",
      spaceComplexity: "O(log n)",
      topicTags: [{ name: "Array", slug: "array" }],
      questionId: 1,
      notes: "Use a hash map",
    });
    expect(onSubmitted).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows a failed write and keeps the form open", async () => {
    upsertReview.mockResolvedValue({ success: false, error: "RLS denied the write" });

    await act(async () => submitButton().click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe("RLS denied the write");
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("blocks duplicate submissions while the first write is pending", async () => {
    let finish!: (value: { success: true }) => void;
    upsertReview.mockReturnValue(new Promise((resolve) => { finish = resolve; }));

    await act(async () => {
      submitButton().click();
      submitButton().click();
    });

    expect(upsertReview).toHaveBeenCalledOnce();
    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toBe("Saving…");

    await act(async () => finish({ success: true }));
  });

  it("lets the user cancel without writing", async () => {
    await act(async () => {
      (container.querySelector(".close-icon") as HTMLElement).click();
    });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(upsertReview).not.toHaveBeenCalled();
  });
});
