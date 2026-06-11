# Title
Admin Gebruikers accountacties in bewerkmodal

## Context
De Admin > Gebruikers-tab heeft inmiddels compactere gebruikersacties en een bestaande `Bewerken`-modal voor profielgegevens zoals naam, e-mailadres en avatar. De gebruikerstabel toont echter nog steeds meerdere accountactieknoppen per rij. Daardoor blijft de tabel visueel druk en minder goed scanbaar, vooral wanneer admins snel de lijst met gebruikers willen beoordelen.

De gewenste UX is dat iedere gebruikersrij nog maar één duidelijke actie toont: `Bewerken`. Alle per-user accountbeheeracties moeten contextueel beschikbaar zijn in de bestaande edit modal, zonder bestaande veiligheidsregels, bevestigingen, API-contracten of profielbewerkfunctionaliteit te verzwakken.

Deze wijziging bouwt voort op de afgeronde Gebruikers-tab UX-/veiligheidsverbeteringen en profielbewerkmodal. Implementatie moet gericht blijven op de Admin > Gebruikers-tab.

## Goals / Non-goals
### Goals
- Toon in de `Acties`-kolom van de gebruikersrijen alleen nog de actie `Bewerken`.
- Breid de bestaande gebruikersbewerkmodal uit met een duidelijk gescheiden sectie `Accountacties`.
- Verplaats bestaande accountacties naar de modal:
  - adminrol toevoegen of verwijderen, volgens huidig ondersteund gedrag;
  - gebruiker inschakelen of uitschakelen;
  - gebruiker verwijderen;
  - wachtwoord resetten.
- Behoud bestaande bevestigingen voor risicovolle acties voordat API-calls worden uitgevoerd.
- Behoud bestaande frontend- en backendbescherming tegen self-lockout.
- Toon acties die tot self-lockout kunnen leiden in de modal als disabled/geblokkeerd met duidelijke uitleg.
- Behoud bestaande profielbewerking voor naam, e-mailadres en avatar.
- Hergebruik huidige endpoints en API-clientfuncties waar mogelijk.
- Voeg of actualiseer frontendtests voor de nieuwe actiepositie in de modal en regressies op bestaande accountacties.
- Werk de user-facing About/changelog-content bij volgens de repo Definition of Done.

### Non-goals
- Geen nieuw rollenmodel.
- Geen nieuwe gebruikersdetailpagina.
- Geen backendgedragswijzigingen, tenzij inspectie aantoont dat een kleine aanpassing noodzakelijk is om bestaande bescherming of regressievrij gedrag te behouden.
- Geen herontwerp van andere Admin-tabs.
- Geen wijzigingen aan accountacties buiten de bestaande Gebruikers-tab-flow.
- Geen implementatie binnen deze spec-authoring stap.

## Proposed approach
1. Inspecteer de huidige Admin > Gebruikers-component, bestaande edit modal, user action handlers, API-clientfuncties en frontendtests.
2. Behoud de bestaande tabelstructuur, status-/rolbadges en profielbewerkmodal; wijzig alleen de actiepresentatie en plaatsing van accountbeheeracties.
3. Verwijder de per-row accountactieknoppen uit de tabelweergave en laat per rij alleen `Bewerken` staan in de `Acties`-kolom.
4. Voeg in de bestaande bewerkmodal een visueel en semantisch gescheiden sectie `Accountacties` toe naast/onder `Profielgegevens`.
5. Verplaats de bestaande handlers voor adminrol, status, verwijderen en wachtwoordreset naar knoppen/controls in de modal, met behoud van huidige API-calls, loading/error feedback en lijstrefresh waar van toepassing.
6. Pas de self-lockout UI-regels toe binnen de modal: eigen account niet kunnen verwijderen, uitschakelen of demoten; toon disabled/blocked controls met korte uitleg.
7. Behoud risicobevestigingen voor wachtwoordreset, uitschakelen, verwijderen en adminrol verwijderen direct vóór de API-call.
8. Houd de modal overzichtelijk door profielvelden en accountacties expliciet te scheiden en destructieve acties visueel herkenbaar te houden.
9. Actualiseer tests zodat ze niet langer rijactieknoppen verwachten behalve `Bewerken`, en zodat accountacties vanuit de modal worden uitgevoerd/getest.
10. Werk About/changelog-content bij tijdens implementatie en vul daarna deze spec aan met exacte wijzigingen en verificatiebewijs.

