import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { sdlcWorkflow, initialCtx, type Ctx } from "./stages.js";
import { isDryRun, repoRoot } from "./shell.js";
import { assertNoApiKey } from "./agent.js";
import { createWorktree } from "./worktree.js";
import { log } from "./log.js";

/**
 * Build an engine bound to a LibSQL file. A new engine over the same file is a
 * simulated process restart — run state is durable and replayable from storage.
 */
export function createEngine(dbPath: string): Mastra {
  mkdirSync(dirname(dbPath), { recursive: true });
  const storage = new LibSQLStore({ id: "sdlc", url: `file:${dbPath}` });
  return new Mastra({
    storage,
    workflows: { sdlc: sdlcWorkflow },
    logger: log,
  });
}

/** Start a new run in its own git worktree. `brief` is optional issue context. */
export async function startRun(
  mastra: Mastra,
  changeName: string,
  brief = "",
  auto: Ctx["auto"] = "off",
) {
  assertNoApiKey();
  // Dry-run stays in the repo root (hermetic); real runs get an isolated worktree.
  const cwd = isDryRun() ? repoRoot() : createWorktree(changeName, repoRoot());
  const run = await mastra.getWorkflow("sdlc").createRun();
  const result = await run.start({
    inputData: initialCtx(changeName, cwd, brief, auto),
  });
  return { runId: run.runId, result };
}

/** What a gate/escalation hands the human at a suspend (see the gate `suspendSchema`). */
export interface GatePrompt {
  gate?: string; // set for the 3 approval gates; absent for the build-result escalation
  changeName?: string;
  done?: string[]; // stages completed so far
  verify?: string; // what to check
  reason?: string; // build-result escalation only
  attempts?: number;
}

/**
 * Drive a run to completion in ONE process: start it, and whenever it suspends at a
 * gate, ask `decide` (which shows the summary + prompts) and resume in place — no second
 * `resume` command, no new terminal. Mastra supports resuming the same run handle.
 */
export async function runInteractive(
  mastra: Mastra,
  changeName: string,
  brief: string,
  auto: Ctx["auto"],
  decide: (prompt: GatePrompt) => Promise<boolean>,
) {
  assertNoApiKey();
  const cwd = isDryRun() ? repoRoot() : createWorktree(changeName, repoRoot());
  const run = await mastra.getWorkflow("sdlc").createRun();
  let result = await run.start({
    inputData: initialCtx(changeName, cwd, brief, auto),
  });
  while (result.status === "suspended") {
    // `suspendPayload` is keyed by the suspended step id (one at a time here).
    const r = result as {
      suspended?: string[][];
      suspendPayload?: Record<string, GatePrompt>;
    };
    const stepId = r.suspended?.[0]?.[0] ?? "";
    const prompt = r.suspendPayload?.[stepId] ?? {};
    const approved = await decide(prompt);
    // The build-result escalation has no reject path — declining just stops here.
    if (!approved && prompt.gate === undefined) break;
    result = await run.resume({ resumeData: { approved, proceed: approved } });
  }
  return { runId: run.runId, result };
}

/** Resume a suspended run's current gate with an approve/reject decision. */
export async function resumeRun(
  mastra: Mastra,
  runId: string,
  approved: boolean,
) {
  const run = await mastra.getWorkflow("sdlc").createRun({ runId });
  const result = await run.resume({ resumeData: { approved } });
  return { runId, result };
}

/** List known runs for the `sdlc ls` command. */
export async function listRuns(mastra: Mastra) {
  return mastra.getWorkflow("sdlc").listWorkflowRuns();
}
