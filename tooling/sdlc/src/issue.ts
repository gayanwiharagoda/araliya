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

/** Live: read an issue via `gh`. */
export function fetchIssue(n: number): Issue {
  const { code, stdout, stderr } = runShell(
    `gh issue view ${n} --json number,title,body`,
  );
  if (code !== 0)
    throw new Error(`gh issue view ${n} failed: ${stderr.trim()}`);
  const raw = JSON.parse(stdout) as {
    number: number;
    title: string;
    body: string | null;
  };
  return { number: raw.number, title: raw.title, body: raw.body ?? "" };
}

/** Live: seed the marker into the issue so the sync stage adopts it as the tracking issue. */
export function adoptIssue(n: number, changeName: string): void {
  const issue = fetchIssue(n);
  const body = withMarker(issue.body, changeName);
  if (body !== issue.body) {
    runShell(`gh issue edit ${n} --body ${JSON.stringify(body)}`);
  }
}
