import { runShellArgs, isDryRun } from "./shell.js";
import { assertNoApiKey, readAgentBody } from "./agent.js";

/**
 * Model-agnostic text completion for the reasoning stages (review, commit-msg),
 * dependency-free. Per-stage policy (task 4.4): agentic stages stay pinned to
 * the configured provider; cheap reasoning stages swap via `SDLC_MODEL_<STAGE>`.
 *
 *   claude[/<model>]   → `claude -p` on the subscription (no API key)
 *   pi[/<model>]       → local `pi` harness (e.g. `--provider kimi`)
 *   ollama/<model>     → local Ollama HTTP (no key)
 *   openai/<model>     → OpenAI API (needs OPENAI_API_KEY — a different vendor)
 */
export function stageModel(stage: string, fallback = "claude"): string {
  const key = `SDLC_MODEL_${stage.toUpperCase().replace(/-/g, "_")}`;
  return process.env[key] ?? fallback;
}

export function parseModel(spec: string): { provider: string; name?: string } {
  const parts = spec.split("/");
  return {
    provider: parts[0] ?? spec,
    name: parts.slice(1).join("/") || undefined,
  };
}

export interface ModelOptions {
  /** Run the call as a named agent (`.claude/agents/<name>.md`) — its body becomes the system prompt. */
  agent?: string;
  cwd?: string;
}

export async function runModel(
  prompt: string,
  spec = "claude",
  opts: ModelOptions = {},
): Promise<string> {
  if (isDryRun()) return JSON.stringify({ dryRun: true, verdict: "approve" });
  const { provider, name } = parseModel(spec);

  if (provider === "claude") {
    assertNoApiKey();
    const args = ["-p", prompt, "--output-format", "json"];
    if (name) args.push("--model", name);
    if (opts.agent) args.push("--agent", opts.agent);
    const { stdout } = runShellArgs("claude", args, opts.cwd);
    try {
      return (JSON.parse(stdout) as { result?: string }).result ?? stdout;
    } catch {
      return stdout;
    }
  }

  if (provider === "pi") {
    const args = [
      "--provider",
      process.env.SDLC_PI_PROVIDER ?? "kimi",
      "--print",
    ];
    if (name) args.push("--model", name);
    if (opts.agent) args.push("--system-prompt", readAgentBody(opts.agent));
    args.push(prompt);
    const { stdout } = runShellArgs("pi", args, opts.cwd);
    return stdout;
  }

  if (provider === "ollama") {
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: name ?? "llama3",
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });
    return (
      ((await res.json()) as { message?: { content?: string } }).message
        ?.content ?? ""
    );
  }

  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY required for openai/* models");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: name ?? "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }

  throw new Error(`unknown model provider: ${provider}`);
}
