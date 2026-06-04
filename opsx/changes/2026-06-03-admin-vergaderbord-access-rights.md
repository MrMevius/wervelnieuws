# Admin-manageable vergaderbord access rights with soft-deletable boards

## Context

Admins need to control which non-admin users can see and open specific vergaderborden. Board access already exists internally through `Project.invited_user_ids_json`, and current board access checks already distinguish admins from non-admins in parts of the backend. However, there is no dedicated admin UI for assigning board access, board creation is not consistently restricted to admins, and board deletion is not available as a soft-delete admin action.

Clarified requirements:

- Deliver the full flow.
- Non-admin users should see and open only assigned vergaderborden.
- Admin UI should use a separate tab named `Bordrechten`.
- Deleting a vergaderbord means soft delete/archive, not hard delete.

## Goals / Non-goals

### Goals

- Add admin-only board rights management.
- Add a separate admin tab named `Bordrechten`.
- Allow admins to select/deselect users per vergaderbord.
- Ensure admins always see/open all non-archived boards, regardless of assignments.
- Ensure non-admin users see/open only assigned non-archived boards.
- Restrict vergaderbord creation to admins.
- Add admin-only soft delete/archive for vergaderborden using `Project.is_archived`.
- Preserve existing board content/history when a board is deleted.
- Add regression tests for backend access control and frontend admin UI behavior.
- Update the user-facing changelog/About content.

### Non-goals

- No hard deletion of boards, cards, updates, recordings, or history.
- No restore UI for archived boards in this change.
- No per-board roles beyond access/no access.
- No redesign of the full board domain model.
- No normalized permissions table unless implementation proves it technically necessary.
- No newsletter, AI-generation, planning, or publication workflow changes.
- No external permissions provider.

## Proposed approach

Use the existing JSON-backed access model (`Project.invited_user_ids_json`) for this iteration, but isolate board-rights updates through repository/service methods to keep a future migration to a normalized access table straightforward.

Backend:

- Add repository/service methods to list/update board rights and archive boards.
- Add admin-only API endpoints for board rights overview/update.
- Add admin-only API endpoint to soft-delete/archive a board.
- Restrict board creation to admins.
- Preserve existing access semantics:
  - admins bypass assignment checks and can access all non-archived boards;
  - non-admins require assignment to the board.
- Validate selected user IDs and avoid assigning inactive/deleted users where the current user model supports that distinction.
- Keep archived boards hidden from normal list/open flows.

Frontend:

- Add `Bordrechten` to the admin UI.
- Show a board-oriented rights management view with user checkboxes/selectors per board.
- Let admins save assignment changes.
- Add a delete/archive action with confirmation for admins.
- Ensure admin-only controls are not visible to non-admin users.

Docs:

- Add an end-user-friendly changelog entry in `backend/app/api/meta.py`.
- Update `ITERATIONS.md` only if useful for repository history.

## Implementation steps (ordered)

1. Confirm current models, schemas, API routes, and frontend admin structure before editing.
2. Backend repository: add/update methods for board-rights updates, board-rights listing, and board archiving.
3. Backend service: add admin-only board-rights and archive operations with user ID validation.
4. Backend API/schemas: add board-rights endpoints, archive endpoint, and restrict board creation to admins.
5. Backend tests: cover assignment, visibility, direct-access denial, admin access, creation restrictions, and soft delete behavior.
6. Frontend API client: add board-rights and archive calls/types.
7. Frontend admin UI: add `Bordrechten` tab and assignment controls.
8. Frontend admin board management: add admin delete/archive action with confirmation where appropriate.
9. Frontend tests: cover admin tab rendering, assignment save flow, and admin-only behavior.
10. Update user-facing changelog/About content.
11. Run targeted verification, then broader checks when needed.
12. Update this spec with shipped changes, verification commands/results, final status, and follow-ups.

## Acceptance criteria

- Admins can open an admin tab named `Bordrechten`.
- Admins can select and deselect users for each vergaderbord.
- Saving board rights changes updates backend permissions.
- Admins always see/open all non-archived boards, even when not explicitly assigned.
- Non-admin users see only assigned non-archived boards.
- Non-admin users cannot open unassigned boards by direct URL/API.
- Only admins can create vergaderborden.
- Only admins can delete/archive vergaderborden.
- Deleted vergaderborden are soft-deleted/archived, not hard-deleted.
- Soft-deleted boards no longer appear in normal board lists.
- Existing board/card/update history remains in the database after soft delete.
- Backend tests cover access-control regressions.
- Frontend tests cover the admin rights UI behavior.
- User-facing changelog/About content is updated.

