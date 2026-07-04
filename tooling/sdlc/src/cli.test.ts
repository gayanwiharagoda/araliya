import { describe, it, expect } from "vitest";
import { parseAuto } from "./cli.js";

describe("--auto flag parsing", () => {
  it("defaults to off when absent", () => {
    expect(parseAuto(["my-change"])).toBe("off");
  });

  it("bare --auto means full", () => {
    expect(parseAuto(["my-change", "--auto"])).toBe("full");
  });

  it("--auto=pr means pr", () => {
    expect(parseAuto(["--auto=pr", "my-change"])).toBe("pr");
  });

  it("rejects an unknown target (input validation)", () => {
    expect(() => parseAuto(["--auto=nope"])).toThrow(/expects 'pr' or 'full'/);
  });
});
