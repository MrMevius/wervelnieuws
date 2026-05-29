# Title
Grotere rijke kaartbeschrijving-editor voor vergaderbord-kaarten

## Context
De kaartbeschrijving op vergaderbord-kaarten is momenteel functioneel beperkt voor langere, beter gestructureerde tekst. De gewenste wijziging is om de beschrijving in zowel **nieuwe kaart** als **kaart bewerken** te verbeteren met:
- standaard zichtbaar grotere invoer (`rows=3`),
- automatische hoogteaanpassing (auto-resize),
- maximale lengte van 2000 tekens,
- een rijke Markdown-achtige toolbar (zoals bij updates),
- consistente rijke rendering in zowel kaartdetail als kolomoverzicht,
- veilige rendering zonder raw HTML-executie.

De scope moet zoveel mogelijk frontend-only blijven; database- of API-schemawijzigingen alleen als technisch strikt noodzakelijk.

## Goals / Non-goals
### Goals
- Beschrijving-invoer in **new-card** en **edit-card** gebruikt een textarea met `rows=3` als basis.
- Beschrijvingveld auto-resized tijdens typen, zonder verlies van bestaande invoerflow.
- Maximaal 2000 tekens wordt afgedwongen in de UI (en waar passend gevalideerd in bestaande backendregels zonder schemawijziging).
- Toolbar met rijke opmaak (Markdown-achtig) sluit functioneel aan op de bestaande updates-editor-ervaring.
- Rijke tekstweergave van kaartbeschrijving is zichtbaar en consistent in:
  - kaartdetail,
  - kolomoverzicht (kaartpreview/kaartitem).
- Rendering is veilig: geen raw HTML-uitvoer of -executie.
- Geen DB/API schemawijziging tenzij onvermijdelijk; als nodig, dan minimaal en expliciet gemotiveerd.
- Relevante tests en About/changelog worden geüpdatet.

### Non-goals
- Geen volledige WYSIWYG-editor.
- Geen toevoeging van nieuwe rich content types (bijv. tabellen, embeds, bijlagen in beschrijving).
- Geen redesign van vergaderbord-layout buiten noodzakelijke UI-aanpassingen voor dit veld.
- Geen brede refactor van alle tekstvelden buiten kaartbeschrijving.

## Proposed approach
1. Hergebruik het bestaande patroon van de rijke updates-editor (toolbar + veilige renderer) voor kaartbeschrijving, met een gedeelde helper/component waar mogelijk.
2. Pas de beschrijving-invoer in zowel create als edit flow aan naar `rows=3` + auto-resize.
3. Voeg/activeer limietlogica van 2000 tekens in de beschrijvingflow en stem validatieberichten af.
4. Gebruik één veilige renderflow voor kaartbeschrijving op alle relevante weergaveplekken (detail + kolomoverzicht), met raw HTML expliciet uitgeschakeld.
5. Behoud bestaande data-opslagstructuur en API-contracten, tenzij implementatie aantoont dat een minimale aanpassing strikt nodig is.
6. Werk tests en changelog bij conform repo-richtlijnen.

## Implementation steps (ordered)
1. Inventariseer huidige beschrijvingflow voor:
   - new-card formulier,
   - edit-card formulier,
   - kaartdetail-weergave,
   - kolomoverzicht-weergave.
2. Bepaal of bestaande updates-toolbarcomponenten direct herbruikbaar zijn of via kleine extractie gedeeld moeten worden.
3. Implementeer textarea-basisaanpassing (`rows=3`) en auto-resize voor beide invoerflows.
4. Voeg maximale lengte van 2000 tekens toe met duidelijke gebruikersfeedback bij limietbereik/overschrijding.
5. Koppel Markdown-achtige toolbaracties aan beschrijvinginvoer (zelfde UX-principe als updates).
6. Implementeer/gebruik veilige rich-text renderer voor kaartbeschrijving in kaartdetail én kolomoverzicht.
7. Verifieer dat raw HTML niet wordt uitgevoerd en dat bestaande plain-text beschrijvingen leesbaar blijven.
8. Controleer backend/API-impact; voer alleen minimale contractwijziging door als noodzakelijk en documenteer motivatie.
9. Werk tests bij (unit/component/integratie waar relevant) voor invoer, limiet, toolbar en veilige rendering.
10. Update About/changelog entry in de website-metadata met eindgebruikersgerichte beschrijving.
11. Leg verificatie vast onder `How to verify` en `Verification evidence`; update statusvelden.

## Acceptance criteria
1. In zowel **new-card** als **edit-card** start het beschrijvingveld zichtbaar met `rows=3` en groeit het automatisch mee met de inhoud.
2. Beschrijving accepteert maximaal **2000 tekens**; overschrijding wordt geblokkeerd of gevalideerd met duidelijke feedback.
3. Toolbar voor rijke opmaak is beschikbaar in beide beschrijving-editflows en past opmaaksyntax consistent toe.
4. Opgeslagen rijke opmaak in beschrijving wordt correct en consistent gerenderd in:
   - kaartdetail,
   - kolomoverzicht.
