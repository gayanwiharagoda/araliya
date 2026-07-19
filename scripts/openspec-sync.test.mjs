// Self-check for the pure helpers in openspec-sync.mjs. No gh/network.
// Run: pnpm openspec:sync:test
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTasks,
  deriveStatus,
  extractTitle,
  buildBody,
  marker,
  archiveChangeId,
} from "./openspec-sync.mjs";

const SAMPLE = `## 1. Setup
- [x] 1.1 Done thing
- [ ] 1.2 Pending thing
* [X] 1.3 Star-bullet done
not a task
- [ ] 1.4 Another pending`;

test("parseTasks counts checked vs total across - and * bullets", () => {
  const { items, checked, total } = parseTasks(SAMPLE);
  assert.equal(total, 4);
  assert.equal(checked, 2);
  assert.equal(items[0].text, "1.1 Done thing");
  assert.equal(items[0].checked, true);
});

test("deriveStatus maps completion correctly", () => {
  assert.equal(deriveStatus({ checked: 0, total: 3, archived: false }), "Todo");
  assert.equal(
    deriveStatus({ checked: 1, total: 3, archived: false }),
    "In Progress",
  );
  assert.equal(deriveStatus({ checked: 3, total: 3, archived: false }), "Done");
  assert.equal(deriveStatus({ checked: 0, total: 0, archived: false }), "Todo");
  // archived always Done, even with unchecked tasks
  assert.equal(deriveStatus({ checked: 1, total: 3, archived: true }), "Done");
});

test("extractTitle prefers proposal H1, falls back to change id", () => {
  assert.equal(
    extractTitle("# Add login\n\nbody", "add-login"),
    "add-login: Add login",
  );
  assert.equal(extractTitle("no heading here", "add-login"), "add-login");
  assert.equal(extractTitle("", "add-login"), "add-login");
});

test("archiveChangeId removes the archive date prefix", () => {
  assert.equal(
    archiveChangeId(
      "2026-07-19-foundation-multi-tenant-core-auth-building-setup",
    ),
    "foundation-multi-tenant-core-auth-building-setup",
  );
  assert.equal(archiveChangeId("add-login"), "add-login");
});

test("buildBody embeds the idempotency marker and a checklist", () => {
  const { items } = parseTasks(SAMPLE);
  const body = buildBody("add-login", items, false);
  assert.ok(body.includes(marker("add-login")));
  assert.ok(body.includes("- [x] 1.1 Done thing"));
  assert.ok(body.includes("- [ ] 1.2 Pending thing"));
});
