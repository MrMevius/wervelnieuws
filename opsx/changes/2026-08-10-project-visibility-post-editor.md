# Title

Project visibility and post editor cleanup — landing-ready parent change

## Context

This is the first active parent change for the project-visibility and post-editor work. It must become independently landable **before** the unrelated audio-transcription and Admin-load-diagnostics changes are treated as release dependencies.

The intended product scope remains: persisted per-project visibility for Vergaderborden and Urenverantwoording, filtered selectable projects, historical read-only handling for hidden boards, removal of **Posten zoeken**, multiline global-post descriptions, and the required Dutch About/changelog entry.

Migration discovery found that `20260729_0025_board_card_lifecycle.py` currently declares `20260616_0023` as its parent. Earlier partial work/evidence describes changing that existing revision to detach an audio branch. That is unsafe: a published Alembic revision is immutable once databases may have applied it. This parent change must use an additive graph strategy; it must not rewrite `20260729_0025`, its identity, parent, operations, or downgrade.

The currently observed visibility path is `20260729_0025 -> 20260730_0026 -> 20260809_0027 -> 20260810_0028 -> 20260810_0029`. Audio is a separate head, `20260630_0024`. The Admin-load diagnostics spec proposes a later merge revision (`20260811_0030`) after both parent branches are authorized and present. That later merge is external to this parent change.

## Discovery outline

1. **Source and graph inventory**
   - Record the exact source artifact identity before changes: repository URL/remotes, checked-out commit SHA, branch/ref, `git status --short`, `git diff --name-status`, `git diff --cached --name-status`, and SHA-256 hashes of `20260729_0025`, `20260810_0028`, `20260810_0029`, and the audio revision.
   - On that exact source artifact, record `alembic heads`, `alembic branches`, `alembic history --verbose`, and revision-targeted history for `20260616_0023:20260810_0029` and for the audio branch. Stop if the graph differs from the identities in this spec.
2. **Additive migration-graph decision**
   - Treat `20260729_0025` as published/immutable. Retain `down_revision = "20260616_0023"`; do not repair history by editing it.
   - Retain the visibility chain as an additive descendant of `20260729_0025`, ending at `20260810_0029`. Its revision-targeted upgrade must traverse only that chain; the independent audio head is neither a parent nor a dependency.
   - Do not add a merge revision here. A merge can only be supplied by the external Admin-load change after both approved heads are available, with a no-op, two-parent revision and a separately authorized source identity.
3. **Compatibility and rollback design**
   - Prove a fresh database can upgrade to `20260810_0029`; prove a database stamped/upgraded through the released board parent can upgrade to `20260810_0029`; prove downgrade from `20260810_0029` to `20260810_0028` and re-upgrade preserve the expected schema/data contract.
   - Prove the visibility upgrade neither applies nor requires `20260630_0024`; record `alembic_version` after every targeted step. Do not use ambiguous generic `head` in parent-chain tests while two heads exist.
   - Define recovery as application rollback plus a verified pre-upgrade backup/restore where visibility decisions must be discarded. Never mutate Alembic history or edit a released revision to recover.
4. **Isolation and release readiness**
   - Establish a clean, authorized worktree or an equivalently isolated patch based on a recorded source identity containing the required existing parent context. The primary dirty worktree is read-only evidence only.
   - Review every allowed hunk and prove that audio, Admin-load, external merge/release files, and unrelated files are absent from the isolated patch.
   - Complete only local disposable-resource checks in this parent change. Commit, push, deployment, target/shared database access, production backup, and external release actions are forbidden.

## Goals / Non-goals

### Goals

- Make the visibility/post-editor parent patch landing-ready on an authorized, clean source artifact containing the required released parent context.
- Preserve the existing product behavior described in the Context and validate it with current backend, frontend, browser, and migration evidence.
- Define and enforce an additive Alembic graph: no historical rewrite of `20260729_0025`; visibility remains targetable as `20260810_0029` without audio.
- Require fresh migration proof for fresh and `20260810_0028` databases, including downgrade/re-upgrade compatibility.
- Require hunk-level isolation from audio, Admin-load, merge, and every other external file.
- Record source artifact identity, worktree provenance, commands, outputs, environment, and release gates so a later authorized release can reproduce the result.

