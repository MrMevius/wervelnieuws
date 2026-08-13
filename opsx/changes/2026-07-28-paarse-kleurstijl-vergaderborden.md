# Title
Duidelijk contrastrijke paarse stijl voor vergaderborden en interface

## Context
De huidige visuele stijl van de vergaderborden en omliggende interface is functioneel, maar mist een uitgesproken en consistent paars kleurverhaal. Daardoor voelen belangrijke UI-elementen zoals primaire acties, geselecteerde states, board-chrome, badges en focusstates minder herkenbaar en minder onderscheidend.

Deze change introduceert een duidelijk contrastrijke paarse stijl voor de vergaderborden en relevante interface-onderdelen, zonder de bestaande workflow, navigatie of inhoudelijke logica te herontwerpen. De beoogde aanpak is bewust semantisch: kleuren worden via tokens gemodelleerd, zodat componenten hun visuele rol krijgen via betekenisvolle variabelen in plaats van losse hex-waarden.

## Goals / Non-goals
### Goals
- Introduceer een herkenbare paarse visuele stijl voor vergaderborden en relevante interface-chrome.
- Gebruik semantische design tokens als bron van waarheid voor kleurgebruik (`optie 2`).
- Zorg voor duidelijke hiërarchie tussen achtergrond, kaartvlakken, primaire acties, geselecteerde items, subtiele accenten en focusstates.
- Houd contrast voldoende hoog voor leesbaarheid en toegankelijkheid, ook in dark mode.
- Pas de stijl consistent toe op board-pagina's, relevante cards/modals/toolbars en gedeelde interface-elementen waar dat logisch is.
- Beperk de wijziging tot styling en thematische mapping; laat functionaliteit en dataflow intact.
- Werk de user-facing changelog/About-entry bij volgens de repo-definitie van done.

### Non-goals
- Geen herontwerp van bordindeling, workflow of interactiemodel.
- Geen backendwijzigingen, API-contractwijzigingen of datamodelwijzigingen.
- Geen per-gebruiker thema-instelling of theme switcher.
- Geen volledige visuele rebrand buiten de afgesproken paarse stijl.
- Geen component- of layout-refactor tenzij strikt nodig om de semantische tokens correct te laten landen.
- Geen implementatie in deze spec-authoring stap.

## Proposed approach
**Optie 2: semantische tokens eerst.**

1. Definieer een compacte paarse basispalette (bijv. tinten voor 50-950) als primitive laag.
2. Map die primitives naar semantische tokens voor rollen zoals:
   - `brand`, `brand-soft`, `brand-contrast`
   - `surface-accent`, `surface-accent-subtle`
   - `border-accent`, `border-accent-strong`
   - `text-accent`, `text-accent-contrast`
   - `focus-ring`, `selection`, `badge-info`, `badge-active`
3. Laat board- en interfacecomponenten deze semantische tokens gebruiken in plaats van lokale hardcoded kleuren.
4. Houd neutrale oppervlakken en tekst grotendeels intact; de paarse stijl moet richting geven via accenten, states en duidelijke nadruk, niet via overal zwaar paars vlakgebruik.
5. Stem light en dark mode apart af zodat contrast, leesbaarheid en visuele balans behouden blijven.
6. Pas alleen die componenten aan die bijdragen aan de vergaderbordervaring en gedeelde interface-elementen die visueel samenhang nodig hebben.

## Implementation steps (ordered)
1. Inventariseer de huidige kleur- en stategebruikspunten in de frontend voor vergaderborden en gedeelde interface-elementen.
2. Introduceer de paarse primitive palette-laag en de semantische tokenmapping in de bestaande stylinglaag.
3. Koppel de global/root theme-variabelen aan de nieuwe semantische tokens voor light en dark mode.
4. Herstyle board-chrome en board-gerelateerde primaire UI-elementen: header, acties, geselecteerde items, badges, kaarten en focusstates.
5. Pas relevante modals/toolbars/panels aan zodat de paarse stijl visueel consistent doorloopt in de interface.
6. Controleer hover/active/disabled/selected states zodat deze semantisch en toegankelijk blijven.
7. Verifieer contrast, leesbaarheid en visuele balans in light en dark mode; corrigeer waar nodig via tokens, niet via losse componentkleurfixes.
8. Werk gerichte frontendtests of snapshots alleen bij als bestaande assertions door de token-/classwijziging breken of als ze nuttig zijn voor regressie-afdekking.
9. Voeg een korte end-user changelog/About-entry toe.
10. Vul deze spec na implementatie aan met `What changed`, `How to verify` en `Verification evidence`.

