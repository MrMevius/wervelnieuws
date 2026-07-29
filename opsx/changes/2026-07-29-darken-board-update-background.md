# Title
Darken board update item background in dark mode

## Context
The `.board-update-item` cards on the vergaderborden detail view already have workable layout, spacing, typography, borders, purple accents, and behavior. In dark mode, however, the card background blends too much with the surrounding page surface, making updates less clearly separated from the rest of the interface.

This change is intentionally narrow: it applies only to `.board-update-item` and only in dark theme styling. Light theme, other update cards, and broader board/component theming are explicitly out of scope.

## Goals / Non-goals
### Goals
- Make `.board-update-item` backgrounds in dark mode more clearly separated from the surrounding page background.
- Use a slightly darker neutral charcoal surface, not a more saturated purple surface.
- Preserve layout, spacing, typography, borders, purple accents, and existing behavior.
- Keep the change scoped to dark theme styling for `.board-update-item` only.
- Validate the change with frontend tests, build, and manual dark-mode visual verification.

### Non-goals
- No changes to light theme styling.
- No changes to other update cards/components or shared board surfaces.
- No changes to layout, spacing, typography, borders, icons, interactions, or behavior.
- No redesign of the board updates section or surrounding page chrome.
- No backend, API, or data-model changes.

## Proposed approach
1. Inspect the current `.board-update-item` styling and the dark-theme color tokens that feed it.
2. Adjust only the dark-mode background treatment for that selector so it reads as a slightly darker neutral charcoal surface against the page.
3. Preserve the current border, accent stripe/purple accent treatment, padding, radius, and shadow behavior.
4. Avoid introducing a more saturated purple surface; keep the result neutral and subtle.
5. Verify that the card still fits the existing board visual system and that only the intended dark-mode surface changes.

## Implementation steps (ordered)
1. Locate the `.board-update-item` rule and any dark-theme overrides that affect it.
2. Identify the minimal styling change needed to darken the card background without altering layout or accents.
3. Apply the dark-mode-only background adjustment scoped to `.board-update-item`.
4. Confirm no light-theme rules or unrelated board/update components are changed.
5. Update or add frontend tests only if a targeted assertion is needed to protect the scoped styling change.
6. Run the relevant frontend test and build commands.
7. Perform manual dark-mode visual verification on the board update items.
8. Record verification results in this spec.

## Acceptance criteria
1. In dark mode, `.board-update-item` has a visibly darker neutral charcoal background than before.
2. The updates are more clearly separated from the surrounding background.
3. Layout, spacing, typography, borders, purple accents, and behavior remain unchanged.
4. The change applies only to `.board-update-item` and only in dark theme styling.
5. Light theme appearance is unchanged.
6. Other update cards/components are unchanged.
7. Frontend tests pass.
8. Frontend build passes.
9. Manual dark-mode visual verification confirms the cards read as clearly separated without becoming purple-tinted.

## Testing plan
- Frontend tests:
  - `cd frontend && npm test -- --run`
- Frontend build:
  - `cd frontend && npm run build`
- Manual verification:
  1. Open the board detail view in dark mode.
  2. Inspect `.board-update-item` cards against the surrounding board background.
  3. Confirm the card surface is slightly darker and more neutral/charcoal.
  4. Confirm spacing, typography, borders, purple accents, and interactions are unchanged.
  5. Confirm light theme and other update components were not affected.

## Risk + rollback plan
### Risks
- The surface change may be too subtle to improve separation.
- A selector or token change could accidentally affect other board surfaces if scoped too broadly.
- Contrast could regress if the darker surface is tuned too aggressively.

### Rollback
- Revert the dark-mode-only `.board-update-item` background change.
- Restore the previous styling value(s) or selector override.
- Revert any test changes tied to this styling update.
- Re-run the frontend checks to confirm the rollback is stable.

## Notes / links
- Slug: `darken-board-update-background`
- Scope confirmation: only `.board-update-item`, only dark theme styling.
- Desired direction: slightly darker neutral charcoal surface, not a stronger purple surface.
- Relevant area: frontend board updates styling in the admin vergaderborden view.

## Current status
Partial — CSS change shipped; manual browser visual proof is still missing.

## What changed
Updated `.board-update-item` styling for dark theme only so the card background reads as a slightly darker neutral charcoal while preserving the existing purple accent strip, border, shadow, spacing, typography, and light theme. No user-facing docs/changelog entry was shipped in this close-out; the repo's About-page changelog update remains a follow-up if/when the change is fully completed.

## How to verify
- `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx -t "toont opnames in dezelfde updates-lijst"`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`
- Manual browser dark-mode visual verification of `.board-update-item` cards in the vergaderborden detail view was not performed.

## Verification evidence
- PASS: `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx -t "toont opnames in dezelfde updates-lijst"`
- PASS: `cd frontend && npm test -- --run`
- PASS: `cd frontend && npm run build`
- NOT PERFORMED: manual browser dark-mode visual verification for `.board-update-item` in the vergaderborden detail view.

## Review verdict
Partially meets — the scoped CSS change and automated verification pass, but visual proof is missing.

## Follow-ups
- Perform manual dark-mode browser verification for `.board-update-item` and capture proof.
- If the change is later closed as complete, add the repo-required user-facing About-page changelog entry then.

---
Status: partial
Owner: n.v.t.
Date: 2026-07-29
