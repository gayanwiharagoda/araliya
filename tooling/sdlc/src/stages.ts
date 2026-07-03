import { z } from "zod";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { runShell, isDryRun, runGated } from "./shell.js";
import { runSkill } from "./agent.js";
import { runModel, stageModel } from "./model.js";
import { allTasksChecked } from "./artifacts.js";

/**
 * SDLC stage graph (ADR 0010). Every stage appends its id to `trace` — the proof
 * of a deterministic control plane: a given input yields the same ordered trace,
 * and a replayed run reaches the same terminal trace.
 *
 * Deterministic stages (sync/validate/release/archive) shell real tooling and gate
 * on exit codes. Agent stages are thin: propose/build reuse the `/opsx:*` skills on
 * the Claude subscription; review/commit-pr are model-swappable reasoning calls
 * (see model.ts). `SDLC_DRY_RUN=1` skips all subprocess/agent/model execution so the
 * control-plane tests stay hermetic and token-free.
 */
export const Ctx = z.object({
  changeName: z.string(),
  // Working directory for this run — the run's git worktree, or repo root in dry-run.
  cwd: z.string(),
  // Issue-driven context fed to `/opsx:propose`; empty for name-only runs.
  brief: z.string(),
  trace: z.array(z.string()),
  validatePassed: z.boolean(),
  attempts: z.number(),
});
export type Ctx = z.infer<typeof Ctx>;

const GateResume = z.object({ approved: z.boolean() });
const GateSuspend = z.object({ gate: z.string(), changeName: z.string() });

/** First JSON object in a model's text response (models often wrap it in prose). */
const extractJson = (s: string): string => s.match(/\{[\s\S]*\}/)?.[0] ?? s;

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

const AGENT_TOOLS = [
  "Read",
  "Edit",
  "Write",
  "Glob",
  "Grep",
  "Bash",
  "Skill",
  "TodoWrite",
];
const NO_PUSH = ["Bash(git push:*)", "Bash(gh:*)"];

// Thin agent: the /opsx:propose skill writes proposal/specs/tasks. Claude-pinned
// (agentic, edits files). The human reviews at the plan gate that follows.
const propose = createStep({
  id: "propose",
  inputSchema: Ctx,
  outputSchema: Ctx,
  execute: async ({ inputData }) => {
    if (!isDryRun()) {
      // The issue detail becomes the spec context; from here OpenSpec drives the run.
      const prompt = inputData.brief.trim()
        ? `/opsx:propose ${inputData.changeName}\n\nContext from the GitHub issue:\n${inputData.brief}`
        : `/opsx:propose ${inputData.changeName}`;
      runSkill(prompt, {
        allowedTools: AGENT_TOOLS,
        disallowedTools: NO_PUSH,
        maxTurns: 100,
        cwd: inputData.cwd,
      });
    }
    return { ...inputData, trace: [...inputData.trace, "propose"] };
  },
});

// Reasoning stage, model-swappable (SDLC_MODEL_REVIEW → claude|ollama|openai).
// Emits a verdict JSON we parse deterministically; the human decides at the merge
// gate. An unparseable verdict fails the stage (artifacts, not vibes).
const review = createStep({
  id: "review",
  inputSchema: Ctx,
  outputSchema: Ctx,
  execute: async ({ inputData }) => {
    if (!isDryRun()) {
      const diff = runShell("git diff HEAD~1", inputData.cwd).stdout;
      const out = await runModel(
        `Review this diff. Respond ONLY with JSON {"verdict":"approve"|"request-changes","notes":string}.\n\n${diff}`,
        stageModel("review"),
      );
      JSON.parse(extractJson(out));
    }
    return { ...inputData, trace: [...inputData.trace, "review"] };
  },
});

// Commit message from a cheap/swappable model; commit + PR are deterministic.
// Success = commitlint passes AND `gh pr view` returns a PR. Outward-facing
// (git/gh), so it runs only outside dry-run — the operator drives the first live one.
const commitPr = createStep({
  id: "commit-pr",
  inputSchema: Ctx,
  outputSchema: Ctx,
  execute: async ({ inputData }) => {
    if (!isDryRun()) {
      runGated("stage", "git add -A", inputData.cwd);
      const diff = runShell("git diff --cached", inputData.cwd).stdout;
      const raw = await runModel(
        `Write a single Conventional Commit subject line (<=72 chars) for change "${inputData.changeName}". Reply with only the line.\n\n${diff}`,
        stageModel("commit-pr"),
      );
      const subject = raw.trim().split("\n")[0];
      runGated(
        "commitlint",
        `printf '%s' ${JSON.stringify(subject)} | pnpm exec commitlint`,
        inputData.cwd,
      );
      runGated(
        "commit",
        `git commit -m ${JSON.stringify(subject)}`,
        inputData.cwd,
      );
      runGated(
        "pr",
        `gh pr create --fill --head sdlc/${inputData.changeName}`,
        inputData.cwd,
      );
      if (runShell("gh pr view --json number", inputData.cwd).code !== 0)
        throw new Error("commit-pr: no PR created");
    }
    return { ...inputData, trace: [...inputData.trace, "commit-pr"] };
  },
});

const build = createStep({
  id: "build",
  inputSchema: Ctx,
  outputSchema: Ctx,
  // Thin agent: delegate to the /opsx:apply skill (subscription-billed). We ignore
  // its self-report — success is decided by `validate` below, not the model.
  execute: async ({ inputData }) => {
    if (!isDryRun()) {
      runSkill(`/opsx:apply ${inputData.changeName}`, {
        allowedTools: AGENT_TOOLS,
        disallowedTools: NO_PUSH, // build must not push
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
  .then(propose)
  .then(gate("plan-gate"))
  .then(shellStage("sync", () => "pnpm openspec:sync"))
  .dountil(
    buildValidate,
    async ({ inputData }) =>
      inputData.validatePassed || inputData.attempts >= 3,
  )
  .then(buildResult)
  .then(review)
  .then(commitPr)
  .then(gate("merge-gate"))
  .then(shellStage("release", releaseCmd))
  .then(gate("release-gate"))
  .then(shellStage("archive", archiveCmd))
  .commit();

/** Initial context for a fresh run. */
export const initialCtx = (
  changeName: string,
  cwd: string,
  brief = "",
): Ctx => ({
  changeName,
  cwd,
  brief,
  trace: [],
  validatePassed: false,
  attempts: 0,
});
