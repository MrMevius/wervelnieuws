# Title
Select team members by avatar

## Context
The current team member selector in the add/edit card form uses name-based checkboxes. The requested UI change is to make selection visual and compact by selecting via avatar tiles instead of visible names.

This spec treats the provided draft outline as the source of truth and keeps scope limited to the selection UI inside the add/edit card form.

## Goals / Non-goals
### Goals
- Replace checkbox + visible name selection in add/edit card forms with a clickable avatar tile/grid selector.
- Use member photo when available.
- Show initials placeholder when no photo exists.
- Keep selected state clearly visible.
- Preserve usability and accessibility with keyboard focus styles and screen reader labels (`aria-label`/`title` or equivalent).
- Keep existing add-card/edit-card flow behavior working.

### Non-goals
- No new team member photo upload/management feature unless already present in existing data flow.
- No backend team member model changes unless strictly required for existing frontend data access.
- No redesign of other team member displays outside this specific selection component.

## Proposed approach
1. Locate the current team member selector in add/edit card UI and isolate selection rendering logic.
2. Replace checkbox row/list rendering with an avatar tile/grid component pattern while retaining existing selection state wiring.
3. For each member, render image avatar when `photo/avatar URL` is present; otherwise render deterministic initials placeholder.
4. Hide visible member names in the selector UI while preserving semantic labels for accessibility.
5. Implement explicit selected/unselected visual states and keyboard-focus-visible styles.
6. Keep payload/state contract unchanged where possible so add/edit submission behavior remains intact.
7. Add/update frontend tests and manual verification notes for selection behavior and accessibility basics.

## Implementation steps (ordered)
1. Identify add-card and edit-card selector component(s) and current data shape for team members.
2. Extract or create a reusable avatar-tile selector UI for both add and edit flows (if both paths exist).
3. Implement avatar image rendering with robust fallback to initials placeholder.
4. Remove visible name text from selection tiles while adding `aria-label` and/or `title` containing member name.
5. Implement clear selected state visuals (e.g., border/ring/check indicator + contrast-safe styles).
6. Ensure keyboard interaction works (tab focus, enter/space activation if custom button semantics are used).
7. Verify no backend/API contract changes are required; if required, document minimal change and rationale.
8. Add/update targeted frontend tests for:
   - click select/deselect,
   - fallback initials,
   - no visible names in selector,
   - accessibility attributes/focus behavior.
9. Update About/changelog entry with an end-user friendly note per repo Definition of Done.
10. During implementation/finalization, fill `How to verify` and `Verification evidence` with exact commands and outcomes.

## Acceptance criteria
1. In add/edit card forms, users can select and deselect team members by clicking avatar/photo/placeholder tiles.
2. Selected members are visually distinguishable from unselected members.
3. Member names are not visibly shown inside the selection UI.
4. Members without photo/avatar data display initials placeholders.
5. Keyboard/focus interaction and screen reader labeling remain usable (via accessible labels and focus-visible states).
6. Existing add-card flow continues to work without regression in submission behavior.

## Testing plan
- Inspect existing frontend tests for the card form/member selector and extend where appropriate.
- Add targeted component/integration tests for avatar selection behavior and fallback rendering.
- Manual UI verification:
  1. Open add-card form and toggle multiple members via avatar tiles.
  2. Open edit-card form and confirm preselected members render correctly and can be toggled.
  3. Verify members without photo render initials.
  4. Verify names are not visibly displayed in selector.
  5. Verify keyboard navigation/focus visibility and accessible labels via dev tools/screen reader quick check.
- Run relevant frontend scripts from package config (exact commands to be recorded during implementation under `How to verify`).

## Risk + rollback plan
### Risks
- Some environments may have sparse/missing avatar data, causing frequent fallback usage.
- Visual-only selection could reduce clarity if selected-state styling is too subtle.
- Accessibility regressions if custom clickable tiles are not implemented with proper semantics.

### Mitigation
- Use reliable initials fallback for all missing photos.
- Use strong selected-state affordances (ring/check/high contrast) validated in manual checks.
- Keep semantic button/input behavior and explicit accessible labels; test keyboard/focus behavior.

### Rollback
- Revert selector UI changes to prior checkbox + visible names implementation.
- No data migration rollback expected when backend contract remains unchanged.

## Notes / links
- User-provided draft outline is the source of truth for scope and acceptance.
- Suggested slug from user: `select-team-members-by-avatar`.
- Docs impact requirement included: update website changelog/About page during implementation.

## Current status
Completed

