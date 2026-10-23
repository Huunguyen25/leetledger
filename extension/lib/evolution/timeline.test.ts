import { describe, expect, it } from "vitest";
import type { TimelineSnapshot } from "@/types/evolution";
import {
  TIMELINE_POLICY,
  appendObservation,
  applyAndVerifyPatch,
  checksumCode,
  createPatch,
  isMeaningfulChange,
  normalizeCode,
  reconstructCode,
  verifyTimelineIntegrity,
  type CodeObservation,
  type TimelineHead,
} from "./timeline";

const BASE_CODE = [
  "class Solution:",
  "    def twoSum(self, nums, target):",
  "        seen = {}",
  "        return []",
].join("\n");

function emptyHead(): TimelineHead {
  return { headCode: "", headChecksum: checksumCode(""), snapshots: [] };
}

/** Applies observations in order, mirroring the background write loop. */
function buildTimeline(
  observations: CodeObservation[],
): TimelineHead & { ignored: string[] } {
  const head = emptyHead();
  const ignored: string[] = [];

  for (const observation of observations) {
    const result = appendObservation(head, observation);
    if (result.kind === "ignored") {
      ignored.push(result.reason);
      continue;
    }
    head.snapshots.push(result.snapshot);
    head.headCode = result.headCode;
    head.headChecksum = result.headChecksum;
  }

  return { ...head, ignored };
}

function observe(
  code: string,
  overrides: Partial<CodeObservation> = {},
): CodeObservation {
  return { code, source: "autosave", timestamp: 1_000, ...overrides };
}

/** Appends a comment long enough to clear the autosave threshold. */
function withExtraLine(code: string, label: string): string {
  return `${code}\n        # reasoning about the approach: ${label}\n`;
}

describe("normalizeCode", () => {
  it("unifies line endings and Unicode without trimming indentation", () => {
    expect(normalizeCode("a\r\nb\rc")).toBe("a\nb\nc");
    expect(normalizeCode("    indented   ")).toBe("    indented   ");
    expect(normalizeCode("e\u0301")).toBe("é");
  });
});

describe("checksumCode", () => {
  it("is deterministic and separates similar content", () => {
    expect(checksumCode(BASE_CODE)).toBe(checksumCode(BASE_CODE));
    expect(checksumCode("ab")).not.toBe(checksumCode("ba"));
    expect(checksumCode("")).toBe(checksumCode(""));
  });
});

describe("patch round trip", () => {
  it("rebuilds the exact target version", () => {
    const after = BASE_CODE.replace("return []", "return [0, 1]");
    const patchText = createPatch(BASE_CODE, after);

    const applied = applyAndVerifyPatch(
      BASE_CODE,
      patchText,
      checksumCode(after),
    );

    expect(applied).toEqual({ ok: true, code: after });
  });

  it("rejects a patch whose result fails checksum verification", () => {
    const patchText = createPatch(BASE_CODE, `${BASE_CODE}\n# note`);

    const applied = applyAndVerifyPatch(BASE_CODE, patchText, "wrong-checksum");

    expect(applied).toMatchObject({ ok: false, reason: "checksum_mismatch" });
  });

  it("rejects malformed patch text", () => {
    const applied = applyAndVerifyPatch(BASE_CODE, "not-a-patch");

    expect(applied).toMatchObject({ ok: false, reason: "patch_failed" });
  });
});

describe("isMeaningfulChange", () => {
  it("ignores tiny single-line edits but keeps larger ones", () => {
    expect(isMeaningfulChange(BASE_CODE, BASE_CODE)).toBe(false);
    expect(isMeaningfulChange(BASE_CODE, `${BASE_CODE}#`)).toBe(false);
    expect(isMeaningfulChange(BASE_CODE, withExtraLine(BASE_CODE, "one"))).toBe(
      true,
    );
    expect(
      isMeaningfulChange(
        BASE_CODE,
        BASE_CODE.replace("    def twoSum(self, nums, target):", ""),
      ),
    ).toBe(true);
  });
});

