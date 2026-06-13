# Title
Vergaderbord-header gebruikt avatarbadges en toont verborgen gebruikers in overflow

## Context
De geopende vergaderbord-header toont momenteel toegangsgebruikers als naamchips. Op de kaartjes zelf wordt al een compactere avatarbadge/weergave gebruikt. Voor scanbaarheid en visuele consistentie moet de header dezelfde badge-/avatarstijl overnemen, maar alleen in de geopende bordheader.

Dit is een gerichte frontend-follow-up: de bestaande toegangslogica blijft gelijk, en dropdowns of kaartbadges mogen niet mee veranderen tenzij een kleine gedeelde presentational component/stijl dat veilig mogelijk maakt.

Aanvullend moet de `+N`-overflowbadge in de geopende header bij mouse-over/focus aangeven welke verborgen gebruikers ook toegang hebben. Dit moet op een eenvoudige, toegankelijke manier gebeuren via `title` en `aria-label`, zonder de zichtbare limiet of toegangsregels te veranderen.

## Goals / Non-goals
### Goals
- Vervang de huidige naamchips in de geopende vergaderbord-header door compacte avatarbadges.
- Gebruik een avatarafbeelding wanneer die beschikbaar is; toon anders initialen als fallback.
- Beperk de zichtbare badges tot maximaal 5 en toon daarna één `+N`-overflowbadge.
- Houd tooltip en `aria-label` per badge gebaseerd op de volledige displaynaam.
- Laat de `+N`-overflowbadge verborgen toegangsgebruikers expliciet benoemen in tooltip en `aria-label`.
- Sluit visueel aan op de bestaande badge/avatar-weergave die al op kaartjes wordt gebruikt.
- Voeg na implementatie de gebruikelijke About/changelog-entry toe.

### Non-goals
- Geen wijziging aan toegangscontrole, autorisatie of board-access selectie.
- Geen backend/API-logica verandering tenzij een reeds beschikbare avatarwaarde alleen nog in frontend types/props moet worden doorgegeven.
- Geen wijzigingen aan dropdowns of andere board-overzichtscomponenten.
- Geen inhoudelijke wijziging aan de kaartbadges zelf; alleen een gedeelde component/stijl mag worden hergebruikt als dat geen regressie veroorzaakt.
- Geen wijziging aan de zichtbare `max 5`-limiet; alleen de toegankelijke overflowtekst verandert.

## Proposed approach
1. Inspecteer de huidige header-accessweergave en de bestaande kaartbadge/avatarcomponenten om te bepalen welke presentational delen gedeeld kunnen worden.
2. Hergebruik of extraheer een kleine gedeelde avatarbadgecomponent/styling voor zowel kaartjes als header, zonder de kaartweergave te veranderen.
3. Vervang in de geopende vergaderbord-header de naamchips door avatarbadges met afbeelding-als-aanwezig en initialen-als-fallback.
4. Houd de bestaande limiet van 5 zichtbare gebruikers aan en render daarboven één compacte `+N`-badge.
5. Behoud duidelijke tooltips en toegankelijke labels met de displaynaam; laat de overflowbadge hidden users expliciet vermelden in `title` en `aria-label`.
6. Werk gerichte frontendtests bij voor avatarweergave, initials-fallback, overflow en toegankelijkheidslabels.
7. Voeg de vereiste About/changelog-entry toe volgens de repositoryconventie.

## Implementation steps (ordered)
1. Inspecteer `frontend/src/app/features/admin/VergaderbordenPage.tsx`, de bijbehorende tests en de bestaande card-avatar/badge-implementatie.
2. Bepaal of de header een bestaande shared avatarbadgecomponent kan gebruiken of dat een kleine presentational extractie nodig is.
3. Vervang de huidige headernaamchips door avatarbadges met afbeelding-fallback naar initialen.
4. Laat de headerlogic voor maximaal 5 zichtbare badges en `+N` overflow intact of herschrijf die alleen voor de nieuwe avatarweergave.
5. Zorg dat `title` en `aria-label` van de `+N`-badge de verborgen gebruikersnamen bevatten, met count en names in het accessible label.
6. Controleer dat dropdowns, kaartbadges en overige boardcomponenten visueel ongewijzigd blijven.
7. Werk frontendtests en eventuele snapshots/DOM-asserties bij voor avatar, initials en overflow-tooltip/accessible text.
8. Voeg de verplichte About/changelog-entry toe.
9. Voer gerichte verificatie uit en leg de uitkomst vast in deze spec.