### Non-goals

- Do not modify `20260729_0025`, `20260630_0024`, or any other existing published migration revision, including revision ID, parent, operations, metadata, or downgrade.
- Do not implement audio transcription, Admin-load diagnostics, Docker/Compose runtime changes, or an Alembic merge revision in this change.
- Do not commit, push, merge, deploy, tag, access a target/shared/production database, take a production backup, or run production migration/smoke commands.
- Do not include unrelated application, generated, lockfile, configuration, or external-release files in the patch.

## Proposed approach

1. Use a recorded clean worktree/isolated patch as the only implementation and verification source. It must be based on an authorized source identity that includes the released parent chain through `20260810_0028` and the existing visibility revision/context required for this change.
2. Keep `20260729_0025` immutable. The only allowed visibility migration is the already additive descendant `20260810_0029` (or a newly allocated additive successor if `20260810_0029` is not part of the authorized parent source); it must descend from the released visibility chain, never from audio.
3. Test migration paths by explicit revision, never generic `head`: fresh/base to `20260810_0029`, `20260810_0028` to `20260810_0029`, downgrade to `20260810_0028`, then re-upgrade. Assert audio is not applied.
4. Run the canonical backend, frontend, build, and browser validations against the isolated artifact. Treat all prior dirty-worktree or historical-rewrite evidence as stale for landing/closure.
5. Stop at an isolated, reviewed, uncommitted patch and documented external gates. A future, separately authorized release may merge audio and visibility only after it validates both immutable parent identities.

## Implementation steps (ordered)

1. **Authorize and identify the source artifact**
   - Record remote/ref/commit SHA and clean/dirty state of the source identity.
   - Create a new clean local worktree on a temporary local branch at that exact authorized commit, outside the primary worktree; alternatively create an isolated patch with equivalent recorded base SHA and clean application target.
   - Before edits, require empty `git status --short`, empty staged diff, and passing `git diff --check` in the isolated worktree. Record its absolute path, branch, base SHA, and cleanup decision. Stop on any discrepancy.
2. **Freeze and prove the migration graph**
   - Hash and inspect `20260729_0025`; assert it keeps `down_revision = "20260616_0023"`. Do not edit it.
   - Record graph commands and confirm the exact visibility chain through `20260810_0029`, plus the separate `20260630_0024` audio head.
   - If the authorized base lacks a required parent revision or has a conflicting graph, stop and escalate; do not solve it by rewriting history, adding a merge, or importing external work.
3. **Confine the parent patch**
   - Limit changes to the visibility/post-editor implementation, its narrowly required tests, documentation/About entry, and this spec. Maintain an explicit changed-path allowlist before each verification run.
   - Exclude every audio file/hunk, `20260811_0030*`/Admin-load file/hunk, Docker/Compose change, and all external release artifacts. Use hunk-level review, not filename-only selection.
4. **Validate migration compatibility**
   - On disposable SQLite databases, execute and record: fresh/base upgrade to `20260810_0029`; populated `20260810_0028` upgrade to `20260810_0029`; downgrade to `20260810_0028`; and re-upgrade to `20260810_0029`.
   - Assert visibility columns/default/backfill and retained project relationships as applicable; assert `alembic_version` at every stage and no audio migration application/dependency.
   - Keep test helpers revision-targeted to `20260810_0029`, with a regression that fails if generic `head` is used for this branch.
5. **Run current product verification**
   - Run targeted backend migration/API tests, the complete backend suite, targeted frontend tests, full frontend suite, and production build using canonical project commands.
   - In a local disposable browser/application environment, perform all manual checks below and attach role, URL/context, outcome, and screenshots/request evidence where relevant.
6. **Review landing artifact and stop**
   - Run all hunk-isolation commands against both unstaged and staged views (staging is review-only; do not commit). Record the changed-path list and a hunk-by-hunk conclusion.
   - Mark completion only when every acceptance criterion and local gate is evidenced. Leave the patch uncommitted, unpublished, undeployed, and without target-DB action.

## Acceptance criteria

