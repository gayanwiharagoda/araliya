import { createEngine, startRun, resumeRun, listRuns } from "./engine.js";
import {
  fetchIssue,
  issueToChangeName,
  adoptIssue,
  normalizeIssueRef,
} from "./issue.js";
import type { Ctx } from "./stages.js";
import { fileURLToPath } from "node:url";

const DB = process.env.SDLC_DB ?? ".sdlc/runs.db";

/** `--auto` → run to archive; `--auto=pr` → auto up to the PR then stop at merge-gate. */
export function parseAuto(argv: string[]): Ctx["auto"] {
  const a = argv.find((x) => x === "--auto" || x.startsWith("--auto="));
  if (!a) return "off";
  const v = a === "--auto" ? "full" : a.slice("--auto=".length);
  if (v !== "pr" && v !== "full")
    throw new Error(`--auto expects 'pr' or 'full' (got '${v}')`);
  return v;
}

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
  const argv = process.argv.slice(2);
  const auto = parseAuto(argv);
  const [cmd, ...rest] = argv.filter(
    (x) => x !== "--auto" && !x.startsWith("--auto="),
  );
  const mastra = createEngine(DB);

  if (!cmd) {
    console.error(
      "usage: sdlc <change-name> [--auto[=pr]] | sdlc --issue <n> [--auto[=pr]] | sdlc resume <id> [--approve|--reject] | sdlc ls",
    );
    process.exit(1);
  }

  if (cmd === "ls") {
    const runs = await listRuns(mastra);
    console.log(JSON.stringify(runs, null, 2));
    return;
  }

  // Issue-driven: pull the detail from the issue (number or URL), let the spec drive it.
  if (cmd === "--issue" || cmd === "issue") {
    const ref = normalizeIssueRef(rest[0] ?? "");
    const issue = fetchIssue(ref);
    const changeName = issueToChangeName(issue.title);
    adoptIssue(ref, changeName); // seed the marker so `openspec:sync` adopts this issue
    console.log(
      `issue #${issue.number} "${issue.title}" → change "${changeName}"`,
    );
    const { runId, result } = await startRun(
      mastra,
      changeName,
      issue.body,
      auto,
    );
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
  const { runId, result } = await startRun(mastra, cmd, "", auto);
  printResult(runId, result);
}

// Run only when invoked directly (not when imported by a test).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    // A fatal crash must always surface — bypass the leveled logger (silent at level=none).
    console.error(
      err instanceof Error ? (err.stack ?? err.message) : String(err),
    );
    process.exit(1);
  });
}
