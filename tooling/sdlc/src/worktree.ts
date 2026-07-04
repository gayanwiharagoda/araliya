import { join } from "node:path";
import { existsSync } from "node:fs";
import { runShell } from "./shell.js";

/**
 * One run = one OpenSpec change = one git worktree/branch, so concurrent runs
 * never share a working tree. Worktrees live under the gitignored `.sdlc/`.
 */
export function createWorktree(changeName: string, root: string): string {
  const dir = join(root, ".sdlc", "worktrees", changeName);
  const branch = `sdlc/${changeName}`;
  const existing = runShell("git worktree list --porcelain", root).stdout;
  if (!existing.includes(dir)) {
    // -B resets the branch if it already exists, so re-runs are idempotent.
    runShell(`git worktree add -B ${branch} ${JSON.stringify(dir)}`, root);
    // A fresh worktree has no node_modules — install so validate/build can run
    // at all (otherwise `pnpm validate` fails with "turbo not found").
    if (existsSync(join(dir, "package.json"))) runShell("pnpm install", dir);
  }
  return dir;
}

export function removeWorktree(dir: string, root: string): void {
  runShell(`git worktree remove --force ${JSON.stringify(dir)}`, root);
}
