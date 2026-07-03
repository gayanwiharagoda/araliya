import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runShell } from "./shell.js";
import { createWorktree, removeWorktree } from "./worktree.js";

let root: string | undefined;

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

function tempRepo(): string {
  const r = mkdtempSync(join(tmpdir(), "sdlc-wt-"));
  runShell(
    "git init -q && git config user.email t@t.co && git config user.name t",
    r,
  );
  runShell("git commit -q --allow-empty -m init", r);
  return r;
}

describe("worktree isolation", () => {
  it("creates a per-change worktree and branch, then removes it", () => {
    root = tempRepo();
    const dir = createWorktree("demo", root);
    expect(existsSync(dir)).toBe(true);
    expect(runShell("git worktree list", root).stdout).toContain(dir);
    expect(runShell("git branch --list sdlc/demo", root).stdout).toContain(
      "sdlc/demo",
    );

    removeWorktree(dir, root);
    expect(existsSync(dir)).toBe(false);
  });
});
