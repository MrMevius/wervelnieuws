# Title
Replace Kaartdetail heading with card title

## Context
In de kaartdetail-modal wordt momenteel bovenaan een vaste grote kop “Kaartdetail” getoond, met daaronder opnieuw de specifieke kaarttitel in een kleinere titelregel. Dit veroorzaakt dubbele titelweergave en verlaagt de scanbaarheid.

## Goals / Non-goals
### Goals
- Vervang de grote koptekst “Kaartdetail” door de daadwerkelijke kaarttitel.
- Behoud exact dezelfde visuele opmaak/styling van de huidige grote kop.
- Verwijder de kleinere, dubbele titelregel onder de kop.
- Maak de zichtbare grote kaarttitel zelf klikbaar zodat die direct titelbewerking opent.
- Verberg/verwijder de losse zichtbare knop “Bewerken” naast de titel in de kaartdetail-header.
- Behoud/herstel bestaande titel-bewerking in kaartdetail, nu gekoppeld aan de grote kop met dezelfde toegankelijke labels/controls (o.a. `Kaarttitel bewerken: ...`).
- Behoud bestaande titel-bewerkinteracties in detail: opslaan met Enter, opslaan op blur, lege titel blokkeren met Nederlandse foutmelding, annuleren met Escape.
- Pas alleen de kaartdetailweergave/modal aan.

### Non-goals
- Geen aanpassingen aan andere kaartweergaven (kaartjes, lijsten, kolommen).
- Geen bredere layout- of styling-redesign van de modal.
- Geen functionele wijzigingen aan updates, opnames, acties, publicatiegedrag of businesslogica.
- Geen verwijdering of verplaatsing van titelbewerking buiten de kaartdetail-headercontext.

## Proposed approach
1. Lokaliseer in de frontend de component/template die de kaartdetail-modal rendert.
2. Vervang in de headersectie de statische labeltekst “Kaartdetail” met de bestaande kaarttitel-data die nu in de kleinere titelregel wordt getoond.
3. Verwijder de redundante kleinere titelregel uit dezelfde modal.
4. Maak de grote titelweergave zelf het primaire interactieve element om bewerken te starten (klik/tap), met een expliciete toegankelijke naam (bijv. `Kaarttitel bewerken: <titel>`).
5. Verwijder/verberg de aparte zichtbare “Bewerken”-knop naast de titel, zodat er één duidelijke entrypoint voor titelbewerking is.
6. Behoud bestaande edit-flow en validatie exact (Enter + blur opslaan, lege titelmelding, Escape annuleren) en laat overige modal-structuur, acties, state en event-handlers onaangeroerd.

## Implementation steps (ordered)
1. Identificeer de kaartdetail-component en de exacte JSX/TSX-regels voor:
   - de grote kop met tekst “Kaartdetail”; en
   - de kleinere titelregel met kaarttitel.
2. Koppel de grote kop aan hetzelfde titelveld als de huidige kleine titelregel.
3. Verwijder de kleine dubbele titelregel.
4. Verplaats de “start bewerken”-interactie naar de grote titel zelf (klikbaar element met keyboard-focusbaarheid) en gebruik een passende accessible name zoals `Kaarttitel bewerken: <titel>`.
5. Verwijder/verberg de losse zichtbare “Bewerken”-knop naast de titel.
6. Behoud het bestaande invoerveld en labels (`Kaarttitel`) en bestaand gedrag (Enter/blur opslaan, Escape annuleren, lege titel fout).
7. Controleer dat classNames/styling van de grote kop visueel gelijk blijven.
8. Verifieer dat geen andere modal-secties of gerelateerde componenten zijn aangepast.

## Acceptance criteria (measurable)
- De tekst “Kaartdetail” verschijnt niet meer als grote kop in de kaartdetail-modal.
- De kaarttitel van de geopende kaart wordt bovenaan als grote kop weergegeven.
- De kleinere, dubbele titelregel onder de kop is verwijderd.
- De grote, zichtbare kaarttitel is klikbaar om titelbewerking te starten en heeft een testbare toegankelijke naam (bijv. `Kaarttitel bewerken: <titel>`).
- Er is geen aparte zichtbare knop “Bewerken” meer naast de titel in de kaartdetail-header.
- De detailmodal bevat het bestaande titelinvoerveld met label `Kaarttitel` zodra bewerken is gestart.
- Titelbewerking in detail werkt ongewijzigd: Enter = opslaan, blur = opslaan, lege titel = foutmelding `Vul een kaarttitel in.`, Escape = annuleren zonder opslaan.
- Visueel en functioneel blijft de rest van de modal ongewijzigd (zelfde acties, velden, gedrag).