## Implementation steps (ordered)
1. Bevestig dit document als actieve change spec voordat implementatie start.
2. Inspecteer de huidige Admin > Gebruikers-frontendcomponent(en), modalstructuur, styling/classes, API-clientfuncties en relevante tests.
3. Inspecteer hoe de huidige ingelogde gebruiker in de frontend beschikbaar is en waar self-lockout checks nu worden toegepast.
4. Verwijder of verberg de bestaande reset/status/delete/adminrol-knoppen uit de table row action rendering.
5. Zorg dat iedere gebruikersrij in de `Acties`-kolom precies één zichtbare primaire/duidelijke `Bewerken`-actie heeft.
6. Voeg in de bestaande edit modal een sectie `Profielgegevens` toe of behoud die expliciete scheiding als deze al bestaat.
7. Voeg in dezelfde modal een sectie `Accountacties` toe met de bestaande accountbeheeracties voor de geselecteerde gebruiker.
8. Verbind de modalacties met de bestaande handlers/API-clientfuncties voor adminrol toevoegen/verwijderen, gebruiker inschakelen/uitschakelen, gebruiker verwijderen en wachtwoord resetten.
9. Behoud bestaande bevestigingsteksten of gelijkwaardige actie-specifieke confirmaties voor risicovolle acties.
10. Blokkeer/disable self-lockout-acties op het eigen account in de modal en toon per geblokkeerde actie of bij de sectie een duidelijke verklaring.
11. Controleer dat naam, e-mailadres en avatar bewerken ongewijzigd blijft werken in dezelfde modal.
12. Zorg dat de modal na acties consistent gedrag vertoont: lijstdata wordt ververst, feedback blijft duidelijk, en de modal sluit of blijft open volgens bestaand passend patroon.
13. Actualiseer frontendtests voor de vereenvoudigde tabelactiekolom.
14. Actualiseer frontendtests voor accountacties vanuit de modal, inclusief confirmatie annuleren/doorgaan en self-lockout blokkade.
15. Als backend/API toch wordt aangepast, voeg of actualiseer gerichte backendtests voor de geraakte admin-endpoints.
16. Werk de user-facing About/changelog-content bij met een korte functionele entry over overzichtelijker gebruikersbeheer.
17. Voer de afgesproken frontendtests en frontend build uit.
18. Voer backendtests alleen uit als backendcode is geraakt.
19. Update deze spec met `What changed`, `How to verify`, `Verification evidence` en zet `Current status` naar de passende implementatiestatus.

## Acceptance criteria
1. De gebruikerslijst toont in de `Acties`-kolom per gebruiker alleen `Bewerken` als rijactie.
2. Accountacties voor adminrol toevoegen/verwijderen, gebruiker inschakelen/uitschakelen, gebruiker verwijderen en wachtwoord resetten zijn beschikbaar in de bewerkmodal.
3. De bewerkmodal heeft een duidelijke scheiding tussen `Profielgegevens` en `Accountacties`.
4. Risicovolle acties vragen nog steeds bevestiging voordat de bijbehorende API-call wordt uitgevoerd.
5. Als een bevestiging wordt geannuleerd, wordt de bijbehorende API-call niet uitgevoerd.
6. De huidige ingelogde gebruiker kan zichzelf niet per ongeluk uitschakelen, verwijderen of de eigen adminrol afnemen.
7. Self-lockout-acties op het eigen account zijn in de modal disabled/geblokkeerd en voorzien van duidelijke uitleg.
8. Bestaande profielbewerking voor naam, e-mailadres en avatar blijft werken.
9. Bestaande toegestane accountacties blijven werken voor andere gebruikers volgens de huidige backendregels en endpoints.
10. Frontendtests dekken de vereenvoudigde table actions en accountacties vanuit de modal.
11. `cd frontend && npm run build` slaagt.
12. Gerichte frontendtests voor de Admin/Gebruikers-flow slagen.
13. Backendtests worden uitgevoerd en slagen als backendcode is geraakt.
14. About/changelog-content bevat een end-user-friendly entry voor deze wijziging.

