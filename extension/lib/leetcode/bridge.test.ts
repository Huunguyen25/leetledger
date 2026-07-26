import { describe, expect, it, vi } from "vitest";
import { createProblemMetadataLoader } from "./bridge";

describe("LeetCode bridge metadata loader", () => {
  it("caches valid metadata and sends the CSRF token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: {
          question: {
            difficulty: "Easy",
            topicTags: [
              { name: "Array", slug: "array" },
              { name: "Invalid" },
            ],
          },
        },
      }),
    });
    const loader = createProblemMetadataLoader(
      fetchMock as unknown as typeof window.fetch,
      { getCookie: () => "csrftoken=token%20123" },
    );

    const [first, second] = await Promise.all([
      loader.fetch("two-sum"),
      loader.fetch("two-sum"),
    ]);

    expect(first).toEqual({
      difficulty: "Easy",
      topicTags: [{ name: "Array", slug: "array" }],
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/graphql/",
      expect.objectContaining({
        headers: {
          "content-type": "application/json",
          "x-csrftoken": "token 123",
        },
      }),
    );
  });

  it("returns empty metadata when the request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    const loader = createProblemMetadataLoader(
      fetchMock as unknown as typeof window.fetch,
    );

    await expect(loader.fetch("two-sum")).resolves.toEqual({
      topicTags: null,
      difficulty: null,
    });
  });
});
