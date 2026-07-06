import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveEnv, parseEnvFile } from "./with-env.mjs";

function scaffold(files) {
  const dir = mkdtempSync(join(tmpdir(), "with-env-"));
  const root = join(dir, "root");
  const app = join(dir, "app");
  mkdirSync(root);
  mkdirSync(app);
  for (const [rel, body] of Object.entries(files))
    writeFileSync(join(dir, rel), body);
  return { dir, root, app };
}

test("app extends root by default; app wins on conflict", () => {
  const { dir, root, app } = scaffold({
    "root/.env": "SHARED=root\nONLY_ROOT=r\n",
    "app/.env.local": "SHARED=app\nONLY_APP=a\n",
  });
  const env = resolveEnv({ appDir: app, repoRoot: root });
  assert.equal(env.SHARED, "app"); // app overrides root
  assert.equal(env.ONLY_ROOT, "r"); // inherited from root
  assert.equal(env.ONLY_APP, "a");
  rmSync(dir, { recursive: true, force: true });
});

test("EXTEND_ROOT_ENV=false stops inheriting root", () => {
  const { dir, root, app } = scaffold({
    "root/.env": "ONLY_ROOT=r\n",
    "app/.env": "EXTEND_ROOT_ENV=false\nONLY_APP=a\n",
  });
  const env = resolveEnv({ appDir: app, repoRoot: root });
  assert.equal(env.ONLY_ROOT, undefined); // root NOT inherited
  assert.equal(env.ONLY_APP, "a");
  rmSync(dir, { recursive: true, force: true });
});

test("real shell env overrides both files", () => {
  const { dir, root, app } = scaffold({
    "root/.env": "SHARED=root\n",
    "app/.env": "SHARED=app\n",
  });
  const env = resolveEnv({
    appDir: app,
    repoRoot: root,
    shellEnv: { SHARED: "shell" },
  });
  assert.equal(env.SHARED, "shell");
  rmSync(dir, { recursive: true, force: true });
});

test("parseEnvFile handles comments and quotes", () => {
  const { dir, app } = scaffold({ "app/.env": '# note\nA="x y"\nB=z\n' });
  const parsed = parseEnvFile(join(app, ".env"));
  assert.deepEqual(parsed, { A: "x y", B: "z" });
  rmSync(dir, { recursive: true, force: true });
});
