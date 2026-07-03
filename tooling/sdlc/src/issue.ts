import { runShell } from "./shell.js";

/**
 * Issue-driven entry: a GitHub issue is only the *input context*. We pull its
 * detail, derive a change name, then `/opsx:propose` turns it into an OpenSpec
 * change — and from there the spec drives the pipeline (build/validate/…).
 */
export interface Issue {
  number: number;
  title: string;
  body: string;
}

/** Kebab-case change name from an issue title. */
export function issueToChangeName(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "change"
  );
}

// Canonical marker lives in scripts/openspec-sync.mjs (`marker()`); duplicated here
// as a one-liner to avoid coupling tooling/ to the root sync script.
export const markerFor = (changeName: string): string =>
  `<!-- openspec:${changeName} -->`;

/** Prepend the sync marker so `openspec:sync` adopts this issue instead of duplicating it. */
export function withMarker(body: string, changeName: string): string {
  const mk = markerFor(changeName);
  return body.includes(mk) ? body : `${mk}\n${body}`;
}

/**
 * Accept an issue **number** or a full GitHub issue/PR **URL** (both are valid
 * `gh` selectors). Validated before it reaches a shell command.
 */
export function normalizeIssueRef(ref: string): string {
  const trimmed = ref.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  if (
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(issues|pull)\/\d+(\?[^\s]*)?$/.test(
      trimmed,
    )
  )
    return trimmed;
  throw new Error(`not an issue number or GitHub issue URL: ${ref}`);
}

/** Live: read an issue via `gh` (ref = number or URL). */
export function fetchIssue(ref: string): Issue {
  const { code, stdout, stderr } = runShell(
    `gh issue view ${ref} --json number,title,body`,
  );
  if (code !== 0)
    throw new Error(`gh issue view ${ref} failed: ${stderr.trim()}`);
  const raw = JSON.parse(stdout) as {
    number: number;
    title: string;
    body: string | null;
  };
  return { number: raw.number, title: raw.title, body: raw.body ?? "" };
}

/** Live: seed the marker into the issue so the sync stage adopts it as the tracking issue. */
export function adoptIssue(ref: string, changeName: string): void {
  const issue = fetchIssue(ref);
  const body = withMarker(issue.body, changeName);
  if (body !== issue.body) {
    runShell(`gh issue edit ${ref} --body ${JSON.stringify(body)}`);
  }
}
