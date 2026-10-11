import { createEngine } from "../engine.js";

/**
 * Entry point Mastra Studio (`mastra dev` → localhost:4111) discovers. It binds to the
 * SAME LibSQL file the CLI writes runs to (`SDLC_DB`, default `.sdlc/runs.db`), so Studio
 * shows real run traces/logs — the workflow graph, per-step execution, and suspend/resume
 * state. Read-only observability: drive runs from the terminal (`pnpm sdlc`), not the UI.
 */
export const mastra = createEngine(process.env.SDLC_DB ?? ".sdlc/runs.db");