## Acceptance criteria
1. In de geopende vergaderbord-header zijn gebruikers zichtbaar als avatarbadges, niet meer als naamchips.
2. Elke badge toont een avatarafbeelding als die beschikbaar is; anders wordt een initialen-fallback getoond.
3. Er zijn nooit meer dan 5 zichtbare badges; extra gebruikers worden samengevat in precies één `+N`-badge.
4. De `+N`-badge toont bij hover/focus een tooltip/title die alleen de verborgen gebruikers bevat; het `aria-label` bevat zowel de count als de verborgen displaynamen.
5. De headerweergave sluit visueel aan op de bestaande badge/avatarstijl van kaartjes.
6. Dropdowns, board-access logica en kaartbadges blijven functioneel en visueel ongewijzigd.
7. Relevante frontendtests dekken de overflow tooltip/accessible label en de frontend build slagen.
8. De About/changelog bevat een eindgebruikersvriendelijke entry over deze wijziging.

## Testing plan
- Gerichte frontendtests:
  - `cd frontend && npm test -- VergaderbordenPage.test.tsx`
- Frontend build/typecheck:
  - `cd frontend && npm run build`
- Handmatige verificatie:
  1. Open een vergaderbord met meerdere toegangsgebruikers.
  2. Controleer dat de header avatarbadges toont in plaats van naamchips.
  3. Controleer een gebruiker met avatar en een gebruiker zonder avatar (initialenfallback).
  4. Controleer dat maximaal 5 badges zichtbaar zijn en dat overflow als `+N` verschijnt.
  5. Controleer tooltip/title en toetsenbord/screenreader-labels voor de `+N`-badge.
  6. Controleer dat dropdowns en kaartbadges er gelijk uit blijven zien.
  7. Controleer de About-pagina op de nieuwe changelog-entry.

## Risk + rollback plan
### Risks
- Een gedeelde avatarbadgecomponent kan onbedoeld kaartbadges beïnvloeden; mitigatie: styling en props strikt lokaal houden en regressietests toevoegen.
- Als avatarmetadata niet beschikbaar is voor sommige gebruikers, kan alleen de initialenfallback worden getoond; mitigatie: fallback blijft verplicht en mag niet blokkeren.
- De header kan visueel druk worden; mitigatie: max 5 zichtbare badges en compacte overflow.
- Accessibiliteit kan achteruitgaan als labels niet expliciet blijven; mitigatie: title/aria-label expliciet testen.
- Overflowlabels kunnen te lang worden; mitigatie: alleen verborgen gebruikers opnemen, geen extra UI-tekst toevoegen.

### Rollback
- Zet de header terug naar de vorige naamchip-weergave.
- Draai eventuele gedeelde presentational styling/componentextractie terug indien kaartjes mee geraakt zijn.
- Revert de About/changelog-entry als de wijziging volledig wordt teruggedraaid.

## Notes / links
- Bron: goedgekeurde follow-up op de bestaande vergaderbord-access UI.
- Relevante bestanden om te inspecteren:
  - `frontend/src/app/features/admin/VergaderbordenPage.tsx`
  - `frontend/src/app/features/admin/VergaderbordenPage.test.tsx`
  - `frontend/src/lib/api/client.ts`
  - eventuele gedeelde avatar/badge styling in de frontend shell of stylesheets
- Scope-beslissing: alleen de geopende vergaderbord-header; geen dropdownwijzigingen.

## Current status
Completed.

## What changed
- De geopende vergaderbord-header toont nu een compacte avatarbadge-regel met maximaal 5 zichtbare badges en een enkele `+N`-overflowbadge.
- De overflowbadge is nu focusable en toont bij hover/focus de verborgen gebruikers via `title` (alleen displaynamen) en `aria-label` (count + displaynamen).
- De about/changelog-entry is bijgewerkt met de nieuwe overflow-omschrijving.

## How to verify
- `cd frontend && npm test -- VergaderbordenPage.test.tsx`
- `cd frontend && npm run build`
- Handmatige browsercheck: open een vergaderbord en controleer avatarbadge, initialenfallback, max 5 zichtbare badges, +N-overflow met hidden-users title/aria-label, en About/changelog-entry.

## Verification evidence
- `cd frontend && npm test -- VergaderbordenPage.test.tsx` ✅ 37 tests passed.
- `cd frontend && npm run build` ✅ build succeeded.
- Geen aparte full-backend test-caveat geregistreerd voor deze change.

---
Status: Completed
Owner: —
Date: 2026-06-12
