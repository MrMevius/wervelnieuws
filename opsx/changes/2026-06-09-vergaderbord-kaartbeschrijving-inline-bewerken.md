# Title
Vergaderbord kaartbeschrijving enkel tonen en inline bewerken

## Context
In het vergaderbord-kaartdetail wordt de korte toelichting/beschrijving van een kaart momenteel dubbel getoond. Dat maakt de detailweergave onnodig druk en verwarrend. De gewenste UX is dat de beschrijving/toelichting één keer zichtbaar is en direct klikbaar bewerkbaar wordt, vergelijkbaar met de bestaande klikbare titelbewerking in het kaartdetail.

Deze wijziging is bedoeld als beperkte frontend-UX-correctie binnen de bestaande vergaderbord-kaartdetailcomponent en moet de bestaande updateflow/API hergebruiken waar mogelijk.

## Goals / Non-goals
### Goals
- Toon de kaartbeschrijving/toelichting maximaal één keer in alle kaartdetail-weergaves die dezelfde vergaderbord-kaartdetailcomponent gebruiken.
- Maak de zichtbare beschrijving/toelichting klikbaar om inline bewerken te starten, vergelijkbaar met de kaarttitel.
- Sla wijzigingen op via de bestaande updateflow/API waar mogelijk.
- Toon bij een lege beschrijving een duidelijke klikbare placeholder waarmee bewerken gestart kan worden.
- Behoud bestaande titelbewerking ongewijzigd.
- Werk de About/changelog-pagina bij met een eindgebruikersvriendelijke vermelding conform repo-regel.

### Non-goals
- Geen herontwerp van het vergaderbord of de kaartdetailmodal.
- Geen wijzigingen aan updates, bijlagen, opnames of publicatiestatussen.
- Geen backend-aanpassing tenzij de bestaande API/updateflow onvoldoende blijkt.
- Geen wijziging aan titelbewerking behalve noodzakelijke regressiechecks.
- Geen nieuwe publicatie-, audit- of versiehistoriefunctionaliteit.

## Proposed approach
1. Lokaliseer de gedeelde vergaderbord-kaartdetailcomponent/rendersectie waarin de beschrijving/toelichting momenteel dubbel verschijnt.
2. Bepaal welke beschrijvingsweergave de primaire UX moet blijven en verwijder/verberg de dubbele rendering.
3. Hergebruik het bestaande inline-edit patroon van de kaarttitel waar passend voor interactie, focusgedrag, opslaan en annuleren.
4. Hergebruik de bestaande beschrijving-updateflow/API indien aanwezig; introduceer alleen een backend-wijziging als uit inspectie blijkt dat de bestaande flow de beschrijving niet kan opslaan.
5. Voeg een klikbare placeholder toe voor kaarten zonder beschrijving, met duidelijke Nederlandse tekst en toegankelijke naam.
6. Beperk wijzigingen tot de kaartdetailbeschrijving en bijbehorende tests/changelog.

## Implementation steps (ordered)
1. Inspecteer `VergaderbordenPage` en eventuele uitgesplitste kaartdetailcomponenten om de dubbele beschrijvingsrendering en bestaande titelbewerkflow te identificeren.
2. Inspecteer de bestaande frontend API-client/updateflow voor kaartbeschrijving en bevestig of backend-aanpassing nodig is.
3. Verwijder één van de dubbele beschrijvingsweergaves zodat de beschrijving/toelichting maximaal één keer in kaartdetail verschijnt.
4. Maak de overblijvende beschrijvingsweergave klikbaar/focusbaar om inline bewerken te starten, met toegankelijke labels en keyboard-ondersteuning waar dit ook voor titelbewerking geldt.
5. Implementeer of hergebruik editmodus voor beschrijving:
   - gewijzigde tekst opslaan via bestaande flow;
   - ongewijzigde tekst niet onnodig opslaan;
   - lege tekst toestaan indien de bestaande beschrijvingsflow dat ondersteunt;
   - foutafhandeling zichtbaar houden volgens bestaande patronen.
6. Voeg een duidelijke klikbare placeholder toe voor lege beschrijvingen, bijvoorbeeld `Beschrijving toevoegen` of een projectconforme Nederlandse tekst.
7. Controleer dat titelbewerking nog werkt zoals vóór deze wijziging.
8. Voeg of actualiseer gerichte frontendtests voor dubbele rendering, inline bewerken, placeholder en titelbewerking-regressie.
9. Voer relevante frontend test/build uit en documenteer de exacte commando’s en resultaten in deze spec tijdens implementatie.
10. Werk de About/changelog-pagina bij met een korte eindgebruikersvriendelijke entry over de verbeterde kaartbeschrijving in het vergaderbord.

## Acceptance criteria (measurable)
1. De beschrijving/toelichting verschijnt maximaal één keer in het vergaderbord-kaartdetail.
2. Klikken op de zichtbare beschrijving/toelichting activeert inline bewerken.
3. Bewerken en opslaan van de beschrijving werkt consistent met de bestaande titelbewerking en gebruikt waar mogelijk de bestaande updateflow/API.
4. Een kaart zonder beschrijving toont een duidelijke klikbare placeholder waarmee beschrijving bewerken/toevoegen gestart wordt.
5. Bestaande titelbewerking in kaartdetail blijft werken.
6. Updates, bijlagen en publicatiestatussen gedragen zich ongewijzigd.
7. About/changelog bevat een eindgebruikersvriendelijke vermelding van deze UX-verbetering.

