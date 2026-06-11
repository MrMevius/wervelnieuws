# Title
Admin Gebruikers bewerkmodal UX-polish

## Context
De Admin > Gebruikers-tab heeft een bestaande bewerkmodal waarin admins profielgegevens kunnen aanpassen en accountacties kunnen uitvoeren. De modal sluit momenteel alleen via de sluitknop of annuleren, waardoor het minder natuurlijk aanvoelt dan gangbare modalpatronen. De gebruiker wil dat de modal ook sluit wanneer naast/buiten de modal wordt geklikt.

Omdat de modal profielvelden en avatarwijzigingen bevat, mag een extra sluitroute niet leiden tot onbedoeld verlies van wijzigingen. Deze wijziging moet daarom overlay/Escape-sluiten toevoegen met dezelfde zorgvuldigheid als annuleren/sluiten: bij gewijzigde profielvelden of een geselecteerde avatar moet eerst bevestiging worden gevraagd voordat wijzigingen worden weggegooid.

Daarnaast kan de bestaande modal rustiger en duidelijker worden gemaakt met kleine GUI/UI/UX-polish rond copy, avatarupload, validatie-/loadingfeedback en de scheiding tussen `Profielgegevens` en `Accountacties`. De wijziging bouwt voort op de bestaande gebruikersbeheerflows en moet alle bestaande profiel- en accountacties behouden.

## Goals / Non-goals
### Goals
- Sluit de gebruikersbewerkmodal wanneer een admin op de overlay/buiten de dialog klikt en er geen onopgeslagen wijzigingen zijn.
- Zorg dat klikken binnen de modal de modal niet sluit.
- Voeg Escape-to-close toe als dit past bij de bestaande modalpatronen in de frontend.
- Bescherm onopgeslagen profiel-/avatarwijzigingen tegen accidental loss bij overlayklik, Escape, annuleren en sluitknop.
- Verbeter modaltitel en copy zodat duidelijker is dat het om gebruikersbeheer/profiel- en accountbeheer gaat.
- Verbeter de presentatie van avatarupload met bestaande uploadfunctionaliteit, bijvoorbeeld via een gestileerde knop, bestandsnaam en/of preview als dit haalbaar is zonder groot redesign.
- Verbeter grouping, spacing en visuele hiërarchie van `Profielgegevens` en `Accountacties`.
- Maak neutralere accountacties en destructieve/risicovolle accountacties duidelijker gegroepeerd of herkenbaar.
- Behoud alle bestaande profielbewerkingen en accountacties.
- Voeg of actualiseer frontendtests voor overlayklik, inside-click, dirty-form close confirmation en regressies voor bestaande modalfunctionaliteit.
- Werk de user-facing About/changelog-content bij volgens de repo Definition of Done.

### Non-goals
- Geen nieuw rollenmodel.
- Geen nieuwe gebruikersdetailpagina.
- Geen breed adminpanel-redesign.
- Geen backendwijzigingen, tenzij inspectie aantoont dat bestaande validatie-/feedbackgedrag dit noodzakelijk maakt.
- Geen geavanceerde avatar-cropper.
- Geen wijzigingen aan andere Admin-tabs behalve strikt noodzakelijke, lokaal veilige shared modalstijlcorrecties.
- Geen implementatie binnen deze spec-authoring stap.

## Proposed approach
1. Inspecteer de huidige Admin > Gebruikers-component, modalstructuur, close-handlers, accountactiehandlers, avataruploadpresentatie, styling en relevante frontendtests.
2. Voeg overlay-click close toe op de modaloverlay of container door alleen te sluiten wanneer het click-event daadwerkelijk van de overlay komt, niet van content binnen de dialog.
3. Voeg Escape-to-close toe als de bestaande modalconventies dit ondersteunen; gebruik dezelfde centrale close-flow als overlay, annuleren en sluitknop.
4. Introduceer of hergebruik dirty-state detectie voor profielvelden en avatarselectie, gebaseerd op vergelijking tussen initiële gebruikerwaarden, huidige formwaarden en geselecteerde avatarfile.
5. Laat elke sluitroute via een gedeelde guard lopen: zonder wijzigingen direct sluiten; met wijzigingen eerst confirmatie vragen voordat de modal wordt gesloten en wijzigingen worden weggegooid.
6. Houd bestaande save-, validatie-, loading- en accountactiegedragingen intact; polish alleen de presentatie en copy.
7. Scope styling zo lokaal mogelijk rond de gebruikersbewerkmodal om regressies in andere modals te voorkomen.
8. Actualiseer tests zodat de nieuwe sluitroutes en dirty-protection vastliggen en bestaande profiel-/accountacties niet regressief worden.
9. Werk About/changelog-content bij tijdens implementatie en vul daarna deze spec aan met exacte wijzigingen en verificatiebewijs.

