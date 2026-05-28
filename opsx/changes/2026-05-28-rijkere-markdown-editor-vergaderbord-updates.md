# Title
Rijkere Markdown-editor voor vergaderbord-updates

## Context
Vergaderbord-updateberichten worden nu als platte tekst weergegeven. Daardoor gaan opmaak en leesbaarheid verloren:
- enters/newlines worden niet consequent zichtbaar behouden;
- vet, cursief en onderstrepen ontbreken in de weergaveflow;
- bullets en genummerde lijsten zijn niet bruikbaar als duidelijke lijstweergave.

De gewenste wijziging is een beperkte, veilige Markdown-compatibele edit- en renderflow voor vergaderbord-updates, zonder backend-datamodelwijzigingen.

## Goals / Non-goals
### Goals
- Markdown-compatibele opslag in het bestaande message text field (geen schemawijziging).
- Nieuwe update- en update-bewerkschermen krijgen toolbar-knoppen voor:
  - bold,
  - italic,
  - underline via interne veilige marker (geen raw HTML),
  - bullet list,
  - numbered list.
- Weergave van updates behoudt en toont newlines/line breaks correct.
- Frontend gebruikt een veilige Markdown-renderer met beperkte rendering en raw HTML expliciet uitgeschakeld.
- Bestaande plain-text updates blijven compatibel en leesbaar.
- Automatische verplaatsingsupdates (system/auto move updates) blijven correct leesbaar.
- Benodigde CSS-aanpassingen worden meegenomen voor consistente weergave.
- Relevante tests en About/changelog entry worden toegevoegd/geüpdatet.

### Non-goals
- Geen full WYSIWYG editor.
- Geen uploads/embeds in updatebericht-opmaak.
- Geen mentions, link previews, tabellen of codeblocks.
- Geen datamigratie van bestaande updates.
- Geen redesign van auth, delete-flow of revisie-/versiemodel.

## Proposed approach
1. Inventariseer huidige vergaderbord update-formulieren (nieuw + edit), update-weergavecomponent(en), en automatische verplaatsingsupdate-opbouw.
2. Introduceer één kleine helper/component voor updatebericht-rendering die:
   - Markdown beperkt rendert,
   - raw HTML uitschakelt,
   - interne underline marker veilig vertaalt naar een toegestane renderuitkomst.
3. Voeg toolbar-acties toe aan nieuw- en edit-formulieren die syntax rond selectie of huidige regel invoegen (Markdown + underline marker).
4. Behoud backend-opslag ongewijzigd (zelfde message text field) en verifieer dat interne newlines end-to-end behouden blijven.
5. Werk CSS bij voor consistente spacing en lijstweergave in update-items.
6. Voeg/actualiseer gerichte frontendtests en (indien van toepassing) backendtest rond updateberichtbehoud.
7. Werk About/changelog entry bij met eindgebruikersgerichte omschrijving.

## Implementation steps (ordered)
1. Bepaal bestaande frontend locaties voor:
   - create update form,
   - edit update form,
   - update message display in vergaderbord detail/overzicht,
   - auto-generated move update rendering.
2. Kies en configureer veilige Markdown-rendering volgens bestaand frontend-stackpatroon:
   - raw HTML disabled,
   - alleen benodigde opmaakfeatures voor scope.
3. Definieer interne underline marker-syntaxis en mappingregels (editor-invoer ↔ renderer-uitvoer), zonder HTML-injectiepad.
4. Implementeer of refactor een gedeelde `UpdateMessageRenderer` (of gelijkwaardig) die zowel handmatige als automatische updates gebruikt.
5. Implementeer toolbar-UI en insert-logica in nieuw updateformulier:
   - selectie-wrapping voor bold/italic/underline;
   - regelprefix voor bullets/numbers.
6. Implementeer dezelfde toolbar-UI en insert-logica in edit updateformulier.
7. Zorg dat multiline/newline semantiek consistent is in opslag, ophalen en rendering.
8. Pas CSS aan voor regelafstanden, lijstopmaak, en consistente inline-opmaak in updateblokken.
9. Controleer compatibiliteit van bestaande plain-text updates en automatische move updates; pas parser/renderer-grenzen aan waar nodig.
10. Voeg tests toe of actualiseer tests:
    - frontend component/page tests voor toolbar-acties en rendering;
    - regressiechecks voor bestaande plain text en auto move updates;
    - backend gerichte test alleen als newline-preservatie daar expliciet geraakt wordt.
11. Update `backend/app/api/meta.py` changelog/About-entry met gebruikersvriendelijke releasebeschrijving.
12. Documenteer verificatie in `How to verify` en `Verification evidence`; update `Current status` conform uitkomst.

## Acceptance criteria
1. Een updatebericht met meerdere regels toont na opslaan alle line breaks zichtbaar en in dezelfde volgorde.
2. In zowel nieuw updateformulier als edit updateformulier werken toolbar-knoppen voor bold, italic, underline, bullets en numbered lists op invoerniveau en renderen correct in weergave.
3. Underline werkt via interne marker zonder raw HTML in berichtinhoud te vereisen; renderer accepteert geen raw HTML-injectie.
4. Bestaande plain-text updates blijven leesbaar en breken niet visueel/functioneel.
5. Automatische verplaatsingsupdates blijven correct leesbaar na invoering van de nieuwe renderer.
6. Bestaande edit- en deleteflows voor updates blijven ongewijzigd in gedrag.
7. Er is geen nieuwe XSS-risk geïntroduceerd via updatebericht-rendering (raw HTML disabled, beperkte rendering).
8. About/changelog bevat een eindgebruikersvriendelijke entry voor deze wijziging.

