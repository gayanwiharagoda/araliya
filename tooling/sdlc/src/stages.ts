import { z } from "zod";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { runShell, repoRoot, isDryRun, runGated } from "./shell.js";

/**
 * SDLC stage graph (ADR 0010). Every stage appends its id to `trace` — the proof
 * of a deterministic control plane: a given input yields the same ordered trace,
 * and a replayed run reaches the same terminal trace.
 *
 * Group 2 wires the deterministic stages (sync/validate/release/archive) to real
 * tooling, gating on exit codes. The agent stages (propose/build/review/commit-pr)
 * stay no-op pass-throughs until groups 3–4. `SDLC_DRY_RUN=1` skips subprocess
 * execution so the control-plane tests stay hermetic and token-free.
 */
export const Ctx = z.object({
  changeName: z.string(),
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
      if (!isDryRun()) runGated(id, cmd(inputData));
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
  execute: async ({ inputData }) => ({
    ...inputData,
    trace: [...inputData.trace, "build"],
    attempts: inputData.attempts + 1,
  }),
});

const validate = createStep({
  id: "validate",
  inputSchema: Ctx,
  outputSchema: Ctx,
  // Exit code of `pnpm validate` drives the branch signal; the dountil loop retries
  // build↔validate. ponytail: after 3 failed attempts the loop currently proceeds;
  // task 3.6 changes that to suspend for a human with the accumulated failure log.
  execute: async ({ inputData }) => ({
    ...inputData,
    trace: [...inputData.trace, "validate"],
    validatePassed: isDryRun()
      ? true
      : runShell("pnpm validate", repoRoot()).code === 0,
  }),
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
  .then(noop("review"))
  .then(noop("commit-pr"))
  .then(gate("merge-gate"))
  .then(shellStage("release", releaseCmd))
  .then(gate("release-gate"))
  .then(shellStage("archive", archiveCmd))
  .commit();

/** Initial context for a fresh run. */
export const initialCtx = (changeName: string): Ctx => ({
  changeName,
  trace: [],
  validatePassed: false,
  attempts: 0,
});
