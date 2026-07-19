#!/usr/bin/env node
// Mirror OpenSpec changes -> GitHub issues (one issue per change), and optionally
// onto a unified Projects v2 board. OpenSpec is the source of truth; this is one-way.
//
// ponytail: plain Node ESM + `gh` CLI, zero deps. Ceiling: single repo, sequential,
// manual run. Upgrade path: a git post-commit hook or a GitHub Action on push, and
// batch the `gh` calls if change count grows into the hundreds.
//
// Usage: node scripts/openspec-sync.mjs   (or `pnpm openspec:sync`)
// Needs: gh authed with `repo` scope. Project-board wiring is optional — it runs only
// when scripts/.openspec-sync.json exists (see README block at bottom of this file).

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHANGES_DIR = join(ROOT, "openspec", "changes");
const ARCHIVE_DIR = join(CHANGES_DIR, "archive");
const CONFIG_PATH = join(ROOT, "scripts", ".openspec-sync.json");
const LABEL = "openspec";

// ---- pure helpers (unit-tested in openspec-sync.test.mjs) --------------------

const TASK_RE = /^\s*[-*]\s+\[( |x|X)\]\s+(.*\S)\s*$/;

/** Parse a tasks.md body into checklist items + counts. */
export function parseTasks(md) {
  const items = [];
  for (const line of md.split("\n")) {
    const m = TASK_RE.exec(line);
    if (m) items.push({ checked: m[1].toLowerCase() === "x", text: m[2] });
  }
  const checked = items.filter((i) => i.checked).length;
  return { items, checked, total: items.length };
}

/** Map completion -> Projects v2 Status option name. */
export function deriveStatus({ checked, total, archived }) {
  if (archived) return "Done";
  if (total > 0 && checked === total) return "Done";
  if (checked > 0) return "In Progress";
  return "Todo";
}

/** First `# H1` of proposal.md, else the change id. */
export function extractTitle(proposalMd, changeId) {
  const m = /^#\s+(.+)$/m.exec(proposalMd ?? "");
  const h1 = m && m[1].trim();
  return h1 ? `${changeId}: ${h1}` : changeId;
}

export function marker(changeId) {
  return `<!-- openspec:${changeId} -->`;
}

export function archiveChangeId(directoryName) {
  return directoryName.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

/** Render the issue body: hidden marker + a GitHub-native checklist (progress bar). */
export function buildBody(changeId, items, archived) {
  const lines = items.map((i) => `- [${i.checked ? "x" : " "}] ${i.text}`);
  return [
    marker(changeId),
    `Mirrored from OpenSpec change \`${changeId}\`${archived ? " (archived)" : ""}.`,
    "Source of truth is `openspec/changes/`; managed by `pnpm openspec:sync` — do not edit by hand.",
    "",
    "### Tasks",
    lines.length ? lines.join("\n") : "_No tasks defined yet._",
  ].join("\n");
}

// ---- gh wrappers ------------------------------------------------------------

const gh = (args, opts = {}) =>
  execFileSync("gh", args, { encoding: "utf8", ...opts }).trim();

function listChangeDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "archive")
    .map((d) => d.name);
}

function readChange(dir, name) {
  const tasksPath = join(dir, name, "tasks.md");
  const proposalPath = join(dir, name, "proposal.md");
  const tasksMd = existsSync(tasksPath) ? readFileSync(tasksPath, "utf8") : "";
  const proposalMd = existsSync(proposalPath)
    ? readFileSync(proposalPath, "utf8")
    : "";
  return { tasksMd, proposalMd };
}

function findIssueByMarker(issues, changeId) {
  const mk = marker(changeId);
  return issues.find((i) => (i.body ?? "").includes(mk));
}

function main() {
  const repo = gh(["repo", "view", "--json", "name", "-q", ".name"]);
  const repoLabel = `repo:${repo}`;
  ensureLabel(LABEL, "0e8a16", "Mirrored from an OpenSpec change");
  ensureLabel(repoLabel, "5319e7", "Source repository");

  const config = existsSync(CONFIG_PATH)
    ? JSON.parse(readFileSync(CONFIG_PATH, "utf8"))
    : null;
  if (!config)
    console.warn(
      "! scripts/.openspec-sync.json not found — syncing issues only, skipping Project board.",
    );

  const existing = JSON.parse(
    gh([
      "issue",
      "list",
      "--label",
      LABEL,
      "--state",
      "all",
      "--limit",
      "200",
      "--json",
      "number,body,state,url",
    ]),
  );

  const changes = [
    ...listChangeDirs(CHANGES_DIR).map((directoryName) => ({
      directoryName,
      changeId: directoryName,
      archived: false,
    })),
    ...listChangeDirs(ARCHIVE_DIR).map((directoryName) => ({
      directoryName,
      changeId: archiveChangeId(directoryName),
      archived: true,
    })),
  ];

  if (!changes.length) {
    console.log("No OpenSpec changes found. Nothing to sync.");
    return;
  }

  for (const { directoryName, changeId, archived } of changes) {
    const dir = archived ? ARCHIVE_DIR : CHANGES_DIR;
    const { tasksMd, proposalMd } = readChange(dir, directoryName);
    const { items, checked, total } = parseTasks(tasksMd);
    const status = deriveStatus({ checked, total, archived });
    const body = buildBody(changeId, items, archived);
    const title = extractTitle(proposalMd, changeId);
    const found = findIssueByMarker(existing, changeId);

    let url;
    if (found) {
      gh(["issue", "edit", String(found.number), "--body", body]);
      // reconcile open/closed with Done status
      if (status === "Done" && found.state === "OPEN")
        gh(["issue", "close", String(found.number)]);
      if (status !== "Done" && found.state === "CLOSED")
        gh(["issue", "reopen", String(found.number)]);
      url = found.url;
      console.log(
        `= ${changeId} -> #${found.number} (${status}, ${checked}/${total})`,
      );
    } else {
      url = gh([
        "issue",
        "create",
        "--title",
        title,
        "--body",
        body,
        "--label",
        LABEL,
        "--label",
        repoLabel,
      ]);
      if (status === "Done") gh(["issue", "close", url]);
      console.log(`+ ${changeId} -> ${url} (${status}, ${checked}/${total})`);
    }

    if (config) syncProjectItem(config, url, status);
  }
}

function ensureLabel(name, color, description) {
  try {
    gh(
      ["label", "create", name, "--color", color, "--description", description],
      {
        stdio: "pipe",
      },
    );
  } catch {
    // already exists — fine
  }
}

function syncProjectItem(config, issueUrl, status) {
  const { owner, projectNumber, projectId, statusFieldId, statusOptions } =
    config;
  const itemId = gh([
    "project",
    "item-add",
    String(projectNumber),
    "--owner",
    owner,
    "--url",
    issueUrl,
    "--format",
    "json",
    "-q",
    ".id",
  ]);
  const optionId = statusOptions?.[status];
  if (statusFieldId && optionId) {
    gh([
      "project",
      "item-edit",
      "--id",
      itemId,
      "--project-id",
      projectId,
      "--field-id",
      statusFieldId,
      "--single-select-option-id",
      optionId,
    ]);
  }
}

// run only when executed directly, not when imported by the test
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
