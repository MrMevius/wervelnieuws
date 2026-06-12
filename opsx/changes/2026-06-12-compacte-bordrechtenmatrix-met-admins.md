# Compacte Bordrechtenmatrix met admins

## Context
De huidige Admin > Bordrechten-matrix is functioneel, maar te ruim opgezet en mist admins in het overzicht. Daardoor voelt de pagina onnodig breed aan en is niet direct zichtbaar dat admins overal toegang hebben. Deze wijziging pakt alleen de matrix-UX aan.

## Doelen / non-doelen
### Doelen
- Maak de matrix visueel compacter: lagere rijhoogte, minder padding, compactere toolbar en kleinere board headers.
- Toon admins in hetzelfde overzicht als read-only rijen.
- Admin-rijen tonen overal aangevinkte toegang, zijn niet bewerkbaar en krijgen een duidelijke **Admin**-badge.
- Actieve niet-admins blijven volledig bewerkbaar.
- Inactieve niet-admins blijven zichtbaar in het complete overzicht, maar zijn read-only/disabled, krijgen een duidelijke uitleg/badge en worden uitgesloten van dirty-state en save-payloads.
- Bestaande save-all blijft werken zoals nu voor bewerkbare actieve niet-admins.
- Admin-clicks en clicks op inactieve niet-admins mogen geen dirty state of save-payload veroorzaken.
- Voeg toegankelijke labels toe voor de uitgeschakelde admin-cellen.

### Non-doelen
- Geen backend auth-model wijzigingen.
- Geen nieuwe rollen of permissieniveaus.
- Geen per-cel/per-user save flow.
- Geen redesign van andere admin-pagina’s.

## Voorgestelde aanpak
- Houd de bestaande user x board matrix aan.
- Gebruik de bestaande response met `is_admin` om admins als read-only rijen in dezelfde matrix te renderen.
- Render admin-rijen met alles aangevinkt, disabled controls en read-only styling.
- Render inactieve niet-admins als read-only rijen met hun bestaande toegangsstaat, een expliciete inactief-indicatie en disabled controls.
- Laat dirty-tracking en save-payloads expliciet alleen actieve niet-admins meenemen.
- Verklein matrixdichtheid via lokale frontend-styling op shell, header, toolbar, cells en row spacing.
- Voeg tests toe voor zichtbaarheid, read-only gedrag, geen dirty state, save-filtering en niet-admin regressies.

## Uitvoeringsstappen (op volgorde)
1. Inspecteer de huidige Bordrechten-matrix, dirty-state logica en bestaande frontendtests.
2. Pas de matrixlayout aan naar compactere spacing, kleinere headers en compactere toolbar.
3. Voeg admins toe aan de matrix als read-only rijen met **Admin**-badge en volledige access-state.
4. Voeg inactieve niet-admins toe als read-only rijen met zichtbare status, uitleg en disabled controls.
5. Zorg dat admin- en inactieve niet-admincellen disabled zijn, een duidelijke accessible label hebben en geen dirty state kunnen zetten.
6. Filter admin-rijen en inactieve niet-admins uit de save-payload; laat save-all voor actieve niet-admin wijzigingen ongewijzigd.
7. Voeg frontendtests toe voor admins zichtbaar, inactieve niet-admins read-only, alles checked waar van toepassing, geen dirty bij click, en save alleen voor actieve niet-admin wijzigingen.
8. Voeg de vereiste About/changelog-entry toe.
9. Run gerichte verificatie en vul deze spec aan met de resultaten.

## Acceptatiecriteria
- Admins zijn zichtbaar in de matrix.
- Elke admin-rij heeft alle board-cellen aangevinkt.
- Admin-cellen zijn niet bewerkbaar.
- Klikken op admin-cellen zet geen dirty state.
- Inactieve niet-admins zijn zichtbaar, read-only en duidelijk gelabeld als inactief.
- Klikken op inactieve niet-admincellen zet geen dirty state.
- Opslaan verwerkt alleen actieve niet-admin wijzigingen.
- Actieve niet-admin bewerken werkt ongewijzigd.
- De matrix is zichtbaar compacter dan voorheen.
- Disabled admin-cellen hebben toegankelijke labels.
- Save-all blijft intact.

## Testplan
- Frontendtests:
  - `cd frontend && npm test -- App.test.tsx`
- Frontend build:
  - `cd frontend && npm run build`
- Backend meta/changelog-verificatie als de About-entry via backend data loopt:
  - `cd backend && uv run pytest tests/test_meta_and_me.py`
- Handmatige check:
  1. Open **Admin > Bordrechten**.
  2. Controleer compactere spacing, toolbar en headers.
  3. Controleer dat admins als read-only rijen zichtbaar zijn met badge.
  4. Klik op admin-cellen en verifieer dat niets dirty wordt.
  5. Wijzig een niet-admin recht en sla op.

## Risico + rollback plan
### Risico’s
- Admin-cellen kunnen per ongeluk toch in de save-payload komen; mitigatie: expliciet filteren op `!is_admin`.
- Disabled controls kunnen onduidelijk zijn; mitigatie: badge, read-only styling en duidelijke labels.
- Compactere styling kan leesbaarheid verminderen; mitigatie: behoud contrast, focusstates en voldoende celinhoud.

### Rollback
- Revert de frontendwijzigingen in de Bordrechten-matrix en tests.
- Herstel de vorige spacing- en headerstijl.
- Revert de About/changelog-entry indien nodig.

## Notities / links
- Bron: goedgekeurde Nederlandse outline uit de user request.
- Relevante bestanden:
  - `frontend/src/app/shell/AppShell.tsx`
  - `frontend/src/app/App.test.tsx`
  - `backend/app/api/meta.py`
- Aannames:
  - De bestaande rechtenresponse levert al gebruikers met `is_admin` terug.
  - De huidige save-flow kan worden behouden met een frontendfilter voor admin-rijen.

## Huidige status
Completed.

## Wat veranderd
- Compacte matrixlayout voor Admin > Bordrechten is behouden en aangescherpt.
- Admins zijn zichtbaar als read-only rijen met volledige toegang en een duidelijke Admin-badge.
- Inactieve niet-admins zijn zichtbaar als read-only/disabled rijen met een duidelijke Inactief-badge en toegankelijke uitleg dat ze niet bewerkbaar zijn.
- Alleen actieve niet-admins blijven bewerkbaar; dirty-state en save-payloads sluiten admins en inactieve niet-admins uit.
- De bestaande save-all flow blijft intact voor bewerkbare actieve niet-admins.

## Hoe te verifiëren
- `cd frontend && npm test -- App.test.tsx`
- `cd frontend && npm run build`
- `cd backend && uv run pytest tests/test_boards_api.py -k "board_rights or manage_board_rights"`
- `cd backend && uv run pytest tests/test_meta_and_me.py`
- Handmatig: open **Admin > Bordrechten**, controleer admins en inactieve niet-admins als read-only rijen, klik op een admin- of inactieve cel en verifieer dat de dirty-state gelijk blijft, wijzig een actieve niet-admin en sla op.

## Verificatiebewijs
- `cd frontend && npm test -- App.test.tsx` — passed, 73 tests
- `cd frontend && npm run build` — passed
- `cd backend && uv run pytest tests/test_boards_api.py -k "board_rights or manage_board_rights"` — passed, 3 tests
- `cd backend && uv run pytest tests/test_meta_and_me.py` — passed, 24 tests

---
Status: Completed
Owner: —
Date: 2026-06-12
