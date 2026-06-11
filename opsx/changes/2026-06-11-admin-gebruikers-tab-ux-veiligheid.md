# Title
Admin Gebruikers-tab UX en veiligheidsverbeteringen

## Context
De Admin > Gebruikers-tab voelt volgens de aangeleverde screenshot en suggestielijst inconsistent en potentieel risicovol. De zichtbare header zegt nog `Nieuw vergaderbord aanmaken` terwijl gebruikersbeheer actief is, de add-user flow staat visueel vermengd met de tabel, invoervelden missen expliciete labels, en actieknoppen hebben onvoldoende hiërarchie. Ook lijken positieve, neutrale en destructieve acties te veel op elkaar, waardoor gevoelige beheertaken zoals uitschakelen, verwijderen, adminrechten verwijderen en wachtwoordreset extra foutgevoelig zijn.

Deze wijziging richt zich op een gerichte frontendverbetering van de Gebruikers-tab binnen Admin. Backendwijzigingen zijn niet beoogd, behalve als inspectie aantoont dat bestaande API-data nodig is om de huidige ingelogde gebruiker veilig te herkennen of bestaande bevestigings-/foutafhandeling correct te behouden.

## Goals / Non-goals
### Goals
- Geef de Gebruikers-tab een correcte, gebruikersbeheer-specifieke heading en korte helpertekst.
- Scheid de add-user flow visueel van de gebruikerstabel met een duidelijke kaart/sectie.
- Voeg expliciete labels toe aan de add-user formuliervelden.
- Verbeter knophiërarchie: primaire toevoegactie, neutrale secundaire acties en destructieve/risicovolle acties visueel onderscheidend.
- Vraag bevestiging voordat risicovolle acties de API aanroepen: gebruiker uitschakelen, gebruiker verwijderen, adminrol verwijderen en wachtwoord resetten.
- Voorkom per ongeluk self-lockout door delete/disable/remove-admin-acties op het eigen actieve adminaccount te blokkeren of disabled te tonen, tenzij inspectie een bestaand veilig productpatroon aantoont.
- Maak rijacties beter scanbaar, bij voorkeur gegroepeerd onder een duidelijke `Acties`-kolom of -zone.
- Presenteer status en rol duidelijker met badges/labels.
- Voeg of actualiseer frontendtests voor labels, bevestigingen, actiehiërarchie waar testbaar, en self-protection guardrails.
- Voeg de verplichte end-user-facing changelog/About-entry toe volgens de repo Definition of Done.

### Non-goals
- Geen redesign van het backend role model.
- Geen nieuw multi-role permissiesysteem buiten de bestaande admin/non-admin-werking.
- Geen volledige redesign van het Admin-panel buiten deze tab, behalve beperkt gedeelde styling die nodig is voor consistentie.
- Geen nieuwe audit-log backendfeature, tenzij bestaande logging triviaal wordt hergebruikt zonder scope-uitbreiding.
- Geen wijzigingen aan Vergaderborden, Bordrechten, Projecten, Thema's, AI, Scheduler of Admin log gedrag, behalve het voorkomen van regressies.
- Geen implementatie binnen deze spec-authoring stap.

## Proposed approach
1. Inspecteer de bestaande Admin-frontendcomponent(en), tests, API-client en authenticatiecontext om te bepalen waar de Gebruikers-tab, huidige gebruiker en user actions worden beheerd.
2. Houd de wijziging primair frontendgericht en behoud bestaande API-contracten en payloads.
3. Vervang de onjuiste heading/copy door gebruikersbeheer-specifieke tekst en groepeer de pagina in minimaal twee herkenbare secties: gebruiker toevoegen en bestaande gebruikers beheren.
4. Maak de add-user form toegankelijker met expliciete labels, duidelijke submitknop en visuele scheiding van de tabel.
5. Herstructureer rijacties zonder groot redesign: groepeer acties in een `Acties`-kolom/gebied en pas knopvarianten aan op intentie.
6. Voeg confirmatiestappen toe direct vóór API-calls voor reset/disable/delete/remove-admin, met actie-specifieke tekst zodat admins de impact begrijpen.
7. Voeg self-protection guardrails toe voor de huidige gebruiker: eigen account niet kunnen verwijderen, uitschakelen of adminrechten afnemen als dat tot lockout kan leiden.
8. Werk status- en rollabels bij met duidelijke badges die actief/inactief en admin/niet-admin sneller scanbaar maken.
9. Voeg tests toe voor de zichtbare UX-copy, labels, confirmatiegedrag en self-protection. Houd tests deterministisch en mock browserconfirmaties/API-calls.
10. Voeg de user-facing changelog/About-entry toe en update deze spec na implementatie met exacte wijzigingen en verificatiebewijs.

