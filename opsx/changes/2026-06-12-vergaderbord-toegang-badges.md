# Title
Vergaderbord-header toont toegang met gebruikersbadges

## Context
Op de geopende vergaderbordpagina toont de header nu vooral de bordtitel. Daardoor is niet direct zichtbaar wie toegang heeft tot het bord, terwijl dat juist in deze view snel scanbaar moet zijn. De gewenste wijziging voegt een compacte badge-regel toe in de geopende bordheader, met dezelfde visuele taal als de bestaande kaartbadges.

Belangrijk: dit is alleen een UI- en metadatawijziging. De bestaande toegangslogica mag niet veranderen. Admins hebben al automatische toegang en moeten daarom als normale gebruikersbadges op elk bord zichtbaar zijn; uitgenodigde gebruikers moeten ook zichtbaar zijn.

## Goals / Non-goals
### Goals
- Toon in de geopende bordheader direct welke gebruikers toegang hebben.
- Laat admins op elk bord zien als normale gebruikersbadges, naast uitgenodigde gebruikers.
- Toon alleen badges in de geopende board header; niet in dropdowns of andere navigatiecomponenten.
- Gebruik dezelfde badge-stijl/visuele taal als de bestaande kaartbadges.
- Beperk de zichtbare badges tot maximaal 5 en toon daarna een compacte `+N`-indicator.
- Zorg voor duidelijke accessible labels voor individuele badges en de `+N`-indicator.
- Laat bestaande toegangscontrole en permissielogica ongewijzigd.
- Voeg na implementatie de vereiste About/changelog-entry toe.

### Non-goals
- Geen wijziging aan board access-control beslissingen of autorisatiechecks.
- Geen wijziging aan dropdowns, board selector of andere lijstweergaven.
- Geen nieuwe rollen, permissies of uitnodigingsflows.
- Geen redesign van de kaartbadges zelf; die moeten ongewijzigd blijven werken en ogen.

## Proposed approach
1. Voeg in de board-detail response een compacte `access_users`-metadataarray toe met alleen de gegevens die de header nodig heeft.
2. Bouw die access roster server-side uit de bestaande projecttoegang: admins plus de uitgenodigde niet-admin users; dedupe en sorteer op een stabiele, voorspelbare volgorde.
3. Render in de header een badge-regel onder of naast de bordtitel, alleen in de geopende bordview, op basis van `access_users`.
4. Gebruik de bestaande kaartbadge-styling of een gedeelde badgecomponent zodat de headerbadge visueel aansluit op de kaartbadges.
5. Toon maximaal 5 badges; bereken het overflow-aantal als het aantal unieke zichtbare toegangshouders minus 5 en toon een `+N`-badge.
6. Voeg toegankelijke labels toe voor elke badge (`Toegang: <naam>`) en voor overflow (`Nog N gebruikers met toegang`).
7. Voeg regressietests toe voor backend metadata, invited-non-admin toegang, frontend rendering en `+N`-gedrag; update de About/changelog-verificatie.
8. Werk de About/changelog-pagina bij met een end-user vriendelijke samenvatting.

## Implementation steps (ordered)
1. Inspecteer de huidige vergaderbord-header, de board-detail API response, de bestaande kaartbadge-styling en de relevante frontendtests.
2. Voeg backend schema- en API-ondersteuning toe voor `access_users` in de board-detail response.
3. Vul `access_users` server-side met admin + uitgenodigde niet-admin metadata zonder de autorisatiechecks te wijzigen.
4. Laat de frontend headerbadge-regel renderen op basis van `boardQuery.data.access_users`.
5. Hergebruik bestaande badge-styling/componenten zodat de headerbadges visueel overeenkomen met kaartbadges.
6. Voeg logica toe voor maximum van 5 badges en een toegankelijke `+N`-overflowbadge.
7. Voeg backendtests toe voor de metadataresponse en invited-non-admin toegang; voeg frontendtests toe voor rendering en overflow.
8. Werk de About/changelog-entry bij volgens de bestaande repositoryconventie.
9. Voer gerichte verificatie uit en leg de uitkomsten vast in deze spec.

