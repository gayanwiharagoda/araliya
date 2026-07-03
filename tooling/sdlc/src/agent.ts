import { runShellArgs, repoRoot, isDryRun } from "./shell.js";

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
    "--output-format",
    "json",
    "--permission-mode",
    "acceptEdits",
  ];
  if (opts.allowedTools?.length)
    args.push("--allowedTools", opts.allowedTools.join(","));
  if (opts.disallowedTools?.length)
    args.push("--disallowedTools", opts.disallowedTools.join(","));
  if (opts.maxTurns) args.push("--max-turns", String(opts.maxTurns));
  if (opts.model) args.push("--model", opts.model);
  return args;
}

export interface AgentResult {
  code: number;
  json: unknown;
  raw: string;
}

/**
 * Invoke a skill. Returns the raw result — callers decide success from
 * deterministic artifacts (tasks.md checkoff, `pnpm validate`, `gh pr` state),
 * NEVER from this return value. Dry-run short-circuits so no budget is spent in tests.
 */
export function runSkill(prompt: string, opts: SkillOptions = {}): AgentResult {
  assertNoApiKey();
  if (isDryRun()) return { code: 0, json: { dryRun: true }, raw: "" };
  const { code, stdout, stderr } = runShellArgs(
    "claude",
    buildClaudeArgs(prompt, opts),
    opts.cwd ?? repoRoot(),
  );
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    json = undefined;
  }
  return { code, json, raw: stdout || stderr };
}
