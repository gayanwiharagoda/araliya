// ponytail: example integration test proving convex-test works.
// Only write integration tests for complex logic (auth, multi-table, computed fields).
// Delete this file once real complex logic exists.

import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const modules = import.meta.glob("../**/*.ts");

describe("tasks integration", () => {
  it("create then list round-trip", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.tasks.create, { text: "buy milk" });
    const tasks = await t.query(api.tasks.list);
    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task).toBeDefined();
    expect(task?.text).toBe("buy milk");
    expect(task?.isCompleted).toBe(false);
  });
});
