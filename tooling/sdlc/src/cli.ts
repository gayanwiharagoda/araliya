import { createEngine, startRun, resumeRun, listRuns } from "./engine.js";
import { fetchIssue, issueToChangeName, adoptIssue } from "./issue.js";

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
      "usage: sdlc <change-name> | sdlc --issue <n> | sdlc resume <id> [--approve|--reject] | sdlc ls",
    );
    process.exit(1);
  }

  if (cmd === "ls") {
    const runs = await listRuns(mastra);
    console.log(JSON.stringify(runs, null, 2));
    return;
  }

  // Issue-driven: pull the detail from the issue, then let the spec drive it.
  if (cmd === "--issue" || cmd === "issue") {
    const n = Number(rest[0]);
    if (!Number.isInteger(n)) throw new Error("usage: sdlc --issue <number>");
    const issue = fetchIssue(n);
    const changeName = issueToChangeName(issue.title);
    adoptIssue(n, changeName); // seed the marker so `openspec:sync` adopts this issue
    console.log(`issue #${n} "${issue.title}" → change "${changeName}"`);
    const { runId, result } = await startRun(mastra, changeName, issue.body);
    printResult(runId, result);
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

  // Anything else is treated as a (kebab-case) change name → start a run.
  const { runId, result } = await startRun(mastra, cmd);
  printResult(runId, result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