## Testing plan
- Inspectie vóór implementatie:
  - Zoek de huidige Admin > Gebruikers-component, edit modal, accountactiehandlers en relevante tests.
  - Controleer waar About/changelog-content wordt beheerd.
- Gerichte frontendtests:
  - `cd frontend && npm test -- App.test.tsx`
  - Of de tijdens inspectie gevonden specifieke Admin/Gebruikers-testbestanden, bijvoorbeeld `cd frontend && npm test -- <admin-users-test-file>`.
- Frontend build:
  - `cd frontend && npm run build`
- Backendtests alleen als backend/API wordt geraakt:
  - `backend/.venv/bin/pytest backend/tests/test_admin_api.py`
- Handmatige verificatie:
  1. Log in als admin.
  2. Open Admin > Gebruikers.
  3. Controleer dat elke gebruikersrij in de tabel alleen `Bewerken` toont in de `Acties`-kolom.
  4. Open `Bewerken` voor een andere gebruiker en controleer `Profielgegevens` en `Accountacties`.
  5. Voer of simuleer reset password, rolwijziging, statuswijziging en verwijderen vanuit de modal; controleer confirmaties.
  6. Annuleer een confirmatie en controleer dat er geen wijziging/API-call plaatsvindt.
  7. Open `Bewerken` voor het eigen account en controleer dat disable/delete/remove-admin geblokkeerd of disabled zijn met duidelijke uitleg.
  8. Controleer dat naam, e-mailadres en avatar nog kunnen worden aangepast volgens bestaande regels.

## Risk + rollback plan
### Risico's
- Het verplaatsen van handlers naar de modal kan bestaande accountacties breken; mitigatie: hergebruik bestaande handlerlogica/API-calls en voeg regressietests toe die acties vanuit de modal uitvoeren.
- De modal kan te druk worden; mitigatie: scheid `Profielgegevens` en `Accountacties` duidelijk en houd destructieve acties gegroepeerd/herkenbaar.
- Self-lockout bescherming kan per ongeluk verdwijnen bij het verplaatsen van controls; mitigatie: test expliciet eigen account delete/disable/remove-admin blokkades in de modal.
- Tests kunnen falen omdat ze oude rijactieknoppen zoeken; mitigatie: actualiseer tests zodat ze de nieuwe UX-contracten vastleggen.
- Backendwijzigingen zouden onbedoeld API-gedrag kunnen wijzigen; mitigatie: backend alleen aanpassen als noodzakelijk en bestaande endpoints als uitgangspunt nemen.

### Rollback
- Herstel de accountactieknoppen in de gebruikersrijen volgens de vorige implementatie.
- Verwijder de sectie `Accountacties` uit de edit modal.
- Revert testwijzigingen en About/changelog-entry voor deze feature als de wijziging volledig wordt teruggedraaid.
- Revert eventuele backendwijzigingen afzonderlijk als die toch nodig waren.
- Voer dezelfde gerichte frontendtests, frontend build en eventuele backendtests opnieuw uit om rollback te bevestigen.

## Notes / links
- Aangevraagde specpath: `opsx/changes/2026-06-11-admin-gebruikers-acties-in-bewerkmodal.md`.
- Bouwt voort op afgeronde specs:
  - `opsx/changes/2026-06-11-admin-gebruikers-tab-ux-veiligheid.md`.
  - `opsx/changes/2026-06-11-admin-gebruikers-profielbewerking-acties.md`.
- Repo Definition of Done vereist een functionele, end-user-friendly About/changelog-entry voor elke afgeronde iteratie.
- Backendgedrag moet in principe ongewijzigd blijven; bestaande endpoints moeten worden hergebruikt tenzij inspectie een noodzakelijke regressiefix aantoont.
- Geen code implementeren als onderdeel van deze spec-authoring stap.
- De huidige working tree kan backend admin-/profielbestanden bevatten uit prerequisite specs. Deze actieve wijziging introduceert zelf geen nieuw backendgedrag voor gebruikersacties; de modal hergebruikt bestaande endpoints en bestaande backendbescherming.
- Er bestaat een unrelated untracked bestand `.opencode/package-lock.json`. Dit hoort niet bij deze app-wijziging en moet niet worden meegenomen tenzij het bewust in een aparte opencode/config-change wordt behandeld.
- Unrelated bredere backendtest-failure wordt apart gevolgd: `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py` faalt op `test_login_token_expiry_aligns_with_cookie_ttl_by_default` door een cookie `Max-Age` versus token-TTL mismatch. Dit valt buiten de acceptatiecriteria van deze wijziging en hoort desgewenst in een losse OPSX change.

