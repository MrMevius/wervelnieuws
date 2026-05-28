## Title
Trello-achtige kaartactiviteiten voor vergaderbord-kaartjes

## Context
De huidige updates in het kaartdetail zijn functioneel, maar ogen als een eenvoudige lijst. Gebruikers willen dat activiteiten visueel en inhoudelijk beter scanbaar zijn, vergelijkbaar met het gevoel van Trello-comments: duidelijke activity cards met auteur, datum/tijd, tekst en acties. Dit moet passen binnen het bestaande donkere thema met subtiele groene accenten.

Probleemstelling: kaartupdates zijn minder scanbaar, en acties zoals bewerken vallen visueel niet logisch samen met de update waarop ze betrekking hebben.

## Goals / Non-goals
### Goals
- Alle `card_updates` in het kaartdetail tonen als duidelijke activity cards.
- Per activity minimaal auteur, datum/tijd en tekst tonen.
- Eventuele update-afbeelding zichtbaar houden binnen het activity-item.
- Bewerkactie duidelijk en alleen zichtbaar maken voor eigen updates.
- Bestaande update-, edit- en image-flow functioneel ongewijzigd laten.
- Donker thema behouden met subtiele groene accenten.
- About/changelog bijwerken met eindgebruikersvriendelijke vermelding.

### Non-goals
- Geen pixel-perfecte Trello-kopie.
- Geen groot backend redesign of nieuw generiek activity-model, tenzij strikt nodig door API-beperkingen.
- Geen wijziging in rechtenmodel.
- Geen redesign van de volledige vergaderbordpagina.
- Geen integratie van audio-opnames onder Opnames in de activity-lijst.

## Proposed approach
Frontend-gerichte wijziging in de bestaande kaartdetailweergave:
- Herstructureer rendering van `cardQuery.data.updates` in `frontend/src/app/features/admin/VergaderbordenPage.tsx` met een kleine interne helper/render-structuur voor activity-items.
- Voeg scoped styling toe in `frontend/src/styles.css` voor activity cards binnen de board-updates sectie.
- Gebruik bestaand `CardUpdateResponse` contract.
- Maak de action row visueel onderdeel van elk activity-item, met behoud van bestaande mutaties/query-invalidation.

## Implementation steps (ordered)
1. Introduceer een kleine interne render-structuur/helper voor update/activity-items in `VergaderbordenPage.tsx`.
2. Render per activity: auteurmarkering (avatar/initialen of subtiele indicator), auteurregel, datum/tijd, berichttekst, eventuele afbeelding en actierij.
3. Verplaats bestaande `Bewerken`-actie naar een duidelijke action row binnen hetzelfde activity-item.
4. Behoud edit-mode functioneel gelijk en style deze als inline activity editor.
5. Voeg/werk board update CSS-classes bij naar Trello-achtige comment/activity cards binnen dark theme met subtiele groene accenten.
6. Verifieer dat automatische verplaatsingsupdates correct leesbaar blijven via bestaande `renderBoardUpdateMessage`.
7. Voeg/werk frontend-tests bij in `frontend/src/app/features/admin/VergaderbordenPage.test.tsx` voor auteur, datum, tekst, owner/non-owner edit-actie en afbeelding.
8. Werk About/changelog bij via `backend/app/api/meta.py` met functionele eindgebruikersnotitie.

## Acceptance criteria
1. In kaartdetail worden alle updates uit `card_updates` als activity cards weergegeven.
2. Elke activity toont auteur, datum/tijd en tekst.
3. Eigen updates tonen een duidelijke bewerkactie.
4. Niet-eigen updates tonen geen bewerkactie.
5. Afbeeldingen bij updates blijven zichtbaar wanneer aanwezig.
6. Automatische verplaatsingsupdates blijven correct leesbaar.
7. Donker thema blijft behouden met subtiele groene accenten.
8. Bestaande update plaatsen en update bewerken blijft functioneel werken.
9. Geen regressie in kaartdetail openen/sluiten, update plaatsen en update bewerken.

## Testing plan
- Update/voeg tests toe in `frontend/src/app/features/admin/VergaderbordenPage.test.tsx` voor:
  - activity rendering (auteur, datum/tijd, tekst),
  - owner edit action zichtbaar,
  - non-owner edit action verborgen,
  - update-afbeelding zichtbaar.
