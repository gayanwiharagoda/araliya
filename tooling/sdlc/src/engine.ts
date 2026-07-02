import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { sdlcWorkflow, initialCtx } from "./stages.js";

/**
 * Build an engine bound to a LibSQL file. A new engine over the same file is a
 * simulated process restart — run state is durable and replayable from storage.
 */
export function createEngine(dbPath: string): Mastra {
  mkdirSync(dirname(dbPath), { recursive: true });
  const storage = new LibSQLStore({ id: "sdlc", url: `file:${dbPath}` });
  return new Mastra({ storage, workflows: { sdlc: sdlcWorkflow } });
}

/** Start a new run. Returns its id and the first result (suspended at plan gate). */
export async function startRun(mastra: Mastra, changeName: string) {
  const run = await mastra.getWorkflow("sdlc").createRun();
  const result = await run.start({ inputData: initialCtx(changeName) });
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
