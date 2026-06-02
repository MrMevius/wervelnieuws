# Toon vergaderbord-update tijden in Amsterdamse lokale tijd

## Context

Een gebruiker meldt dat de tijd van updates niet overeenkomt met de daadwerkelijke lokale tijd in Amsterdam. In de screenshot toont de metadata van een update `02-06-2026, 13:32`, terwijl de update-inhoud verwijst naar `15:32 uur`.

De frontend formatteert vergaderbord update- en activiteitstijden met browser-lokale `toLocaleString(...)` zonder expliciete tijdzone. Daardoor kan UTC-invoer verkeerd als lokale tijd zichtbaar worden.

## Goals / Non-goals

### Goals

- Toon vergaderbord-update- en opname-activiteitstijden als `Europe/Amsterdam` lokale tijd.
- Laat timestamp-opslag en API-serialisatie ongewijzigd.
- Verwerk ISO timestamps met `Z` of offset correct.
- Behandel ISO timestamps zonder timezone defensief als UTC.
- Voeg regressietests toe voor zomer- en wintertijd.

### Non-goals

- Geen database-migratie.
- Geen wijziging van opgeslagen timestampwaarden.
- Geen scheduler- of publicatielogica aanpassen.
- Geen brede migratie van alle datumweergaves in de applicatie.
- Geen automatische herschrijving van bestaande update-bodytekst.

## Proposed approach

Introduceer een kleine gedeelde frontend datetime-helper die expliciet `Intl.DateTimeFormat` gebruikt met locale `nl-NL` en timezone `Europe/Amsterdam`. Gebruik deze helper in `VergaderbordenPage.tsx` voor update- en opname-activiteit metadata.

## Implementation steps (ordered)

1. Maak `frontend/src/lib/datetime.ts` met Amsterdam-formattering en defensieve UTC parsing.
2. Vervang inline datumformattering in `VergaderbordenPage.tsx` voor update- en opname-activiteit metadata.
3. Voeg utility-regressietests toe voor zomer-/wintertijd en naive UTC input.
4. Update de About/changelog-entry voor de gebruiker zichtbare verbetering.
5. Run gerichte frontend tests en build/typecheck waar passend.

## Acceptance criteria

- Een update met UTC timestamp `2026-06-02T13:32:00Z` wordt getoond als `02-06-2026, 15:32`.
- Een update met naive UTC timestamp `2026-06-02T13:32:00` wordt ook getoond als `02-06-2026, 15:32`.
- Wintertijd wordt correct met CET-offset verwerkt.
- Opname-activiteiten in dezelfde lijst gebruiken dezelfde Amsterdamse tijdweergave.
- Timestamps worden niet anders opgeslagen of gemuteerd.
- Bestaande update-bodytekst wordt niet herschreven.

## Testing plan

Gericht:

```bash
npm test -- --run src/lib/datetime.test.ts
```

Aanvullend voor de gewijzigde frontend:

```bash
npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx
npm run build
```

## Risk + rollback plan

Risico: naive ISO timestamps zonder timezone kunnen verkeerd geïnterpreteerd worden als lokale tijd. Mitigatie: de helper detecteert ISO strings zonder offset en behandelt deze als UTC.

Rollback: revert de frontend helper, usages in `VergaderbordenPage.tsx`, tests en changelog-entry. Geen data rollback nodig.

## Notes / links

Betrokken bestanden:

- `frontend/src/lib/datetime.ts`
- `frontend/src/lib/datetime.test.ts`
- `frontend/src/app/features/admin/VergaderbordenPage.tsx`
- `backend/app/api/meta.py`

## Current status

Completed.

## What changed

- Toegevoegd: `frontend/src/lib/datetime.ts` met expliciete `Europe/Amsterdam` datum-/tijdweergave.
- Toegevoegd: `frontend/src/lib/datetime.test.ts` met regressietests voor zomertijd, wintertijd, naive UTC ISO strings en ongeldige input.
- Aangepast: `frontend/src/app/features/admin/VergaderbordenPage.tsx` gebruikt de Amsterdam-helper voor update- en opname-activiteit metadata.
- Aangepast: `backend/app/api/meta.py` bevat een gebruikersgerichte changelog-entry voor deze correctie.

## How to verify

Vanuit `frontend/`:

```bash
npm test -- --run src/lib/datetime.test.ts
npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx
npm run build
```

## Verification evidence

Uitgevoerd op 2026-06-02:

```bash
npm test -- --run src/lib/datetime.test.ts
```

Resultaat: geslaagd, 1 testbestand, 4 tests.

```bash
npm test -- --run src/app/features/admin/VergaderbordenPage.test.tsx
```

Resultaat: geslaagd, 1 testbestand, 33 tests.

```bash
npm run build
```

Resultaat: geslaagd, TypeScript build en Vite production build voltooid.

Review: no-edit review uitgevoerd tegen de acceptatiecriteria. De wijziging is beperkt tot frontend-tijdweergave plus About/changelog en wijzigt geen timestamp-opslag of update-bodytekst. Let op: de working tree bevat meerdere bestaande, niet-gerelateerde wijzigingen buiten deze spec.
