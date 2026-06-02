# Title
Compacte verplaats-update op vergaderbord

## Context
De automatische update bij het verplaatsen van een kaartje op het vergaderbord wordt nu weergegeven als `Kaart verplaatst van <oude kolom> naar <nieuwe kolom>.` waarbij de kolomnamen apart vet worden gerenderd. In een smalle kaartdetailkolom breekt dit rommelig over meerdere regels, waardoor de update visueel onrustig oogt.

De gewenste wijziging is klein en gericht: alleen de visuele weergave van automatische verplaats-updates compacter en netter maken.

## Goals / Non-goals
### Goals
- Pas alleen de frontend-weergave van automatische verplaats-updates aan.
- Toon verplaats-updates compact als: `Kaart verplaatst: <oude kolom> → <nieuwe kolom>`.
- Houd oude en nieuwe kolomnaam duidelijk herkenbaar.
- Laat metadata, auteur, datum/tijd en update-acties zoals Bewerken/Verwijderen ongewijzigd.
- Laat niet-verplaats-updates via de bestaande rich text renderer lopen.
- Voeg of update een gerichte frontendtest waar passend.
- Werk de website/About changelog bij met een korte eindgebruikersnotitie conform repo DoD.

### Non-goals
- Geen wijziging aan handmatige updateberichten.
- Geen opslagmigratie, backfill of herschrijven van bestaande updates.
- Geen brede redesign van updatekaarten of vergaderbordlayout.
- Geen wijziging aan backend-generatie van de opgeslagen move-updateboodschap, tenzij technisch noodzakelijk blijkt.

## Proposed approach
1. Gebruik de bestaande specifieke patroonherkenning voor automatische move-updates (`Kaart verplaatst van ... naar ... .`).
2. Pas uitsluitend de render-output van dit patroon aan naar één compacte zin met pijl: `Kaart verplaatst: <oud> → <nieuw>`.
3. Geef de oude en nieuwe kolomnaam visueel herkenbaar weer, bij voorkeur met bestaande eenvoudige emphasis zonder extra layoutcomplexiteit.
4. Laat de fallback voor alle andere updateberichten ongewijzigd.
5. Werk de bestaande `VergaderbordenPage.test.tsx`-test rond move-updates bij zodat die de compacte zin en kolomnamen controleert.

## Implementation steps (ordered)
1. Lokaliseer `renderBoardUpdateMessage` in `frontend/src/app/features/admin/VergaderbordenPage.tsx`.
2. Restate acceptance criteria voordat code-edits beginnen.
3. Pas alleen de matched move-update rendering aan naar compacte tekst met pijl.
4. Controleer dat niet-matchende updateberichten ongewijzigd via `UpdateMessageRenderer` blijven lopen.
5. Werk de gerichte frontendtest in `VergaderbordenPage.test.tsx` bij.
6. Werk de About/changelog-weergave bij met een korte eindgebruikersnotitie.
7. Run gerichte frontendtest en waar passend build/typecheck.
8. Leg verificatiecommando's en resultaten vast in deze spec.

## Acceptance criteria
1. Automatische move-updates worden in kaartdetail compact weergegeven als `Kaart verplaatst: <oude kolom> → <nieuwe kolom>`.
2. Oude en nieuwe kolomnaam blijven duidelijk herkenbaar in de compacte tekst.
3. Niet-move updates blijven ongewijzigd gerenderd via de bestaande rich text renderer.
4. Auteur, datum/tijd en acties onder de update blijven functioneel en visueel ongewijzigd.
5. Een gerichte frontendtest dekt de compacte move-updateweergave.
6. De website/About changelog bevat een korte functionele melding voor eindgebruikers.

## Testing plan
- Gericht frontend:
  - `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` vanuit `frontend/`.
- Build/typecheck indien frontendwijziging dit vereist:
  - `npm run build` vanuit `frontend/`.
- Handmatige UI-check:
  1. Open een kaartdetail met een move-update.
  2. Controleer dat de update compact oogt als `Kaart verplaatst: Bezig → Klaar`.
  3. Controleer dat datum, auteur en acties nog zichtbaar en bruikbaar zijn.

## Risk + rollback plan
### Risks
- De patroonherkenning blijft afhankelijk van de bestaande opgeslagen tekstvorm `Kaart verplaatst van <oud> naar <nieuw>.`.
- Een erg lange kolomnaam kan nog steeds afbreken, maar de zin bevat minder losse woorden en zou netter moeten blijven.

### Mitigation
- Beperk de wijziging tot het bestaande specifieke patroon en behoud veilige fallback naar bestaande rich text rendering.
- Dek het gedrag af met een gerichte frontendtest.

### Rollback
- Zet de render-output in `renderBoardUpdateMessage` terug naar de vorige formulering.
- Geen datamigratie of backend rollback nodig als alleen de frontendweergave wijzigt.

## Notes / links
- Gebruikersfeedback met screenshot: huidige tekst breekt rommelig over regels bij update `Kaart verplaatst van Bezig naar Klaar.`
- Gerelateerde eerdere spec: `opsx/changes/2026-05-28-vergaderbord-verplaatsingsupdates-duidelijke-kolomnamen.md`.

## Current status
Completed

## What changed
- Frontend: automatische move-updateberichten die het bestaande patroon `Kaart verplaatst van <oud> naar <nieuw>.` matchen, worden nu compact getoond als `Kaart verplaatst: <oud> → <nieuw>`.
- Frontend: oude en nieuwe kolomnaam blijven als `<strong>` weergegeven zodat ze herkenbaar blijven.
- Frontend fallback: niet-matchende updates blijven via de bestaande rich text renderer lopen.
- Backend/About: changelog-entry toegevoegd met een korte eindgebruikersnotitie over de nettere verplaats-updateweergave.
- Tests: gerichte `VergaderbordenPage.test.tsx`-asserties bijgewerkt voor compacte tekst en pijlweergave.

## How to verify
1. Gericht frontend:
   - `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` vanuit `frontend/`.
2. Frontend build/typecheck:
   - `npm run build` vanuit `frontend/`.
3. Handmatige UI-check:
   1. Open een kaartdetail met een move-update.
   2. Controleer dat de update compact oogt als `Kaart verplaatst: Bezig → Klaar`.
   3. Controleer dat datum, auteur en acties nog zichtbaar en bruikbaar zijn.

## Verification evidence
- ✅ `npm test -- src/app/features/admin/VergaderbordenPage.test.tsx` (in `frontend/`)
  - Resultaat: 1 testbestand geslaagd, 33 tests passed.
- ✅ `npm run build` (in `frontend/`)
  - Resultaat: geslaagde TypeScript/Vite productiebuild.

## Review notes
- Dedicated `opsx-review` subagent faalde met `ProviderModelNotFoundError`; daarom is een handmatige no-edit review uitgevoerd op de diff tegen deze spec.
- Review-uitkomst: geen blocking findings. De wijziging blijft beperkt tot de specifieke move-update renderer, behoudt fallbackgedrag voor niet-move updates, laat metadata/acties ongemoeid en bevat de gevraagde changelog-entry en gerichte testdekking.

---
Status: completed
Owner: n.v.t.
Date: 2026-06-02
