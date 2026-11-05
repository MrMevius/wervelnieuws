# Title

Admin log: compacter en leesbaarder

## Context

Het tabblad Admin > Admin log toont de laatste 40 auditgebeurtenissen als een ruime tabel met technische namen (`board.card.updated`), volledige datum per regel en een bijna altijd lege kolom "Topic". Herhaalde acties, zoals vijf keer achter elkaar een kaart verwijderen, nemen elk een eigen regel in.

## Goals / Non-goals

### Goals

- Compactere regels: kleinere tekst en minder witruimte, ook op mobiel (een lijst in plaats van één kaart per gebeurtenis).
- Gegroepeerd per dag ("Vandaag", "Gisteren", "maandag 27 oktober") met alleen de tijd per regel.
- Opeenvolgende identieke acties (zelfde persoon, actie en topic op dezelfde dag) samengevoegd tot één regel met "×N" en een tijdsbereik.
- Leesbare Nederlandse acties met de technische naam als tooltip, plus een gekleurd label per onderdeel (Vergaderborden, Uren, Wervelnieuws, Database, Participatie).
- Topic achter de actie in plaats van in een eigen kolom; een filter op onderdeel.

### Non-goals

- Geen wijziging in de API of in het aantal opgehaalde gebeurtenissen (40).

## Proposed approach

Nieuwe component `AdminActivityLog` in `frontend/src/app/shell/`, aangeroepen vanuit `AppShell.tsx`. Hulpfuncties `formatAmsterdamTime` en `formatAmsterdamDayLabel` in `lib/datetime.ts`. CSS `admin-log-*` in `styles.css` en een compacte mobiele weergave in `responsive.css`.

## Acceptance criteria

1. Elke gebeurtenis blijft zichtbaar, alleen opeenvolgende duplicaten worden samengevoegd met een teller.
2. Onbekende gebeurtenistypes worden ongewijzigd getoond.
3. Het filter op onderdeel past de telling en de lijst aan.

## Verification evidence

Zie PR: `tsc -b` en de volledige frontend-testsuite (inclusief nieuwe tests voor groeperen, samenvoegen en filteren) slagen; screenshots van donker, licht en mobiel zijn met de echte stylesheets gecontroleerd.
