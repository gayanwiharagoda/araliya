# AI Skills

Project skills live in `.agents/skills/` (symlinked at `.claude/skills`). Invoke with `/<skill-name>`.

## OpenSpec

Spec-driven workflow for proposing, implementing, and archiving changes.

| Skill                   | Command         | Purpose                                                                    |
| ----------------------- | --------------- | -------------------------------------------------------------------------- |
| openspec-propose        | `/opsx:propose` | Create a change with proposal, design, and task artifacts in one step.     |
| openspec-apply-change   | `/opsx:apply`   | Implement tasks from an OpenSpec change.                                   |
| openspec-sync-specs     | `/opsx:sync`    | Sync delta specs from a change to main specs.                              |
| openspec-explore        | `/opsx:explore` | Thinking partner mode — explore ideas and investigate before implementing. |
| openspec-archive-change | `/opsx:archive` | Archive a completed change after implementation.                           |

## Ponytail

"Lazy senior dev" ruleset — simplicity enforcement and over-engineering detection.

| Skill           | Command            | Purpose                                                   |
| --------------- | ------------------ | --------------------------------------------------------- |
| ponytail        | `/ponytail`        | Toggle lazy senior dev mode (lite/full/ultra/off).        |
| ponytail-review | `/ponytail-review` | Review a diff for over-engineering. One line per finding. |
| ponytail-audit  | `/ponytail-audit`  | Audit the whole repo for over-engineering. Ranked list.   |
| ponytail-debt   | `/ponytail-debt`   | Harvest `ponytail:` comments into a tracked debt ledger.  |
| ponytail-gain   | `/ponytail-gain`   | Show measured impact scoreboard (less code, cost, time).  |
| ponytail-help   | `/ponytail-help`   | Quick reference for ponytail modes and commands.          |

## Productivity

| Skill    | Command     | Purpose                                                    |
| -------- | ----------- | ---------------------------------------------------------- |
| grill-me | `/grill-me` | Stress-test a plan or design with relentless interviewing. |

## Tooling

| Skill         | Command          | Purpose                                         |
| ------------- | ---------------- | ----------------------------------------------- |
| skill-creator | `/skill-creator` | Create, modify, evaluate, and benchmark skills. |
