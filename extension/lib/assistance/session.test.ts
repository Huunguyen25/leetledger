import { describe, expect, it, vi } from "vitest";
import { createAssistanceSession } from "./session";

describe("createAssistanceSession", () => {
  it("clears signals when navigating to a different problem", () => {
    let pathname = "/problems/two-sum/";
    const session = createAssistanceSession({ getPathname: () => pathname });

    session.handleNavigation(pathname);
    session.record("HINT");
    expect(session.getPrimary()).toBe("HINT");

    pathname = "/problems/three-sum/";
    session.handleNavigation(pathname);
    expect(session.getPrimary()).toBe("NONE");
  });

  it("preserves signals on submission detail navigation", () => {
    const session = createAssistanceSession({
      getPathname: () => "/problems/two-sum/",
    });

    session.handleNavigation("/problems/two-sum/");
    session.record("HINT");
    session.handleNavigation("/submissions/detail/123/");
    expect(session.getPrimary()).toBe("HINT");
  });

  it("resets when leaving the problem flow", () => {
    const session = createAssistanceSession({
      getPathname: () => "/problems/two-sum/",
    });

    session.handleNavigation("/problems/two-sum/");
    session.record("SOLUTION_PEEK");
    session.handleNavigation("/problemset/all/");
    expect(session.getPrimary()).toBe("NONE");
  });

  it("starts a fresh attempt when returning to a problem", () => {
    let pathname = "/problems/two-sum/";
    const session = createAssistanceSession({ getPathname: () => pathname });

    session.handleNavigation("/problems/two-sum/");
    session.record("SOLUTION_PEEK");
    session.handleNavigation("/problemset/all/");
    pathname = "/problems/two-sum/";
    session.handleNavigation("/problems/two-sum/");
    expect(session.getPrimary()).toBe("NONE");
  });

  it("ignores records for a stale slug", () => {
    const session = createAssistanceSession({
      getPathname: () => "/problems/three-sum/",
    });

    session.handleNavigation("/problems/three-sum/");
    session.record("HINT", "two-sum");
    expect(session.getPrimary()).toBe("NONE");
  });

  it("calls onReset when rebinding or clearing", () => {
    const onReset = vi.fn();
    const session = createAssistanceSession({ onReset });

    session.handleNavigation("/problems/two-sum/");
    expect(onReset).toHaveBeenCalledTimes(1);

    session.handleNavigation("/problems/three-sum/");
    expect(onReset).toHaveBeenCalledTimes(2);

    session.clearAfterSubmit();
    expect(onReset).toHaveBeenCalledTimes(3);
  });

  it("records SOLUTION_PEEK when navigating to the solutions tab", () => {
    const session = createAssistanceSession({
      getPathname: () => "/problems/two-sum/solutions/",
    });

    session.handleNavigation("/problems/two-sum/");
    expect(session.getPrimary()).toBe("NONE");

    session.handleNavigation("/problems/two-sum/solutions/");
    expect(session.getPrimary()).toBe("SOLUTION_PEEK");
  });

  it("records SOLUTION_PEEK when landing directly on the editorial tab", () => {
    const session = createAssistanceSession({
      getPathname: () => "/problems/two-sum/editorial/",
    });

    session.handleNavigation("/problems/two-sum/editorial/");
    expect(session.getPrimary()).toBe("SOLUTION_PEEK");
  });

  it("drops a path-detected peek after leaving the problem", () => {
    const session = createAssistanceSession({
      getPathname: () => "/problems/two-sum/solutions/",
    });

    session.handleNavigation("/problems/two-sum/solutions/");
    expect(session.getPrimary()).toBe("SOLUTION_PEEK");

    session.handleNavigation("/problemset/all/");
    expect(session.getPrimary()).toBe("NONE");
  });

  it("does not rebind on same-problem navigation", () => {
    const onReset = vi.fn();
    const session = createAssistanceSession({
      onReset,
      getPathname: () => "/problems/two-sum/description/",
    });

    session.handleNavigation("/problems/two-sum/");
    session.record("HINT");
    session.handleNavigation("/problems/two-sum/description/");
    expect(session.getPrimary()).toBe("HINT");
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