## Testing plan
- Eerst repository-specifieke bestaande test/build-commands verifiëren in codebase-documentatie en package scripts.
- Verwachte minimale verificatie (te confirmeren tijdens implementatie):
  - Frontend gericht: test(s) voor `VergaderbordenPage` en/of update-renderer component.
  - Frontend typecheck/build: projectstandaard command(s).
  - Backend gericht: alleen relevante board-update test(s) indien newline/opslaggedrag backend raakt.
- Handmatige smoke-check:
  1. Maak update met meerdere regels, bold/italic/underline en lijsten; verifieer rendering.
  2. Bewerk bestaande update met toolbar en verifieer correcte persist/render.
  3. Open bestaande oude plain-text update en verifieer leesbaarheid.
  4. Verplaats kaart en verifieer automatische move update-weergave.
- Exacte commands worden in deze spec ingevuld onder `How to verify` zodra implementatie start.

## Risk + rollback plan
### Risks
- XSS/unsafe rendering als Markdown-configuratie te permissief is.
- Underline is niet standaard Markdown; markerkeuze kan ambiguïteit of regressies geven.
- Verschillen in line-break semantiek kunnen onverwachte rendering opleveren.
- Cursor-/selectiegedrag van toolbar kan UX-bugs veroorzaken.
- Nieuwe frontend dependency/configuratie kan build/test beïnvloeden.

### Mitigatie
- Raw HTML expliciet uitschakelen en renderer beperken tot benodigde subset.
- Underline marker strikt intern definiëren en centraal afhandelen.
- Regressietests op multiline, plain text en auto move updates toevoegen.
- Toolbar-logica implementeren met voorspelbare selectie/line-handling en tests.
- Dependencywijzigingen minimaliseren en bestaande build/typecheck pipeline draaien.

### Rollback
- Revert frontend renderer/helper, toolbar, CSS, tests en changelog-entry van deze change.
- Backend-opslag en database blijven ongewijzigd; geen DB rollback nodig.

## Notes / links
- Door gebruiker aangeleverde scope, aanpak, acceptatiecriteria en risico’s zijn leidend voor deze spec.
- Doelbestand volgens repo-conventie: `opsx/changes/2026-05-28-rijkere-markdown-editor-vergaderbord-updates.md`.
- Verwante context: bestaande vergaderbord-update specs in `opsx/changes/`.

## Current status
Completed

## What changed
- Frontend `VergaderbordenPage` uitgebreid met een gedeelde update-renderflow (`UpdateMessageRenderer`) die:
  - multiline/newlines zichtbaar behoudt,
  - beperkte Markdown-achtige inline opmaak rendert (bold `**...**`, italic `*...*`, underline via interne marker `++...++`),
  - bullet- en genummerde lijsten op regelniveau rendert,
  - raw HTML niet uitvoert (geen `dangerouslySetInnerHTML`; tekst blijft escaped) en daarmee XSS-risico in deze flow beperkt.
- Toolbar toegevoegd in zowel nieuw-update als edit-update form met knoppen voor bold/italic/underline/bullet/numbered en selectie-/regel-insertlogica.
- Bestaande automatische verplaatsingsupdate-weergave (`Kaart verplaatst van ... naar ...`) behouden, inclusief vetgedrukte kolomnamen.
- Bestaande edit/delete-flow voor updates ongewijzigd gelaten.
- CSS bijgewerkt voor toolbar-layout en consistente spacing/lijstopmaak in updateberichten.
- Gerichte frontendtests uitgebreid met regressiechecks voor markdown-rendering, newline/lijstweergave, veilige HTML-weergave en toolbar-gedrag in create/edit.
- About/changelog aangevuld in `backend/app/api/meta.py` met iteratie 50 voor deze gebruikersgerichte wijziging.

## How to verify
1. Draai gerichte vergaderbord frontendtests:
   - `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
2. Draai frontend build/typecheck volgens projectstandaard:
   - `cd frontend && npm run build`
3. Handmatige smoke-check in UI:
   - Open vergaderbord-kaartdetail, plaats update met meerdere regels + bold/italic/underline + bullets/nummers en verifieer rendering.
   - Bewerk een bestaande update met toolbar en verifieer dat opslaan en rendering correct blijven.
   - Verifieer dat bestaande plain-text update leesbaar blijft.
   - Verplaats kaart en verifieer dat automatische verplaatsingsupdate correct leesbaar blijft met vetgedrukte kolomnamen.
   - Verifieer dat edit/delete-acties nog hetzelfde gedrag hebben.

## Verification evidence
- ✅ `cd frontend && npm test -- src/app/features/admin/VergaderbordenPage.test.tsx`
  - Resultaat: **PASS** (25 tests geslaagd, incl. nieuwe markdown/toolbar/security regressietests).
- ✅ `cd frontend && npm run build`
  - Resultaat: **PASS** (`tsc -b` + `vite build` succesvol).

---
Status: completed
Owner: n.v.t.
Date: 2026-05-28