## Implementation steps (ordered)
1. Bevestig dit document als actieve change spec voordat implementatie start.
2. Inspecteer de huidige Admin > Gebruikers-frontendcomponent(en), modal markup, event handlers, keyboard handling, styling/classes en relevante tests.
3. Inspecteer bestaande modalpatronen elders in de frontend om te bepalen of Escape-to-close consistent kan worden toegevoegd.
4. Bepaal de initiële formstate voor de geselecteerde gebruiker en definieer dirty-state detectie voor naam, e-mailadres en avatarfile.
5. Maak een gedeelde close-helper voor de bewerkmodal die dirty-state controleert en zo nodig een discard-confirmation toont.
6. Sluit overlay-click aan op deze close-helper en zorg dat alleen klikken op de overlay zelf sluit.
7. Zorg dat klikken op inputs, knoppen, accountacties, avatarcontrols en overige content binnen de modal niet naar overlay-close leidt.
8. Voeg Escape-to-close toe als dit past bij bestaande frontendpatronen, met dezelfde dirty-state bescherming.
9. Laat annuleren en sluitknop eveneens via dezelfde dirty-state close-helper lopen, zodat sluitgedrag consistent is.
10. Verbeter modaltitel, sectiekoppen en korte helpercopy rond `Profielgegevens`, avatarupload en `Accountacties`.
11. Verbeter avataruploadpresentatie met bestaande uploadflow: duidelijke control, gekozen bestandsnaam en/of preview waar haalbaar zonder groot redesign.
12. Verbeter spacing/groepering binnen de modal zodat profielvelden, neutralere accountacties en destructieve/risicovolle acties rustiger en duidelijker gescheiden zijn.
13. Behoud bestaande loading-, fout- en validatiefeedback; verbeter presentatie alleen waar dat lokaal en veilig kan.
14. Controleer dat alle bestaande profielacties en accountacties functioneel blijven, inclusief bestaande confirmaties en self-lockout bescherming.
15. Voeg of actualiseer frontendtests voor overlayklik zonder wijzigingen.
16. Voeg of actualiseer frontendtests dat klikken binnen de modal niet sluit.
17. Voeg of actualiseer frontendtests voor dirty-form close confirmation bij gewijzigde profielvelden en bij geselecteerde avatarfile.
18. Voeg of actualiseer regressietests voor bestaande profielsave, avatarflow en accountacties in de modal.
19. Werk de user-facing About/changelog-content bij met een korte functionele entry over de rustigere gebruikersmodal en veiliger sluitgedrag.
20. Voer gerichte frontendtests uit.
21. Voer de frontend build uit.
22. Als backendcode onverwacht wordt geraakt, voer relevante backendtests uit en documenteer waarom.
23. Update deze spec met `What changed`, `How to verify`, `Verification evidence` en zet `Current status` naar de passende implementatiestatus.

## Acceptance criteria
1. Klikken buiten de gebruikersbewerkmodal sluit de modal wanneer er geen onopgeslagen wijzigingen zijn.
2. Klikken binnen de modal sluit de modal niet.
3. Sluiten met onopgeslagen profielwijzigingen vraagt bevestiging voordat wijzigingen worden weggegooid.
4. Sluiten met een geselecteerde/niet-opgeslagen avatarwijziging vraagt bevestiging voordat wijzigingen worden weggegooid.
5. Annuleren en de sluitknop gebruiken dezelfde unsaved-change bescherming als overlay/Escape-sluiten.
6. Escape-to-close werkt als geïmplementeerd en volgt dezelfde unsaved-change bescherming; als Escape bewust niet wordt geïmplementeerd vanwege bestaande modalpatronen, is dit in `What changed` gemotiveerd.
7. Bestaande profielbewerking voor naam, e-mailadres en avatar blijft werken.
8. Bestaande accountacties blijven werken, inclusief bestaande confirmaties en self-lockout bescherming.
9. De modal UI is duidelijker door verbeterde titel/copy, avatarcontrolpresentatie en rustigere grouping/spacing van profielgegevens en accountacties.
10. Neutralere accountacties en destructieve/risicovolle acties zijn duidelijker gegroepeerd of visueel herkenbaar.
11. Frontendtests dekken overlayklik, inside-click, dirty-close-confirmation en bestaande modalactie-/profielregressies.
12. `cd frontend && npm run build` slaagt.
13. Gerichte frontendtests voor de Admin/Gebruikers-flow slagen.
14. Backendtests worden alleen vereist als backendcode wordt geraakt; in dat geval slagen de relevante backendtests.
15. About/changelog-content bevat een end-user-friendly entry voor deze wijziging.