## Testing plan

Targeted backend:

```bash
cd backend && uv run pytest tests/test_boards_api.py tests/test_admin_api.py
```

Full backend when shared foundations are touched:

```bash
cd backend && uv run pytest
```

Targeted frontend:

```bash
cd frontend && npm test -- VergaderbordenPage.test.tsx App.test.tsx
```

Frontend build/typecheck:

```bash
cd frontend && npm run build
```

Manual verification if needed:

1. Login as admin.
2. Create a board.
3. Assign one non-admin user to the board in `Bordrechten`.
4. Login as assigned user and confirm the board is visible/openable.
5. Login as unassigned user and confirm the board is hidden and direct API access is denied.
6. Soft-delete/archive the board as admin.
7. Confirm the board disappears from normal listings while database history remains present.

## Risk + rollback plan

### Risks

- Restricting board creation to admins may change behavior if non-admins currently rely on creating boards.
- JSON-based access storage is less queryable/auditable than a join table.
- Frontend admin and regular board flows may share components; changes must avoid exposing admin-only user lists/actions to non-admins.
- Archived boards must be consistently filtered from all relevant normal board routes.
- Tests may reveal existing assumptions around board visibility or creation permissions.

### Rollback

- Revert the new admin routes/UI and permission restriction changes.
- Because this change uses existing JSON storage, rollback should not require data migration.
- Soft-deleted boards can be restored manually by setting `Project.is_archived = false` if needed.
- If implementation unexpectedly introduces a migration, include explicit downgrade/backfill notes before merging.

## Notes / links

Relevant files identified during discovery:

- `backend/app/models/entities.py`
- `backend/app/api/boards.py`
- `backend/app/api/admin.py`
- `backend/app/services/board_service.py`
- `backend/app/repositories/board_repository.py`
- `backend/app/schemas/boards.py`
- `backend/app/schemas/admin.py`
- `frontend/src/app/shell/AppShell.tsx`
- `frontend/src/app/features/admin/VergaderbordenPage.tsx`
- `frontend/src/lib/api/client.ts`
- `backend/tests/test_boards_api.py`
- `backend/tests/test_admin_api.py`
- `frontend/src/app/features/admin/VergaderbordenPage.test.tsx`
- `frontend/src/app/App.test.tsx`
- `backend/app/api/meta.py`
- `docs/changelog-guidelines.md`
- `ITERATIONS.md`

## Current status

Completed.

## What changed

- Created this change spec.
- Added admin-only backend board-rights endpoints for listing board/user access, updating assigned users per board, and soft-deleting/archiving boards.
- Restricted vergaderbord creation to admins.
- Kept admins automatically authorized for all non-archived boards, while non-admin users only see/open assigned boards.
- Ensured archived boards return 404 through normal project/card access flows and disappear from normal board lists.
- Added `Bordrechten` to the Admin UI with per-board user checkboxes, save action, and archive/delete action with confirmation.
- Guarded the direct admin vergaderborden route so non-admins do not see admin-only board-management controls.
- Added backend regression tests for rights assignment, non-admin visibility/API denial, admin-only creation/rights/archive actions, and soft-delete behavior.
- Added frontend tests for the `Bordrechten` tab, deselect/save behavior, archive/delete action, and non-admin direct-route protection.
- Updated the user-facing About/changelog entry in `backend/app/api/meta.py`.

## How to verify

- Backend targeted API tests:

  ```bash
  cd backend && uv run pytest tests/test_boards_api.py tests/test_admin_api.py
  ```

- Full backend test suite:

  ```bash
  cd backend && uv run pytest
  ```

- Frontend targeted tests:

  ```bash
  cd frontend && npm test -- VergaderbordenPage.test.tsx App.test.tsx
  ```

- Frontend build/typecheck:

  ```bash
  cd frontend && npm run build
  ```

## Verification evidence

- Discovery completed without product-code edits.
- Spec created from approved discovery outline.
- `cd backend && uv run pytest tests/test_boards_api.py tests/test_admin_api.py` — passed: 57 tests passed.
- `cd backend && uv run pytest` — passed: 128 tests passed.
- Initial frontend targeted test run exposed a missing import; after fixing it, review found missing route guard/test coverage.
- Added route guard and frontend coverage for Bordrechten save/archive behavior.
- Final `cd frontend && npm test -- VergaderbordenPage.test.tsx App.test.tsx` — passed: 89 tests passed.
- Final `cd frontend && npm run build` — passed: TypeScript build and Vite production build completed.
- Final no-edit review reported no remaining blockers.
