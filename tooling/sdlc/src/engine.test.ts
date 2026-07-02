import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEngine, startRun, resumeRun } from "./engine.js";

const tempDb = () => join(mkdtempSync(join(tmpdir(), "sdlc-")), "runs.db");

const EXPECTED_TRACE = [
  "propose",
  "plan-gate:approved",
  "sync",
  "build",
  "validate",
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
});