1. `20260729_0025` is byte-identical to the recorded authorized source artifact (or has a matching recorded SHA-256), still declares parent `20260616_0023`, and no historical revision is edited.
2. The visibility migration is an additive descendant of the released board/work-hours chain and is explicitly targetable at `20260810_0029`; it has no audio revision in `down_revision` or `depends_on`.
3. Fresh and populated disposable databases each upgrade to `20260810_0029`; a populated `20260810_0028` database upgrades, downgrades to `20260810_0028`, and re-upgrades successfully. At each stage the recorded `alembic_version` is the requested revision and audio `20260630_0024` is not applied.
4. Migration tests prove legacy projects receive both visibility values as `true`, no existing project foreign keys change, and downgrade removes only visibility schema additions. Recovery criteria document backup/restore rather than history rewriting.
5. Admin visibility persistence, board/hours selector filtering, hidden-board read-only history/API enforcement, removal of **Posten zoeken**, multiline textarea persistence, and Dutch About entry pass targeted automated and manual browser checks.
6. The complete backend suite, full frontend suite, and frontend production build pass from the isolated source artifact; warnings/failures and command durations are recorded verbatim.
7. The isolated patch has a recorded source identity and worktree provenance; `git diff --check` passes; hunk-level review proves no audio, Admin-load, merge, Docker/Compose, external-release, or unrelated hunk/file is included.
8. No commit, push, deployment, target/shared database operation, production backup, or external release action is performed or claimed as evidence.

## Testing plan

### Source identity and graph

```bash
git remote -v
git rev-parse HEAD
git status --short
git diff --name-status
git diff --cached --name-status
sha256sum backend/alembic/versions/20260729_0025_board_card_lifecycle.py \
  backend/alembic/versions/20260810_0028_remove_work_hours_json_restore.py \
  backend/alembic/versions/20260810_0029_project_module_visibility.py \
  backend/alembic/versions/20260630_0024_audio_topic_transcription.py
cd backend
.venv/bin/alembic heads
.venv/bin/alembic branches
.venv/bin/alembic history --verbose
.venv/bin/alembic history -r 20260616_0023:20260810_0029
```

### Disposable migration and automated checks

```bash
cd backend
STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest \
  tests/test_project_visibility_migration.py \
  tests/test_admin_api.py tests/test_boards_api.py tests/test_work_hours_api.py -q
STORAGE_ROOT=$(mktemp -d) .venv/bin/python -m pytest -q

# Explicit target only; run against isolated disposable SQLite databases.
DATABASE_URL="sqlite:///$tmp/fresh.db" STORAGE_ROOT="$tmp/storage" .venv/bin/alembic upgrade 20260810_0029
DATABASE_URL="sqlite:///$tmp/fresh.db" STORAGE_ROOT="$tmp/storage" .venv/bin/alembic downgrade 20260810_0028
DATABASE_URL="sqlite:///$tmp/fresh.db" STORAGE_ROOT="$tmp/storage" .venv/bin/alembic upgrade 20260810_0029

cd ../frontend
npm test -- --run src/app/App.test.tsx src/app/features/admin/VergaderbordenPage.test.tsx src/app/features/urenverantwoording/UrenverantwoordingPage.test.tsx
npm test -- --run
npm run build
```

The implementation must add/retain a populated-`20260810_0028` migration fixture; command-only proof is insufficient. It must assert schema/data compatibility and `alembic_version` at each requested revision, with no audio revision application.

### Manual browser checks (local disposable environment only)

1. As admin, toggle each visibility combination on an existing project; save and hard-refresh to confirm persistence.
2. Confirm board-only/hours-only filtering in Vergaderborden and both Urenverantwoording registration and project-filter options.
3. Open an authorized direct URL for a hidden board with historical data; verify history/downloads remain readable and every mutation affordance is absent; verify direct mutation requests are rejected.
4. In Admin > posten, confirm **Posten zoeken** is absent and multiline create/edit/save/refresh preserves line breaks.
5. Record environment, role, source identity, result, and screenshot/request evidence for every check.

### Hunk isolation

