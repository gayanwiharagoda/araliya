import { describe, it, expect, beforeEach } from "vitest";
import {
  buildClaudeArgs,
  assertNoApiKey,
  runSkill,
  formatEvent,
} from "./agent.js";

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.SDLC_DRY_RUN;
});

describe("thin agent layer", () => {
  it("builds headless claude args with per-stage tool scoping", () => {
    const args = buildClaudeArgs("/opsx:apply demo", {
      allowedTools: ["Read", "Edit"],
      disallowedTools: ["Bash(git push:*)"],
      maxTurns: 200,
    });
    expect(args).toContain("-p");
    expect(args).toContain("/opsx:apply demo");
    expect(args).toEqual(
      expect.arrayContaining(["--output-format", "stream-json"]),
    );
    expect(args).toContain("--verbose");
    expect(args).toEqual(
      expect.arrayContaining(["--allowedTools", "Read,Edit"]),
    );
    expect(args).toEqual(
      expect.arrayContaining(["--disallowedTools", "Bash(git push:*)"]),
    );
    expect(args).toEqual(expect.arrayContaining(["--max-turns", "200"]));
  });

  it("routes through a named subagent when opts.agent is set", () => {
    const args = buildClaudeArgs("/opsx:apply demo", { agent: "builder" });
    expect(args).toEqual(expect.arrayContaining(["--agent", "builder"]));
  });

  it("fails fast when ANTHROPIC_API_KEY is set (subscription-only)", () => {
    process.env.ANTHROPIC_API_KEY = "sk-should-not-be-here";
    expect(() => assertNoApiKey()).toThrow(/ANTHROPIC_API_KEY is set/);
  });

  it("passes when no API key is present", () => {
    expect(() => assertNoApiKey()).not.toThrow();
  });

  it("dry-run short-circuits without spending budget", async () => {
    process.env.SDLC_DRY_RUN = "1";
    const r = await runSkill("/opsx:apply demo");
    expect(r.code).toBe(0);
    expect(r.json).toEqual({ dryRun: true });
  });
});

describe("stream-json formatter", () => {
  it("renders each event kind as a readable line", () => {
    expect(
      formatEvent({
        type: "system",
        subtype: "init",
        model: "haiku",
        tools: [1, 2],
      }),
    ).toContain("haiku");
    expect(
      formatEvent({
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", name: "Bash", input: { command: "ls" } },
          ],
        },
      }),
    ).toContain("Bash");
    expect(
      formatEvent({
        type: "result",
        subtype: "success",
        num_turns: 3,
        duration_ms: 1200,
      }),
    ).toMatch(/done/);
    expect(
      formatEvent({ type: "result", is_error: true, num_turns: 2 }),
    ).toMatch(/failed/);
  });

  it("drops events with nothing to show", () => {
    expect(formatEvent({ type: "system", subtype: "other" })).toBeNull();
    expect(formatEvent({ type: "unknown" })).toBeNull();
  });
});