## Testing plan (canonical commands or approach)
- Code-inspectie van de kaartdetail-component om te bevestigen dat:
  - de statische kop “Kaartdetail” is vervangen;
  - de dubbele kleine titelregel is verwijderd;
  - de grote titel zelf het bewerk-entrypoint is met passende accessible name;
  - de losse zichtbare “Bewerken”-knop naast de titel is verwijderd/verborgen;
  - titelbewerking verder aanwezig is met bestaand gedrag/validatie;
  - overige modal-secties gelijk zijn gebleven.
- Handmatige UI-check:
  1. Open een vergaderbord met kaarten.
  2. Open kaartdetail-modal van minimaal 1 kaart met herkenbare titel.
  3. Verifieer dat de grote kop de kaarttitel toont en dat geen tweede titelregel zichtbaar is.
  4. Klik op de grote titel en verifieer dat bewerken start.
  5. Verifieer dat geen losse zichtbare “Bewerken”-knop naast de titel aanwezig is.
  6. Verifieer Enter/blur save, lege titel foutmelding, Escape annuleren.
- Voer relevante frontend-validatie uit indien beschikbaar in de repo:
  - `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` (in `frontend/`).
  - `npm run build` (in `frontend/`).

## Risk + rollback plan
### Risks
- Laag risico: kleine rendering/interactie-wijziging in één modal.
- Toegankelijkheidsrisico als de klikbare titel geen duidelijke naam/focusstate heeft.
- Discoverability-risico voor gebruikers die gewend zijn aan een losse “Bewerken”-knop.

### Rollback
- Herstel de vorige titelstructuur in de kaartdetail-component:
  - statische kop “Kaartdetail” terugplaatsen;
  - kleine titelregel terugplaatsen.
  - losse zichtbare “Bewerken”-knop terugplaatsen indien de klikbare titel-interactie regressies geeft.

## Notes / links
- Inputbron: user-provided Draft Change Spec Outline voor deze iteratie.
- Docs impact: geen docs/changelog-aanpassing gevraagd voor deze iteratie; dit is expliciet buiten scope voor deze spec, ondanks algemene repo-DoD-verwijzing.

## Current status
Completed

## What changed
- Deze change spec is uitgebreid voor de follow-up:
  - de grote zichtbare kaarttitel wordt het primaire klikbare entrypoint voor bewerken;
  - de losse zichtbare “Bewerken”-knop naast de titel wordt verwijderd/verborgen;
  - bestaande edit-interacties en validatie blijven expliciet ongewijzigd;
  - a11y-eis is aangescherpt: klikbare titel moet een passende testbare accessible name hebben.
- Scopegrenzen zijn aangescherpt: geen wijzigingen aan andere kaartviews, modal-redesign, updates/opnames/publicatiegedrag.
- Implementatie uitgevoerd in `VergaderbordenPage`:
  - De titelregel in kaartdetail gebruikt nu de grote titel zelf als interactief element (`h2` met `role="button"`, `tabIndex={0}`, `aria-label="Kaarttitel bewerken: <titel>"`).
  - Klik op de grote titel start titelbewerking; toetsenbordactivatie via Enter/Spatie is toegevoegd.
  - De losse zichtbare knop met label `Bewerken` is verwijderd uit de kaartdetail-header.
  - Bestaande titelbewerkflow (Enter opslaan, blur opslaan, lege titelvalidatie, Escape annuleren) is ongewijzigd gelaten.
- Gerichte tests bijgewerkt in `VergaderbordenPage.test.tsx`:
  - Asserties toegevoegd dat in de kaartdetail-modal geen aparte zichtbare knop `Bewerken` aanwezig is.
  - Bestaande a11y-query op `role="button"` met naam `Kaarttitel bewerken: <titel>` blijft gebruikt voor het openen van editmodus via de titel.

## How to verify
- In `frontend/`:
  1. `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
  2. `npm run build`
- Handmatige UI-check:
  1. Open een vergaderbord en daarna een kaartdetail-modal.
  2. Controleer dat de grote heading de kaarttitel toont (geen `Kaartdetail`).
  3. Controleer dat geen kleine duplicate titelregel zichtbaar is.
  4. Klik op de grote titel en verifieer dat titelbewerking opent.
  5. Controleer dat geen losse zichtbare “Bewerken”-knop naast de titel staat.
  6. Verifieer Enter/blur save, lege titel fout, Escape annuleren.
  7. (Optioneel) Verifieer keyboard activatie op de titel (Enter/Spatie) om edit te starten.

## Verification evidence
- ✅ `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` (in `frontend/`)
  - Resultaat: **pass**
  - Output: `7 passed (7)` in `src/app/features/admin/VergaderbordenPage.test.tsx`.
- ✅ `npm run build` (in `frontend/`)
  - Resultaat: **pass**
  - Output: TypeScript build + Vite build succesvol (`✓ built in 992ms`).

---
Status: completed  
Owner: n/a  
Date: 2026-05-27