## Testing plan
- Inspectie vóór implementatie:
  - Zoek de huidige Admin > Gebruikers-component, bewerkmodal, modal styling/classes, accountactiehandlers en relevante tests.
  - Controleer bestaande modal-/keyboardpatronen elders in de frontend.
  - Zoek waar About/changelog-content wordt beheerd.
- Gerichte frontendtests:
  - `cd frontend && npm test -- App.test.tsx`
  - Of de tijdens inspectie gevonden specifieke Admin/Gebruikers-testbestanden, bijvoorbeeld `cd frontend && npm test -- <admin-users-test-file>`.
- Frontend build:
  - `cd frontend && npm run build`
- Backendtests alleen als backend/API wordt geraakt:
  - `backend/.venv/bin/pytest backend/tests/test_admin_api.py`
  - Plus relevante tests voor eventueel geraakte validatie-/profielcode.
- Handmatige verificatie:
  1. Log in als admin.
  2. Open Admin > Gebruikers.
  3. Open de bewerkmodal voor een gebruiker.
  4. Klik buiten de modal zonder wijzigingen en controleer dat de modal sluit.
  5. Open opnieuw, klik binnen de modal op velden/knoppen/avatarcontrols en controleer dat de modal open blijft.
  6. Wijzig een profielveld, klik buiten de modal en controleer dat discard-confirmation verschijnt.
  7. Annuleer discard en controleer dat de modal met wijzigingen open blijft.
  8. Bevestig discard en controleer dat de modal sluit zonder op te slaan.
  9. Herhaal dirty-close-verificatie met een geselecteerde avatarfile.
  10. Test Escape indien geïmplementeerd, inclusief dirty-state bescherming.
  11. Controleer dat profiel opslaan, avatarupload en bestaande accountacties nog werken.
  12. Controleer dat de modal copy, avataruploadpresentatie en accountactiegroepering rustiger en duidelijker zijn.

## Risk + rollback plan
### Risico's
- Overlay-click handling kan onbedoeld sluiten wanneer admins met file input, formuliercontrols of accountactieknoppen werken; mitigatie: sluit alleen wanneer `event.target` de overlay is of gebruik equivalente veilige targetcontrole.
- Dirty-state detectie kan te agressief zijn of avatarwijzigingen missen; mitigatie: vergelijk initiële formwaarden met huidige formwaarden en neem selected-file state expliciet mee.
- Een gedeelde close-helper kan bestaande save/close-flow beïnvloeden; mitigatie: houd save-flow apart en test annuleren/sluiten/overlay/Escape expliciet.
- Escape-handling kan conflicteren met andere keyboardinteracties; mitigatie: implementeer alleen als dit past bij bestaande modalpatronen en cleanup event listeners bij unmount/sluiten.
- Modal styling kan andere modals raken als shared classes te breed worden aangepast; mitigatie: scope styles lokaal waar mogelijk.
- UI-polish kan bestaande selectors in tests breken; mitigatie: actualiseer tests op toegankelijk gedrag/labels in plaats van broze stylingdetails.

### Rollback
- Verwijder overlay- en eventuele Escape-close handlers en herstel alleen de bestaande closeknop/annuleren-sluitroutes.
- Verwijder of disable de dirty-state discard-confirmation als deze regressies veroorzaakt en herstel het vorige sluitgedrag.
- Revert lokale modalcopy-, avatarpresentatie- en stylingwijzigingen.
- Revert testwijzigingen en About/changelog-entry voor deze feature als de wijziging volledig wordt teruggedraaid.
- Voer dezelfde gerichte frontendtests en frontend build opnieuw uit om rollback te bevestigen.