## Acceptance criteria
1. In de geopende vergaderbordheader zijn toegangsbades zichtbaar voor admins en uitgenodigde gebruikers.
2. Admins worden op elk bord weergegeven als normale gebruikersbadges; er is geen speciale admin-only visual variant nodig in deze header.
3. De badge-regel verschijnt alleen in de geopende board header, niet in dropdowns of andere board-overzichten.
4. Er worden nooit meer dan 5 badges tegelijk getoond; extra toegangs-houders worden samengevat in precies één `+N`-badge.
5. De `+N`-badge geeft correct weer hoeveel unieke gebruikers niet direct zichtbaar zijn.
6. Elke badge heeft een duidelijke accessible label en de overflowbadge is screenreader-vriendelijk benoemd.
7. De headerbadges gebruiken dezelfde visuele badge-taal als de bestaande kaartbadges.
8. Bestaande kaartbadges blijven visueel en functioneel ongewijzigd.
9. De board-detail response levert een non-admin-safe `access_users` metadataarray met alleen de gegevens die de header nodig heeft.
10. De bestaande toegangscontrole blijft inhoudelijk gelijk; deze wijziging voegt alleen metadata en presentatie toe.
11. De relevante frontend- en backendtests slagen, inclusief de About/changelog-verificatie.

## Testing plan
- Frontend gerichte tests:
  - `cd frontend && npm test -- VergaderbordenPage.test.tsx`
- Frontend build:
  - `cd frontend && npm run build`
- Backend API/tests voor metadata en regressie:
  - `cd backend && uv run pytest tests/test_boards_api.py tests/test_meta_and_me.py`
- Handmatige verificatie:
  1. Open een vergaderbord met meerdere toegangs-houders.
  2. Controleer dat admins en uitgenodigde gebruikers in de header zichtbaar zijn.
  3. Controleer dat er maximaal 5 badges zichtbaar zijn en dat overflow als `+N` verschijnt.
  4. Controleer met toetsenbord/screenreader dat badges bruikbare labels hebben.
  5. Controleer dat kaartbadges ongewijzigd blijven.
  6. Controleer de About-pagina op de nieuwe changelog-entry.

## Risk + rollback plan
### Risks
- De header kan visueel te druk worden; mitigatie: max 5 badges en compacte overflow-weergave.
- Hergebruik van badge-styling kan onbedoeld kaartbadges beïnvloeden; mitigatie: gedeelde styling alleen via stabiele, expliciete componenten/classes en regressietests.
- Extra metadata kan responsegroottes vergroten; mitigatie: alleen minimale access-gegevens toevoegen die nodig zijn voor rendering.
- Onjuiste deduplicatie kan dubbele badges tonen voor admins die ook uitgenodigd zijn; mitigatie: dedupe op user-id.

### Rollback
- Verwijder de headerbadge-rendering en de aanvullende metadata-uitbreiding.
- Herstel de frontend- en backendtests naar de vorige situatie.
- Revert de About/changelog-entry indien de wijziging volledig wordt teruggedraaid.

## Notes / links
- Bron: goedgekeurde outline van de user request.
- Relevante bestanden om te inspecteren/aan te passen:
  - `frontend/src/app/features/admin/VergaderbordenPage.tsx`
  - `frontend/src/app/features/admin/VergaderbordenPage.test.tsx`
  - `frontend/src/lib/api/client.ts`
  - `frontend/src/styles.css`
  - `backend/app/api/boards.py`
  - `backend/app/schemas/boards.py`
  - `backend/tests/test_boards_api.py`
  - `backend/tests/test_meta_and_me.py`
- Scope-beslissing: badges alleen in de geopende board header; geen dropdownwijziging.

## Current status
Completed.

## What changed
- De board-detail response levert nu een non-admin-safe `access_users` metadataarray met alleen de gegevens die de header nodig heeft.
- Die metadata wordt server-side opgebouwd uit admins plus uitgenodigde niet-admin gebruikers, zonder aan de toegangslogica te sleutelen.
- De geopende vergaderbordheader toont nu een compacte badge-regel op basis van `access_users`, met maximaal 5 zichtbare badges en een `+N`-overflowbadge.
- De badges gebruiken dezelfde pill-stijl als bestaande user badges elders in de app en hebben toegankelijke labels.
- De About/changelog bevat nu een eindgebruikersvriendelijke iteratie 78-entry over deze wijziging.

## How to verify
- Frontend: `cd frontend && npm test -- VergaderbordenPage.test.tsx`
- Frontend build: `cd frontend && npm run build`
- Backend: `cd backend && uv run pytest tests/test_boards_api.py tests/test_meta_and_me.py`
- Handmatig: open een vergaderbord met meerdere toegangshouders en controleer dat maximaal 5 badges zichtbaar zijn, dat admins en genodigden zichtbaar zijn, en dat overflow als `+N` verschijnt.

## Verification evidence
- `cd backend && uv run pytest tests/test_boards_api.py tests/test_meta_and_me.py` → passed (54 tests).
- `cd frontend && npm test -- VergaderbordenPage.test.tsx` → passed (37 tests).
- `cd frontend && npm run build` → passed.
- Visuele/accessibility checks niet handmatig uitgevoerd in browser; labels en overflow zijn gedekt door tests.

---
Status: completed
Owner: —
Date: 2026-06-12
