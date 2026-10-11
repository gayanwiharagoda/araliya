import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, isDryRun } from "./shell.js";
import { log } from "./log.js";

/**
 * Thin agent layer. Agent stages own NO logic — each just invokes an existing
 * skill (`/opsx:apply`, `/opsx:propose`, ...) headless, scoped to per-stage tools.
 *
 * Provider selection:
 *   claude (default) → Claude Code subscription (`claude -p`)
 *   pi               → local harness via the `pi` CLI (e.g. `--provider kimi`)
 *
 * Behaviour lives in the skills, which already match this repo's tools/architecture.
 */

/** Fail fast so a stray API key can't silently move Claude stages onto API billing. */
export function assertNoApiKey(): void {
  if (process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is set. Unset it so agent stages bill to your Claude subscription, not the API.",
    );
  }
}

export function agentProvider(): string {
  return process.env.SDLC_AGENT_PROVIDER ?? "claude";
}

export interface SkillOptions {
  /** Per-stage tool scope, e.g. ["Read","Edit","Write","Bash","Skill"]. */
  allowedTools?: string[];
  /** Tools this stage must never use, e.g. ["Bash(git push:*)","Bash(gh:*)"]. */
  disallowedTools?: string[];
  maxTurns?: number;
  model?: string;
  /** Run as a named agent (`.claude/agents/<name>.md`) — its body becomes the system prompt. */
  agent?: string;
  cwd?: string;
}

/** Read an agent markdown file and return the body (after the YAML frontmatter). */
export function readAgentBody(name: string): string {
  const path = join(repoRoot(), ".claude", "agents", `${name}.md`);
  const text = readFileSync(path, "utf-8");
  const match = text.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return (match?.[1] ?? text).trim();
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

const PI_TOOL_MAP: Record<string, string> = {
  Read: "read",
  Edit: "edit",
  Write: "write",
  Bash: "bash",
};

function toPiTool(name: string): string | undefined {
  return PI_TOOL_MAP[name];
}

const PI_SKILL_MAP: Record<string, string> = {
  propose: "openspec-propose",
  apply: "openspec-apply-change",
};

/** Parse a `/opsx:<skill>` command from the start of the prompt. */
function parsePiSkill(
  prompt: string,
  cwd: string,
): { skillPath?: string; prompt: string } {
  const match = prompt.match(/^\/opsx:(\S+)(?:\s+|\n)?([\s\S]*)$/);
  if (!match) return { prompt };
  const skill = match[1] ? PI_SKILL_MAP[match[1]] : undefined;
  if (!skill) return { prompt };
  return {
    skillPath: join(cwd, ".agents", "skills", skill),
    prompt: match[2]?.trim() ?? "",
  };
}

/** Pure: build the `pi` argv for a skill invocation. */
export function buildPiArgs(
  prompt: string,
  opts: SkillOptions = {},
  agentBody = "You are a helpful coding assistant.",
): string[] {
  const cwd = opts.cwd ?? repoRoot();
  const { skillPath, prompt: userPrompt } = parsePiSkill(prompt, cwd);
  const args = [
    "--provider",
    process.env.SDLC_PI_PROVIDER ?? "kimi",
    "--print",
  ];
  if (skillPath) args.push("--skill", skillPath);
  args.push("--system-prompt", agentBody);
  const tools = opts.allowedTools
    ?.map(toPiTool)
    .filter((t): t is string => t !== undefined) ?? [
    "read",
    "bash",
    "edit",
    "write",
  ];
  if (tools.length) args.push("--tools", tools.join(","));
  // pi does not support --disallowedTools; push denial is enforced by the system prompt.
  args.push(userPrompt || prompt);
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
/** Last two path segments — enough context without the long absolute prefix. */
const shortPath = (p: string): string => p.split("/").slice(-2).join("/");

/** A meaningful one-liner for a tool call — the key arg, not the whole input blob. */
function toolSummary(name = "?", input: Record<string, unknown> = {}): string {
  const s = (k: string): string =>
    typeof input[k] === "string" ? (input[k] as string) : "";
  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
    case "NotebookEdit": {
      const p = s("file_path") || s("notebook_path");
      return p ? `${name} ${shortPath(p)}` : name;
    }
    case "Bash":
      return `Bash ${trunc(oneLine(s("command")), 80)}`;
    case "Grep":
      return `Grep ${s("pattern")}${input.path ? ` in ${shortPath(s("path"))}` : ""}`;
    case "Glob":
      return `Glob ${s("pattern")}`;
    case "Skill":
      return `Skill ${s("command") || s("name")}`.trim();
    case "Task":
      return `Task ${s("description") || s("subagent_type")}`.trim();
    case "TodoWrite":
      return `TodoWrite (${Array.isArray(input.todos) ? input.todos.length : "?"} todos)`;
    default:
      return `${name} ${trunc(oneLine(JSON.stringify(input)), 60)}`.trim();
  }
}

/** tool_result content is a string or an array of content blocks — pull out the text. */
function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .map((c) =>
        c && typeof c === "object" && "text" in c
          ? String((c as { text: unknown }).text)
          : "",
      )
      .join("\n");
  return content == null ? "" : JSON.stringify(content);
}

/** Summarize a tool result: show short output/errors inline, collapse big dumps to a count. */
function resultSummary(content: unknown, isError?: boolean): string {
  const body = resultText(content).trim();
  if (isError) return `⚠️  ${trunc(oneLine(body), 120)}`;
  const lines = body ? body.split("\n").length : 0;
  return lines <= 2 && body.length <= 120
    ? `↳ ${oneLine(body) || "ok"}`
    : `↳ ${lines} lines`;
}

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
            `🔧 ${toolSummary(c.name, c.input as Record<string, unknown>)}`,
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
      return `   ${resultSummary(r.content, r.is_error)}`;
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

/** Spawn `pi`, streaming its plain-text output line by line. */
function streamPi(args: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("pi", args, { cwd });
    createInterface({ input: child.stdout }).on("line", (line) => {
      if (!line.trim()) return;
      log.info(line);
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
  const provider = agentProvider();
  if (provider === "claude") assertNoApiKey();
  if (isDryRun()) return { code: 0, json: { dryRun: true }, raw: "" };
  const cwd = opts.cwd ?? repoRoot();

  if (provider === "claude") {
    assertNoApiKey();
    const code = await streamClaude(buildClaudeArgs(prompt, opts), cwd);
    return { code, json: undefined, raw: "" };
  }

  if (provider === "pi") {
    const body = opts.agent
      ? readAgentBody(opts.agent)
      : "You are a helpful coding assistant.";
    const code = await streamPi(buildPiArgs(prompt, opts, body), cwd);
    return { code, json: undefined, raw: "" };
  }

  throw new Error(`unknown agent provider: ${provider}`);
}