## Notes / links
- Aangevraagde specpath: `opsx/changes/2026-06-11-admin-gebruikers-modal-ux-polish.md`.
- Bouwt voort op bestaande Admin > Gebruikers-modal/accountactie-wijzigingen, waaronder:
  - `opsx/changes/2026-06-11-admin-gebruikers-profielbewerking-acties.md`.
  - `opsx/changes/2026-06-11-admin-gebruikers-acties-in-bewerkmodal.md`.
- Repo Definition of Done vereist een functionele, end-user-friendly About/changelog-entry voor elke afgeronde iteratie.
- Geen code implementeren als onderdeel van deze spec-authoring stap.

## Current status
Completed.

## What changed
- De Admin > Gebruikers-bewerkmodal sluit nu via overlayklik wanneer er geen onopgeslagen profiel- of avatarwijzigingen zijn.
- Klikken binnen de modal sluit de modal niet; overlay-sluiten controleert expliciet dat de klik op de overlay zelf startte.
- Escape-to-close is toegevoegd en gebruikt dezelfde centrale sluitroute als overlay, sluitknop en Annuleren.
- Sluiten via overlay, Escape, sluitknop of Annuleren vraagt bevestiging wanneer naam, e-mailadres of een geselecteerde avatar afwijkt van de oorspronkelijke modalstate.
- De modalcopy is verduidelijkt met titel `Profiel en account beheren`, helpercopy voor profielgegevens en accountacties, en een melding dat onopgeslagen wijzigingen beschermd zijn.
- Avatarupload gebruikt dezelfde uploadflow, maar toont nu een gestileerde keuzecontrol, bestandsnaam na selectie en een compacte preview/initialen-placeholder.
- Profielgegevens en Accountacties hebben rustiger spacing; neutrale accountacties en risicovolle/destructieve acties zijn visueel gescheiden.
- Bestaande profielsave, avatarupload, wachtwoordreset, rol/statuswijzigingen, verwijderen, confirmaties en self-lockout bescherming zijn behouden.
- Frontendtests zijn uitgebreid voor overlay-click, inside-click, dirty-close-confirmation voor profielvelden en avatar, Escape sluiten, en bestaande profiel-/accountactie-regressies.
- User-facing About/changelog-content is bijgewerkt in `backend/app/api/meta.py` met iteratie 71 over de rustigere gebruikersmodal en veilig sluiten.

## How to verify
- `cd frontend && npm test -- App.test.tsx`
- `cd frontend && npm run build`
- Omdat `backend/app/api/meta.py` is geraakt voor de changelog-entry: `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py -k test_about_returns_read_only_payload`
- Handmatige smoke (optioneel): open Admin > Gebruikers, open Bewerken, test overlay/inside-click/Escape/Annuleren/sluitknop met en zonder gewijzigde velden en avatarselectie.

## Verification evidence
- PASS — `cd frontend && npm test -- App.test.tsx`: 67 tests passed.
- PASS — `cd frontend && npm run build`: TypeScript build en Vite production build geslaagd.
- PASS — `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py -k test_about_returns_read_only_payload`: targeted About API test geslaagd en bevestigt dat `/api/meta/about` een geldige changelogpayload retourneert.
- EXCLUDED / follow-up — bredere run `backend/.venv/bin/pytest backend/tests/test_meta_and_me.py`: 23 passed, 1 failed. Failing test: `test_login_token_expiry_aligns_with_cookie_ttl_by_default`, waarbij cookie `Max-Age=2592000` niet overeenkomt met token-TTL circa 43199 seconden. Deze bekende, niet-gerelateerde auth/session-TTL failure raakt niet aan de aangepaste About/changelog-meta en blokkeert deze wijziging niet.

## Follow-ups
- Optioneel: pak de bekende auth/session-TTL mismatch uit `test_login_token_expiry_aligns_with_cookie_ttl_by_default` op in een aparte change spec.
- Optioneel: blijf bij toekomstige modalwijzigingen toetsen dat Escape-/overlay-close geen nested interacties of browser/file-input gedrag verstoort.
