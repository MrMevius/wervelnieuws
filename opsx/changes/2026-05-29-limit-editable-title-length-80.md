# Title
Limit editable titles to 80 characters

## Context
In meerdere plekken kunnen gebruikers titels bewerken (Vergaderborden-kaarttitels, planning Onderwerp wanneer dit als title wordt opgeslagen, en handmatig bewerkbare kanaal/variant-titels). Er is nu geen consistente maximale lengte-afdwinging, waardoor te lange titels kunnen leiden tot inconsistente UI-weergave en verschillen tussen frontend en backend-validatie.

Deze change spec begrenst de scope tot een harde max van 80 tekens voor bewerkbare titels, met consistente validatie in frontend formulieren én backend/API.

## Goals / Non-goals
### Goals
- Forceer `max title length = 80` voor relevante bewerkbare titelvelden.
- Valideer in frontend (directe feedback + submit blokkeren) en backend/API (authoritative guardrail).
- Dek expliciet:
  - Vergaderborden-kaarttitels bij aanmaken en bewerken;
  - planning **Onderwerp** wanneer opgeslagen als title;
  - handmatig bewerkte channel/variant titles.
- Behoud bestaande data; geen retroactieve aanpassing van reeds opgeslagen records.

### Non-goals
- Geen database migratie of data cleanup voor bestaande titels >80 tekens.
- Geen wijziging aan niet-bewerkbare titelbronnen of externe payload-contracten buiten validatiegrenzen.
- Geen herontwerp van titel-UX buiten noodzakelijke validatie- en foutmeldingsaanpassingen.

## Proposed approach
1. Inventariseer alle UI-invoerpunten waar title/onderwerp handmatig te wijzigen is binnen scope.
2. Voeg frontend constraints toe (`maxlength` waar mogelijk + centrale lengtecheck op submit) met duidelijke foutmelding.
3. Voeg backend/API schema- en/of service-validatie toe zodat requests met titels >80 tekens worden geweigerd met consistente foutrespons.
4. Harmoniseer validatiegedrag tussen planning Onderwerp→title en kanaal/variant titel-edits.
5. Voeg gerichte tests toe voor frontend en backend-validatiepaden.

## Implementation steps (ordered)
1. Bepaal de canonical validatieregel: title mag maximaal 80 Unicode-tekens bevatten (geen truncation; reject met foutmelding).
2. Lokaliseer frontend formulieren voor:
   - Vergaderborden-kaart aanmaken en kaarttitel bewerken;
   - planning Onderwerp (waar dit title opslaat);
   - handmatige channel/variant title edits.
3. Implementeer frontend limiet:
   - veldniveau (`maxLength=80` of equivalent);
   - submit-validatie voor bestaande/edge invoer (paste/programmatic value);
   - eenduidige gebruikersmelding bij overschrijding.
4. Lokaliseer backend endpoints/schemas/services die deze title updates verwerken.
5. Implementeer backend/API limiet op dezelfde regel (80), met duidelijke 4xx validatiefout.
6. Bevestig dat bestaande records ongewijzigd blijven en alleen nieuwe/gewijzigde writes worden gevalideerd.
7. Voeg/actualiseer tests:
   - frontend: 80 toegestaan, 81 geblokkeerd + fout zichtbaar;
   - backend: 80 geaccepteerd, 81 rejected met voorspelbare foutstructuur.
8. Update changelog/About-entry volgens repo Definition of Done tijdens implementatie.
9. Vul tijdens implementatie `What changed`, `How to verify` en `Verification evidence` met concrete resultaten.

## Acceptance criteria
1. Voor elk in-scope bewerkbaar titelveld accepteert de UI maximaal 80 tekens en toont een duidelijke validatiefout bij 81+.
2. Frontend submit van een titel met 81+ tekens wordt geblokkeerd.
3. Backend/API weigert elke in-scope create/update met title-lengte >80 met een consistente 4xx validatiefout.
4. Een title van exact 80 tekens wordt geaccepteerd door frontend én backend.
5. Scope dekt zowel planning Onderwerp (als title) als handmatige channel/variant title edits.
6. Scope dekt Vergaderborden-kaarttitels bij aanmaken en bewerken.
7. Bestaande data wordt niet gemigreerd of aangepast door deze wijziging.

## Testing plan
- Frontend targeted tests voor in-scope formulieren:
  - input van 80 tekens (pass);
  - input van 81 tekens (validatiefout + submit geblokkeerd).
- Backend/API targeted tests voor relevante endpoints:
  - payload met 80-tekens title (2xx/verwacht succes);
  - payload met 81-tekens title (4xx validatiefout).
- Integratie/manual check:
  1. Bewerk planning Onderwerp op 80 en 81 tekens.
  2. Bewerk handmatig channel/variant title op 80 en 81 tekens.
  3. Verifieer consistente foutboodschap en gedrag.
