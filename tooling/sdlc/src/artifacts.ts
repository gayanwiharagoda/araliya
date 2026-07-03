import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./shell.js";

/**
 * Deterministic build-success check: every checkbox in the change's tasks.md is
 * ticked. Combined with `pnpm validate` exit 0, this is what marks build complete —
 * the agent's own "I'm done" is never trusted.
 */
export function allTasksChecked(
  changeName: string,
  root = repoRoot(),
): boolean {
  const md = readFileSync(
    join(root, "openspec", "changes", changeName, "tasks.md"),
    "utf8",
  );
  return !/^\s*- \[ \]/m.test(md);
}
