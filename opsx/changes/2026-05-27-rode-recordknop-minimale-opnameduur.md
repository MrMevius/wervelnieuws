# Title
Duidelijke rode recordknop en minimale opnameduur

## Context
De huidige Vergaderbord-opnameflow werkt al op kaartniveau (alle kaarten), met direct start/stop, één actieve opname tegelijk, timerweergave en normale upload van geldige opnames. De vervolgscope is een gerichte UX- en guard-verbetering:
- de knop moet in idle-state duidelijker zichtbaar zijn als rode, ronde recordknop;
- bij actieve opname moet de stop-state visueel duidelijk blijven (rood/donkerrood, passend bij huidige interactie);
- opnames korter dan 5 seconden moeten client-side worden afgekeurd: niet uploaden, opname-state resetten en een Nederlandse melding tonen.

Deze wijziging blijft binnen frontend-scope (kaart-UI + opnameduur-guard) en behoudt bestaand gedrag uit eerdere opname-specs.

## Goals / Non-goals
### Goals
- Maak de idle recordknop op Vergaderbord-kaarten duidelijk rood en rond, visueel herkenbaar als opnameactie.
- Behoud of verbeter de actieve stop-state zodat duidelijk zichtbaar is dat opname actief is en stoppen mogelijk is.
- Introduceer een frontend minimale opnameduur van 5 seconden voor kaart-opnames.
- Voorkom upload van opnames korter dan 5 seconden.
- Reset recording-state (incl. timer/UI-state) na een te korte opname.
- Toon bij te korte opname een Nederlandstalige melding: **"Opname is te kort. Neem minimaal 5 seconden op."** (exact of functioneel equivalent).
- Behoud bestaand gedrag: alle kaarten, direct start/stop zonder detail-opening, één actieve opname tegelijk, timer tijdens opname, normale uploads vanaf 5 seconden.
- Als detail-opname dezelfde state/guard gebruikt, blijft die flow correct werken.
- Werk relevante frontendtests bij voor de nieuwe UX en duurguard.

### Non-goals
- Geen backend-wijzigingen voor deze scope.
- Geen wijziging van upload-endpoints, audioformaten of server-side validatieregels.
- Geen herontwerp van volledige Vergaderbord-kaartlayout buiten de opnameknop-/statusweergave.
- Geen wijziging aan businessregels rond publicatie, planning of andere board-interacties.

## Proposed approach
1. Inventariseer de bestaande kaart-opnamecomponent(en) en gedeelde recording-state die door kaart- en eventueel detail-opname wordt gebruikt.
2. Pas knopstyling aan zodat idle-state consequent als rode, ronde recordknop wordt gerenderd met voldoende contrast en herkenbaarheid.
3. Behoud/verscherp actieve-state styling naar duidelijke stopknop (rood/donkerrood) zonder regressie in click-gedrag.
4. Voeg in de stop/uploadflow een frontend duurcheck toe op basis van gemeten opnametijd of blob-duur (≥5s toegestaan, <5s afkeuren).
5. Bij <5s: upload overslaan, recording-state volledig resetten, timer resetten, Nederlandse foutmelding tonen.
6. Bij ≥5s: bestaande uploadflow ongewijzigd doorlopen.
7. Verifieer dat single-active opnamegedrag en detail-compatibiliteit intact blijven.
8. Update geautomatiseerde tests voor knopweergave, state-overgangen, duurguard en foutmelding.

## Implementation steps (ordered)
1. Lokaliseer frontendbestanden voor Vergaderbord-kaart-opnameknop, timer en upload-trigger.
2. Definieer/actualiseer UI-varianten voor idle (record) en actief (stop) met duidelijke rode visuele states.
3. Implementeer stylingaanpassing in kaartknopcomponent zonder klikbubbling/regressie in kaartinteractie.
4. Voeg minimale-opnameduurconstante toe in frontend recording-flow (`5` seconden).
5. Voeg guard toe in stop-handler: bepaal effectieve opnameduur en splitstroom `<5s` vs `>=5s`.
6. Implementeer `<5s`-pad: geen upload, reset opname/timer/errorvrije state, toon NL melding.
7. Behoud `>=5s`-pad: bestaande upload en succes/foutafhandeling.
8. Verifieer gedeelde state met detail-opnameflow (indien gedeeld) op regressies.
9. Werk frontendtests bij (unit/component/integratie waar aanwezig) voor visuele state, guard en gedragsbehoud.
10. Leg verificatiecommando’s en resultaten vast tijdens implementatie.
11. Werk About/changelog bij met eindgebruikersentry indien wijziging wordt geïmplementeerd en shipped.

