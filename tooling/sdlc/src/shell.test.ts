import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runShell, runGated, repoRoot } from "./shell.js";

// These tests exercise real subprocesses, so dry-run must be off.
beforeAll(() => {
  delete process.env.SDLC_DRY_RUN;
});

describe("shell runner", () => {
  it("captures a zero exit code for a successful command", () => {
    expect(runShell("true").code).toBe(0);
  });

  it("captures the real non-zero exit code for a failing command", () => {
    expect(runShell("exit 3").code).toBe(3);
  });

  it("resolves the repo root", () => {
    // Repo-agnostic: the resolved root must be an absolute path that holds
    // the monorepo's workspace marker (works in the base repo, forks, and worktrees).
    const root = repoRoot();
    expect(root.startsWith("/")).toBe(true);
    expect(existsSync(join(root, "pnpm-workspace.yaml"))).toBe(true);
  });
});

describe("deterministic stage gate (runGated)", () => {
  it("passes through when the command exits 0", () => {
    expect(() => runGated("probe", "true")).not.toThrow();
  });

  it("throws when the command exits non-zero — this fails the stage/run", () => {
    expect(() => runGated("probe", "false")).toThrow(/probe failed \(exit 1\)/);
  });
});