## Acceptance criteria
1. Vergaderborden en de relevante interface tonen een duidelijke, consistente paarse visuele stijl.
2. De kleurlaag is semantisch opgebouwd: componenten gebruiken tokens/variabelen in plaats van losse, verspreide kleurwaarden.
3. Primaire acties, geselecteerde states, badges en focusstates zijn duidelijker herkenbaar dan vóór deze wijziging.
4. Tekst en iconen blijven leesbaar; contrast voldoet op de aangepaste oppervlakken aan ten minste WCAG AA waar van toepassing.
5. Light en dark mode blijven visueel coherent met dezelfde semantische tokenlaag.
6. Er zijn geen wijzigingen aan workflow, rechten, dataopslag of API-gedrag.
7. Frontendtests en build slagen voor de gewijzigde gebieden.
8. De About/changelog bevat een end-user-friendly entry over de paarse stijlwijziging.

## Testing plan
- Frontend tests:
  - `cd frontend && npm test -- --run`
- Frontend build:
  - `cd frontend && npm run build`
- Handmatige verificatie:
  1. Open meerdere vergaderbord-schermen en relevante interface-onderdelen.
  2. Controleer de paarse accenten op header, kaarten, primaire knoppen, badges en focusstates.
  3. Controleer light en dark mode op contrast en leesbaarheid.
  4. Controleer dat geselecteerde en hover states duidelijk onderscheiden blijven.
  5. Controleer dat de paarse stijl niet doorschiet naar onnodige full-surface blending.

## Risk + rollback plan
### Risks
- Te veel paars kan de interface zwaar of onrustig maken; mitigatie: semantic tokens beperken tot accenten en states.
- Contrast kan onvoldoende blijken in dark mode; mitigatie: tokens per thema apart afregelen en toetsen op AA-niveau.
- Semantische tokenmapping kan bestaande componenten onverwacht raken als selectors te breed zijn; mitigatie: scoped toepassing en gecontroleerde root-variabelen.
- Visuele consistentie kan afnemen als een deel van de UI nog oude kleuren gebruikt; mitigatie: één centrale tokenlaag als bron van waarheid.

### Rollback
- Zet de semantische paarse tokenmapping terug naar de vorige kleurwaarden.
- Herstel componenten naar de vorige styling-classes/variabelen.
- Verwijder de About/changelog-entry als de change volledig wordt teruggedraaid.
- Draai frontendtests en build opnieuw na rollback om te bevestigen dat de oude toestand stabiel is.

## Docs-impact
- Voeg een korte, gebruikersgerichte About/changelog-entry toe.
- Indien er bestaande design-/stijlnotities zijn, leg de semantische tokenlaag kort vast als referentie voor vervolgwerk.

## Notes / links
- Slug: `paarse-kleurstijl-vergaderborden`
- Aanpakvoorkeur: semantische tokens, optie 2.
- Basis voor implementatie: bestaande frontend stylinglaag en theme-variabelen.
- Scope blijft bewust beperkt tot visuele styling en tokenmapping.

## Current status
Partial

## What changed
Frontend styling is omgezet naar semantische paarse tokens voor vergaderbordkolommen, board-chrome, modals, overlays en interactieve states. De algemene interface gebruikt nu dezelfde paarse accentlaag voor navigatie, hero/chrome, focusstates en geselecteerde states. De About/changelog bevat een nieuwe gebruikersgerichte update over de paarse stijl. Gerichte frontendtests en build zijn geslaagd.

## How to verify
- `cd frontend && npm test -- --run` → PASS.
- `cd frontend && npm run build` → PASS.
- `cd backend && pytest tests/test_meta_and_me.py -q` → lokaal geblokkeerd door ontbrekende `fastapi` in de host-omgeving.
- Handmatige visuele/a11y-check van vergaderborden en interface in light/dark mode op contrast, geselecteerde states en focusstates: nog niet aantoonbaar uitgevoerd.

## Follow-ups
- Voer een aparte visuele WCAG-/a11y-review uit; er is geen losse contrast- of accessibility-tooling gebruikt in deze change.
- Controleer en migreer/actualiseer bestaande opgeslagen About-content indien die nog oude tekst bevat.
- Isoleer en behandel ongerelateerde pre-existing audiowijzigingen apart; die zaten al in de worktree en zijn niet door deze change aangepast.

## Verification evidence
`cd frontend && npm test -- --run` ✅ 3 test files, 129 tests passed.

`cd frontend && npm run build` ✅ build geslaagd.

`cd backend && pytest tests/test_meta_and_me.py -q` ⚠️ lokaal geblokkeerd met `ModuleNotFoundError: No module named 'fastapi'`.

Review verdict:
- User accepted partial verification as sufficient for close-out.
- No visual proof or separate a11y proof was captured.

Punch-list:
- Capture visual/a11y evidence for the purple theme pass.
- Re-run backend verification in an environment with FastAPI installed.
- Confirm unrelated pre-existing audio work remains out of scope.

---
Status: partial
Owner: n.v.t.
Date: 2026-07-28
