import { describe, it, expect } from "vitest";

describe("tasks schema", () => {
  it("schema module exports a default schema", async () => {
    const schema = await import("../schema");
    expect(schema.default).toBeDefined();
  });
});