## Acceptance criteria (measurable)
1. Op elk Vergaderbord-kaartje is de opnameknop in idle-state duidelijk zichtbaar als rode, ronde recordknop.
2. Tijdens actieve opname verandert de knop naar een duidelijke stop-state (rood/donkerrood) die visueel onderscheidbaar is van idle-state.
3. Een opname korter dan 5,0 seconden triggert **geen** uploadverzoek.
4. Na een te korte opname wordt de opname-state gereset en staat de timer terug op beginstand.
5. De gebruiker ziet bij een te korte opname een Nederlandse melding met tekst exact of functioneel equivalent aan: "Opname is te kort. Neem minimaal 5 seconden op."
6. Een opname van 5,0 seconden of langer volgt de bestaande uploadflow succesvol (onder gelijkblijvende randvoorwaarden).
7. Bestaand gedrag blijft intact: direct start/stop op kaartniveau, geen verplichte detailopening, maximaal één actieve opname tegelijk.
8. Als detail-opname dezelfde recording-state/guard gebruikt, blijft detail-opname functioneel en consistent met de 5-secondenregel.
9. Relevante frontendtests zijn bijgewerkt en dekken minimaal: idle/active knopstates, <5s blokkade, melding, timer-reset, >=5s uploadpad, single-active gedrag.
10. Indien de wijziging wordt uitgerold: About/changelog bevat een functionele eindgebruikersnotitie.

## Testing plan (canonical commands or approach)
- Frontend gerichte tests voor Vergaderbord-opnameflow:
  - idle rode ronde knop zichtbaar op kaart;
  - actieve stop-state zichtbaar en onderscheidend;
  - `<5s` opname: geen upload-call + melding + timer/reset;
  - `>=5s` opname: upload-call blijft werken;
  - single-active opnamegedrag blijft intact;
  - (indien gedeeld) detail-opname regressietest op duurguard.
- Voer project-relevante frontend verificatie uit (tests/build/typecheck voor gewijzigde onderdelen).
- Tijdens implementatie de exacte commando’s opnemen onder **How to verify** en uitkomsten onder **Verification evidence**.

## Risk + rollback plan
### Risks
- Visuele regressie in knopcontrast/toegankelijkheid op verschillende kaartachtergronden/themes.
- Randgevallen in duurmeting (afronding/timing drift rond 5,0 seconden).
- Onbedoelde impact op gedeelde recording-state tussen kaart en detail.

### Mitigation
- Gebruik consistente design tokens/klassen voor rood- en stop-state met visuele controle in relevante UI-contexten.
- Hanteer eenduidige duurvergelijking en test grenswaarden net onder en op 5 seconden.
- Voeg regressietests toe voor gedeelde state en single-active gedrag.

### Rollback
- Frontend: herstel vorige knopstyling en verwijder minimale-duurguard.
- Behoud overige opnameflow zoals voor deze wijziging.
- Her-run opnamegerelateerde frontendtests om herstel te bevestigen.

## Notes / links
- Inputbron: user-approved request voor "Duidelijke rode recordknop en minimale opnameduur".
- Slug: `rode-recordknop-minimale-opnameduur`.
- Scopegrens bevestigd: frontend-only; backend hardening hooguit als optionele toekomstige follow-up.

## Current status
Completed

## What changed
- Frontend opnameflow op Vergaderborden aangepast met minimale duurguard van 5 seconden (`MIN_RECORDING_SECONDS = 5`).
- Bij stop van opname wordt effectieve duur nu bepaald via klokmeting (starttijdref + `Date.now`) en timerstate; hiermee worden opnames `<5s` betrouwbaar client-side afgekeurd.
- Bij opnames `<5s` wordt geen upload gestart en toont de UI de Nederlandse melding: **"Opname is te kort. Neem minimaal 5 seconden op."**
- Na te korte opname blijft resetgedrag intact: actieve opname stopt, timer verdwijnt/reset naar 0 en recorder-state wordt opgeruimd.
- Styling van kaartrecordknop aangepast:
  - idle-state: duidelijke rode, ronde knop;
  - active-state: donkerrode stop-state.
- Gerichte frontendtests bijgewerkt voor:
  - visuele class-state idle/active;
  - `<5s` blokkade zonder upload + melding + timer-reset;
  - `>=5s` uploadpad blijft werken.
- About/changelog entry toegevoegd in backend fallback content (iteratie 45) met eindgebruikersnotitie over recordknop + minimale opnameduur.

## How to verify
- `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
- `cd frontend && npm run build`

## Verification evidence
- ✅ `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
  - Resultaat: **20 passed, 0 failed**.
  - Gedekte punten: idle/active recordknopstate, single-active gedrag, `<5s` blokkade met NL melding en zonder upload, `>=5s` uploadflow.
- ✅ `npm run build`
  - Resultaat: build geslaagd (`tsc -b && vite build`), productie-assets gegenereerd.
- ✅ Review/finalize:
  - Automatische `opsx-review` subagent was niet beschikbaar (`ProviderModelNotFoundError`), daarom handmatig no-edit gereviewd tegen acceptance criteria.
  - Changelog-iteratie genummerd als **45** om aan te sluiten op de eerdere opname-iteraties 43 en 44.
  - Na deze finalize-correctie opnieuw geverifieerd: `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` → **20 passed**; `npm run build` → geslaagd.

---
Status: completed
Owner: OPSX Implementer
Date: 2026-05-27
