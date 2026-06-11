# Title
Admin Gebruikers compactere bewerkmodal

## Context
De Admin > Gebruikers user edit/manage modal is visueel te hoog en ruim opgezet voor de beperkte hoeveelheid inhoud. Door ruime sectiekaarten, helpertekst, inputvelden, knoppen en avatarupload ontstaat snel verticale scroll binnen de modal.

Deze wijziging moet de bestaande bewerk-/beheermodal merkbaar compacter maken zonder functionaliteit, veiligheidscontroles of bestaande gebruikersbeheerflows te veranderen. De modal moet de secties `Profielgegevens` en `Accountacties` behouden, maar met strakkere spacing, kortere copy en compactere controls zodat profielvelden, avatarupload en accountacties sneller zichtbaar en bereikbaar zijn.

## Goals / Non-goals
### Goals
- Maak de Admin > Gebruikers bewerk-/beheermodal duidelijk compacter door verticale padding, marges en tussenruimtes te verminderen.
- Verkort helpercopy waar mogelijk zonder betekenis of veiligheidsinformatie te verliezen.
- Maak sectiekaarten dichter en rustiger, met behoud van de secties `Profielgegevens` en `Accountacties`.
- Verlaag inputveldhoogte en gebruik compactere knoppen waar dit bruikbaar en toegankelijk blijft.
- Compacteer de avataruploadzone met kleinere preview en kortere uploadpresentatie, terwijl uploadknop, bestandsnaam en hulptekst leesbaar blijven.
- Verminder de noodzaak voor verticale scroll binnen de modal bij dezelfde inhoud.
- Behoud alle bestaande acties en beveiligingen: naam/e-mail/avatar bewerken, wachtwoord resetten, adminrol wijzigen, in-/uitschakelen, verwijderen, bestaande confirmaties, overlay/Escape-sluitgedrag en dirty-change protection.
- Houd de modal bruikbaar op kleinere schermen en behoud het bestaande max-height/scrollgedrag als vangnet.
- Werk frontendtests alleen bij waar gedrag, labels of praktische class-/structuurasserties dit nodig maken.
- Werk de user-facing About/changelog-content bij volgens de repo Definition of Done.

### Non-goals
- Geen nieuwe gebruikersbeheerfunctionaliteit.
- Geen nieuwe backendwijzigingen voor deze compactheidswijziging, behalve About/changelog/meta als dat nodig is voor de changelog-entry. Backend Admin API-wijzigingen die in dezelfde werkboom zichtbaar zijn horen bij prerequisite/related eerder goedgekeurde specs en worden niet door deze compact-modal spec geïntroduceerd.
- Geen volledig redesign van de Admin-pagina of gebruikerslijst.
- Geen wijzigingen aan permissies, validatie, accountactielogica of self-protection behavior.
- Geen wijzigingen aan andere modals, behalve strikt noodzakelijke en lokaal veilige shared stylingcorrecties.
- Geen implementatie binnen deze spec-authoring stap.

## Proposed approach
1. Inspecteer de huidige Admin > Gebruikers modalmarkup, styling/classes, avataruploadpresentatie, copy en tests.
2. Scope compactheidswijzigingen zo lokaal mogelijk rond de Admin Gebruikers bewerkmodal om regressies in andere modals te voorkomen.
3. Maak de modalheader compacter met een kortere subtitle/helpertekst.
4. Verminder verticale spacing binnen `Profielgegevens`: compactere labels, inputrijen, veldmarges en sectiepadding.
5. Compacteer avatarupload door kleinere preview, kortere uploadzone en bondige hulptekst, met behoud van uploadknop en bestandsnaamfeedback.
6. Verminder verticale spacing binnen `Accountacties` en groepeer neutrale en risicovolle/destructieve acties strakker maar nog duidelijk herkenbaar.
7. Gebruik kleinere knoppen en lagere inputs waar dit geen toegankelijkheids- of klikbaarheidsschade oplevert.
8. Behoud bestaande modal max-height en responsive gedrag; overweeg alleen een iets bredere modal als dit hoogte reduceert zonder kleine schermen te verslechteren.
9. Laat alle bestaande handlers, confirmaties, overlay/Escape close behavior en dirty-change protection functioneel intact.
10. Update tests alleen voor gewijzigde labels/structuur of voor compacte modalclass-/structuurasserties als dat praktisch en niet broos is.
11. Werk About/changelog-content bij tijdens implementatie en vul daarna deze spec aan met wijzigings- en verificatiebewijs.

