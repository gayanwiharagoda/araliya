import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { repoRoot, isDryRun } from "./shell.js";
import { log } from "./log.js";

/**
 * Thin agent layer. Agent stages own NO logic — each just invokes an existing
 * Claude Code skill (`/opsx:apply`, `/opsx:propose`, `/code-review`, …) headless
 * via `claude -p`, scoped to per-stage tools. All behaviour lives in the skills,
 * which already match this repo's tools/architecture. Billing is the Claude
 * subscription (the CLI's OAuth) — never an API key.
 */

/** Fail fast so a stray API key can't silently move agent runs onto API billing. */
export function assertNoApiKey(): void {
  if (process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is set. Unset it so agent stages bill to your Claude subscription, not the API.",
    );
  }
}

export interface SkillOptions {
  /** Per-stage tool scope, e.g. ["Read","Edit","Write","Bash","Skill"]. */
  allowedTools?: string[];
  /** Tools this stage must never use, e.g. ["Bash(git push:*)","Bash(gh:*)"]. */
  disallowedTools?: string[];
  maxTurns?: number;
  model?: string;
  /** Run as a named subagent (`.claude/agents/<name>.md`) — pins its model + tool scope. */
  agent?: string;
  cwd?: string;
}

/** Pure: build the `claude -p` argv for a skill invocation (unit-testable, no side effects). */
export function buildClaudeArgs(
  prompt: string,
  opts: SkillOptions = {},
): string[] {
  const args = [
    "-p",
    prompt,
    // stream-json (+ --verbose, required in print mode) emits NDJSON events as the
    // agent works, so a long propose/build streams live instead of buffering silently.
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "acceptEdits",
  ];
  if (opts.allowedTools?.length)
    args.push("--allowedTools", opts.allowedTools.join(","));
  if (opts.disallowedTools?.length)
    args.push("--disallowedTools", opts.disallowedTools.join(","));
  if (opts.maxTurns) args.push("--max-turns", String(opts.maxTurns));
  if (opts.model) args.push("--model", opts.model);
  // The subagent's frontmatter carries the model + tool scope; no --model needed.
  if (opts.agent) args.push("--agent", opts.agent);
  return args;
}

export interface AgentResult {
  code: number;
  json: unknown;
  raw: string;
}

const oneLine = (s: string): string => s.replace(/\s+/g, " ").trim();
const trunc = (s: string, n = 200): string =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;

/**
 * Turn one `claude` stream-json event into a readable one-liner (or null to drop it).
 * Keeps the live agent feed legible instead of dumping raw NDJSON. Exported for testing.
 */
export function formatEvent(e: {
  type?: string;
  subtype?: string;
  model?: string;
  tools?: unknown[];
  is_error?: boolean;
  num_turns?: number;
  duration_ms?: number;
  message?: {
    content?: {
      type?: string;
      text?: string;
      name?: string;
      input?: unknown;
      content?: unknown;
      is_error?: boolean;
    }[];
  };
}): string | null {
  switch (e.type) {
    case "system":
      return e.subtype === "init"
        ? `⚙  ${e.model ?? "?"} · ${e.tools?.length ?? 0} tools`
        : null;
    case "assistant": {
      const lines = (e.message?.content ?? []).flatMap((c) => {
        if (c.type === "text" && c.text?.trim())
          return [`💬 ${trunc(oneLine(c.text))}`];
        if (c.type === "tool_use")
          return [
            `🔧 ${c.name} ${trunc(oneLine(JSON.stringify(c.input ?? {})), 100)}`,
          ];
        return [];
      });
      return lines.length ? lines.join("\n") : null;
    }
    case "user": {
      const r = (e.message?.content ?? []).find(
        (c) => c.type === "tool_result",
      );
      if (!r) return null;
      const body =
        typeof r.content === "string" ? r.content : JSON.stringify(r.content);
      return `   ${r.is_error ? "⚠️  " : "↳ "}${trunc(oneLine(body), 120)}`;
    }
    case "result": {
      const turns = e.num_turns ?? "?";
      if (e.is_error || e.subtype?.startsWith("error"))
        return `✗ failed (${turns} turns${e.subtype ? `, ${e.subtype}` : ""})`;
      return `✓ done (${turns} turns, ${Math.round((e.duration_ms ?? 0) / 1000)}s)`;
    }
    default:
      return null;
  }
}

/** Spawn `claude`, formatting its stream-json to readable lines as they arrive. */
function streamClaude(args: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("claude", args, { cwd });
    createInterface({ input: child.stdout }).on("line", (line) => {
      if (!line.trim()) return;
      let evt;
      try {
        evt = JSON.parse(line);
      } catch {
        return; // non-JSON noise (e.g. a stray log line) — skip
      }
      // Pretty line at info; the raw event only surfaces at SDLC_LOG_LEVEL=debug.
      const out = formatEvent(evt);
      if (out) log.info(out);
      else log.debug(line);
    });
    child.stderr.on("data", (d: Buffer) => log.error(d.toString().trimEnd()));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/**
 * Invoke a skill. Returns the (empty) result — callers decide success from
 * deterministic artifacts (tasks.md checkoff, `pnpm validate`, `gh pr` state),
 * NEVER from this return value. Dry-run short-circuits so no budget is spent in tests.
 */
export async function runSkill(
  prompt: string,
  opts: SkillOptions = {},
): Promise<AgentResult> {
  assertNoApiKey();
  if (isDryRun()) return { code: 0, json: { dryRun: true }, raw: "" };
  const code = await streamClaude(
    buildClaudeArgs(prompt, opts),
    opts.cwd ?? repoRoot(),
  );
  return { code, json: undefined, raw: "" };
}
