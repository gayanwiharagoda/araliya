import { createEngine, startRun, resumeRun, listRuns } from "./engine.js";

const DB = process.env.SDLC_DB ?? ".sdlc/runs.db";

function printResult(
  runId: string,
  result: { status: string; suspended?: unknown },
) {
  console.log(`run ${runId}: ${result.status}`);
  if (result.status === "suspended") {
    const at =
      (result.suspended as string[][] | undefined)?.[0]?.join("/") ?? "?";
    console.log(`  suspended at gate: ${at}`);
    console.log(
      `  resume with: pnpm sdlc resume ${runId} --approve   (or --reject)`,
    );
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const mastra = createEngine(DB);

  if (!cmd) {
    console.error(
      'usage: sdlc "<description>" | sdlc resume <id> [--approve|--reject] | sdlc ls',
    );
    process.exit(1);
  }

  if (cmd === "ls") {
    const runs = await listRuns(mastra);
    console.log(JSON.stringify(runs, null, 2));
    return;
  }

  if (cmd === "resume") {
    const runId = rest[0];
    if (!runId) throw new Error("resume requires a run id");
    const approved = !rest.includes("--reject");
    const { result } = await resumeRun(mastra, runId, approved);
    printResult(runId, result);
    return;
  }

  // Anything else is treated as a change description → start a run.
  const { runId, result } = await startRun(mastra, cmd);
  printResult(runId, result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
