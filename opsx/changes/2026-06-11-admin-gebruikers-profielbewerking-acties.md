# Title
Admin Gebruikers profielbewerking en compactere acties

## Context
De Admin > Gebruikers-tabel bevat bestaande beheeracties voor status, wachtwoord, verwijderen en adminrechten. Deze acties zijn functioneel, maar de actieknoppen zijn momenteel te groot en niet strak genoeg uitgelijnd binnen de tabel, waardoor de Gebruikers-tab visueel druk wordt. Daarnaast kunnen admins wel operationele beheeracties uitvoeren, maar niet de basisprofielgegevens van gebruikers aanpassen: naam, avatar en e-mailadres.

Deze wijziging bouwt voort op het bestaande gebruikersbeheer en moet de huidige veiligheidsregels behouden, waaronder bevestigingen voor risicovolle acties en bescherming tegen self-lockout. De oplossing moet gericht blijven: compacte actieknoppen, een duidelijke `Bewerken`-actie per gebruiker en een modal waarmee admins naam, e-mailadres en avatar kunnen aanpassen.

## Goals / Non-goals
### Goals
- Maak de actieknoppen in de Admin > Gebruikers-tabel kleiner en compacter.
- Lijn alle actieknoppen consistent uit binnen de `Acties`-kolom.
- Voeg per gebruiker een duidelijke `Bewerken`-actie toe.
- Open een edit modal voor de geselecteerde gebruiker.
- Laat admins de naam van een gebruiker aanpassen.
- Laat admins het e-mailadres van een gebruiker aanpassen.
- Laat admins de avatar van een gebruiker aanpassen via bestaande upload/API-patronen of een kleine passende uitbreiding.
- Hergebruik of voeg validatie toe voor e-mailadres en avatar-upload.
- Behoud bestaande risicobevestigingen en self-lockout bescherming.
- Behoud bestaande reset-password-, enable/disable-, delete- en admin-rights-acties.
- Voeg of actualiseer tests voor modal openen/sluiten, opslaan van naam/e-mail/avatar, foutafhandeling en regressies op bestaande acties.
- Werk de user-facing About/changelog-content bij volgens de repo Definition of Done.

### Non-goals
- Geen nieuw rollenmodel.
- Geen volledige herbouw van gebruikersbeheer.
- Geen aparte gebruikersdetailpagina.
- Geen geavanceerde avatar-cropper, tenzij bestaande avatar-uploadlogica dit al triviaal ondersteunt.
- Geen wijzigingen aan andere Admin-tabs, behalve beperkt gedeelde styling die nodig is voor consistentie.
- Geen implementatie binnen deze spec-authoring stap.

## Proposed approach
1. Inspecteer eerst de huidige frontend Admin/Gebruikers-component, API-client, relevante tests, backend admin/user endpoints en bestaande avatar-uploadondersteuning.
2. Houd de tabelverbetering lokaal en beperkt: compacte knopvariant(en), consistente alignment en geen brede herstructurering buiten de `Acties`-kolom.
3. Voeg een `Bewerken`-knop toe aan iedere gebruikersrij, passend bij de bestaande actiehiërarchie.
4. Implementeer een modal die de geselecteerde gebruiker toont en velden bevat voor naam, e-mailadres en avatar.
5. Gebruik bestaande API-contracten voor profielgegevens waar mogelijk. Als bestaande endpoints alleen de ingelogde gebruiker ondersteunen, voeg dan een minimale admin-endpointuitbreiding toe voor het bewerken van andere gebruikers.
6. Valideer e-mailadres en avatar vóór of tijdens opslaan met bestaande validatiepatronen; toon duidelijke foutfeedback zonder gedeeltelijk of ongeldig op te slaan.
7. Zorg dat bestaande risicovolle acties hun bevestigingen behouden en dat self-lockout bescherming niet wordt afgezwakt door de nieuwe modal of actiegroepering.
8. Voeg tests toe of actualiseer bestaande tests voor de nieuwe modalflow en regressies op bestaande user actions.
9. Werk de About/changelog-content bij tijdens implementatie en vul deze spec daarna aan met exacte wijzigingen en verificatiebewijs.

