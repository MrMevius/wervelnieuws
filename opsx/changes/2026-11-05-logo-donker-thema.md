# Title

Logo leesbaar in het donkere thema

## Context

Het Groene Noabers-logo in de topbalk heeft donkerblauwe letters ("NOABERS"). In het donkere thema vallen die weg tegen de donkere balk.

## Goals / Non-goals

### Goals

- In het donkere thema een logovariant tonen waarin alleen het donkerblauw lichtgrijs is; groen, geel en transparantie blijven gelijk.
- De keuze volgt het opgeloste thema, dus ook bij themavoorkeur "systeem".

### Non-goals

- Geen wijziging aan het logo in het lichte thema (blijft de originele afbeelding van groenenoabers.nl).

## Proposed approach

`frontend/public/groene-noabers-logo-dark.png` is afgeleid van het originele logo (navy pixels → `#f1f3f4`, alfa behouden). `AppShell.tsx` houdt het opgeloste thema bij in `resolvedTheme` en kiest daarmee de `src` van het logo.

## Acceptance criteria

1. In het donkere thema is "NOABERS" goed leesbaar in de topbalk.
2. In het lichte thema is het logo ongewijzigd.

## Verification evidence

Zie PR: `tsc -b` en de volledige frontend-testsuite (inclusief een nieuwe test voor het donkere thema) slagen; screenshot van de donkere topbalk gecontroleerd.
