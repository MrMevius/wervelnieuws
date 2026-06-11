# Title
Vergaderbord recordicoon-polish

## Context
Op de Vergaderborden-kaarten is de recordactie nu functioneel, maar visueel nog te nadrukkelijk. De wens is om het recordicoon kleiner en realistischer te maken en het subtiel rechtsonder op de kaart te plaatsen, zodat de kaart rustiger oogt zonder de opnamefunctionaliteit te veranderen.

Een kleine kaartpolish mag alleen worden toegevoegd als dat nodig is om de nieuwe iconpositie goed leesbaar te houden, bijvoorbeeld door titelclamping of subtielere meta-informatie.

## Goals / Non-goals
### Goals
- Maak het recordicoon visueel kleiner en minder dominant.
- Plaats het recordicoon rechtsonder in de kaart.
- Houd de bestaande recordactie/functionele interactie intact.
- Voeg alleen minimale ondersteunende card-polish toe als dat nodig is voor leesbaarheid van de nieuwe layout.
- Behoud een bruikbare kaart op desktop en mobiel.
- Houd de wijziging frontend-only.

### Non-goals
- Geen backend-, API- of datamodelwijzigingen.
- Geen herontwerp van Vergaderborden-kaarten of board layout.
- Geen nieuwe opnameflow of extra opnamefuncties.
- Geen wijziging aan permissies, data-opslag of upload/record endpoints.
- Geen brede visuele rebrand of nieuwe themastijl.

## Proposed approach
1. Inventariseer de huidige Vergaderborden-kaartcomponent en de plek waar het recordicoon wordt gerenderd.
2. Pas de iconstijling aan zodat het icoon kleiner, subtieler en visueel realistischer oogt.
3. Positioneer het icoon rechtsonder op de kaart, zonder de klik/tap-interactie te breken.
4. Controleer de kaartinhoud op overlap of visuele druk; voeg alleen minimale ondersteunende polish toe waar nodig, zoals:
   - titelclamping op maximaal 2 regels;
   - iets subtielere meta-tekst/metadata;
   - kleine spacing-aanpassingen om het icoon vrij te houden.
5. Beperk wijzigingen tot de frontendcomponenten en bijbehorende styles.
6. Werk gerichte frontendtests bij als bestaande testdekking dit ondersteunt.

## Implementation steps (ordered)
1. Inspecteer de huidige Vergaderborden-kaartrendering en bestaande recordknop/icon-styles.
2. Verklein het recordicoon en stem kleur/opacity/gewicht af op een subtielere, realistischere uitstraling.
3. Verplaats het icoon naar de rechteronderhoek van de kaart met behoud van bestaande interactie.
4. Controleer of de kaartinhoud nog goed leest; voeg alleen indien nodig minimale polish toe aan titel, meta-info en spacing.
5. Verifieer dat de recordactie functioneel onveranderd blijft.
6. Voeg of pas frontendtests aan voor iconpositie, zichtbaarheid en interactie waar de bestaande teststack dat ondersteunt.
7. Valideer de wijziging op smalle en brede schermen.

## Acceptance criteria
1. Elk Vergaderborden-kaartje toont het recordicoon rechtsonder.
2. Het recordicoon is zichtbaar kleiner en visueel subtieler dan de huidige variant.
3. De recordactie blijft functioneel identiek aan vóór deze wijziging.
4. Kaartinhoud blijft leesbaar en overlapt niet met het icoon.
5. Als ondersteunende polish nodig is, blijft die beperkt tot minimale aanpassingen zoals titelclamping of subtielere meta-info.
6. Er zijn geen backend-, API- of datamodelwijzigingen.
7. De UI blijft bruikbaar op desktop en mobiele breedtes.

## Testing plan
- Frontend tests:
  - run de bestaande frontend test-suite (`cd frontend && npm test`)
  - run de frontend build (`cd frontend && npm run build`)
- Gerichte checks:
  - icon staat rechtsonder op kaartniveau;
  - icon is kleiner en minder nadrukkelijk;
  - klik/tap op het icoon werkt nog zoals voorheen;
  - titel/meta blijven leesbaar zonder overlap.
- Handmatige UI-checks:
  - Vergaderborden op brede desktopbreedte;
  - Vergaderborden op smalle viewport/mobile breedte.

## Risk + rollback plan
### Risks
- Het icoon kan op smalle kaarten te dicht op tekst of andere acties komen te staan.
- Kleine stijlwijzigingen kunnen focus/hover-states of klikbaarheid beïnvloeden.
- Titelclamping kan onverwacht invloed hebben op kaarthoogte en scanbaarheid.

### Mitigation
- Houd de wijziging strikt frontend-only en beperkt tot de kaartcomponent en styles.
- Voeg alleen minimale ondersteunende polish toe als de nieuwe iconpositie dat vereist.
- Controleer desktop en mobiel expliciet op overlap, clipping en klikbaarheid.

### Rollback
- Draai de kaart/icon-styling terug naar de vorige positie en grootte.
- Verwijder eventuele ondersteunende titel/meta-polish zonder backend-impact.

## Notes / links
- Scope: Vergaderborden UI/UX polish voor recordicoon op kaartniveau.
- Slug: `vergaderbord-recordicoon-polish`
- Verwachte frontend scopebestanden: Vergaderborden-kaartcomponent(en) en bijbehorende styles.
- Backend valt expliciet buiten scope.

## Current status
Completed

## What changed
- Vergaderborden-kaarten renderen nu een kleinere, subtielere recordknop rechtsonder in de kaart.
- De emoji-glyph is vervangen door een inline SVG microphone/stop-icon voor een realistischer uitstraling.
- De kaart kreeg minimale ondersteunende polish: extra onderpadding voor de knop en een 2-regelige titelclamp om overlap te voorkomen.
- Alleen frontend-bestanden zijn aangepast; backend/API/datamodel blijven ongewijzigd.
- About/changelog is bijgewerkt met een nieuwe Vergaderborden-entry over de compactere recordknop.

## How to verify
1. `cd frontend && npm test`
2. `cd frontend && npm run build`
3. `python3 -m py_compile backend/app/api/meta.py`
4. Verifieer in de Vergaderborden-UI dat:
   - elk kaartje een recordknop rechtsonder heeft;
   - de knop visueel kleiner en subtieler is;
   - de knop nog start/stop-opname triggert;
   - titel/meta niet overlappen met de knop op desktop en mobiel.

## Verification evidence
`cd frontend && npm test` → passed (3 test files, 107 tests).
`cd frontend && npm run build` → passed.
`python3 -m py_compile backend/app/api/meta.py` → passed.

---
Status: done
Owner: n.t.b.
Date: 2026-06-11
