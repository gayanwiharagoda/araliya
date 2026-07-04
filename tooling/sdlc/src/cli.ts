import {
  createEngine,
  startRun,
  resumeRun,
  runInteractive,
  listRuns,
  type GatePrompt,
} from "./engine.js";
import {
  fetchIssue,
  issueToChangeName,
  adoptIssue,
  normalizeIssueRef,
} from "./issue.js";
import type { Ctx } from "./stages.js";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const DB = process.env.SDLC_DB ?? ".sdlc/runs.db";

// One stdin reader for the session, with a line queue so buffered/piped answers aren't
// dropped between prompts (readline.question loses lines that arrive before the next call).
let rl: ReturnType<typeof createInterface> | undefined;
const lineQueue: string[] = [];
const lineWaiters: ((line: string) => void)[] = [];

function readLine(): Promise<string> {
  if (!rl) {
    rl = createInterface({ input: process.stdin });
    rl.on("line", (l) => {
      const waiter = lineWaiters.shift();
      if (waiter) waiter(l);
      else lineQueue.push(l);
    });
  }
  const queued = lineQueue.shift();
  if (queued !== undefined) return Promise.resolve(queued);
  return new Promise((resolve) => lineWaiters.push(resolve));
}

/** Print a prompt and read a single y/N answer. */
async function confirm(question: string): Promise<boolean> {
  process.stdout.write(question);
  return /^y(es)?$/i.test((await readLine()).trim());
}

/** Close the shared reader so the process can exit. */
function closePrompts(): void {
  rl?.close();
  rl = undefined;
}

/** Print the "what happened / what to verify" summary and prompt to continue. */
async function askGate(p: GatePrompt): Promise<boolean> {
  console.log(`\n── ${p.gate ?? "build-result (validate failed)"} ──`);
  if (p.changeName) console.log(`  change:  ${p.changeName}`);
  if (p.done?.length) console.log(`  done:    ${p.done.join(" → ")}`);
  if (p.reason) console.log(`  problem: ${p.reason} (attempt ${p.attempts})`);
  console.log(`  verify:  ${p.verify ?? "review the run so far"}`);
  return confirm(`  approve & continue? [y/N] `);
}

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

async function dispatch() {
  const argv = process.argv.slice(2);
  const auto = parseAuto(argv);
  const interactive = argv.includes("-i") || argv.includes("--interactive");
  const flags = new Set(["--auto", "-i", "--interactive"]);
  const [cmd, ...rest] = argv.filter(
    (x) => !flags.has(x) && !x.startsWith("--auto="),
  );
  const mastra = createEngine(DB);

  // Interactive: drive the run in this terminal, prompting at each gate (no `resume` command).
  const begin = (changeName: string, brief: string) =>
    interactive
      ? runInteractive(mastra, changeName, brief, auto, askGate)
      : startRun(mastra, changeName, brief, auto);

  if (!cmd) {
    console.error(
      "usage: sdlc <change-name> [--auto[=pr]] [-i] | sdlc --issue <n> [--auto[=pr]] [-i] | sdlc resume <id> [--approve|--reject] | sdlc ls",
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
    const { runId, result } = await begin(changeName, issue.body);
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
  const { runId, result } = await begin(cmd, "");
  printResult(runId, result);
}

async function main() {
  try {
    await dispatch();
  } finally {
    closePrompts(); // release stdin so the process can exit
  }
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
