# 0009. Automated release and commit conventions

- Status: Proposed
- Date: 2026-07-02
- Deciders: DomusOS team

## Context

DomusOS needs a repeatable way to version releases, generate changelogs, and tag
releases — plus an enforced commit message structure so that history is machine-readable
and can drive that automation.

Forces shaping the choice:

- **Private multi-package monorepo.** `@domus/web`, `@domus/mobile`, `@domus/backend`
  are all `private`. **Nothing is published to npm** — versioning/changelog/tags are for
  internal release tracking (app-store builds, deploy provenance), not distribution.
- **Commit-driven is the goal.** We want releases derived from commit messages, which
  requires an enforced convention (Conventional Commits).
- **GitHub-centric workflow.** Issues + the cross-repo Projects board are already central,
  so `GITHUB_TOKEN`-based automation fits naturally.
- **Existing foundation.** Husky 9 + lint-staged are wired (a `pre-commit` hook only), so a
  `commit-msg` validator slots in with no new plumbing. There is no commitlint, no release
  tooling, no tags, and no CHANGELOGs today.

## Decision

Two complementary pieces:

1. **Commit structure — commitlint.** Add `@commitlint/cli` +
   `@commitlint/config-conventional`, enforced via a Husky **`commit-msg`** hook
   (`npx commitlint --edit $1`). Enforce-only: developers write commits normally and
   malformed messages are rejected. Interactive tooling (**commitizen**) is deferred — add
   it only if the team asks — per the lean-tooling rule in `.agents/rules/ponytail.md`.

2. **Semantic release — release-please.** Adopt Google's **release-please** as a GitHub
   Action. It reads Conventional Commits, opens a "Release PR" that aggregates unreleased
   changes, and on merge creates git tags, GitHub Releases, and per-package `CHANGELOG.md`
   files. Monorepo versions are tracked per package via `release-please-config.json` +
   `.release-please-manifest.json`. No npm publish step is used.

release-please is the only option that is **both** commit-driven **and** comfortable with a
private, multi-package GitHub repo that does not publish to npm.

## Consequences

- Releases are derived from commit history — no separate manual per-change step.
- The Release-PR gate makes cutting a release a deliberate, reviewable action rather than a
  side effect of every merge to `main`.
- Each package gets independent versions, tags, and changelogs.
- No publishing infrastructure or npm credentials to manage.
- Enforced Conventional Commits keep history clean and directly feed release-please.
- **Follow-up:** the `.release-please-manifest.json` must be seeded with current versions
  (web `0.1.0`, mobile `1.0.0`, backend has none — assign one). Package versions are
  currently inconsistent, so this establishes the baseline.
- **Mental-model shift:** contributors must learn the Release-PR flow (releases are not
  automatic on push).
- **GitHub coupling:** release-please is tied to GitHub Actions and would not port cleanly
  off GitHub.
- Malformed commit messages are now rejected at commit time.
- Actual installation/config (commitlint deps + config, the `commit-msg` hook,
  `release-please-config.json` + manifest, and the release workflow) is a separate
  implementation change once this ADR is accepted.

## Alternatives considered

- **Changesets** — the de-facto standard for pnpm monorepos, with excellent independent
  per-package versioning and explicit, human-readable changelogs. Rejected because it is
  **file-based, not commit-driven**: every change needs a manual `pnpm changeset` intent
  file, and it neither enforces nor consumes Conventional Commits. It runs parallel to
  commitlint rather than integrating with it, so it does not satisfy the goal of "semantic
  release from commit structure."

- **semantic-release** — the original, most mature commit-driven release tool with a large
  plugin ecosystem and fully automatic releases. Rejected because it is **single-package by
  design and npm-publish shaped**: monorepo support needs `semantic-release-monorepo` plus
  per-package config and a wrapper, and its core publish step would be disabled since we
  publish nothing. It is the heaviest setup for the least payoff here, and releases fire on
  every qualifying push rather than through a review gate.

- **commitizen (for commit UX)** — adds an interactive `pnpm commit` prompt on top of
  commitlint, which eases onboarding. Deferred, not rejected: it is additive (commitlint is
  still required underneath) and adds dependencies and config for a nicety power users often
  bypass. Revisit if the team wants guided commit authoring.
