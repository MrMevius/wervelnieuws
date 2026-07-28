# Title
Improve main modal dark color system

## Context
The referenced main modal currently has a usable layout, spacing, and typography, but its color treatment does not yet provide a strong enough visual hierarchy in dark mode. The result is that surfaces, borders, secondary text, and emphasis states can feel too flat or too similar, making the modal harder to scan quickly.

This change is intentionally narrow: it targets only the single main modal the user referenced. It must not expand to all modals, all board modals, or broader UI theming. Layout, spacing, component sizing, and typography are to remain unchanged.

## Goals / Non-goals
### Goals
- Improve the main modal's dark color system so hierarchy is clearer and more readable.
- Strengthen distinctions between modal surface, header, body, footer, borders, helper text, and emphasis states.
- Preserve the existing layout, spacing, and typography exactly.
- Keep the change localized to the single referenced main modal.
- Maintain accessibility-conscious contrast in dark mode.

### Non-goals
- No redesign of the modal layout or content structure.
- No changes to spacing, padding, font sizes, or typography scale.
- No changes to other modals.
- No changes to all board modals or global theme tokens unless strictly needed for this one modal only.
- No backend, data, or workflow changes.

## Proposed approach
1. Inspect the main modal's current dark-mode styling, including surface, border, shadow, text, and action color usage.
2. Identify the smallest styling surface needed to improve hierarchy without touching layout or typography.
3. Introduce or adjust modal-scoped color tokens/classes for:
   - base surface
   - elevated header/footer separation
   - primary vs secondary text
   - subtle borders/dividers
   - focus/active states
   - destructive or cautionary accents if present
4. Keep all sizing, spacing, and type rules untouched.
5. Verify the modal still feels visually consistent with the surrounding app while being easier to read in dark mode.

## Implementation steps (ordered)
1. Locate the single main modal component and its current styling hooks.
2. Audit the existing dark-mode colors used inside that modal.
3. Define the minimal color adjustments needed to increase hierarchy while preserving layout and typography.
4. Apply the color updates only within the modal scope.
5. Confirm no shared styles unintentionally affect other modals or board modals.
6. Add or update frontend tests only if needed to protect the targeted modal appearance or behavior.
7. Run the relevant frontend verification commands.
8. Update this spec with implementation results, verification, and evidence.

## Acceptance criteria
1. Only the referenced main modal is changed.
2. Layout, spacing, and typography remain unchanged.
3. The modal's dark-mode color system provides clearer hierarchy than before.
4. Header/body/footer and text emphasis are easier to distinguish at a glance.
5. The change does not alter other modals or all board modals.
6. Any adjusted colors remain readable and accessible in dark mode.
7. Relevant frontend tests and build checks pass.

## Testing plan
- Targeted frontend tests for the main modal, if a dedicated test exists.
- Frontend build:
  - `cd frontend && npm run build`
- Manual verification:
  1. Open the referenced main modal in dark mode.
  2. Confirm layout, spacing, and typography are unchanged.
  3. Confirm the modal surface, borders, text, and action emphasis now read with clearer hierarchy.
  4. Confirm no other modal variants changed unexpectedly.

## Risk + rollback plan
### Risks
- Color-only changes may be too subtle and fail to improve hierarchy.
- Scoped style changes could accidentally leak into related modal components if selectors are too broad.
- Dark-mode contrast could regress if tokens are not tuned carefully.

### Rollback
- Revert the modal-scoped color adjustments.
- Restore the previous modal color values or classes.
- Revert any test updates tied to this change.
- Re-run the targeted checks to confirm the prior state is stable.

## Notes / links
- Scope confirmation from user: only the single referenced main modal, not all modals or all board modals.
- Preserve layout, spacing, and typography; change only color system and visual hierarchy.
- Related style-only modal polish work exists in nearby OPSX changes, but this spec remains separate and tightly scoped.

## Current status
Partial — implementation complete; backend and visual/a11y verification remain limited.

## What changed
Implemented a modal-local dark color-system refresh for the admin user profile/account modal only. The update reduces purple-tinted surfaces, shifts the modal and its inner sections to neutral charcoal layers, strengthens borders and control contrast, and keeps layout/spacing/typography/behavior unchanged. Also added the matching About-page changelog entry.

## How to verify
- `cd frontend && npm run build`
- `cd backend && pytest tests/test_meta_and_me.py -k about`
- Manually open the admin user profile modal in dark mode and confirm layout/spacing/typography/behavior are unchanged while the surfaces, borders, and controls are more neutral and easier to scan.

## Verification evidence
- PASS — `cd frontend && npm test -- --run` (3 test files, 129 tests passed)
- PASS — `cd frontend && npm run build` (typecheck and production build)
- BLOCKED — `cd backend && pytest tests/test_meta_and_me.py -q` (`fastapi` is missing from the local Python environment)
- User accepted the partial verification as sufficient for close-out.
- Review noted that dedicated visual/WCAG evidence was not captured; no layout, typography, or behavior regressions were found in available checks.

## Status
partial

## Follow-ups
- Re-run backend verification in an environment with the project dependencies installed.
- Capture dedicated visual/accessibility evidence if stronger WCAG proof is required.

## Owner
n/a

## Date
2026-07-28