## Implementation steps (ordered)
1. Bevestig dit document als actieve change spec voordat implementatie start.
2. Inspecteer de bestaande Admin > Gebruikers component(en), user edit/manage modal, CSS/classes, accountactiehandlers, avataruploadflow en relevante tests.
3. Noteer de huidige modalstructuur en identificeer welke spacing/copy/styling lokaal kan worden aangepast zonder gedeelde modalregressies.
4. Pas de modalheader aan naar een compactere titel-/subtitlepresentatie met kortere helpercopy.
5. Maak `Profielgegevens` compacter door sectiepadding, veldmarges, labelspacing en inputhoogtes te reduceren.
6. Compacteer de avataruploadarea met kleinere preview/placeholder, kortere helptekst en een minder hoge uploadcontrol, met behoud van leesbare bestandsnaamfeedback.
7. Maak knoppen in de modal compacter waar passend, zonder bestaande acties of disabled/loading-states te wijzigen.
8. Maak `Accountacties` compacter door neutralere acties en risicovolle/destructieve acties dichter te groeperen, terwijl risico's herkenbaar blijven.
9. Controleer responsive gedrag op kleinere schermen; behoud max-height/overflow als fallback en vermijd horizontale overflow.
10. Controleer dat overlayklik, Escape, annuleren/sluitknop en dirty-change protection exact blijven werken.
11. Controleer dat profiel opslaan, avatarupload, wachtwoordreset, adminrolwijziging, enable/disable en delete inclusief confirmaties blijven werken.
12. Update frontendtests voor gewijzigde labels/structuur of voeg compacte modalclass-/structuurasserties toe als dit praktisch en onderhoudbaar is.
13. Werk de user-facing About/changelog-content bij met een korte, functionele entry over de compactere gebruikersmodal.
14. Voer gerichte frontendtests uit.
15. Voer de frontend build uit.
16. Als About/changelog/meta of backendcode wordt geraakt, voer de relevante targeted About/API-test uit.
17. Update deze spec met `What changed`, `How to verify`, `Verification evidence` en zet `Current status` naar de passende implementatiestatus.

## Acceptance criteria
1. De Admin > Gebruikers user edit/manage modal oogt en voelt merkbaar compacter dan voorheen.
2. De modal vereist minder verticale scroll voor dezelfde inhoud dan vóór de wijziging.
3. `Profielgegevens` en `Accountacties` blijven als herkenbare secties aanwezig.
4. Profielvelden, avatarupload en accountacties blijven leesbaar en bruikbaar op normale en kleinere schermen.
5. De avatarpreview/uploadzone neemt minder verticale ruimte in, terwijl uploadknop, gekozen bestandsnaam en helptekst begrijpelijk blijven.
6. Neutrale en gevaarlijke accountacties zijn strakker gegroepeerd, maar risico-/destructieve acties blijven duidelijk herkenbaar.
7. Naam, e-mailadres en avatar bewerken blijven werken.
8. Wachtwoord resetten, adminrol wijzigen, gebruiker in-/uitschakelen en gebruiker verwijderen blijven werken met bestaande confirmaties en protections.
9. Overlay click, Escape close, annuleren/sluitknop en dirty-change protection blijven werken zoals vóór deze compactheidswijziging.
10. Frontendtests voor de geraakte Admin/Gebruikers-flow slagen.
11. `cd frontend && npm run build` slaagt.
12. Backendtests zijn alleen vereist als backend/meta code wordt geraakt; in dat geval slaagt de relevante targeted test.
13. About/changelog-content bevat een end-user-friendly entry voor de compactere gebruikersmodal.

## Testing plan
- Gerichte frontendtests:
  - `cd frontend && npm test -- App.test.tsx`
  - Of de tijdens inspectie gevonden specifieke Admin/Gebruikers-testbestanden, bijvoorbeeld `cd frontend && npm test -- <admin-users-test-file>`.
- Frontend build:
  - `cd frontend && npm run build`
- Backend/API alleen als About/changelog/meta of backendcode wordt geraakt:
  - Voer de relevante targeted About/API-test uit, bijvoorbeeld de test die `/api/meta/about` of changelogpayload valideert.
- Handmatige verificatie:
  1. Log in als admin.
  2. Open Admin > Gebruikers.
  3. Open de Bewerken/user edit/manage modal.
  4. Vergelijk de modalhoogte, sectiespacing, inputhoogte, avatarupload en accountacties met de vorige ruime opzet.
  5. Controleer dat minder verticale scroll nodig is voor dezelfde inhoud.
  6. Controleer de modal op een kleiner scherm of smalle viewport.
  7. Test overlayklik, Escape, annuleren/sluitknop en dirty-change protection.
  8. Test profielsave, avatarselectie/upload en alle accountacties op bereikbaarheid en bestaande confirmaties.

## Risk + rollback plan
### Risico's
- Overmatig comprimeren kan leesbaarheid, focusvolgorde of klik-/touchtargets verslechteren; mitigatie: labels duidelijk houden en controls niet kleiner maken dan verantwoord bruikbaar.
- CSS-wijzigingen kunnen andere modals raken als selectors te breed zijn; mitigatie: styles scopen op de Admin Gebruikers modal.
- Compactere copy kan belangrijke context of waarschuwingen te veel inkorten; mitigatie: veiligheidsinformatie en bevestigingscopy behouden.
- Testselectors kunnen breken door markup- of labelwijzigingen; mitigatie: tests op toegankelijk gedrag en stabiele labels/classes richten in plaats van broze layoutdetails.
- Responsive gedrag kan verslechteren als de modal breder wordt; mitigatie: breedte alleen aanpassen als kleine viewports goed blijven werken.

