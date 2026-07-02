import { z } from "zod";
import { createStep, createWorkflow } from "@mastra/core/workflows";

/**
 * Walking skeleton (ADR 0010, tasks group 1). Every stage is a deterministic
 * no-op that appends its id to `trace`. The trace is the proof of a
 * deterministic control plane: a given input always yields the same ordered
 * trace, and a replayed run reaches the same terminal trace.
 *
 * ponytail: no models here by design — the skeleton proves suspend/resume/replay
 * with zero token spend. Groups 2–4 swap the no-ops for real tooling/agent calls
 * (sync→`pnpm openspec:sync`, build→`/opsx:apply`, validate→`pnpm validate`, …).
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
  // ponytail: skeleton always passes. Task 2.2 shells `pnpm validate` and sets
  // `validatePassed` from its exit code; task 3.6 caps the retry loop at 3.
  execute: async ({ inputData }) => ({
    ...inputData,
    trace: [...inputData.trace, "validate"],
    validatePassed: true,
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
  .then(noop("sync"))
  .dountil(
    buildValidate,
    async ({ inputData }) =>
      inputData.validatePassed || inputData.attempts >= 3,
  )
  .then(noop("review"))
  .then(noop("commit-pr"))
  .then(gate("merge-gate"))
  .then(noop("release"))
  .then(gate("release-gate"))
  .then(noop("archive"))
  .commit();

/** Initial context for a fresh run. */
export const initialCtx = (changeName: string): Ctx => ({
  changeName,
  trace: [],
  validatePassed: false,
  attempts: 0,
});