- Uit te voeren verificatiecommando’s:
  - `npm test -- VergaderbordenPage.test.tsx`
  - `npm test`
  - `npm run build`
- Alleen bij API-wijzigingen aanvullend backend-check:
  - `pytest backend/tests/test_boards_api.py -k "update or board"`

## Risk + rollback plan
### Risico’s
- CSS-scope kan onbedoeld andere board-elementen beïnvloeden.
- Regressie in edit-flow door render-herstructurering.
- Interpretatie-ambiguïteit van “alle activiteiten” kan te breed worden opgepakt.

### Mitigaties
- Scope CSS expliciet op `.board-updates-section` / `.board-update-item` (of equivalent).
- Laat mutaties, query keys en invalidationpad ongewijzigd; wijzig alleen rendering/styling.
- Houd scope strikt op `card_updates`; sluit opnames expliciet uit.

### Rollback
- Revert frontend rendering/CSS wijzigingen en changelog-entry.
- Geen backend-migraties of datamigraties verwacht.

## Notes / links
- Primair frontendbestand: `frontend/src/app/features/admin/VergaderbordenPage.tsx`
- Styles: `frontend/src/styles.css`
- Changelog/About: `backend/app/api/meta.py`
- Gerelateerde eerdere specs kunnen context bieden voor board updates, maar deze spec is leidend voor deze wijziging.

## Current status
Completed

## What changed
- `frontend/src/app/features/admin/VergaderbordenPage.tsx`
  - Update-rendering in kaartdetail herstructureerd naar duidelijke activity cards met:
    - header met auteur-initialenbadge,
    - auteurnaam,
    - datum/tijd,
    - berichttekst,
    - eventuele update-afbeelding,
    - action row met `Bewerken` alleen voor eigen updates.
  - Bestaande update-editflow functioneel behouden (zelfde mutaties, query invalidation, save/cancel en image edit/remove gedrag).
  - `renderBoardUpdateMessage` intact gelaten zodat automatische verplaatsingsupdates hetzelfde leesbaar blijven.
- `frontend/src/styles.css`
  - Scoped styling toegevoegd/uitgebreid rond `.board-updates-section` en `.board-update-*` classes voor Trello-achtige activity cards binnen bestaand dark theme met subtiele groene accenten.
  - Inline update-editor visueel in dezelfde activity card gehouden.
- `frontend/src/app/features/admin/VergaderbordenPage.test.tsx`
  - Testverwachtingen bijgewerkt voor nieuwe activity header-structuur (auteur, datumindicatie, initialenbadge).
  - Test uitgebreid met zichtbaarheid van update-afbeelding.
  - Bestaande owner/non-owner edit-actieassertie behouden (`Bewerken` alleen voor auteur).
- `backend/app/api/meta.py`
  - About/changelog entry toegevoegd (iteratie 48) met eindgebruikersvriendelijke beschrijving van activity cards en owner-only editactie.

## How to verify
- Targeted frontend test:
  - `cd frontend && npm test -- VergaderbordenPage.test.tsx`
- Frontend regressietests:
  - `cd frontend && npm test`
- Frontend productiebuild:
  - `cd frontend && npm run build`
- Backend-tests zijn niet vereist voor deze wijziging, omdat het API-contract en backendgedrag ongewijzigd bleven; alleen de About/changelog-metadata is aangevuld.

## Verification evidence
- Uitgevoerde commandos:
  - `git status --short` (inspectie werkboom)
  - `cd frontend && npm test -- VergaderbordenPage.test.tsx` ✅ geslaagd
    - Resultaat: `1 passed`, `21 passed (21)`
  - `cd frontend && npm test` ✅ geslaagd
    - Resultaat: `2 passed`, `69 passed (69)`
  - `cd frontend && npm run build` ✅ geslaagd
    - Resultaat: TypeScript build en Vite productiebuild succesvol afgerond.
- Niet uitgevoerd:
  - Backend-tests, omdat er geen API-contract- of backendgedragswijziging is doorgevoerd.

---
Status: completed
Owner: n.v.t.
Date: 2026-05-28