describe("appendObservation", () => {
  it("stores the first version as a checkpoint", () => {
    const result = appendObservation(emptyHead(), observe(BASE_CODE));

    expect(result).toMatchObject({
      kind: "appended",
      snapshot: { kind: "checkpoint", sequence: 0, fullCode: BASE_CODE },
      headCode: BASE_CODE,
    });
  });

  it("ignores an empty first observation", () => {
    expect(appendObservation(emptyHead(), observe(""))).toEqual({
      kind: "ignored",
      reason: "duplicate",
    });
  });

  it("stores meaningful autosave changes as patches", () => {
    const second = withExtraLine(BASE_CODE, "walk the array once");
    const timeline = buildTimeline([observe(BASE_CODE), observe(second)]);

    expect(timeline.snapshots.map((snapshot) => snapshot.kind)).toEqual([
      "checkpoint",
      "patch",
    ]);
    expect(timeline.headCode).toBe(second);
  });

  it("ignores duplicate and sub-threshold autosave polls", () => {
    const timeline = buildTimeline([
      observe(BASE_CODE),
      observe(BASE_CODE),
      observe(`${BASE_CODE}#`),
    ]);

    expect(timeline.ignored).toEqual(["duplicate", "below_threshold"]);
    expect(timeline.snapshots).toHaveLength(1);
  });

  it("stores a marker when a run repeats the current code", () => {
    const timeline = buildTimeline([
      observe(BASE_CODE),
      observe(BASE_CODE, { source: "run", timestamp: 2_000 }),
    ]);

    expect(timeline.snapshots[1]).toMatchObject({
      kind: "marker",
      source: "run",
      sequence: 1,
      codeChecksum: checksumCode(BASE_CODE),
    });
    expect(timeline.headChecksum).toBe(checksumCode(BASE_CODE));
  });

  it("keeps a submission marker linked to its submission id", () => {
    const timeline = buildTimeline([
      observe(BASE_CODE),
      observe(BASE_CODE, { source: "submit", submissionId: "4242" }),
    ]);

    expect(timeline.snapshots[1]).toMatchObject({
      kind: "marker",
      source: "submit",
      submissionId: "4242",
    });
  });

  it("stores milestone code that is below the autosave threshold", () => {
    const nudged = `${BASE_CODE}#`;
    const timeline = buildTimeline([
      observe(BASE_CODE),
      observe(nudged, { source: "submit", submissionId: "77" }),
    ]);

    expect(timeline.snapshots[1]).toMatchObject({ kind: "patch", sequence: 1 });
    expect(timeline.headCode).toBe(nudged);
  });

  it("falls back to a checkpoint once the patch chain is long enough", () => {
    let code = BASE_CODE;
    const observations = [observe(code)];
    for (let i = 0; i < TIMELINE_POLICY.maxPatchesPerCheckpoint + 1; i++) {
      code = withExtraLine(code, `step ${i}`);
      observations.push(observe(code));
    }

    const timeline = buildTimeline(observations);
    const kinds = timeline.snapshots.map((snapshot) => snapshot.kind);

    expect(kinds.filter((kind) => kind === "checkpoint")).toHaveLength(2);
    expect(kinds[kinds.length - 1]).toBe("checkpoint");
  });

  it("prefers a checkpoint when the patch is not smaller than the code", () => {
    const timeline = buildTimeline([
      observe(BASE_CODE),
      observe("def solve():\n    return 0\n"),
    ]);

    expect(timeline.snapshots[1].kind).toBe("checkpoint");
  });
});

describe("reconstructCode", () => {
  it("rebuilds every version in a mixed snapshot chain", () => {
    const versions = [
      BASE_CODE,
      withExtraLine(BASE_CODE, "first pass"),
      withExtraLine(withExtraLine(BASE_CODE, "first pass"), "second pass"),
    ];
    const timeline = buildTimeline([
      observe(versions[0]),
      observe(versions[1], { timestamp: 2_000 }),
      observe(versions[1], { source: "run", timestamp: 3_000 }),
      observe(versions[2], { timestamp: 4_000 }),
    ]);

    expect(reconstructCode(timeline.snapshots, 0)).toEqual({
      ok: true,
      code: versions[0],
    });
    expect(reconstructCode(timeline.snapshots, 2)).toEqual({
      ok: true,
      code: versions[1],
    });
    expect(reconstructCode(timeline.snapshots)).toEqual({
      ok: true,
      code: versions[2],
    });
    expect(
      verifyTimelineIntegrity(timeline.snapshots, timeline.headChecksum),
    ).toBe(true);
  });

  it("reports corruption instead of returning drifted code", () => {
    const timeline = buildTimeline([
      observe(BASE_CODE),
      observe(withExtraLine(BASE_CODE, "explain the approach")),
    ]);
    const corrupted: TimelineSnapshot[] = [
      timeline.snapshots[0],
      { ...timeline.snapshots[1], beforeChecksum: "tampered" } as
        TimelineSnapshot,
    ];

    expect(reconstructCode(corrupted)).toEqual({
      ok: false,
      reason: "checksum_mismatch",
      sequence: 1,
    });
    expect(verifyTimelineIntegrity(corrupted, timeline.headChecksum)).toBe(
      false,
    );
  });

  it("reports a missing checkpoint base", () => {
    expect(reconstructCode([])).toEqual({ ok: false, reason: "no_checkpoint" });
  });
});
