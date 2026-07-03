import { spawnSync } from "node:child_process";

export interface ShellResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run a shell command synchronously and capture its exit code + output. */
export function runShell(cmd: string, cwd?: string): ShellResult {
  const r = spawnSync(cmd, { shell: true, encoding: "utf8", cwd });
  return {
    code: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

/** Run a binary with an explicit arg array (no shell) — safe for untrusted args like prompts. */
export function runShellArgs(
  bin: string,
  args: string[],
  cwd?: string,
): ShellResult {
  const r = spawnSync(bin, args, {
    shell: false,
    encoding: "utf8",
    cwd,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    code: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

let cachedRoot: string | undefined;

/** Repo root, so stages shell out from the right cwd regardless of pnpm's filter cwd. */
export function repoRoot(): string {
  if (cachedRoot === undefined) {
    const r = runShell("git rev-parse --show-toplevel");
    cachedRoot = r.code === 0 ? r.stdout.trim() : process.cwd();
  }
  return cachedRoot;
}

/** Dry-run skips real subprocess execution — keeps the control-plane tests hermetic. */
export const isDryRun = (): boolean => process.env.SDLC_DRY_RUN === "1";

/** Run a command and throw on non-zero exit — the deterministic stage gate. */
export function runGated(label: string, cmd: string, cwd = repoRoot()): void {
  const { code, stderr } = runShell(cmd, cwd);
  if (code !== 0) throw new Error(`${label} failed (exit ${code}): ${stderr}`);
}
