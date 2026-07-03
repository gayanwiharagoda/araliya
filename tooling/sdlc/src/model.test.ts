import { describe, it, expect, beforeEach } from "vitest";
import { stageModel, parseModel, runModel } from "./model.js";

beforeEach(() => {
  delete process.env.SDLC_DRY_RUN;
  delete process.env.SDLC_MODEL_REVIEW;
  delete process.env.OPENAI_API_KEY;
});

describe("per-stage model policy", () => {
  it("defaults to the fallback (Claude) when unset", () => {
    expect(stageModel("review")).toBe("claude");
    expect(stageModel("commit-pr", "claude")).toBe("claude");
  });

  it("honours a SDLC_MODEL_<STAGE> override (swappable reasoning stages)", () => {
    process.env.SDLC_MODEL_REVIEW = "ollama/llama3";
    expect(stageModel("review")).toBe("ollama/llama3");
  });

  it("parses provider/name specs", () => {
    expect(parseModel("claude")).toEqual({
      provider: "claude",
      name: undefined,
    });
    expect(parseModel("ollama/llama3")).toEqual({
      provider: "ollama",
      name: "llama3",
    });
    expect(parseModel("openai/gpt-4o-mini")).toEqual({
      provider: "openai",
      name: "gpt-4o-mini",
    });
  });
});

describe("model router", () => {
  it("dry-run short-circuits without any provider call", async () => {
    process.env.SDLC_DRY_RUN = "1";
    const out = await runModel("review this", "ollama/llama3");
    expect(JSON.parse(out)).toMatchObject({ dryRun: true });
  });

  it("openai/* requires OPENAI_API_KEY (fails before any network call)", async () => {
    await expect(runModel("hi", "openai/gpt-4o-mini")).rejects.toThrow(
      /OPENAI_API_KEY/,
    );
  });

  it("rejects an unknown provider", async () => {
    await expect(runModel("hi", "bogus/model")).rejects.toThrow(
      /unknown model provider/,
    );
  });
});
