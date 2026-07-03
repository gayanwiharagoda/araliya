import { describe, it, expect } from "vitest";
import { issueToChangeName, markerFor, withMarker } from "./issue.js";

describe("issue → change name", () => {
  it("kebab-cases an issue title", () => {
    expect(issueToChangeName("Add Dark Mode toggle")).toBe(
      "add-dark-mode-toggle",
    );
  });

  it("strips punctuation and collapses separators", () => {
    expect(issueToChangeName("  Fix: login (500) error!! ")).toBe(
      "fix-login-500-error",
    );
  });

  it("falls back for an empty/symbol-only title", () => {
    expect(issueToChangeName("!!!")).toBe("change");
  });
});

describe("sync marker adoption", () => {
  it("prepends the openspec marker so sync adopts the issue", () => {
    expect(withMarker("Some feature request", "add-dark-mode")).toBe(
      "<!-- openspec:add-dark-mode -->\nSome feature request",
    );
  });

  it("is idempotent — never double-marks", () => {
    const once = withMarker("body", "demo");
    expect(withMarker(once, "demo")).toBe(once);
  });

  it("marker format matches the sync script contract", () => {
    expect(markerFor("demo")).toBe("<!-- openspec:demo -->");
  });
});
