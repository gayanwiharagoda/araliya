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
