import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEngine, startRun, resumeRun, runInteractive } from "./engine.js";

// Control-plane tests are hermetic: dry-run skips the real subprocess stages
// (sync/validate/release/archive) so we exercise ordering/suspend/resume only.
process.env.SDLC_DRY_RUN = "1";

const tempDb = () => join(mkdtempSync(join(tmpdir(), "sdlc-")), "runs.db");

const EXPECTED_TRACE = [
  "propose",
  "plan-gate:approved",
  "sync",
  "build",
  "validate",
  "build-result",
  "review",
  "commit-pr",
  "merge-gate:approved",
  "release",
  "release-gate:approved",
  "archive",
];

describe("sdlc walking skeleton", () => {
  it("suspends at each gate, resumes, and completes stages in deterministic order", async () => {
    const m = createEngine(tempDb());
    const { runId, result } = await startRun(m, "demo");
    expect(result.status).toBe("suspended"); // plan gate

    const afterPlan = await resumeRun(m, runId, true);
    expect(afterPlan.result.status).toBe("suspended"); // merge gate

    const afterMerge = await resumeRun(m, runId, true);
    expect(afterMerge.result.status).toBe("suspended"); // release gate

    const done = await resumeRun(m, runId, true);
    expect(done.result.status).toBe("success");
    expect(
      done.result.status === "success" && done.result.result.trace,
    ).toEqual(EXPECTED_TRACE);
  });

  it("replays to the same terminal state across simulated restarts (new engine, same db)", async () => {
    const db = tempDb();
    const { runId } = await startRun(createEngine(db), "demo");

    // Each resume uses a fresh engine over the same LibSQL file = process restart.
    await resumeRun(createEngine(db), runId, true);
    await resumeRun(createEngine(db), runId, true);
    const done = await resumeRun(createEngine(db), runId, true);

    expect(done.result.status).toBe("success");
    expect(
      done.result.status === "success" && done.result.result.trace,
    ).toEqual(EXPECTED_TRACE);
  });

  it("rejecting the plan gate stops the run before build", async () => {
    const m = createEngine(tempDb());
    const { runId } = await startRun(m, "demo");
    const rejected = await resumeRun(m, runId, false);
    expect(rejected.result.status).toBe("failed");
  });

  it("--auto (full) runs to completion with no gate suspends", async () => {
    const m = createEngine(tempDb());
    const { result } = await startRun(m, "demo-auto", "", "full");
    expect(result.status).toBe("success");
    expect(result.status === "success" && result.result.trace).toEqual([
      "propose",
      "plan-gate:auto",
      "sync",
      "build",
      "validate",
      "build-result",
      "review",
      "commit-pr",
      "merge-gate:auto",
      "release",
      "release-gate:auto",
      "archive",
    ]);
  });

  it("--auto=pr auto-clears the plan gate but still stops at merge-gate", async () => {
    const m = createEngine(tempDb());
    const { result } = await startRun(m, "demo-pr", "", "pr");
    const r = result as { status: string; suspended?: string[][] };
    expect(r.status).toBe("suspended");
    expect(r.suspended?.[0]?.join("/")).toBe("merge-gate"); // past plan-gate, paused at the PR
  });

  it("interactive: prompts at each gate with a summary and completes in one process", async () => {
    const m = createEngine(tempDb());
    const prompted: string[] = [];
    const { result } = await runInteractive(
      m,
      "demo-i",
      "",
      "off",
      async (p) => {
        prompted.push(p.gate ?? "escalation");
        expect(p.verify).toBeTruthy(); // the summary carries a "what to verify" hint
        return true;
      },
    );
    expect(prompted).toEqual(["plan-gate", "merge-gate", "release-gate"]);
    expect(result.status).toBe("success");
    expect(result.status === "success" && result.result.trace).toEqual(
      EXPECTED_TRACE,
    );
  });

  it("interactive: declining a gate fails the run", async () => {
    const m = createEngine(tempDb());
    const { result } = await runInteractive(
      m,
      "demo-i2",
      "",
      "off",
      async () => false,
    );
    expect(result.status).toBe("failed");
  });
});
