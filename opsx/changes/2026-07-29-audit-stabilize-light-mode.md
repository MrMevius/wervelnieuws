# Title
Audit and stabilize frontend light mode

## Context
The frontend light theme needs a full audit and stabilization pass. The highest-priority regression is that buttons in the shown board detail modal are not clearly visible in light mode. The review scope also includes checking buttons, disabled states, inputs, cards/update cards, modals, navigation, status pills, dropzones, and focus states across the frontend light theme.

This change must preserve existing behavior, workflow, layout, spacing, and typography. It must not redesign the brand system or the dark theme, except for minimal cross-theme fixes needed to prevent regressions. The work should be done in phases so the theme foundation can be stabilized before touching more surfaces.

## Goals / Non-goals
### Goals
- Restore visible, usable buttons in the shown board detail modal in light mode.
- Audit and stabilize light-mode styling for buttons, disabled states, inputs, cards/update cards, modals, navigation, status pills, dropzones, and focus states.
- Preserve current behavior, workflow, layout, spacing, and typography.
- Keep dark theme unchanged unless a small shared-token correction is required to avoid regressions.
- Improve light-mode contrast and affordance to meet WCAG AA where applicable.
- Add or update frontend regression tests for the targeted surfaces.
- Add the required About-page changelog entry for the completed iteration.

### Non-goals
- No redesign of the brand, shell, or visual language.
- No layout rework, spacing overhaul, or typography changes.
- No workflow or behavior changes.
- No dark-theme redesign.
 - No backend, API, or data-model changes, except the minimal About/changelog content update needed to surface the required user-facing entry through the existing metadata endpoint.
- No broad refactor of component architecture unless required to isolate a regression fix.

## Proposed approach
1. Audit the current light-mode token usage and the components that rely on it, with emphasis on the board detail modal action buttons.
2. Stabilize the foundation first: tokens, inputs, and button states so visibility/contrast problems are corrected at the source.
3. Apply the corrected foundation to cards and update surfaces to keep light-mode surfaces consistent.
4. Tighten modal and navigation styling so interactive controls remain legible and focusable in light mode.
5. Clean up legacy palette usage only where it causes light-mode regressions or cross-theme leakage.
6. Verify the result with automated tests, build/typecheck, token/CSS regression checks where practical, and manual browser checks in both light and dark mode.

## Implementation steps (ordered)
1. **Phase 1 — token / input / button foundation**
   - Inspect the frontend theme tokens, shared button variants, input controls, disabled styles, and focus-ring treatments used in light mode.
   - Identify why the board detail modal buttons are not visibly readable or actionable in the current light theme.
   - Update the smallest shared token/component set needed to restore clear contrast and interaction affordance without changing sizing or layout.
2. **Phase 2 — cards / update surfaces**
   - Audit card, update-card, status-pill, and dropzone surfaces in light mode.
   - Align surface, border, text, and disabled/read-only treatments so content remains scannable and controls remain distinct.
   - Keep spacing, structure, and typography untouched.
3. **Phase 3 — modals / navigation**
   - Audit modal shells, modal actions, and navigation surfaces in light mode.
   - Ensure visible primary/secondary/destructive buttons, clear focus states, and consistent disabled behavior inside the board detail modal and nearby modal patterns.
   - Check navigation items, active states, and hover/focus states for light-mode legibility.
4. **Phase 4 — legacy palette cleanup**
   - Remove or constrain legacy light-mode palette values that still leak into interactive or elevated surfaces.
   - Only touch shared/dark-linked tokens if needed to prevent regressions across themes.
   - Confirm the cleanup does not alter layout or behavior.
5. **Phase 5 — regression verification**
   - Add or update frontend tests for the button visibility regression and any touched theme surfaces.
   - Run the frontend test suite, build, and typecheck.
   - Perform manual browser verification in light and dark mode, including WCAG AA contrast checks for key interactive surfaces.
   - Add the About-page changelog entry and verify it appears in the app’s About content.

## Acceptance criteria
1. Buttons in the shown board detail modal are clearly visible and usable in light mode.
2. Light-mode buttons, disabled states, inputs, cards/update cards, modals, navigation, status pills, dropzones, and focus states have consistent, legible contrast and affordance.
3. Existing behavior, workflow, layout, spacing, and typography are unchanged.
4. Dark theme remains visually unchanged unless a minimal regression-prevention token fix is required.
5. No unintended brand redesign or palette overhaul is introduced.
6. Automated frontend tests covering the changed areas pass.
7. Frontend build and typecheck pass.
8. Manual browser verification confirms light-mode usability on the affected surfaces.
9. Manual light/dark checks confirm WCAG AA contrast for primary text, essential controls, focus states, and key surface boundaries where applicable.
10. The About-page changelog entry is added and verifiable in-app.

