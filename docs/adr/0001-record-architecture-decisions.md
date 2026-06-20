# 0001. Record architecture decisions

- Status: Accepted
- Date: 2026-06-18
- Deciders: DomusOS team

## Context

We need a durable, reviewable record of significant architectural choices so future maintainers understand the "why", not just the "what".

## Decision

Use Architecture Decision Records (ADRs): one Markdown file per decision under `docs/adr/`, numbered sequentially from [`0000-template.md`](0000-template.md).

## Consequences

- Decisions are versioned with the code and reviewed through normal PRs.
- Superseded decisions stay in history; change is additive (a new ADR supersedes the old).
- Small per-decision overhead; applies only to significant choices, not routine work.

## Alternatives considered

- Wiki / external doc: drifts from code, not reviewed alongside changes.
- No formal record: context is lost and decisions get re-litigated.
