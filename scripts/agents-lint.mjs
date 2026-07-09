#!/usr/bin/env node
// Lint agent + skill definitions against the governance policy
// (docs/plans/agentic-improvements.md): least-privilege tools declared, versioning,
// skill name matches its directory, no duplicate names, lockfile entries have a dir.
//
// ponytail: skills-lock.json entries get a presence check only — NOT a hash check.
// Ceiling: `computedHash` is produced by the external `npx skills` installer and is
// not reproducible from local files (sha256 of a vendored SKILL.md != its lock hash,
// confirmed for convex + find-skills), so verifying it here would false-fail a clean
// repo. Upgrade path: call the installer's verify command if one ships, or pin the
// algorithm here and hash the vendored dir.
//
// Run: pnpm agents:lint   (also runs inside pnpm validate)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---- pure helpers (unit-tested in agents-lint.test.mjs) ---------------------

/** Parse the leading `---`-fenced frontmatter into a flat key→string map, or null.
 *  Folds indented continuation lines into the current key so YAML block-scalar
 *  values (e.g. a `description:` wrapped across lines) are captured, not read empty. */
export function parseFrontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const out = {};
  let key = null;
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      out[key] = kv[2].trim();
    } else if (key && /^\s+\S/.test(line)) {
      out[key] = `${out[key]} ${line.trim()}`.trim();
    } else {
      key = null;
    }
  }
  return out;
}

const REQUIRED_AGENT_KEYS = [
  "name",
  "description",
  "model",
  "tools",
  "version",
];

/** Errors for one agent .md. Explicit `tools` is required so restrictions are enforced,
 *  not merely promised in prose (an omitted `tools` inherits ALL tools). */
export function lintAgent(path, src) {
  const fm = parseFrontmatter(src);
  if (!fm) return [`${path}: no frontmatter`];
  return REQUIRED_AGENT_KEYS.filter((k) => !fm[k]).map(
    (k) => `${path}: missing '${k}' in frontmatter`,
  );
}

/** Errors for one skill SKILL.md. `local` (non-vendored) skills must also carry a
 *  version; vendored skills are pinned by hash and must not be hand-edited. */
export function lintSkill(path, src, dirName, local) {
  const fm = parseFrontmatter(src);
  if (!fm) return [`${path}: no frontmatter`];
  const errs = [];
  if (!fm.name) errs.push(`${path}: missing 'name'`);
  if (!fm.description) errs.push(`${path}: missing 'description'`);
  if (fm.name && fm.name !== dirName)
    errs.push(
      `${path}: name '${fm.name}' does not match directory '${dirName}'`,
    );
  if (local && !fm.version) errs.push(`${path}: local skill missing 'version'`);
  return errs;
}

// ---- runner -----------------------------------------------------------------

export function lintRepo(root = ROOT) {
  const errors = [];

  const agentsDir = join(root, ".agents/agents");
  for (const f of readdirSync(agentsDir).filter((n) => n.endsWith(".md"))) {
    errors.push(
      ...lintAgent(
        `.agents/agents/${f}`,
        readFileSync(join(agentsDir, f), "utf8"),
      ),
    );
  }

  const skillsDir = join(root, ".agents/skills");
  const lock = JSON.parse(readFileSync(join(root, "skills-lock.json"), "utf8"));
  const vendored = new Set(Object.keys(lock.skills));
  const seen = new Map();
  const dirs = readdirSync(skillsDir, { withFileTypes: true }).filter((d) =>
    d.isDirectory(),
  );
  for (const d of dirs) {
    const rel = `.agents/skills/${d.name}/SKILL.md`;
    const p = join(skillsDir, d.name, "SKILL.md");
    if (!existsSync(p)) {
      errors.push(`${rel}: missing`);
      continue;
    }
    const src = readFileSync(p, "utf8");
    errors.push(...lintSkill(rel, src, d.name, !vendored.has(d.name)));
    const fm = parseFrontmatter(src);
    if (fm?.name) {
      if (seen.has(fm.name))
        errors.push(
          `duplicate skill name '${fm.name}': ${d.name} and ${seen.get(fm.name)}`,
        );
      else seen.set(fm.name, d.name);
    }
  }

  for (const name of vendored) {
    if (!existsSync(join(skillsDir, name, "SKILL.md")))
      errors.push(
        `skills-lock.json: '${name}' has no .agents/skills/${name}/SKILL.md`,
      );
  }

  return errors;
}

function main() {
  const errors = lintRepo();
  if (errors.length) {
    console.error("agents-lint: FAIL");
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  console.log("agents-lint: OK");
}

// run only when executed directly, not when imported by the test
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
