import { describe, expect, it } from "vitest";
import { ARCHIVE_VERSION, upgradeArchive } from "./archive";

describe("upgradeArchive", () => {
  it("accepts the current archive version", () => {
    const result = upgradeArchive({
      archiveVersion: ARCHIVE_VERSION,
      snapshots: [],
    });
    expect(result.ok).toBe(true);
  });

  it("soft-rejects unknown older versions until a migrator is registered", () => {
    const result = upgradeArchive({ archiveVersion: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unsupported_version");
    expect(result.message).toContain("missing migrator");
  });

  it("soft-rejects newer archives the extension cannot read yet", () => {
    const result = upgradeArchive({ archiveVersion: ARCHIVE_VERSION + 1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unsupported_version");
    expect(result.message).toContain("newer than this extension");
  });
});