## Testing plan (canonical commands or approach)
- Frontend gericht:
  - Draai de relevante `VergaderbordenPage` test(s), bijvoorbeeld vanuit `frontend/`: `npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx` of het repo-conforme equivalent.
  - Voeg/actualiseer tests voor:
    - beschrijving wordt niet dubbel getoond;
    - klik op beschrijving opent inline edit;
    - lege beschrijving toont klikbare placeholder;
    - bestaande titelbewerking blijft werken.
- Frontend build/typecheck:
  - Draai vanuit `frontend/`: `npm run build` indien frontendcomponenten of types zijn aangepast.
- Backend gericht:
  - Alleen nodig als inspectie uitwijst dat een backend-aanpassing vereist is; draai dan relevante boards API-tests.
- Handmatige UI-check:
  1. Open een vergaderbordkaart met beschrijving en controleer dat deze één keer zichtbaar is.
  2. Klik op de beschrijving, wijzig tekst en sla op volgens de bestaande inline-edit interactie.
  3. Open een kaart zonder beschrijving en controleer de klikbare placeholder.
  4. Test titelbewerking in dezelfde kaartdetailweergave als regressiecheck.

## Risk + rollback plan
### Risks
- De kaartdetailcomponent kan gedeeld zijn door meerdere kaartdetailplekken, waardoor de wijziging breder zichtbaar wordt dan één scherm.
- Inline bewerken van beschrijving kan conflicteren met bestaande klik-, blur- of save-handlers van titelbewerking.
- Als de dubbele weergave uit twee verschillende datavelden komt, kan het verwijderen van de verkeerde rendering informatie verbergen.

### Mitigation
- Inspecteer alle usages van de gedeelde kaartdetailcomponent vóór wijziging en test de relevante detailpaden.
- Hergebruik bestaande titel-/beschrijvingseditpatronen in plaats van een nieuwe interactielaag te introduceren.
- Controleer expliciet welk veld de korte toelichting/beschrijving representeert en behoud de canonieke bron.

### Rollback
- Draai de frontendwijziging terug naar de vorige rendering van de kaartbeschrijving/toelichting.
- Verwijder eventuele toegevoegde frontendtests/changelog-entry als de functionaliteit volledig wordt teruggedraaid.
- Indien onverhoopt een backend-aanpassing nodig was, revert die apart en herstel gebruik van de vorige API-flow.

## Notes / links
- Bron: user-provided Draft Change Spec Outline in deze sessie.
- Verwachte scope: frontend vergaderbord-kaartdetailcomponent, waarschijnlijk rond `VergaderbordenPage` en bijbehorende test(s).
- Docs impact: geen technische docs verwacht; About/changelog wel bijwerken conform repo Definition of Done.

## Current status
Completed — implementatie, verificatie en review zijn afgerond. De gevraagde frontendtests slagen met 37 tests en de frontend production build slaagt. Docs/changelog-impact is compleet via de About/changelog-entry; er zijn geen aanvullende technische docs nodig.

## What changed
- In het vergaderbord-kaartdetail is de dubbele beschrijvingsweergave verwijderd: buiten editmodus blijft alleen de klikbare rich-text beschrijving zichtbaar.
- De zichtbare beschrijving start nu inline bewerken via dezelfde bestaande `updateBoardCardDescription` updateflow; opslaan bij blur, lengtevalidatie en foutmelding blijven gelijk aan de bestaande beschrijvingseditor.
- De klikbare rich-text beschrijving gebruikt een focusbare `role="button"` wrapper met Enter/spatie-ondersteuning, zodat block rich-text markup niet in een HTML `<button>` terechtkomt.
- Kaarten zonder beschrijving tonen in het detail een duidelijke klikbare placeholder `Beschrijving toevoegen`.
- De titelbewerkflow is ongemoeid gelaten en blijft gedekt door bestaande regressietests.
- De About/changelog-defaultcontent is aangevuld met een eindgebruikersvriendelijke entry over de verbeterde kaartbeschrijving.
- Gerichte frontendtests zijn aangepast/uitgebreid voor klikbaar bewerken, geen dubbele detailweergave, de lege placeholder en foutafhandeling bij mislukte beschrijving-save.
- Review afgerond zonder blocking findings voor deze spec; de wijziging blijft beperkt tot kaartdetailbeschrijving, bijbehorende tests en About/changelog.

## How to verify
- `cd frontend && npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx`
- `cd frontend && npm run build`
- Optioneel vanwege About/changelog-entry: `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py`

## Verification evidence
- PASS — `cd frontend && npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx`: 1 test file passed, 37 tests passed.
- PASS — `cd frontend && npm run build`: TypeScript build en Vite production build geslaagd.
- Eerder aanvullende backend meta-check vanwege About/changelog-entry: `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py` draaide 18 tests waarvan 17 passed en 1 bestaande/ongerelateerde failure op `test_login_token_expiry_aligns_with_cookie_ttl_by_default` (token TTL circa 43199s versus cookie Max-Age 2592000s). De About/changelog-test in hetzelfde bestand faalde niet.

## Follow-ups
- Geen functionele follow-ups voor deze spec.
- Scope-isolatie bij eventueel later committen: controleer de working tree en stage/commit alleen de bestanden die bij deze spec horen, omdat er in deze repo ook andere actieve specs/wijzigingen kunnen bestaan.

---
Status: completed
Owner: n/a
Date: 2026-06-09