## Current status
Completed.

## What changed
- De Admin > Gebruikers-tabel toont per gebruikersrij alleen nog de rijactie `Bewerken` in de kolom `Acties`.
- De bestaande gebruikersbewerkmodal is uitgebreid met expliciete secties `Profielgegevens` en `Accountacties`.
- Bestaande accountacties voor adminrol toevoegen/verwijderen, gebruiker in-/uitschakelen, verwijderen en wachtwoord resetten zijn verplaatst naar de modal en hergebruiken de bestaande API-clientfuncties en mutaties.
- Bestaande confirmaties voor risicovolle acties blijven direct vóór de API-call staan; geannuleerde confirmaties voeren geen API-call uit.
- Self-lockout-acties op het eigen adminaccount zijn in de modal disabled met duidelijke uitleg.
- Profielbewerking voor naam, e-mailadres en avatar blijft in dezelfde modal behouden.
- De About/changelog-content bevat een nieuwe gebruikersvriendelijke entry over overzichtelijkere gebruikersacties.
- Frontendtests zijn aangepast voor de vereenvoudigde tabelacties, modal-accountacties, confirmatie-regressies en self-protection.
- Er is voor deze actieve wijziging geen nieuw backendgedrag voor gebruikersacties toegevoegd; bestaande backend endpoints en accountbeschermingen worden hergebruikt. Backend admin-/profielbestanden die in de working tree zichtbaar zijn, horen bij prerequisite specs waarop deze wijziging voortbouwt.

## How to verify
- `cd frontend && npm test -- App.test.tsx`
- `cd frontend && npm run build`
- Omdat `backend/app/api/meta.py` is geraakt voor de changelog-entry:
  - `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py::test_about_returns_read_only_payload`
  - `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py` als bredere suitecontrole; zie verificatiebewijs voor bestaande/niet-scope failure.
- Omdat deze wijziging vertrouwt op bestaande backend gebruikersaccountbescherming:
  - `backend/.venv/bin/pytest backend/tests/test_admin_api.py`
- Handmatige controle volgens de stappen in `Testing plan` blijft aanbevolen in een browseromgeving.

## Verification evidence
- PASS — `cd frontend && npm test -- App.test.tsx`: 64 tests passed.
- PASS — `cd frontend && npm run build`: TypeScript build en Vite production build geslaagd.
- PASS — `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py::test_about_returns_read_only_payload`: 1 test passed.
- PASS — `backend/.venv/bin/pytest backend/tests/test_admin_api.py`: bestaande backend admin/user-account protecties slagen en worden door deze frontendwijziging hergebruikt.
- FAIL (niet gerelateerd aan deze wijziging) — `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py`: 23 passed, 1 failed. Failing test: `test_login_token_expiry_aligns_with_cookie_ttl_by_default`, waarbij cookie `Max-Age=2592000` niet overeenkomt met token-TTL circa 43199 seconden. Deze failure zit in auth/session-TTL-gedrag en niet in de aangepaste changelog/About-code.
- Backend admin/API-gedrag voor gebruikersacties is niet aangepast door deze actieve wijziging; bestaande backend self-lockout-protectie blijft ongemoeid en is via `test_admin_api.py` bevestigd. Eventuele backend admin-/profielbestanden in de working tree zijn afkomstig uit prerequisite specs.
- Follow-up: onderzoek de bestaande auth cookie/token TTL mismatch apart als losse OPSX change als dit opgepakt moet worden.
- Niet meenemen in deze app-change: unrelated untracked `.opencode/package-lock.json`, tenzij dat bewust in een aparte opencode/config-change wordt behandeld.

---

Status: completed  
Owner: optional  
Date: 2026-06-11
