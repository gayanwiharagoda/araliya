// Self-check for the pure helpers in agents-lint.mjs, plus a live pass over the repo.
// Run: pnpm openspec:sync:test  (or node --test scripts/agents-lint.test.mjs)
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseFrontmatter,
  lintAgent,
  lintSkill,
  lintRepo,
} from "./agents-lint.mjs";

test("parseFrontmatter reads the fenced block, null when absent", () => {
  const fm = parseFrontmatter("---\nname: x\nmodel: opus\n---\nbody");
  assert.equal(fm.name, "x");
  assert.equal(fm.model, "opus");
  assert.equal(parseFrontmatter("no fence here"), null);
});

test("lintAgent flags a missing explicit tools field", () => {
  const noTools =
    "---\nname: c\ndescription: d\nmodel: haiku\nversion: 1.0.0\n---\n";
  const errs = lintAgent("a.md", noTools);
  assert.ok(errs.some((e) => e.includes("missing 'tools'")));
  const ok =
    "---\nname: c\ndescription: d\ntools: Read\nmodel: haiku\nversion: 1.0.0\n---\n";
  assert.deepEqual(lintAgent("a.md", ok), []);
});

test("lintSkill enforces name↔dir match and local versioning", () => {
  const mismatch = "---\nname: wrong\ndescription: d\nversion: 1.0.0\n---\n";
  assert.ok(
    lintSkill("s", mismatch, "right", true).some((e) =>
      e.includes("does not match"),
    ),
  );
  const noVersion = "---\nname: s\ndescription: d\n---\n";
  assert.ok(
    lintSkill("s", noVersion, "s", true).some((e) =>
      e.includes("missing 'version'"),
    ),
  );
  // vendored skills are exempt from the version requirement
  assert.deepEqual(lintSkill("s", noVersion, "s", false), []);
});

test("lintRepo passes on the real repo", () => {
  assert.deepEqual(lintRepo(), []);
});