## What changed
- Replaced the add-card team member checkbox list in `frontend/src/app/features/admin/VergaderbordenPage.tsx` with clickable avatar tiles inside the existing selector dropdown.
- Kept existing form state and payload contract unchanged (`assignment_user_ids` still driven by `selectedUserIds` + hidden inputs), so add-card submission behavior stays intact.
- Added avatar rendering support for optional `avatar_url` values when present and deterministic initials fallback when no avatar is available.
- Removed visible name labels from tiles while preserving accessibility via `aria-label`, `title`, `role="option"`, and `aria-selected`.
- Added clear visual selected/focus states and avatar tile styling in `frontend/src/styles.css`.
- Added targeted regression test coverage in `frontend/src/app/features/admin/VergaderbordenPage.test.tsx` for avatar-tile selection, initials fallback, hidden visible names, and preserved submit payload.
- Updated About/changelog entry in `backend/app/api/meta.py` (iteration 56) with end-user friendly release notes.
- Bugfix: admin user responses now include `has_avatar`, and admins can fetch stored user avatars through `GET /api/admin/users/{user_id}/avatar`.
- Bugfix: the avatar selector now uses that existing stored-avatar endpoint when `has_avatar` is true, so users such as Mark Mevius render their profile photo instead of initials.
- Display extension: board-card assignment payloads now include `has_avatar` and assigned users on overview cards and card detail render an avatar row with profile photos where available.
- Updated About/changelog iteration 56 to mention assigned-user profile photos on cards and card details.

## How to verify
- `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
- `cd frontend && npm test`
- `cd frontend && npm run build`
- `cd backend && uv run pytest tests/test_admin_api.py -q`
- `cd backend && uv run pytest tests/test_admin_api.py tests/test_boards_api.py -q`

## Verification evidence
- ✅ Pass: `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
  - Result: `1 passed` test file, `31 passed` tests.
- ✅ Pass: `cd frontend && npm test`
  - Result: `2 passed` test files, `79 passed` tests.
- ✅ Pass: `cd frontend && npm run build`
  - Result: TypeScript build and Vite production build completed successfully.
- ✅ Pass: `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
  - Bugfix rerun result: `1 passed` test file, `31 passed` tests.
- ✅ Pass: `cd backend && uv run pytest tests/test_admin_api.py -q`
  - Result: `26 passed` tests.
- ✅ Pass: `cd frontend && npm run build`
  - Bugfix rerun result: TypeScript build and Vite production build completed successfully.
- ✅ Pass: `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
  - Display extension rerun result: `1 passed` test file, `31 passed` tests.
- ✅ Pass: `cd backend && uv run pytest tests/test_admin_api.py tests/test_boards_api.py -q`
  - Result: `47 passed` tests.
- ✅ Pass: `cd frontend && npm run build`
  - Display extension rerun result: TypeScript build and Vite production build completed successfully.
- Review: `opsx-review` and `opsx-docs` subagent calls returned `ProviderModelNotFoundError`; orchestrator performed a no-edit manual review against the acceptance criteria and found no blocking issues.

## Implementation notes
- Scope intentionally limited to the add-card selector UI in Vergaderborden, matching current code paths. No backend contract changes were required for team member selection data.
- Photo usage is implemented as optional `avatar_url` support when provided by API responses; when absent, initials placeholders are rendered.

## Bugfix update: stored profile photo fallback
- Reported issue: Mark Mevius has a profile photo, but the selector still shows initials.
- Root cause to address: `AdminUser` data currently exposes no direct avatar URL/availability in the frontend type, while the selector only checks optional `avatar_url`.
- Updated scope: expose/use existing stored avatar availability for admin users and render a profile-photo URL in the selector when `has_avatar` is true, falling back to initials only when no stored avatar exists.
- Acceptance addition: an admin user with `has_avatar: true` renders an `<img>` in the avatar selector using the existing avatar storage endpoint pattern.
- Final result: implemented via `AdminUserResponse.has_avatar`, `GET /api/admin/users/{user_id}/avatar`, and frontend `getAdminUserAvatarUrl(userId)` fallback in `avatarUrlForUser`.

## Display extension: assigned user avatars on cards
- Requested behavior: board overview cards and card detail should show an avatar row for assigned users, using profile photos when available and initials only as fallback.
- Scope: update assignment payloads with avatar availability, render assigned-user avatar rows on overview cards and card detail, keep accessible labels/tooltips.
- Acceptance addition: assigned users with `has_avatar: true` render photo avatars on both overview cards and card detail; assigned users without avatars still render initials placeholders.
- Final result: implemented via `CardAssignmentResponse.has_avatar`, frontend assignment avatar row rendering, and the existing `getAdminUserAvatarUrl(userId)` fallback.

---
Status: completed
Owner: OPSX Implementer
Date: 2026-05-29