## Implementation steps (ordered)
1. Bevestig dit document als actieve change spec voordat implementatie start.
2. Inspecteer `frontend/` om de Admin-pagina, Gebruikers-tab, gedeelde knop-/badge-styling, API-client en relevante tests te vinden.
3. Inspecteer hoe de huidige geauthenticeerde gebruiker beschikbaar is in de frontend en hoe bestaande user records hun id/username/admin/active-status tonen.
4. Corrigeer de Gebruikers-tab heading en voeg korte helpercopy toe die uitlegt dat admins gebruikers, wachtwoorden, status en adminrechten beheren.
5. Verplaats of herstructureer de add-user UI naar een aparte kaart/sectie boven of naast de tabel, met expliciete labels voor alle velden.
6. Houd de bestaande add-user API-flow intact en pas alleen UI-structuur, labels en styling aan tenzij inspectie een bug aantoont.
7. Voeg of verbeter status-/rolbadges voor actief/inactief en admin/niet-admin, passend bij bestaande stylingconventies.
8. Groepeer rijacties in een duidelijke `Acties`-kolom of -zone en pas knopvarianten aan: primair voor toevoegen, neutraal voor reset/roltoggle waar passend, destructief voor disable/delete/remove-admin.
9. Voeg confirmatie toe voor reset password, disable user, delete user en remove admin role voordat de API-aanroep start.
10. Implementeer self-protection guardrails voor de huidige gebruiker: disable/delete/remove-admin zijn geblokkeerd of disabled met duidelijke uitleg.
11. Controleer dat beheeracties voor andere gebruikers/admins blijven werken en dat bestaande API-payloads niet onbedoeld wijzigen.
12. Voeg of actualiseer gerichte frontendtests voor heading/helpercopy, form labels, confirmaties, API-call blokkering bij annuleren, self-protection en behoud van bestaande flows.
13. Voeg de verplichte user-facing changelog/About-entry toe op de plek waar changelog/About-content in deze repo wordt beheerd.
14. Voer de gerichte frontendtests uit die tijdens inspectie zijn gevonden.
15. Voer `cd frontend && npm run build` uit als typecheck/build-verificatie.
16. Als backendgedrag toch wordt geraakt, voer gerichte backend admin tests uit en verantwoord waarom backendwijziging nodig was.
17. Update deze spec met `What changed`, `How to verify`, `Verification evidence` en een nieuwe `Current status`.

## Acceptance criteria
1. De Gebruikers-tab toont een correcte gebruikersbeheer-specifieke heading; `Nieuw vergaderbord aanmaken` is daar niet meer zichtbaar als paginatitel/sectietitel voor gebruikersbeheer.
2. De tab bevat duidelijke helpercopy voor gebruikersbeheer.
3. De add-user form is visueel gescheiden van de gebruikerstabel in een herkenbare kaart/sectie.
4. Alle add-user formuliervelden hebben expliciete, aanwijsbare labels.
5. User table actions zijn makkelijker te scannen en bij voorkeur gegroepeerd onder een `Acties`-kolom of vergelijkbare actiezone.
6. Destructieve/risicovolle acties zijn visueel onderscheidend van positieve/primaire acties.
7. Reset password, disable user, delete user en remove admin role vragen bevestiging voordat de API wordt aangeroepen.
8. Als een bevestiging wordt geannuleerd, wordt de bijbehorende API-call niet uitgevoerd.
9. De huidige ingelogde admin kan zichzelf niet per ongeluk verwijderen, uitschakelen of de eigen adminrechten afnemen als dat tot lockout kan leiden.
10. Bestaande adminflows voor gebruiker toevoegen, wachtwoord resetten, adminrechten aanpassen, uitschakelen en verwijderen blijven werken voor toegestane doelgebruikers.
11. Status en rol worden duidelijk gepresenteerd met labels/badges.
12. Tests dekken de belangrijkste UI-copy, labels, confirmaties en self-protection guardrails.
13. De About/changelog content bevat een beknopte, end-user-friendly entry voor deze wijziging.

## Testing plan
- Inspecteer eerst de bestaande Admin-component en testnamen voordat commands definitief worden gekozen.
- Voer gerichte frontendtests uit voor de Admin/Gebruikers-tab. Commandokandidaten:
  - `cd frontend && npm test -- VergaderbordenPage.test.tsx App.test.tsx`
  - Of de werkelijk gevonden Admin-specifieke testbestanden, bijvoorbeeld `cd frontend && npm test -- <admin-test-file>`.
- Test in frontendtests minimaal:
  - juiste heading/helpercopy;
  - expliciete labels;
  - confirmaties voor reset/disable/delete/remove-admin;
  - geen API-call wanneer bevestiging wordt geannuleerd;
  - self-protection voor delete/disable/remove-admin op de huidige gebruiker;
  - bestaande toegestane beheerflows blijven API-calls doen met dezelfde payloads.
- Voer de frontend build uit:
  - `cd frontend && npm run build`
- Alleen als backendgedrag wordt aangepast, voer gerichte backend admin tests uit, commandokandidaat:
  - `cd backend && uv run pytest tests/test_admin_api.py`
