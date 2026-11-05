# Title

Admin Urenhistorie en identiteiten: overzichtelijke externe personen en historie

## Context

Op het tabblad Admin > Urenhistorie en identiteiten staan externe personen als een opsomming met vier even zware knoppen. "Herstel" staat ook bij actieve personen. Na archiveren of herstellen ververst de lijst niet, waardoor de status niet zichtbaar verandert. De historiefilters en de paginering lopen tegen elkaar aan.

## Goals / Non-goals

### Goals

- Dezelfde opbouw als de andere admin-tabbladen: kop met toelichting, tabel met naam (met notitie), e-mail, statusbadge en acties.
- Alleen passende acties per status: actief → Bewerk, Samenvoegen, Archiveer; gearchiveerd → Bewerk, Herstel.
- De lijst, de keuzelijsten en de historie verversen na bewerken, archiveren, herstellen en samenvoegen.
- Historiefilters in een nette filterbalk, de historie als tabel met type-badge, een lege staat en paginering met "Pagina X van Y".

### Non-goals

- Geen API- of backendwijzigingen.
- Het koppelen van een historische identiteit blijft aan de eerste beschikbare gebruiker gekoppeld, zoals voorheen.

## Acceptance criteria

1. Archiveren en herstellen tonen direct de nieuwe status zonder de pagina te herladen.
2. Alle bestaande acties en dialogen werken ongewijzigd.
3. Het tabblad is bruikbaar op mobiel.

## Verification evidence

Zie PR: `tsc -b` en de volledige frontend-testsuite slagen; screenshots van donker, licht en mobiel zijn met de echte stylesheet gecontroleerd.
