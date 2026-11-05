# Title

Admin Bordrechten: rustiger overzicht van vergaderborden

## Context

In Admin > Bordrechten staan de kaarten onder "Vergaderborden beheren" slordig. De verwijderknop staat naast de titel en drukt de inhoud samen tot een smalle kolom. Daardoor breken titels, statuschips en hulpteksten per woord af.

## Goals / Non-goals

### Goals

- Titel en status bovenaan de kaart, met de status als kleine badge (Actief, Stil, Leeg).
- Laatste activiteit, toegang en aantal kaarten als nette label/waarde-rijen.
- Synchronisatiestatus en verwijderknop samen onderaan de kaart.
- De link "Nieuw vergaderbord aanmaken" in de huisstijl.

### Non-goals

- Geen wijziging in rechtenbeheer, filters of het verwijderen van borden.
- Geen API- of backendwijzigingen.

## Proposed approach

1. Kaartmarkup in `AdminBoardRightsPanel` opgesplitst in kop, `<dl>` met feiten en voet.
2. `boardRightsStatusLabel` geeft een korte statuslabel plus aparte activiteitstekst terug.
3. Toegangslabel ingekort tot "Alleen admins" of "N gebruikers".
4. CSS voor kaart, badge, feitenrijen en voet; minimale kaartbreedte 280px.

## Acceptance criteria

1. Op desktop en mobiel lopen titels, status en waarden zonder woord-voor-woord afbreken.
2. De verwijderknop blijft per kaart beschikbaar en werkt zoals voorheen.
3. Niet-opgeslagen rechten in de matrix blijven zichtbaar per kaart.

## Verification evidence

Zie PR: `tsc -b` en de volledige frontend-testsuite slagen; screenshots van donker, licht en mobiel zijn met de echte stylesheet gecontroleerd.
