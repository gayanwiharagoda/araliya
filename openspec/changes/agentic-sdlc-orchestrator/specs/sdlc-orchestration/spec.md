## ADDED Requirements

### Requirement: Deterministic control plane

The orchestrator SHALL sequence SDLC stages via a deterministic control plane whose branch
decisions depend only on deterministic artifacts (exit codes, file/git/`gh` state), never on
an agent's self-report. Given the same artifacts, a replayed run SHALL follow the same path.

#### Scenario: Replay follows the same path

- **WHEN** a run is replayed from persisted state with identical stage artifacts
- **THEN** the same stages execute in the same order and reach the same terminal state

#### Scenario: Branch keys off artifacts, not the model

- **WHEN** an agent stage reports success but its deterministic check fails (e.g. `pnpm validate` exits non-zero)
- **THEN** the stage is treated as failed regardless of the agent's report

### Requirement: Eight-stage graph

The orchestrator SHALL run the stages propose → sync → build → validate → review →
commit/PR → release → archive in order, with `validate` looping back to `build` on failure.

#### Scenario: Stages execute in order

- **WHEN** a run starts and no stage fails
- **THEN** stages execute in the defined order through to `archive`

#### Scenario: Validate failure loops to build

- **WHEN** the `validate` stage fails and the retry budget is not exhausted
- **THEN** control returns to the `build` stage with the failure output available

### Requirement: Three human gates

The orchestrator SHALL suspend at three gates: approve **plan** (after propose), approve
**merge** (the feature PR), and approve **release** (the release-please Release-PR). A run
SHALL NOT advance past a gate until approval is recorded.

#### Scenario: Plan gate blocks until approval

- **WHEN** the `propose` stage completes
- **THEN** the run suspends and does not enter `build` until the plan is approved

#### Scenario: Plan rejection stops the run

- **WHEN** a suspended plan gate is rejected via `pnpm sdlc resume <id> --reject`
- **THEN** the run terminates without entering `build`

### Requirement: Durable run lifecycle

The orchestrator SHALL persist run state to a local LibSQL store so a run can suspend,
resume, and survive process restart. State SHALL be gitignored.

#### Scenario: Resume after restart

- **WHEN** a suspended run's process is terminated and `pnpm sdlc resume <id>` is invoked later
- **THEN** the run continues from the suspended stage using persisted state

#### Scenario: List runs

- **WHEN** `pnpm sdlc ls` is invoked
- **THEN** each run is listed with its id, change name, and current stage/status

### Requirement: Worktree isolation

Each run SHALL operate in its own git worktree/branch, one run per OpenSpec change.
Concurrent runs SHALL NOT share a working tree.

#### Scenario: Concurrent runs are isolated

- **WHEN** two runs execute concurrently
- **THEN** each mutates a separate worktree and neither observes the other's uncommitted changes

### Requirement: PR-backed gates auto-resume on merge

The merge and release gates SHALL open a PR, suspend, and poll `gh pr view` until the PR is
merged, then auto-resume — without GitHub Actions or webhooks.

#### Scenario: Merge resumes the run

- **WHEN** a suspended PR-backed gate detects its PR is merged
- **THEN** the run auto-resumes into the next stage

#### Scenario: Unmerged PR keeps the run suspended

- **WHEN** the PR for a suspended gate is still open
- **THEN** the run remains suspended and continues polling
