# Feature pipeline

Turn a list of features into tracked, AI-built work on a single cross-repo board.

Three layers, glued by one script:

| Layer              | Tool                            | Role                                                  |
| ------------------ | ------------------------------- | ----------------------------------------------------- |
| Spec + task engine | **OpenSpec** (`/opsx:*`)        | One **change** per feature; `tasks.md` = the tickets. |
| Ticket board       | **GitHub Issues + Projects v2** | One issue per change, mirrored onto a unified board.  |
| Live agent runner  | **Claude Code**                 | Builds the feature; watch live via background tasks.  |

OpenSpec is the **source of truth**; `pnpm openspec:sync` mirrors it one-way to GitHub
(`scripts/openspec-sync.mjs`). Re-running is idempotent (issues are matched by a hidden
`<!-- openspec:<change-id> -->` marker in the body).

## Daily workflow

```sh
/opsx:propose        # describe a feature → proposal + specs + tasks.md
/opsx:apply          # AI builds it, checking off tasks.md as it goes
pnpm openspec:sync   # mirror changes → GitHub issues + the board
/opsx:archive        # when done → next sync marks it Done and closes the issue
```

> **Automating the whole loop:** the above steps can be driven end-to-end by the local
> **SDLC orchestrator** (`pnpm sdlc <change-name>`) — a deterministic conductor that chains
> propose → build → validate → review → release → archive with human gates, on your Claude
> subscription. See [`tooling/sdlc/README.md`](../tooling/sdlc/README.md) (ADR 0010).

- **Status board:** the GitHub **Feature Pipeline** Project. Each card shows its repo via the
  built-in Repository field and a `repo:<name>` label.
- **Live activity:** run `/opsx:apply` as a Claude Code **background task**.
- **Status mapping** (issue body checklist → Project Status):
  0 tasks done → `Todo` · some done → `In Progress` · all done or archived → `Done`.

## One-time setup

Needs the GitHub CLI (`gh`) authenticated. Run from the repo root.

1. **Grant the Projects scope** (interactive — run in a normal terminal, not via `!`):

   ```sh
   gh auth refresh -s project,read:project
   gh auth status        # confirm 'project' now appears in Token scopes
   ```

2. **Create the board and write the sync config:**

   ```sh
   OWNER=gayanwiharagoda
   CREATE=$(gh project create --owner "$OWNER" --title "Feature Pipeline" --format json)
   PROJ=$(echo "$CREATE" | jq -r '.number'); PID=$(echo "$CREATE" | jq -r '.id')

   gh project field-list "$PROJ" --owner "$OWNER" --format json \
     | jq --arg owner "$OWNER" --argjson num "$PROJ" --arg pid "$PID" '
         (.fields[] | select(.name=="Status")) as $s
         | { owner: $owner, projectNumber: $num, projectId: $pid,
             statusFieldId: $s.id,
             statusOptions: ($s.options | map({(.name): .id}) | add) }' \
     > scripts/.openspec-sync.json
   cat scripts/.openspec-sync.json   # every field should have a real id, no "xxxx"
   ```

   See `scripts/.openspec-sync.example.json` for the expected shape. Without this file the
   sync still runs but updates **issues only** (no board wiring).

3. **Smoke test:** `pnpm openspec:sync` — with no changes it prints "No OpenSpec changes
   found" and no config warning.

## Onboarding another repo

The board is shared. In the new repo: copy `scripts/openspec-sync.mjs` and
`scripts/.openspec-sync.json` (same project IDs), then run `pnpm openspec:sync`. Its issues
roll up to the same **Feature Pipeline** board, tagged with that repo's `repo:<name>` label.

## Troubleshooting

| Symptom                                             | Fix                                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `missing required scopes [project read:project]`    | Run setup step 1 in a real terminal (the `!` prefix can't do interactive auth).                 |
| `! scripts/.openspec-sync.json not found` warning   | Run setup step 2 — sync is updating issues only until then.                                     |
| `statusOptions` missing `Todo`/`In Progress`/`Done` | Your board renamed the Status options; edit the keys in `scripts/.openspec-sync.json` to match. |

Verify the helpers: `pnpm openspec:sync:test`.
