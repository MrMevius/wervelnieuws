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
- Beschrijvingsvelden van urenposten één regel hoog (meerdere regels blijven mogelijk).
- Nieuwe zichtbaarheid "Participatiemomenten" per project, naast Vergaderborden en Urenregistratie.

### Non-goals

- Geen wijziging in rechten of in leestoegang tot bestaande participatiemomenten.

## Proposed approach

Markup van het tabblad Projecten in `AppShell.tsx` herschikt met bestaande admin-klassen (`admin-create-user-card`, `admin-field`, `status-badge`, `admin-user-action-compact`), plus nieuwe CSS voor zichtbaarheidschips, inline naambewerking en kolombreedtes.

Backend: kolom `projects.is_visible_in_participation` (migratie `20261105_0035`, standaard zichtbaar voor bestaande projecten), opgenomen in de admin-projectendpoints. Een verborgen project is in `/api/participatiemomenten/meta` niet selecteerbaar en kan niet nieuw gekoppeld worden; bestaande koppelingen blijven behouden, net als bij gearchiveerde projecten.

## Acceptance criteria

1. Alle bestaande acties (toevoegen, hernoemen, zichtbaarheid, (de)activeren, opslaan, archiveren, herstellen) werken ongewijzigd.
2. "Naam opslaan" is uitgeschakeld zolang de naam niet gewijzigd is.
3. De pagina blijft bruikbaar op mobiel.
4. Na de migratie zijn alle bestaande projecten zichtbaar in Participatiemomenten.
5. Een project dat verborgen is voor Participatiemomenten kan niet aan een nieuw moment gekoppeld worden; bestaande momenten blijven ongewijzigd bewerkbaar.

## Verification evidence

Zie PR: `tsc -b`, de volledige frontend-testsuite en de backendtests voor admin, participatie en migraties slagen; screenshots van donker, licht en mobiel zijn met de echte stylesheet gecontroleerd.
