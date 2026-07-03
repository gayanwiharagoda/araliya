import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allTasksChecked } from "./artifacts.js";

function fakeChange(tasks: string): string {
  const root = mkdtempSync(join(tmpdir(), "sdlc-art-"));
  const dir = join(root, "openspec", "changes", "demo");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "tasks.md"), tasks);
  return root;
}

describe("artifact-verified build success", () => {
  it("is incomplete while any task box is unchecked", () => {
    const root = fakeChange("- [x] 1.1 done\n- [ ] 1.2 not done\n");
    expect(allTasksChecked("demo", root)).toBe(false);
  });

  it("is complete only when every box is checked", () => {
    const root = fakeChange("- [x] 1.1 done\n- [x] 1.2 done\n");
    expect(allTasksChecked("demo", root)).toBe(true);
  });
});