- Exacte commando’s worden tijdens implementatie ingevuld onder `How to verify`.

## Risk + rollback plan
### Risks
- Incomplete dekking: een bewerkbaar titelpad wordt gemist en blijft onbeperkt.
- Frontend/backend mismatch in telmethode of fouttekst veroorzaakt inconsistent gedrag.
- UX-frictie als foutmelding onvoldoende duidelijk is.

### Mitigation
- Mapping van alle in-scope edit-paden vooraf vastleggen.
- Één gedeelde constante/regel per laag gebruiken waar mogelijk (`80`).
- Testen op grenswaarden (79/80/81) en zowel UI als API.

### Rollback
- Revert van frontend en backend validatie-aanpassingen in deze change.
- Geen datarollback nodig (geen migraties of data-aanpassingen).

## Notes / links
- User request + agreed discovery outline: limit editable titles to 80 chars.
- Slug vastgesteld door user: `limit-editable-title-length-80`.
- Scopegrens expliciet: alleen validatie voor nieuwe/gewijzigde invoer; bestaande records blijven intact.

## Current status
Implemented and targeted verification passed

## What changed
- Voor planning Onderwerp (frontend) is een harde limiet van 80 tekens toegevoegd:
  - `maxLength=80` op het invoerveld;
  - submit-guard die verzenden blokkeert bij >80 en duidelijke foutmelding toont.
- Voor Vergaderborden-kaarttitels is een harde limiet van 80 tekens toegevoegd:
  - `maxLength=80` bij kaart aanmaken en kaarttitel bewerken;
  - submit/save-guards die opslaan blokkeren bij >80 en duidelijke foutmelding tonen.
- Voor kanaal/variant titelbewerking (frontend) is dezelfde 80-tekenslimiet toegevoegd:
  - `maxLength=80` op titelinput;
  - inline validatiefout bij >80;
  - save-knop geblokkeerd en extra submit-guard bij >80.
- Backend/API validatie is aangescherpt naar max 80 tekens voor in-scope paden:
  - `BoardCardCreateRequest.title` en `BoardCardTitleUpdateRequest.title`;
  - `TopicCreate.title` en `TopicCreate.subject`;
  - `TopicUpdate.title` en `TopicUpdate.subject`;
  - `VariantUpdateRequest.title`;
  - `ManualEditRequest.title`.
- Bestaande data blijft ongemoeid; er zijn geen migraties of data-aanpassingen gedaan.
- Tests uitgebreid:
  - frontend tests voor kaarttitel aanmaken/bewerken >80 blokkade;
  - frontend test voor Onderwerp >80 blokkade;
  - frontend test voor varianttitel >80 blokkade;
  - backend tests voor kaart aanmaken en kaarttitel bewerken met title >80 (422);
  - backend test voor topic create met title/subject >80 (422);
  - backend test voor variant update met title >80 (422).
- About/changelog geüpdatet met nieuwe eindgebruikersentry over de 80-tekenslimiet.

## How to verify
- Frontend targeted:
  - `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
  - `cd frontend && npm test -- src/app/App.test.tsx`
- Backend targeted:
  - `cd backend && uv run pytest tests/test_boards_api.py tests/test_auth_and_topics.py tests/test_channel_variants_api.py`
- Handmatige checks:
  1. Maak in Planning een nieuwe regel met Onderwerp van 80 tekens (moet kunnen opslaan).
  2. Probeer Onderwerp van 81 tekens (moet melding tonen en submit blokkeren).
  3. Open planningsdetail, bewerk kanaaltitel naar 80 tekens (moet kunnen opslaan).
  4. Probeer kanaaltitel van 81 tekens (moet melding tonen en opslaan blokkeren).

## Verification evidence
- `cd frontend && npm test -- src/app/App.test.tsx` ✅
  - Resultaat: 1 testbestand geslaagd, 51 tests geslaagd.
- `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` ✅
  - Resultaat: 1 testbestand geslaagd, 33 tests geslaagd.
- `cd frontend && npm run build` ✅
  - Resultaat: productiebuild geslaagd.
- `cd frontend && npm test` ✅
  - Resultaat: 84 tests geslaagd.
- `cd backend && uv run pytest tests/test_boards_api.py tests/test_auth_and_topics.py tests/test_channel_variants_api.py` ✅
  - Resultaat: 37 tests geslaagd, 148 warnings.
  - Noot: directe `python`/`python3 -m pip` installatie was niet beschikbaar in deze omgeving (`python` ontbreekt, `pip` ontbreekt voor `python3`); backend verificatie is daarom via de aanwezige `uv` workflow uitgevoerd.

---
Status: implemented / targeted verification passed
Owner: OPSX Implementer
Date: 2026-05-29