## Implementation steps (ordered)
1. Bevestig dit document als actieve change spec voordat implementatie start.
2. Inspecteer de huidige Admin > Gebruikers-frontendcomponent(en), styling/classes, API-client en bestaande tests.
3. Inspecteer backend admin/user endpoints en bestaande avatar-uploadlogica om te bepalen of bestaande API-patronen kunnen worden hergebruikt.
4. Bepaal het minimale data-/API-contract voor adminbewerking van naam, e-mailadres en avatar.
5. Maak of hergebruik compacte buttonstyling voor rijacties en pas de `Acties`-kolom aan zodat knoppen kleiner en consistent uitgelijnd zijn.
6. Voeg per gebruikersrij een duidelijke `Bewerken`-actie toe zonder bestaande reset/status/delete/adminrecht-acties te verwijderen of te hernoemen buiten noodzakelijke consistentie.
7. Voeg een edit modal toe die opent voor de juiste gebruiker en sluit via annuleren, close-knop en succesvolle save.
8. Vul de modal met bewerkvelden voor naam, e-mailadres en avatar, inclusief bestaande waarden en toegankelijke labels.
9. Implementeer opslaan voor naam en e-mailadres via bestaande of minimale nieuwe admin-API-ondersteuning.
10. Implementeer avatarbewerking via bestaande upload/API-patronen of een kleine admingerichte uitbreiding als bestaande support alleen voor de ingelogde gebruiker geldt.
11. Voeg validatie en duidelijke foutmeldingen toe voor ongeldig e-mailadres, ontbrekende/ongeldige naam waar van toepassing, en ongeldige avatarbestanden.
12. Controleer dat bestaande bevestigingen voor reset-password, enable/disable, delete en adminrechten behouden blijven.
13. Controleer dat self-lockout bescherming voor risicovolle acties op het eigen adminaccount behouden blijft.
14. Voeg of update frontendtests voor openen/sluiten van de modal, opslaan van naam/e-mailadres/avatar, validatiefouten, serverfouten en regressies op bestaande acties.
15. Als backend/API wordt aangepast, voeg of update gerichte backendtests voor adminprofielbewerking en avatarvalidatie.
16. Werk de user-facing About/changelog-content bij met een korte, functionele beschrijving van de verbetering.
17. Voer de afgesproken gerichte frontendtests en build uit.
18. Als backend/API is geraakt, voer gerichte backend admin/user/avatar tests uit.
19. Update deze spec met `What changed`, `How to verify`, `Verification evidence` en zet `Current status` naar de passende implementatiestatus.

## Acceptance criteria
1. Actieknoppen in de Gebruikers-tab zijn compacter dan de huidige knoppen en visueel consistent uitgelijnd binnen de `Acties`-kolom.
2. Iedere gebruikersrij heeft een duidelijke `Bewerken`-actie.
3. Klikken op `Bewerken` opent een modal voor de juiste gebruiker.
4. De edit modal kan worden gesloten zonder wijzigingen op te slaan.
5. Admins kunnen de naam van een gebruiker succesvol wijzigen.
6. Admins kunnen het e-mailadres van een gebruiker succesvol wijzigen.
7. Admins kunnen de avatar van een gebruiker succesvol wijzigen met bestaande upload/API-patronen of een kleine passende uitbreiding.
8. Ongeldige input toont duidelijke feedback en wordt niet opgeslagen.
9. Server-/API-fouten tijdens opslaan tonen duidelijke feedback en laten de admin herstellen of annuleren.
10. Bestaande reset-password-, enable/disable-, delete- en admin-rights-acties blijven werken voor toegestane doelgebruikers.
11. Bestaande bevestigingen voor risicovolle acties blijven aanwezig voordat de API-call start.
12. Bestaande self-lockout bescherming blijft actief voor risicovolle acties op het eigen adminaccount.
13. Tests dekken modal openen/sluiten, opslaan van naam/e-mailadres/avatar, validatiefouten of foutafhandeling, en relevante regressies op bestaande acties.
14. `cd frontend && npm run build` slaagt.
15. Gerichte frontendtests voor de Admin/Gebruikers-flow slagen.
16. Als backend/API wordt aangepast, slagen gerichte backend admin/user/avatar tests.
17. About/changelog-content bevat een end-user-friendly entry voor deze wijziging.

## Testing plan
- Inspectie vóór implementatie:
  - Zoek de huidige frontend Admin/Gebruikers-component, API-client, bestaande tests en avatar-uploadcode.
  - Zoek backend admin/user endpoints en bestaande avatarvalidatie als API-wijziging nodig lijkt.
- Gerichte frontendtests:
  - `cd frontend && npm test -- App.test.tsx`
  - Of de tijdens inspectie gevonden specifieke Admin/Gebruikers-testbestanden, bijvoorbeeld `cd frontend && npm test -- <admin-users-test-file>`.
- Frontend build:
  - `cd frontend && npm run build`
- Backendtests als backend/API wordt geraakt:
  - `backend/.venv/bin/pytest backend/tests/test_admin_api.py`
  - Plus relevante user/avatar tests als aanwezig of nieuw toegevoegd.
- Handmatige verificatie:
  1. Log in als admin.
  2. Open Admin > Gebruikers.
  3. Controleer dat actieknoppen compact zijn en strak zijn uitgelijnd in de `Acties`-kolom.
  4. Open `Bewerken` voor een gebruiker en sluit de modal zonder opslaan.
  5. Wijzig naam, e-mailadres en avatar en controleer dat de tabel/detailweergave de wijzigingen toont.
  6. Voer ongeldige e-mail/avatarinput in en controleer duidelijke foutfeedback zonder save.
  7. Controleer reset-password, enable/disable, delete en admin-rights-acties.
  8. Controleer dat risicobevestigingen en self-lockout bescherming nog actief zijn.

