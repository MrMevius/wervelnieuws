# Title

Vergaderbord: snelle zoekfunctie per bord

## Context

Op een vergaderbord kun je alleen filteren op "Mijn kaarten" en "Urgent". Kaarten terugvinden op inhoud van titel, beschrijving of updates vraagt handmatig openen van kaarten.

## Goals / Non-goals

### Goals

- Eén zoekveld in de filterbalk van het actieve bord.
- Zoeken (hoofdletterongevoelig, deelstring) in titel, beschrijving, niet-verwijderde updates, opnametranscripties en bijlagebestandsnamen.
- Direct resultaat voor titel/beschrijving; updates/transcripties/bijlagen via de server.

### Non-goals

- Geen zoeken over meerdere borden, in archief of prullenbak.
- Geen full-text index of ranking; datasets zijn klein.
- Geen markering van de treffer binnen een kaart.

## Proposed approach

1. `GET /api/boards/projects/{project_id}/search?q=` met bestaande bordtoegangscontrole; retourneert `card_ids` van actieve kaarten. `LIKE`-wildcards in de zoekterm worden ge-escaped.
2. Frontend filtert lokaal op titel/beschrijving en voegt na 250 ms debounce de servertreffers toe; zoeken combineert met bestaande filters, schakelt slepen uit zoals bestaande filters, toont het aantal treffers en wist met Esc of "Wis filters". Zoekterm reset bij wisselen van bord.

## Acceptance criteria

1. Kaarten met de term in titel, beschrijving, update, transcriptie of bijlagenaam blijven zichtbaar; andere verdwijnen.
2. Gearchiveerde/verwijderde kaarten, verwijderde updates en andere borden geven geen treffer.
3. Gebruikers zonder toegang tot het bord kunnen niet zoeken.
4. `%` en `_` worden letterlijk gezocht.

## Verification evidence

Zie PR: backend-test per bron plus archief, verwijderde update, ander bord, wildcards en toegang; frontendtest voor directe lokale treffers, servertreffers, aantal, sleepblokkade en Esc.
