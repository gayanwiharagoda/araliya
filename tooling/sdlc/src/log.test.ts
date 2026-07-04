import { describe, it, expect } from "vitest";
import { LogLevel } from "@mastra/core/logger";
import { resolveLevel } from "./log.js";

describe("log level resolution", () => {
  it("defaults to INFO when unset or unknown", () => {
    expect(resolveLevel(undefined)).toBe(LogLevel.INFO);
    expect(resolveLevel("bogus")).toBe(LogLevel.INFO);
  });

  it("maps known names (case-insensitive)", () => {
    expect(resolveLevel("debug")).toBe(LogLevel.DEBUG);
    expect(resolveLevel("DEBUG")).toBe(LogLevel.DEBUG);
    expect(resolveLevel("none")).toBe(LogLevel.NONE);
  });
});
