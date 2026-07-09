# AI Skills

Project skills live in `.agents/skills/` (symlinked at `.claude/skills`). Invoke with `/<skill-name>`.

**Source** is either _local_ (authored in this repo, versioned in frontmatter) or _external_
(installed from another repo and pinned by hash in `skills-lock.json` — never hand-edit these).

## OpenSpec

Spec-driven workflow for proposing, implementing, and archiving changes.

| Skill                   | Command         | Purpose                                                                    | Source |
| ----------------------- | --------------- | -------------------------------------------------------------------------- | ------ |
| openspec-propose        | `/opsx:propose` | Create a change with proposal, design, and task artifacts in one step.     | local  |
| openspec-apply-change   | `/opsx:apply`   | Implement tasks from an OpenSpec change.                                   | local  |
| openspec-sync-specs     | `/opsx:sync`    | Sync delta specs from a change to main specs.                              | local  |
| openspec-explore        | `/opsx:explore` | Thinking partner mode — explore ideas and investigate before implementing. | local  |
| openspec-archive-change | `/opsx:archive` | Archive a completed change after implementation.                           | local  |

## Ponytail

"Lazy senior dev" ruleset — simplicity enforcement and over-engineering detection.

| Skill           | Command            | Purpose                                                   | Source |
| --------------- | ------------------ | --------------------------------------------------------- | ------ |
| ponytail        | `/ponytail`        | Toggle lazy senior dev mode (lite/full/ultra/off).        | local  |
| ponytail-review | `/ponytail-review` | Review a diff for over-engineering. One line per finding. | local  |
| ponytail-audit  | `/ponytail-audit`  | Audit the whole repo for over-engineering. Ranked list.   | local  |
| ponytail-debt   | `/ponytail-debt`   | Harvest `ponytail:` comments into a tracked debt ledger.  | local  |
| ponytail-gain   | `/ponytail-gain`   | Show measured impact scoreboard (less code, cost, time).  | local  |
| ponytail-help   | `/ponytail-help`   | Quick reference for ponytail modes and commands.          | local  |

## Convex (backend)

| Skill             | Command              | Purpose                                                      | Source   |
| ----------------- | -------------------- | ------------------------------------------------------------ | -------- |
| convex            | `/convex`            | Route a Convex request to the right project skill.           | external |
| convex-quickstart | `/convex-quickstart` | Create or add Convex to an app (setup, env vars, first dev). | external |

## Frontend & mobile

| Skill                        | Command                         | Purpose                                                            | Source   |
| ---------------------------- | ------------------------------- | ------------------------------------------------------------------ | -------- |
| nextjs-app-router-patterns   | `/nextjs-app-router-patterns`   | Next.js App Router: Server Components, streaming, data fetching.   | external |
| expo-react-native-typescript | `/expo-react-native-typescript` | Expo + React Native + TypeScript mobile development best practice. | external |

## Thinking discipline

| Skill      | Command       | Purpose                                                                | Source |
| ---------- | ------------- | ---------------------------------------------------------------------- | ------ |
| fable-mode | `/fable-mode` | Frontier-model reasoning discipline; portable prompt for small models. | local  |
| grill-me   | `/grill-me`   | Stress-test a plan or design with relentless interviewing.             | local  |

## Tooling & meta

| Skill            | Command             | Purpose                                                     | Source   |
| ---------------- | ------------------- | ----------------------------------------------------------- | -------- |
| testing-strategy | `/testing-strategy` | Decide what tests a change needs in this monorepo.          | local    |
| skill-creator    | `/skill-creator`    | Create, modify, evaluate, and benchmark skills.             | external |
| find-skills      | `/find-skills`      | Discover and install agent skills from external registries. | external |

## Versioning & governance

Agents (`.agents/agents/*.md`) and local skills carry a `version:` field in frontmatter, bumped by:

- **major** — the workflow or output contract changes (a consumer must adapt).
- **minor** — the `description:` changes (alters triggering), a new capability, or an agent's
  `tools:`/`model:` change.
- **patch** — wording or clarifications with the same behavior.

`scripts/agents-lint.mjs` (run inside `pnpm validate`) enforces the policy: every agent declares
`model` + an explicit `tools` scope + `version`; every skill's `name` matches its directory with
no duplicates; local skills carry a `version`; and every `skills-lock.json` entry has a matching
skill directory. External skills are pinned by hash in `skills-lock.json` — update them by
re-installing from source, never by editing in place.