- Handmatige verificatie:
  1. Log in als admin.
  2. Open Admin > Gebruikers.
  3. Controleer heading, helpercopy, gescheiden add-user kaart, labels, badges en actiehiërarchie.
  4. Voeg indien veilig een testgebruiker toe.
  5. Controleer dat reset/disable/delete/adminrol-acties bevestiging vragen.
  6. Annuleer een bevestiging en controleer dat er geen wijziging/API-call plaatsvindt.
  7. Controleer dat self-lockout acties op het eigen account geblokkeerd of disabled zijn.
  8. Controleer dat acties op andere gebruikers/admins blijven werken volgens bestaande productregels.

## Risk + rollback plan
### Risico's
- UI-refactor kan bestaande adminacties breken als event handlers of API-payloads onjuist worden verplaatst; mitigatie: gerichte tests en behoud van bestaande API-contracten.
- Self-protection kan te breed worden toegepast en daardoor beheer van andere admins blokkeren; mitigatie: beperk de guardrail expliciet tot de huidige geauthenticeerde gebruiker.
- Stylingwijzigingen aan gedeelde classes kunnen andere Admin-tabs beïnvloeden; mitigatie: prefereer lokale component/classes of bestaande varianten.
- Browserconfirmaties of custom confirmatiecomponenten kunnen tests flaky maken als ze niet goed worden gemockt; mitigatie: deterministische mocks en assertions op API-calls.

### Rollback
- Revert de frontend UI-, styling- en testwijzigingen voor de Gebruikers-tab.
- Revert de user-facing changelog/About-entry als de feature volledig wordt teruggedraaid.
- Backend rollback zou niet nodig moeten zijn; als er toch backendwijzigingen plaatsvinden, revert die apart en voer gerichte backend admin tests uit.
- Her-run dezelfde gerichte frontendtests en build om herstel te bevestigen.

## Notes / links
- Aangevraagde specpath: `opsx/changes/2026-06-11-admin-gebruikers-tab-ux-veiligheid.md`.
- Bron: gebruikersscreenshot en prior suggestion list zoals samengevat in de user request.
- Repo Definition of Done vereist een functionele, end-user-friendly About/changelog-entry voor elke afgeronde iteratie.
- Backendwijzigingen zijn buiten scope tenzij inspectie ze technisch noodzakelijk maakt voor current-user herkenning of regressievrije bestaande flows.

## Current status
Completed.

Follow-ups: none.

## What changed
- Admin > Gebruikers heeft nu een gebruikersbeheer-specifieke sectieheading (`Gebruikers beheren`) met helpercopy over accounts, wachtwoorden, status en adminrechten.
- De add-user flow staat in een aparte kaart met introductietekst en expliciete labels voor gebruikersnaam en tijdelijk wachtwoord; de primaire toevoegknop gebruikt een primaire buttonstijl.
- De gebruikerstabel toont status en rol als badges en groepeert beheerknoppen in één duidelijke `Acties`-kolom.
- Buttonintentie is visueel aangescherpt met primaire, neutrale en destructieve varianten voor de Gebruikers-tab-acties.
- Risicovolle acties vragen bevestiging vóór de API-call: wachtwoord resetten, actieve gebruiker uitschakelen, gebruiker verwijderen en adminrechten verwijderen.
- Geannuleerde bevestigingen blokkeren de bijbehorende API-calls.
- Self-lockout guardrails blokkeren de ingelogde admin voor eigen delete/disable/remove-admin-acties wanneer de huidige gebruiker beschikbaar is.
- Bestaande toegestane beheerflows blijven dezelfde API-functies/payloads gebruiken.
- Frontendtests zijn uitgebreid voor copy/labels, confirmaties, annuleren zonder API-call en self-protection.
- De user-facing changelog/About-bron is aangevuld met een entry voor veiliger gebruikersbeheer.
- Follow-up reviewfix: de link `Nieuw vergaderbord aanmaken` staat niet meer boven de Gebruikers-tab en verschijnt alleen nog op de bordgerelateerde Admin-tab `Bordrechten`.
- Follow-up reviewfix: de actielabels `Disable` / `Enable` zijn vertaald naar `Uitschakelen` / `Inschakelen`, inclusief toegankelijke knopnamen.
- Follow-up reviewfix: er is een gerichte frontendtest toegevoegd die bevestigt dat annuleren van `Verwijder admin` geen `updateAdminUser` API-call doet.

## How to verify
- `cd frontend && npm test -- App.test.tsx`
- `cd frontend && npm run build`
- Omdat de changelog/About-bron in backend metadata is aangepast: `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py::test_about_returns_read_only_payload`
- Handmatig: log in als admin, open Admin > Gebruikers en controleer heading/helpercopy, add-user kaart met labels, badges, gegroepeerde acties, confirmaties en disabled self-lockout-acties.

## Verification evidence
- `cd frontend && npm test -- App.test.tsx` — geslaagd: 60 tests passed na de follow-up reviewfixes.
- `cd frontend && npm run build` — geslaagd: TypeScript build en Vite production build voltooid na de follow-up reviewfixes.
- `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py::test_about_returns_read_only_payload` — geslaagd: 1 test passed, 2 bestaande deprecation warnings.
- Handmatige verificatie niet uitgevoerd in deze sessie; zie bovenstaande stappen voor browsercontrole.

---

Status: completed  
Owner: optional  
Date: 2026-06-11
