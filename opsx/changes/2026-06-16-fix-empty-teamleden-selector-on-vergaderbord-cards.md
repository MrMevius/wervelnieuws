# Fix empty Teamleden selector on vergaderbord cards

## Context

On vergaderbord cards, the Teamleden selector currently renders no options on all boards. The likely root cause is that the frontend is sourcing selectable users from an admin-only user list instead of the board-scoped assignable users list, which leaves invited non-admin board users with an empty selector.

This change should fix the user-selection source, add resilient loading/error/empty states, and tighten backend validation so card assignments can only reference allowed active board users.

A narrow follow-up is also in scope to align stale frontend test expectations in `App.test.tsx` with the new Teamleden empty/error-state copy, so repo verification can stay green without expanding product behavior.

## Goals / Non-goals

### Goals

- Show board-scoped assignable users in the Teamleden selector on vergaderbord cards.
- Allow invited non-admin board users to select valid team members when creating a card.
- Show a useful loading, error, or empty state instead of silently rendering a blank selector.
- Align stale frontend expectations in `App.test.tsx` with the new Teamleden empty/error-state copy.
- Validate `assignment_user_ids` against allowed active board users on the backend.
- Preserve admin workflows.
- Add frontend and backend regression tests.
- Update the website changelog/About entry if implementation proceeds.

### Non-goals

- No UI redesign of the vergaderbord card form.
- No broader permission model redesign.
- No new assignment editing for existing cards unless explicitly added later.
- No product behavior expansion beyond copy/expectation alignment for the existing empty/error states.
- No unrelated board, topic, or publication workflow changes.

## Proposed approach

- Frontend: switch the Teamleden selector data source to the existing board-scoped assignable users endpoint/data model used by vergaderborden.
- Frontend: add explicit loading, error, and empty states so a data issue is visible to the user.
- Frontend: update stale `App.test.tsx` assertions to match the new Teamleden empty/error-state copy.
- Backend: enforce that submitted `assignment_user_ids` are limited to active users allowed on the current board.
- Backend: keep admin access working by ensuring admins continue to see/select the full allowed set where appropriate.
- Tests: add regression coverage for visible options, load failure handling, and allowed/disallowed assignee validation.
- Docs: add an end-user friendly About/changelog note during implementation.

## Implementation steps (ordered)

1. Inspect the current Teamleden selector flow and the board/user data source used by `VergaderbordenPage`.
2. Update the frontend selector to consume board-scoped assignable users instead of the admin-only user list.
3. Add loading, error, and empty states that prevent silent blank rendering.
4. Update stale `App.test.tsx` expectations to match the new Teamleden empty/error-state copy.
5. Tighten backend validation for `assignment_user_ids` against active board-allowed users.
6. Ensure admin create-card flows continue to work with the updated validation and data source.
7. Add frontend regression tests for visible options and failed-load behavior.
8. Add backend regression tests for allowed and disallowed assignees.
9. Update the website changelog/About content for the user-visible fix.
10. Run targeted verification and record results in this spec.

## Acceptance criteria

- Board users are visible/selectable in the Teamleden selector.
- Invited non-admin board users can select valid team members when creating a card.
- If user loading fails, the selector shows an explicit error state instead of a blank list.
- If no assignable users exist, the selector shows an explicit empty state.
- Invalid or inactive assignees are rejected by backend validation.
- Admin create-card flows continue to work.
- `App.test.tsx` expectations match the new Teamleden copy.
- Frontend and backend regression tests cover the fix.
- The user-facing changelog/About entry is updated when implementation ships.
- The full frontend suite passes after this follow-up.

## Testing plan

Targeted frontend tests:

- Add or update tests around `frontend/src/app/features/admin/VergaderbordenPage.tsx` for:
  - visible board-scoped options,
  - loading/error/empty state handling,
  - admin and invited non-admin create-card flows.
- Align stale `frontend/src/App.test.tsx` expectations with the new Teamleden empty/error-state copy.

Full frontend verification:

- Run the full frontend test suite after the expectation alignment; it should pass.

Targeted backend tests:

- Add or update tests in `backend/tests/test_boards_api.py` for:
  - allowed active board users accepted,
  - invalid/inactive assignees rejected,
  - admin path remains valid.

Manual verification:

1. Log in as an admin and confirm Teamleden shows board-scoped users.
2. Log in as an invited non-admin board user and create a card with valid team members.
3. Simulate a user-loading failure and confirm the selector shows an error state.
4. Confirm invalid assignee IDs are rejected by the backend.

## Risk + rollback plan

### Risks

- Stricter validation may reject payloads that were previously accepted.
- The intended assignable user set may differ between admin and non-admin flows.
- Frontend state handling may need to distinguish empty, loading, and error states carefully to avoid regressions.

### Rollback

- Revert the selector data-source change and backend validation tightening.
- Restore the previous behavior if the new assignee constraints block legitimate card creation.
- Since this is a behavior-only change, rollback should not require a migration.

## Notes / links

- Source of truth: user-provided draft outline in this request.
- Relevant files:
  - `frontend/src/app/features/admin/VergaderbordenPage.tsx`
  - `frontend/src/lib/api/client.ts`
  - `backend/app/api/boards.py`
  - `backend/app/api/admin.py`
  - `backend/app/services/board_service.py`
  - `backend/tests/test_boards_api.py`
  - `opsx/changes/2026-05-29-select-team-members-by-avatar.md`

## Current status

done

## What changed

- Aligned `frontend/src/app/App.test.tsx` with the current Teamleden board-scoped behavior by adding `access_users` to the mocked board payload, so the selector renders the expected selectable state instead of the empty-state fallback.
- The vergaderbord card create form now uses board-scoped active access users for the Teamleden selector instead of the admin-only user list.
- The selector now shows explicit loading, error, and empty-state messages instead of a blank menu.
- Backend card-creation validation now rejects inactive or board-disallowed `assignment_user_ids`.
- Added frontend and backend regression tests for the selector source, state handling, and assignee validation.
- Added a new user-facing changelog/About entry for the fix.
- Card creation now validates assignees before persistence and commits the new card + assignments together, so rejected assignee IDs cannot leave behind a partially created card.
- Added a regression assertion proving the board card list stays unchanged after invalid/inactive/disallowed assignee submissions.

## How to verify

- `cd frontend && npm test -- --run src/app/App.test.tsx`
- `cd frontend && npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx`
- `cd frontend && npm run build`
- `cd backend && ./.venv/bin/pytest tests/test_boards_api.py tests/test_meta_and_me.py`
- `cd backend && ./.venv/bin/pytest tests/test_boards_api.py -q`

## Verification evidence

- `frontend && npm test -- --run src/app/App.test.tsx`: passed (`73 tests`)
- `frontend && npm test`: passed (`117 tests`)
- `frontend/src/app/features/admin/VergaderbordenPage.test.tsx`: passed (`40 tests`)
- `frontend && npm run build`: passed (`tsc -b && vite build`)
- `backend && ./.venv/bin/pytest tests/test_boards_api.py tests/test_meta_and_me.py`: passed (`55 tests`)
- `backend && ./.venv/bin/pytest tests/test_boards_api.py -q`: passed (`31 passed`)

---
Status: done
Owner: —
Date: 2026-06-16