5. Rendering van beschrijving voert **geen raw HTML** uit (geen XSS-pad via beschrijvingweergave).
6. Bestaande kaarten met plain-text beschrijving blijven correct leesbaar zonder regressie.
7. Er is **geen DB/API schemawijziging**, tenzij aantoonbaar noodzakelijk; indien toch nodig is dit expliciet gedocumenteerd in spec en implementatie.
8. About/changelog bevat een eindgebruikersvriendelijke entry voor deze wijziging.

## Testing plan
- Gerichte frontendtests voor vergaderbordkaart-beschrijving:
  - create-flow (rows, auto-resize, toolbar, max length),
  - edit-flow (rows, auto-resize, toolbar, max length),
  - renderflow in detail + kolomoverzicht,
  - security-regressie: raw HTML wordt niet uitgevoerd.
- Bestaande regressietests rondom vergaderborden draaien om compatibiliteit te bevestigen.
- Projectstandaard frontend typecheck/build draaien.
- Handmatige smoke checks:
  1. Nieuwe kaart aanmaken met meerregelige/rijk opgemaakte beschrijving en weergave checken in kolom + detail.
  2. Bestaande kaartbeschrijving bewerken met toolbar, opnieuw openen en rendering verifiëren.
  3. Proberen >2000 tekens in te voeren en verwachte validatiegedrag bevestigen.
  4. HTML payload (bijv. `<script>`) invoeren en bevestigen dat deze als tekst/safe output behandeld wordt.
- Exacte commando’s worden tijdens implementatie ingevuld onder `How to verify`.

## Risk + rollback plan
### Risks
- Onveilige rendererconfiguratie kan XSS-risico introduceren.
- Verschillen tussen detail- en kolomweergave kunnen inconsistente opmaak opleveren.
- Auto-resize kan layout-issues veroorzaken op kleinere schermen.
- 2000-tekengrens kan afwijken tussen frontend en backendvalidatie als niet goed afgestemd.

### Mitigatie
- Raw HTML expliciet uitschakelen in renderer en regressietests toevoegen voor onveilige input.
- Eén gedeelde renderhelper/component gebruiken voor beide weergavecontexten.
- UI-tests + handmatige responsieve smoke-check op auto-resize gedrag.
- Validatielogica centraal afstemmen en eenduidige foutmelding tonen.

### Rollback
- Revert wijzigingen aan beschrijving-editor, renderer, styles, tests en changelog-entry van deze change.
- Omdat DB/API-schema standaard ongewijzigd blijft, is geen datamigratie-rollback nodig.

## Notes / links
- Aangeleverde titel/slug en scope door gebruiker zijn leidend.
- Verwante eerdere wijzigingen:
  - `opsx/changes/2026-05-27-edit-card-description.md`
  - `opsx/changes/2026-05-28-rijkere-markdown-editor-vergaderbord-updates.md`
- Deze spec is wijzigingsbron voor implementatie via `opsx-implement`.

## Current status
Completed

## What changed
- Frontend `VergaderbordenPage` uitgebreid met gedeelde rich-text rendering helper voor kaartbeschrijvingen, inclusief veilige output zonder raw HTML-executie.
- Kaartbeschrijving in kolomoverzicht rendert nu rijke Markdown-achtige opmaak (vet/cursief/onderstreept/lijsten) consistent met detailweergave.
- Detail-beschrijving gebruikt nu een rijke editor-shell met toolbar (zelfde UX-principe als updates), `rows=3`, auto-resize, tekenteller en `maxLength=2000`.
- Nieuw-kaart flow (`CreateCardInline`) gebruikt nu ook een rijke beschrijving-editor met toolbar, `rows=3`, auto-resize en 2000-tekengrens.
- Bestaand blur-save gedrag en no-op bij ongewijzigde tekst behouden; extra guard toegevoegd voor >2000 tekens bij detail-save.
- Gerichte tests toegevoegd/aangepast in `VergaderbordenPage.test.tsx` voor rows/maxLength, veilige rijke rendering, create-flow toolbar, en 2000-tekens-validatie.
- About/changelog bijgewerkt in `backend/app/api/meta.py` met iteratie 55.

## How to verify
- `cd frontend && npm run test -- src/app/features/admin/VergaderbordenPage.test.tsx`
- `cd frontend && npm run build`

## Verification evidence
- `cd frontend && npm run test -- src/app/features/admin/VergaderbordenPage.test.tsx` → **PASS** (30 tests geslaagd).
- `cd frontend && npm run build` → **PASS** (`tsc -b` + `vite build` succesvol; productiebundle opgebouwd).

---
Status: completed
Owner: opsx-implement
Date: 2026-05-29
