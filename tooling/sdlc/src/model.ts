import { runShellArgs, isDryRun } from "./shell.js";
import { assertNoApiKey } from "./agent.js";

/**
 * Model-agnostic text completion for the reasoning stages (review, commit-msg),
 * dependency-free. Per-stage policy (task 4.4): agentic stages stay pinned to
 * Claude; cheap reasoning stages swap via `SDLC_MODEL_<STAGE>`.
 *
 *   claude[/<model>]   → `claude -p` on the subscription (no API key)
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

export async function runModel(
  prompt: string,
  spec = "claude",
): Promise<string> {
  if (isDryRun()) return JSON.stringify({ dryRun: true, verdict: "approve" });
  const { provider, name } = parseModel(spec);

  if (provider === "claude") {
    assertNoApiKey();
    const args = ["-p", prompt, "--output-format", "json"];
    if (name) args.push("--model", name);
    const { stdout } = runShellArgs("claude", args);
    try {
      return (JSON.parse(stdout) as { result?: string }).result ?? stdout;
    } catch {
      return stdout;
    }
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
