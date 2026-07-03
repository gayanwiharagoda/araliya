import { z } from "zod";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { runShell, isDryRun, runGated } from "./shell.js";
import { runSkill } from "./agent.js";
import { allTasksChecked } from "./artifacts.js";

/**
 * SDLC stage graph (ADR 0010). Every stage appends its id to `trace` — the proof
 * of a deterministic control plane: a given input yields the same ordered trace,
 * and a replayed run reaches the same terminal trace.
 *
 * Deterministic stages (sync/validate/release/archive) shell real tooling and gate
 * on exit codes. `build` is a thin agent over the `/opsx:apply` skill (subscription);
 * propose/review/commit-pr stay no-op until group 4. `SDLC_DRY_RUN=1` skips all
 * subprocess/agent execution so the control-plane tests stay hermetic and token-free.
 */
export const Ctx = z.object({
  changeName: z.string(),
  // Working directory for this run — the run's git worktree, or repo root in dry-run.
  cwd: z.string(),
  trace: z.array(z.string()),
  validatePassed: z.boolean(),
  attempts: z.number(),
});
export type Ctx = z.infer<typeof Ctx>;

const GateResume = z.object({ approved: z.boolean() });
const GateSuspend = z.object({ gate: z.string(), changeName: z.string() });

/** A deterministic pass-through stage that records itself in the trace. */
const noop = (id: string) =>
  createStep({
    id,
    inputSchema: Ctx,
    outputSchema: Ctx,
    execute: async ({ inputData }) => ({
      ...inputData,
      trace: [...inputData.trace, id],
    }),
  });

/**
 * A human gate: first execution suspends; resuming with `{ approved: true }`
 * proceeds, `{ approved: false }` fails the run (stops before the next stage).
 * Groups 5 replaces the merge/release gates with `gh` PR-merge polling.
 */
const gate = (id: string) =>
  createStep({
    id,
    inputSchema: Ctx,
    outputSchema: Ctx,
    resumeSchema: GateResume,
    suspendSchema: GateSuspend,
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData)
        return await suspend({ gate: id, changeName: inputData.changeName });
      if (!resumeData.approved) throw new Error(`${id}: rejected`);
      return { ...inputData, trace: [...inputData.trace, `${id}:approved`] };
    },
  });

/**
 * A deterministic stage that shells out to real tooling and gates on exit code:
 * a non-zero exit fails the run. Dry-run records the stage without executing.
 */
const shellStage = (id: string, cmd: (ctx: Ctx) => string) =>
  createStep({
    id,
    inputSchema: Ctx,
    outputSchema: Ctx,
    execute: async ({ inputData }) => {
      if (!isDryRun()) runGated(id, cmd(inputData), inputData.cwd);
      return { ...inputData, trace: [...inputData.trace, id] };
    },
  });

// ponytail: live release-please needs GITHUB_TOKEN + repo url (outward-facing,
// deferred to groups 3–5). The stage is wired and exit-code-gated now; supply
// SDLC_REPO_URL + GITHUB_TOKEN via env to run it for real.
const releaseCmd = () =>
  `npx release-please release-pr --repo-url="${process.env.SDLC_REPO_URL ?? ""}" --token="${process.env.GITHUB_TOKEN ?? ""}"`;

const archiveCmd = (ctx: Ctx) =>
  `openspec archive ${ctx.changeName} -y && pnpm openspec:sync`;

const build = createStep({
  id: "build",
  inputSchema: Ctx,
  outputSchema: Ctx,
  // Thin agent: delegate to the /opsx:apply skill (subscription-billed). We ignore
  // its self-report — success is decided by `validate` below, not the model.
  execute: async ({ inputData }) => {
    if (!isDryRun()) {
      runSkill(`/opsx:apply ${inputData.changeName}`, {
        allowedTools: [
          "Read",
          "Edit",
          "Write",
          "Glob",
          "Grep",
          "Bash",
          "Skill",
          "TodoWrite",
        ],
        disallowedTools: ["Bash(git push:*)", "Bash(gh:*)"], // build must not push
        maxTurns: 200,
        cwd: inputData.cwd,
      });
    }
    return {
      ...inputData,
      trace: [...inputData.trace, "build"],
      attempts: inputData.attempts + 1,
    };
  },
});

const validate = createStep({
  id: "validate",
  inputSchema: Ctx,
  outputSchema: Ctx,
  // Artifacts, not self-report: build is done only when every tasks.md box is
  // checked AND `pnpm validate` exits 0. This is the branch signal for the loop.
  execute: async ({ inputData }) => {
    const passed = isDryRun()
      ? true
      : allTasksChecked(inputData.changeName, inputData.cwd) &&
        runShell("pnpm validate", inputData.cwd).code === 0;
    return {
      ...inputData,
      trace: [...inputData.trace, "validate"],
      validatePassed: passed,
    };
  },
});

/**
 * Escalation gate (task 3.6): if validate still fails after the retry budget,
 * suspend with the failure context for a human. Distinct from the 3 approval gates.
 */
const buildResult = createStep({
  id: "build-result",
  inputSchema: Ctx,
  outputSchema: Ctx,
  resumeSchema: z.object({ proceed: z.boolean() }),
  suspendSchema: z.object({ reason: z.string(), attempts: z.number() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (inputData.validatePassed)
      return { ...inputData, trace: [...inputData.trace, "build-result"] };
    if (!resumeData)
      return await suspend({
        reason: "validate failed after 3 build attempts",
        attempts: inputData.attempts,
      });
    return {
      ...inputData,
      trace: [...inputData.trace, "build-result:override"],
    };
  },
});

/** The build↔validate retry edge: repeat until validate passes or 3 attempts. */
const buildValidate = createWorkflow({
  id: "build-validate",
  inputSchema: Ctx,
  outputSchema: Ctx,
})
  .then(build)
  .then(validate)
  .commit();

export const sdlcWorkflow = createWorkflow({
  id: "sdlc",
  inputSchema: Ctx,
  outputSchema: Ctx,
})
  .then(noop("propose"))
  .then(gate("plan-gate"))
  .then(shellStage("sync", () => "pnpm openspec:sync"))
  .dountil(
    buildValidate,
    async ({ inputData }) =>
      inputData.validatePassed || inputData.attempts >= 3,
  )
  .then(buildResult)
  .then(noop("review"))
  .then(noop("commit-pr"))
  .then(gate("merge-gate"))
  .then(shellStage("release", releaseCmd))
  .then(gate("release-gate"))
  .then(shellStage("archive", archiveCmd))
  .commit();

/** Initial context for a fresh run. */
export const initialCtx = (changeName: string, cwd: string): Ctx => ({
  changeName,
  cwd,
  trace: [],
  validatePassed: false,
  attempts: 0,
});
