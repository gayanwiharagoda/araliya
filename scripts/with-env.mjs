#!/usr/bin/env node
// Monorepo env inheritance: an app extends the repo-root env by default.
//
// Precedence, low -> high:
//   root/.env  <  root/.env.local  <  app/.env  <  app/.env.local  <  real shell env
// so the app overrides the root, and a real environment variable overrides both.
//
// An app opts OUT of inheriting the root by setting `EXTEND_ROOT_ENV=false` in its
// own .env / .env.local. (Default is to extend.)
//
// Wired into each app's dev/build/start scripts, e.g.:
//   "build": "node ../../scripts/with-env.mjs next build"
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Minimal .env parser: KEY=VALUE lines, `#` comments, optional surrounding quotes. */
export function parseEnvFile(file) {
  const env = {};
  if (!existsSync(file)) return env;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    const quoted =
      val.length >= 2 &&
      ((val[0] === '"' && val.at(-1) === '"') ||
        (val[0] === "'" && val.at(-1) === "'"));
    if (quoted) val = val.slice(1, -1);
    env[key] = val;
  }
  return env;
}

/** Resolve the effective env for `appDir`, extending `repoRoot` unless opted out. */
export function resolveEnv({ appDir, repoRoot, shellEnv = {} }) {
  const app = {
    ...parseEnvFile(join(appDir, ".env")),
    ...parseEnvFile(join(appDir, ".env.local")),
  };
  const extendRoot =
    String(app.EXTEND_ROOT_ENV ?? "true").toLowerCase() !== "false";
  const root = extendRoot
    ? {
        ...parseEnvFile(join(repoRoot, ".env")),
        ...parseEnvFile(join(repoRoot, ".env.local")),
      }
    : {};
  return { ...root, ...app, ...shellEnv };
}

// CLI: `with-env.mjs <command> [args...]` — run the command with the resolved env.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const env = resolveEnv({
    appDir: process.cwd(),
    repoRoot,
    shellEnv: process.env,
  });
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) {
    console.error("with-env: no command given");
    process.exit(1);
  }
  // No shell on posix: spawn resolves the bin via PATH (npm adds node_modules/.bin)
  // and args stay unmangled. Windows needs a shell to run .cmd shims.
  spawn(cmd, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  }).on("exit", (code) => process.exit(code ?? 0));
}
