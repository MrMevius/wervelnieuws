# Title
Kaart-verplaats updates als niet-bewerkbare system messages

## Context
Automatische kaart-verplaats updates gedragen zich nu als gewone updates en kunnen daardoor worden bewerkt of verwijderd. Dat is ongewenst: in de kaartmodal moeten dit system messages zijn die alleen informatief zijn.

Deze wijziging is een gerichte follow-up op de bestaande kaart-update UX, met focus op de updates-lijst in de kaartmodal. De bedoeling is om automatische move-updates consequent niet-actief te presenteren, zonder handmatige updates of andere systeemupdate-types te veranderen.

## Goals / Non-goals
### Goals
- Toon automatische kaart-verplaats updates in de kaartmodal als system messages.
- Verberg/blokkeer voor automatische kaart-verplaats updates zowel de `Bewerken`- als de `Verwijderen`-actie.
- Laat dit gelden voor zowel bestaande als nieuwe kaart-verplaats updates.
- Laat handmatige updates ongewijzigd bewerkbaar/verwijderbaar volgens huidige rechten.

### Non-goals
- Geen wijziging aan handmatige updates.
- Geen wijziging aan andere systeemupdate-types.
- Geen backend-opslagwijziging van updateberichten, tenzij dat technisch onvermijdelijk blijkt.
- Geen verandering aan de inhoud van de move-update zelf; alleen aan de presentatie en acties.

## Proposed approach
1. Hergebruik de bestaande detectie of metadata voor automatische kaart-verplaats updates.
2. Markeer deze updates in de kaartmodal als system messages in de renderlaag.
3. Verberg voor deze updates de volledige actie-ui, inclusief `Bewerken` en `Verwijderen`.
4. Laat de huidige action logic voor handmatige updates intact.
5. Zorg dat historische move-updates en nieuw aangemaakte move-updates dezelfde niet-bewerkbare presentatie krijgen.
6. Voeg gerichte frontend-regressietests toe voor move-updates en handmatige updates.

## Implementation steps (ordered)
1. Lokaliseer de kaartmodal-updates-lijst en de bestaande detectie/renderlogica voor automatische kaart-verplaats updates.
2. Bepaal het kleinste betrouwbare criterium om een update als move/system message te classificeren.
3. Pas de renderlaag aan zodat automatische kaart-verplaats updates als system message worden weergegeven.
4. Verberg voor deze updates alle actieknoppen/links, in het bijzonder `Bewerken` en `Verwijderen`.
5. Controleer dat bestaande move-updates dezelfde behandeling krijgen zonder datamigratie.
6. Controleer dat handmatige updates en andere systeemupdates hun huidige gedrag behouden.
7. Voeg of werk frontendtests bij voor:
   - bestaande automatische move-update,
   - nieuwe automatische move-update,
   - handmatige update met bestaande acties.
8. Run relevante frontend build/test-verificatie en leg de uitkomst vast.

## Acceptance criteria
1. Automatische kaart-verplaats updates tonen geen `Bewerken`-actie in de kaartmodal.
2. Automatische kaart-verplaats updates tonen geen `Verwijderen`-actie in de kaartmodal.
3. Dit geldt zowel voor bestaande als nieuwe kaart-verplaats updates.
4. Handmatige updates blijven bewerkbaar/verwijderbaar volgens de huidige rechten.
5. Andere systeemupdate-types blijven ongewijzigd, tenzij ze al hetzelfde bestaande gedrag hadden.
6. De UI onderscheidt move-updates zichtbaar als system messages in plaats van gewone interactieve updates.

## Testing plan
- Gerichte frontendtest(s) voor de kaartmodal-updates-lijst:
  - bestaande move-update zonder acties,
  - nieuwe move-update zonder acties,
  - handmatige update met behoud van acties.
- Frontend build draaien voor gewijzigde componenten.
- Waar relevant: relevante frontend test-suite of componenttest voor regressie op action rendering.

## Risk + rollback plan
### Risico’s
- Detectie van kaart-verplaats updates kan te smal zijn, waardoor niet alle historische move-updates system message gedrag krijgen.
- Detectie kan te breed zijn, waardoor gewone updates onterecht actie-vrij worden.
- Als de renderlaag alleen de UI verbergt maar niet de semantiek wijzigt, kan de code later kwetsbaar blijven voor regressie.

### Rollback
- Herstel de huidige actieknoppenlogica voor updates in de kaartmodal.
- Laat detectie/renderwijzigingen terugvallen naar de bestaande update-weergave.
- Geen datamigratie terugdraaien nodig als er geen opslagwijziging wordt doorgevoerd.

## Notes / links
- Volgt de meegegeven Draft Change Spec Outline.
- Waarschijnlijk geen extra externe docs nodig; wel deze spec en de verificatie-evidence bijwerken.
- Gerelateerd aan eerdere kaart-update/specs in `opsx/changes/` rond move-updates en compacte actions.

## Current status
Done

## What changed
- Automatische kaart-verplaats updates in de kaartmodal worden nu herkend via de bestaande move-message-regex en renderen als informatieve system messages zonder `Bewerken`- of `Verwijderen`-actie.
- De edit- en delete-acties blijven ongewijzigd beschikbaar voor handmatige updates wanneer de huidige rechten dat toestaan.
- De About/changelog-informatie bevat een korte end-user entry over deze wijziging.

## How to verify
- Gerichte frontendtest:
  - `npm run test -- src/app/features/admin/VergaderbordenPage.test.tsx`
- Frontend build:
  - `npm run build`
- Gerichte backendtest:
  - `./.venv/bin/pytest tests/test_meta_and_me.py -k about_returns_read_only_payload`

## Verification evidence
- `npm run test -- src/app/features/admin/VergaderbordenPage.test.tsx` ✅ 37 tests passed.
- `npm run build` ✅ frontend build completed successfully.
- `./.venv/bin/pytest tests/test_meta_and_me.py -k about_returns_read_only_payload` ✅ 1 test passed.

---
Status: done
Owner: n.v.t.
Date: 2026-06-13
