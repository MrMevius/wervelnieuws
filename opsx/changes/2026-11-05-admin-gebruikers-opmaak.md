# Title

Admin Gebruikers: subtieler aanmaken en compactere gebruikerslijst

## Context

Op Admin > Gebruikers neemt het formulier "Nieuwe gebruiker toevoegen" altijd een grote kaart boven de lijst in. De browser vult er bovendien de inloggegevens van de beheerder automatisch in. Naam en gebruikersnaam staan in twee aparte kolommen, vaak met "-".

## Goals / Non-goals

### Goals

- Aanmaken achter een rustige knop "+ Nieuwe gebruiker" die een compact formulier openklapt; na toevoegen klapt het weer dicht.
- Geen automatisch invullen van de eigen inloggegevens (`autocomplete="off"` en `new-password`).
- Eén kolom "Gebruiker" met initialen, volledige naam en gebruikersnaam; het aantal gebruikers bij de tabelkop.

### Non-goals

- Geen wijziging in de bewerkmodal, rechten of API.

## Acceptance criteria

1. Het aanmaakformulier is standaard dicht en opent of sluit met de knop.
2. Een gebruiker toevoegen werkt zoals voorheen; daarna sluit het formulier.
3. Het wachtwoordveld vraagt de browser om een nieuw wachtwoord in plaats van het opgeslagen wachtwoord.

## Verification evidence

Zie PR: `tsc -b` en de volledige frontend-testsuite slagen; screenshots van desktop (dicht en open) en mobiel zijn met de echte stylesheet gecontroleerd.
