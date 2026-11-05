# Title

Admin Projecten: professionelere opmaak van projecten en urenposten

## Context

Op het tabblad Admin > Projecten staan het formulier en de tabellen los van de rest van Admin. Knoppen zijn overal even zwaar, de status is platte tekst en de zichtbaarheidsvinkjes lopen tegen elkaar aan.

## Goals / Non-goals

### Goals

- Dezelfde opbouw als Admin > Gebruikers: kop, een kaart om toe te voegen met gelabelde velden, en een tabel met toelichting.
- Status als badge (Actief, Inactief, Gearchiveerd, Verwijderd).
- Zichtbaarheid (Vergaderborden, Urenregistratie) als duidelijke aan/uit-chips.
- Zichtbare rangorde in acties: "Naam opslaan" en "Opslaan" alleen opvallend bij een wijziging, "Deactiveer" als gevarenactie.

### Non-goals

- Geen wijziging in API, opslaglogica of rechten.

## Proposed approach

Markup van het tabblad Projecten in `AppShell.tsx` herschikt met bestaande admin-klassen (`admin-create-user-card`, `admin-field`, `status-badge`, `admin-user-action-compact`), plus nieuwe CSS voor zichtbaarheidschips, inline naambewerking en kolombreedtes.

## Acceptance criteria

1. Alle bestaande acties (toevoegen, hernoemen, zichtbaarheid, (de)activeren, opslaan, archiveren, herstellen) werken ongewijzigd.
2. "Naam opslaan" is uitgeschakeld zolang de naam niet gewijzigd is.
3. De pagina blijft bruikbaar op mobiel.

## Verification evidence

Zie PR: `tsc -b` en de volledige frontend-testsuite slagen; screenshots van donker, licht en mobiel zijn met de echte stylesheet gecontroleerd.