### Rollback
- Revert de lokale CSS/class/layout/copy-wijzigingen voor de Admin Gebruikers bewerkmodal.
- Herstel de vorige avataruploadpresentatie, input-/buttonformaten en sectiespacing.
- Revert eventuele testwijzigingen die alleen voor de compacte presentatie waren toegevoegd.
- Revert de About/changelog-entry als de wijziging volledig wordt teruggedraaid.
- Voer de gerichte frontendtests en frontend build opnieuw uit om rollback te bevestigen.

## Notes / links
- Aangevraagde specpath: `opsx/changes/2026-06-11-admin-gebruikers-compactere-bewerkmodal.md`.
- Bouwt voort op bestaande Admin > Gebruikers modalwijzigingen, waaronder:
  - `opsx/changes/2026-06-11-admin-gebruikers-profielbewerking-acties.md`.
  - `opsx/changes/2026-06-11-admin-gebruikers-acties-in-bewerkmodal.md`.
  - `opsx/changes/2026-06-11-admin-gebruikers-modal-ux-polish.md`.
- Deze compact-modal change is primair frontend + About/changelog/meta. Backend Admin API-bestanden/tests die in de gerelateerde werkboom geraakt zijn, vallen onder prerequisite/related eerder goedgekeurde Admin Gebruikers-specs en zijn hier alleen als regressie-afdekking meegenomen.
- `.opencode/package-lock.json` is unrelated/out-of-scope voor deze compact-modal change; niet aanpassen of verwijderen binnen deze spec.
- Repo Definition of Done vereist een functionele, end-user-friendly About/changelog-entry voor elke afgeronde iteratie.
- Geen code implementeren als onderdeel van deze spec-authoring stap.

## Current status
Completed.

## What changed
- De Admin > Gebruikers bewerk-/beheermodal is compacter gemaakt met minder modalpadding, lagere sectiepadding, kleinere gaps, compactere helpercopy, lagere inputs/knoppen en een smallere avataruploadrij.
- De avatarpreview is verkleind en de uploadzone gebruikt minder padding; bestandsnaamfeedback en toegestane bestandstypes blijven zichtbaar.
- `Profielgegevens` en `Accountacties` blijven als aparte secties aanwezig; neutrale en risicovolle accountacties blijven gescheiden maar dichter gegroepeerd.
- Bestaande handlers en protections zijn ongemoeid gehouden: profielsave, avatarupload, wachtwoordreset, adminrol, status, delete, confirmaties, overlay/Escape/sluitknop en dirty-change protection.
- Frontendtests zijn bijgewerkt voor de kortere helpercopy en een onderhoudbare structuurassertie op compacte modalsecties/avatar/action-groepen.
- About/changelog-content is bijgewerkt met iteratie 72 over de compactere gebruikersmodal.
- Afbakening: deze spec introduceert geen nieuwe backend Admin API-functionaliteit; bestaande/gerelateerde backend Admin API-protections blijven afgedekt via de eerder geraakte testfile.

## How to verify
- `cd frontend && npm test -- App.test.tsx`
- `cd frontend && npm run build`
- Omdat `backend/app/api/meta.py` is geraakt voor de changelog-entry: `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py::test_about_returns_read_only_payload`
- Regressie-afdekking voor bestaande/gerelateerde Admin API-protections in de werkboom: `backend/.venv/bin/pytest backend/tests/test_admin_api.py`
- Handmatige smoke via code-/testinspectie: controleer dat de modal `Profielgegevens` en `Accountacties` behoudt, de compacte classes/structuur gebruikt en dat bestaande close-/dirty- en accountactiehandlers niet functioneel zijn aangepast.

## Verification evidence
- PASS — `cd frontend && npm test -- App.test.tsx`: 1 test file passed, 68 tests passed.
- PASS — `cd frontend && npm run build`: TypeScript build en Vite production build geslaagd; 95 modules transformed.
- PASS — `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py::test_about_returns_read_only_payload`: 1 test passed, 2 warnings (bestaande pytest/passlib/jose deprecation warnings).
- PASS — `backend/.venv/bin/pytest backend/tests/test_admin_api.py`: targeted Admin API-regressietest geslaagd voor de bestaande/gerelateerde admin-user backend protections die in de werkboom aanwezig zijn; deze compact-modal spec introduceert geen nieuwe backend Admin API-functionaliteit.
- PASS (inspectie) — compacte modalstructuur staat lokaal gescoped op `.admin-user-profile-modal`; max-height/overflow fallback blijft behouden; bestaande actiehandlers en confirmatie-/dirty-change flows blijven op dezelfde knoppen gekoppeld.
- Out-of-scope bevestiging — `.opencode/package-lock.json` is unrelated/out-of-scope voor deze wijziging en is niet aangepast of verwijderd binnen deze docs/spec close-out.

## Status footer
- Status: completed
- Owner: optional
- Date: 2026-06-11
