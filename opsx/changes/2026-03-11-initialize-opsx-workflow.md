# Initialize OPSX Workflow

## Context
This repository currently has no active OPSX change spec. The OPSX workflow requires a single change spec as the source of truth before implementation work.

## Goals / Non-goals
### Goals
- Create the initial OPSX change spec in the default location.
- Establish acceptance criteria for repository initialization tasks.

### Non-goals
- Implement feature code.
- Set up CI/CD or project tooling beyond OPSX spec scaffolding.

## Proposed approach
Create an initial spec at `opsx/changes/2026-03-11-initialize-opsx-workflow.md` using the required OPSX template sections, then use it as the active spec for subsequent build steps.

## Implementation steps (ordered)
1. Create the `opsx/changes/` directory and initial spec file.
2. Capture initialization scope, acceptance criteria, and verification plan.
3. Mark current status for this bootstrap change.

## Acceptance criteria
- A single active spec exists at `opsx/changes/2026-03-11-initialize-opsx-workflow.md`.
- The spec contains all required OPSX sections.
- The spec has a clear verification plan and status.

## Testing plan
- Verify the spec file exists in the default OPSX location.
- Verify all required sections are present.

## Risk + rollback plan
- Risk: Minimal; this is documentation/bootstrap only.
- Rollback: Remove the created spec file if initialization direction changes.

## Notes / links
- OPSX global rules from `~/.config/opencode/AGENTS.md`.

## Current status
Completed

## What changed
- Created initial OPSX change spec for repository bootstrap.

## How to verify
- Confirm file exists: `opsx/changes/2026-03-11-initialize-opsx-workflow.md`
- Confirm required sections are present in the spec.

## Verification evidence
- Spec file created at `opsx/changes/2026-03-11-initialize-opsx-workflow.md`.
- Verified required sections are present via file review.