## Risk + rollback plan
### Risico's
- Avatarbeheer kan bestaande user settings/profile APIs raken; mitigatie: inspecteer eerst en houd eventuele API-uitbreiding minimaal en adminspecifiek.
- Als avatarupload momenteel alleen de ingelogde gebruiker ondersteunt, kan een nieuw admin-endpoint nodig zijn; mitigatie: hergebruik validatie, opslag en responsevormen waar mogelijk.
- Nieuwe edit controls kunnen de tabel verbreden; mitigatie: gebruik een modal en compacte rijacties om layoutimpact te beperken.
- Het verplaatsen of compact maken van actieknoppen kan bestaande event handlers breken; mitigatie: voeg regressietests toe voor bestaande acties.
- E-mailwijzigingen kunnen authenticatie of gebruikersidentiteit beïnvloeden als e-mail uniek moet zijn; mitigatie: respecteer bestaande backendvalidatie en toon foutmeldingen duidelijk.

### Rollback
- Revert de modal-, API-, styling-, test- en About/changelog-wijzigingen voor deze feature.
- Als een adminprofielbewerk-endpoint is toegevoegd, revert dat endpoint en bijbehorende schema/service/testwijzigingen afzonderlijk.
- Behoud of herstel bestaande user actions naar de pre-change implementatie.
- Voer dezelfde gerichte frontendtests, frontend build en eventuele backendtests opnieuw uit om rollback te bevestigen.

## Notes / links
- Aangevraagde specpath: `opsx/changes/2026-06-11-admin-gebruikers-profielbewerking-acties.md`.
- Gerelateerde bestaande wijziging: `opsx/changes/2026-06-11-admin-gebruikers-tab-ux-veiligheid.md` bevat eerder afgeronde UX- en veiligheidsverbeteringen voor dezelfde tab; deze nieuwe spec moet daarop voortbouwen zonder regressie.
- Repo Definition of Done vereist een functionele, end-user-friendly About/changelog-entry voor elke afgeronde iteratie.
- Geen code implementeren als onderdeel van deze spec-authoring stap.

## Current status
Completed. Follow-ups: none.

## What changed
- Admin > Gebruikers heeft nu compactere rijactieknoppen in één consistent uitgelijnde `Acties`-kolom.
- Iedere gebruikersrij heeft een duidelijke `Bewerken`-actie.
- `Bewerken` opent een modal voor de geselecteerde gebruiker met velden voor naam, e-mailadres en avatar.
- Admins kunnen gebruikersnaam-profielvelden (`full_name`, `email`) opslaan via de bestaande admin user PATCH-route, uitgebreid zodat profielvelden zonder rolwijziging aangepast kunnen worden.
- Admins kunnen avatars voor gebruikers uploaden via een minimale admin-avatarroute die de bestaande PNG-, lege-upload- en maximale-groottevalidatie hergebruikt.
- Frontendvalidatie toont directe feedback voor ongeldige e-mail en niet-PNG-avatarbestanden; serverfouten zoals dubbele e-mail of avatarfouten blijven herstelbaar in de modal.
- Bestaande risicobevestigingen en self-lockout bescherming voor adminrechten, status, verwijderen en wachtwoordreset zijn behouden.
- Gerichte frontend- en backendtests zijn toegevoegd voor profielbewerking, avatarupload, validatie/foutafhandeling en regressies op bestaande adminacties.
- De user-facing About/changelog-content bevat een nieuwe entry over compactere gebruikersacties en profielbewerking.
- Reviewblockers opgelost: bij een gekozen avatar valideert de frontend eerst bestandstype, lege bestanden en maximale grootte, uploadt daarna de avatar vóór de profiel-PATCH en stopt zonder naam/e-mail op te slaan als de avatarupload faalt.
- Backend self-lockout is extra gehard: admin-endpoints weigeren nu ook server-side dat de ingelogde admin eigen adminrechten verwijdert of het eigen account uitschakelt, terwijl eigen naam/e-mailbewerking mogelijk blijft.
- Admin-avatarupload accepteert nu PNG, JPEG, GIF en WebP met basis magic-byte controle, weigert lege bestanden en weigert gespoofde inhoud die niet past bij het content-type.
- Tests zijn uitgebreid voor mislukte avatarupload zonder profiel-PATCH, server-side self-demotion/self-disable blokkade en lege/gespoofde avatarinhoud.
- About/changelog-entry staat in `backend/app/api/meta.py` als iteratie 69.

## How to verify
- Finale verificatie uitgevoerd:
  - `backend/.venv/bin/pytest backend/tests/test_admin_api.py`
  - `cd frontend && npm test -- App.test.tsx`
  - `cd frontend && npm run build`
- Optionele handmatige verificatie: volg de stappen in `Testing plan` in een browser.

## Verification evidence
- PASS — `backend/.venv/bin/pytest backend/tests/test_admin_api.py` — 30 passed, 74 warnings.
- PASS — `cd frontend && npm test -- App.test.tsx` — 64 tests passed.
- PASS — `cd frontend && npm run build` — TypeScript build en Vite production build geslaagd.
- Handmatige verificatie: niet uitgevoerd in browser binnen deze sessie.

## Follow-ups
- None.

---

Status: completed  
Owner: optional  
Date: 2026-06-11
