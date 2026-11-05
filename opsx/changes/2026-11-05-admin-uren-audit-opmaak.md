# Title

Admin Uren-audit: leesbare tabel en bruikbare filters

## Context

Het tabblad Admin > Uren-audit toont auditregels als één lange opsomming met technische actienamen. De filters staan los tegen elkaar en vragen om exacte waarden, zoals een gebruikers-ID of `work_hours.group.created`.

## Goals / Non-goals

### Goals

- Dezelfde opbouw als de andere Admin-tabbladen: kop met toelichting, een filterkaart en een tabel.
- Kolommen Tijdstip, Door, Actie, Onderwerp, Request en Resultaat.
- Leesbare Nederlandse acties (bijv. "Urenregistratie aangemaakt"); de technische naam blijft als tooltip beschikbaar.
- Resultaat als badge (Gelukt, Geweigerd).
- Filters als keuzelijsten voor gebruiker, actie, resultaat en HTTP-methode, plus "Filters wissen".
- Paginering en paginagrootte onder de tabel, in dezelfde stijl als Urenhistorie.

### Non-goals

- Geen wijziging in de audit-API of in welke gebeurtenissen gelogd worden.

## Proposed approach

`WorkHoursAuditAdminTab` in `WorkHoursAdminTabs.tsx` herschreven met `ResponsiveTable` en bestaande admin-klassen. De gebruikerslijst komt uit de bestaande uren-meta (`eligible_users`), aangevuld met actoren uit de getoonde regels. Nieuwe CSS-klassen `admin-audit-*` in `styles.css`.

## Acceptance criteria

1. Filters sturen dezelfde parameters naar `/api/urenverantwoording/audit` als voorheen.
2. Onbekende acties of resultaten worden ongewijzigd getoond.
3. De pagina blijft bruikbaar op mobiel.

## Verification evidence

Zie PR: `tsc -b` en de volledige frontend-testsuite slagen; screenshots van donker, licht en mobiel zijn met de echte stylesheet gecontroleerd.
