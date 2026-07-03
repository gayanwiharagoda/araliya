import { describe, it, expect, beforeEach } from "vitest";
import { buildClaudeArgs, assertNoApiKey, runSkill } from "./agent.js";

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
    expect(args).toEqual(expect.arrayContaining(["--output-format", "json"]));
    expect(args).toEqual(
      expect.arrayContaining(["--allowedTools", "Read,Edit"]),
    );
    expect(args).toEqual(
      expect.arrayContaining(["--disallowedTools", "Bash(git push:*)"]),
    );
    expect(args).toEqual(expect.arrayContaining(["--max-turns", "200"]));
  });

  it("fails fast when ANTHROPIC_API_KEY is set (subscription-only)", () => {
    process.env.ANTHROPIC_API_KEY = "sk-should-not-be-here";
    expect(() => assertNoApiKey()).toThrow(/ANTHROPIC_API_KEY is set/);
  });

  it("passes when no API key is present", () => {
    expect(() => assertNoApiKey()).not.toThrow();
  });

  it("dry-run short-circuits without spending budget", () => {
    process.env.SDLC_DRY_RUN = "1";
    const r = runSkill("/opsx:apply demo");
    expect(r.code).toBe(0);
    expect(r.json).toEqual({ dryRun: true });
  });
});