## Testing plan
- Frontend tests:
  - Run the existing Vitest suite from `frontend/`.
  - Add/update targeted tests for the board detail modal button visibility and any touched shared theme behaviors.
- Build / typecheck:
  - `cd frontend && npm run build` (`tsc -b && vite build`)
  - If a dedicated typecheck step is added later, use the repo-standard command; otherwise rely on `npm run build` for type safety.
- CSS / token regression checks, if practical:
  - Inspect shared theme token usage for accidental light/dark leakage.
  - Prefer targeted component assertions over brittle snapshot churn.
  - If useful, add narrow style assertions for critical classes/state combinations rather than broad visual snapshots.
- Manual browser verification:
  1. Open the board detail modal in light mode and confirm all buttons are visible, distinguishable, and clickable.
  2. Check disabled states, hover states, and focus states for the affected interactive controls.
  3. Inspect inputs, cards/update cards, modals, navigation, status pills, and dropzones in light mode.
  4. Repeat a dark-mode smoke check to confirm no unintended regressions.
  5. Validate key text/control contrast against WCAG AA expectations in the browser devtools or an accessible color-contrast workflow.
- About-page verification:
  - Confirm the changelog/About entry is present and readable in the app.

## Risk + rollback plan
### Risks
- Shared token changes could improve the light theme but accidentally shift dark theme subtleties.
- Over-correcting contrast could make the UI feel heavier or deviate from the existing visual language.
- Legacy palette cleanup could accidentally touch unrelated components if the scope is too broad.
- Style changes might fix visibility but unintentionally alter perceived spacing or hierarchy.

### Rollback
- Revert the token/component updates introduced for the light-mode foundation.
- Revert any secondary surface, modal, or navigation styling changes that are not required for the button visibility fix.
- Restore legacy palette values if cleanup causes regressions.
- Remove the About-page changelog entry only if the wider change is rolled back.
- Re-run the frontend verification commands after rollback to confirm the UI is stable.

## Notes / links
- Scope confirmation: full frontend light-mode audit/stabilization with special attention to the board detail modal buttons.
- Preserve existing behavior, workflow, layout, spacing, and typography.
- Do not redesign brand or dark theme except for regression prevention.
- Related frontend areas to inspect:
  - `frontend/src/app/features/admin/VergaderbordenPage.tsx`
  - `frontend/src/app/shell/AppShell.tsx`
  - `frontend/src/app/App.test.tsx`
  - `frontend/package.json`
- Repo rule reminder: each completed iteration must add a functional, end-user-friendly About-page changelog entry.

## Current status
Partial

Review verdict: Partially meets.

Follow-ups:
- Manual browser and contrast verification in light mode.
- Dark-mode smoke check.
- Toolbar layout-shift check.
- No action in this change for unrelated pre-existing audio/Whisper work.

## What changed
Implemented a phased light-mode stabilization pass in the frontend: shared control/token normalization, visible board-detail modal actions, card/update and modal/navigation surface cleanup, and light-mode/status palette cleanup. Shipped the frontend regression coverage and build-safe changes alongside the About/changelog content source update so the new entry is visible in-app. Shipped areas: theme tokens, board-detail modal buttons, cards/update cards, modals, navigation, status pills, and focused light-mode regressions.

## How to verify
- `cd frontend && npm test -- src/styles.lightmode.test.ts src/app/App.test.tsx src/app/features/admin/VergaderbordenPage.test.tsx`
- `cd frontend && npm run build`
- If the backend Python environment is available, `python3 -m pytest backend/tests/test_meta_and_me.py -k about_returns_read_only_payload`
- Manual browser check: open the board detail modal in light mode and confirm buttons, disabled controls, inputs, status pills, dropzones, and focus states remain legible; repeat a dark-mode smoke check and toolbar layout-shift check.
- Confirm the About/changelog entry is present and readable in-app.

## Verification evidence
- PASS: `cd frontend && npm test -- src/styles.lightmode.test.ts src/app/App.test.tsx src/app/features/admin/VergaderbordenPage.test.tsx`
- PASS: `cd frontend && npm run build`
- BLOCKED: `python3 -m pytest backend/tests/test_meta_and_me.py -k about_returns_read_only_payload` → `ModuleNotFoundError: No module named 'fastapi'` in this shell environment
- PASS: About/changelog entry added and surfaced in the app content source.

Remaining gaps:
- Manual browser and contrast verification.
- Dark-mode smoke check.
- Toolbar layout-shift check.
- Unrelated pre-existing audio/Whisper work remains out of scope.

---
Status: partial
Owner: n.v.t.
Date: 2026-07-29