```bash
git diff --check
git diff --name-only
git diff --word-diff -- <allowed-paths>
git diff --cached --check
git diff --cached --name-only
git diff --cached --word-diff -- <allowed-paths>
```

## Risk + rollback plan

### Risks and mitigations

- **Historical migration rewrite corrupts upgrade provenance.** Freeze/hash `20260729_0025`; reject any hunk touching it. Use only additive descendants and explicit targets.
- **Two heads make generic `head` ambiguous.** Branch-specific tests target `20260810_0029`; a later, external merge is not a workaround for this parent change.
- **Partial evidence comes from the wrong source or graph.** Require clean worktree provenance and invalidate prior dirty-worktree, pre-authorization, or historical-rewrite evidence.
- **Audio/Admin-load changes leak into the parent.** Enforce the allowlist and hunk-level review of unstaged and staged patches; stop rather than absorb a dependency.
- **Migration downgrade loses post-release choices.** Require a verified pre-upgrade backup/restore plan for real release; do not reconstruct data or alter migration history.
- **Automated checks miss user behavior.** Require the listed browser checks in a local disposable environment before local completion.

### Rollback

- Before any later external release, that release owner must verify a backup and document restoration on a non-production copy. This parent change performs neither action.
- For a failed later visibility release, deploy the prior application artifact and downgrade only the additive visibility revision when its data contract permits; otherwise restore the verified pre-upgrade backup.
- Never edit `20260729_0025` or any applied revision as rollback. If the graph is wrong, stop the release and introduce a separately reviewed additive correction/merge only when authorized.
- Discard this parent patch if isolation or provenance fails; do not commit or transplant mixed hunks.

## Notes / links

- Parent foundation: `opsx/changes/2026-08-09-compacte-urenregistratie-centraal-beheer.md`.
- External, not a dependency for this parent landing: `opsx/changes/2026-08-10-admin-load-failure-diagnostics.md`. Its proposed `20260811_0030` merge is allowed only after both immutable parents are authorized and independently landed.
- Required immutable migration: `backend/alembic/versions/20260729_0025_board_card_lifecycle.py`.
- Visibility migration/context: `backend/alembic/versions/20260810_0029_project_module_visibility.py`.
- Audio migration excluded from this change: `backend/alembic/versions/20260630_0024_audio_topic_transcription.py`.

### External release gates

1. An authorized source artifact must contain the recorded immutable parent identities and this clean, isolated parent patch.
2. The parent patch must land independently before audio or Admin-load/merge work is considered. No external branch may be merged merely to make parent verification pass.
3. A later audio+visibility merge requires a separate approved spec, a no-op additive merge revision, independent validation of both parents, and a newly recorded source identity.
4. Commit/push/deploy/target-DB actions require explicit user authorization and are outside this spec's execution scope.

## Current status

Draft — re-baselined as the first active parent change. No fresh evidence from a clean authorized worktree exists yet. No implementation, commit, push, deployment, or target-database action is authorized by this spec.

## What changed

- Replaced the prior partial/closure-oriented plan with a landing-ready parent-change plan.
- Explicitly prohibited rewriting existing Alembic revision `20260729_0025` and specified an additive, revision-targeted graph strategy.
- Added source-identity, isolated-worktree, fresh/`0028` migration proof, hunk-isolation, browser-check, and external-release-gate requirements.

## How to verify

- Follow the commands and manual checks in **Testing plan** only from the recorded clean, authorized worktree/isolated patch.
- Map each command result to the acceptance criteria and record source identity, revision state, duration, warnings, and failures.
- Do not treat an external merge, production action, commit, or push as permitted verification for this parent change.

## Verification evidence

### Stale / non-closure evidence

- All evidence previously recorded in this spec is **stale for landing and closure**. It predates this parent-change re-baseline, was collected from partial/dirty context, or relied on/recorded the unsafe proposal to modify `20260729_0025`.
- Earlier passing backend/frontend/migration results may be used only as historical diagnostic context. They do not prove the required clean source identity, immutable historical revision, fresh/`0028` compatibility matrix, browser checks, hunk isolation, or external gates.
- No fresh evidence has been collected under this spec revision.

---
Status: draft
Owner: n.v.t.
Date: 2026-08-11
