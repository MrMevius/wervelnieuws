# Participatiemomenten

Een participatiemoment is een gesprek, een bijeenkomst of een communicatie-uiting richting de omgeving, ongeacht de lengte. Het register staat onder **Participatiemomenten** in de hoofdnavigatie en vormt de basis voor het participatieverslag (het participatielogboek). Het is geen urenregistratie: een tijdsduur is optioneel en er worden geen urenregels aangemaakt.

## Een moment vastleggen

Kies **Nieuw moment** en vul een onderwerp, datum en verslag in. Selecteer minimaal één uitvoerder (een teamlid met een account) en minimaal één project. Meerdere uitvoerders en projecten kunnen aan hetzelfde moment worden gekoppeld, zonder het moment te dupliceren.

Aanvullende velden, afgestemd op het participatielogboek:

- Soort: gesprek, bijeenkomst of communicatie-uiting (brief, krant, nieuwsbrief, website, sociale media).
- Doel: wat het moment moest opleveren. In het overzicht wordt het doel niet herhaald als het gelijk is aan het onderwerp.
- Participatieniveau: één of meer treden van de participatieladder: informeren, raadplegen, adviseren, coproduceren, meebeslissen.
- Kanaal: persoonlijk, telefoon, e-mail, videogesprek, bijeenkomst, brief, krant, online / sociale media of anders.
- Belanghebbenden: de persoon, organisatie of groep met wie contact was. Zij hoeven geen account te hebben.
- Opgehaalde informatie: vragen, zorgen, ideeën en reacties.
- Acties en vervolg: wat er met de opgehaalde informatie gebeurt, wie wat doet en wanneer.
- Verantwoording: uitnodiging verstuurd, voldoende geïnformeerd en terugkoppeling gegeven (ja, nee, n.v.t., met een optionele toelichting) en doelstelling bereikt (ja, deels, nee, nog niet, n.v.t.).
- Opmerkingen, locatie en duur in minuten: optioneel.

**Historisch moment.** Bij momenten uit de tijd vóór WindWilly is niet altijd bekend wie van het team het contact had. Vink dan **Historisch moment** aan; de uitvoerder mag dan leeg blijven en wordt getoond als "Onbekend (historisch moment)". Nieuwe momenten hebben altijd minimaal één uitvoerder.

Een compact overzicht toont onderwerp, datum, projecten, gesprekspartners en uitvoerders. Het volledige verslag staat in het zijpaneel. Op een telefoon gebruikt dit paneel het volledige scherm; opslaan en sluiten blijven bereikbaar. Bij sluiten met niet-opgeslagen wijzigingen wordt om bevestiging gevraagd.

## Terugzoeken en exporteren

Zoek op onderwerp, doel, verslag, opgehaalde informatie, acties, opmerkingen, belanghebbenden of locatie. Combineer dit met een inclusieve datumperiode, project, uitvoerder, soort, participatieniveau en/of doelstelling bereikt. Het overzicht toont maximaal 25 gesprekken per pagina, met de nieuwste gespreksdatum bovenaan.

**Export selectie** exporteert alle gesprekken die aan de huidige filters voldoen, niet alleen de zichtbare pagina:

- **CSV (Excel):** UTF-8 met BOM, puntkomma's, volledige verslagtekst en afspraken. Potentiële spreadsheetformules worden als tekst geëxporteerd.
- **Markdown:** één leesbaar participatieverslag met per gesprek alle inhoud, betrokkenen en projecten.
- **JSON:** gestructureerde gegevens met schema-versie (2 sinds de logboekvelden), exportdatum, filters en alle geselecteerde momenten.

Alle drie de formaten bevatten de logboekvelden: soort, doel, participatieniveau, opgehaalde informatie, verantwoording en opmerkingen.

Export uit **Gesprekken** bevat actieve momenten; export uit **Archief** bevat de gearchiveerde selectie. Voor meer dan 5.000 gesprekken wordt gevraagd de selectie te verkleinen. De export wordt op aanvraag gegenereerd en direct gedownload, niet als publiek bestand op de server bewaard. JSON-import wordt niet aangeboden.

Gespreksverslagen en exports kunnen persoonsgegevens bevatten. Leg alleen relevante informatie vast en deel gedownloade verslagen uitsluitend met de beoogde ontvangers.

## Toegang en betrouwbaarheid

- Beheerders hebben toegang tot alle momenten.
- Andere gebruikers hebben alleen lees- en exporttoegang wanneer zij toegang hebben tot **alle** gekoppelde projecten, volgens de bestaande projectuitnodigingen.
- Binnen die projecttoegang mogen de vastlegger, gekoppelde uitvoerders en beheerders een verslag wijzigen of archiveren. Andere lezers kunnen niet wijzigen.
- Nieuwe koppelingen vereisen actieve gebruikers en actieve, niet-gearchiveerde projecten die in Admin > Projecten zichtbaar zijn gezet voor Participatiemomenten. Bestaande historische koppelingen blijven behouden bij bewerken; een verborgen project blijft daarom zichtbaar bij momenten die er al aan gekoppeld zijn.
- Namen en bron-ID's worden bij de koppeling vastgelegd. Het hernoemen of verwijderen van een gebruiker/project wist geen historische verslaginhoud. Een moment met een verwijderd project is uitsluitend voor beheerders toegankelijk.
- Archiveren vereist bevestiging en is herstelbaar. Er is geen definitieve verwijderactie. Herstel een gearchiveerd moment voordat je het bewerkt.
- Opslaan gebruikt een versienummer. Bij een conflict blijft de ingevoerde tekst in het paneel staan en volgt een melding; er wordt niets overschreven. Kopieer zo nodig de eigen invoer voordat je het paneel opnieuw opent.
- Aanmaken, bewerken, archiveren en herstellen leggen een auditgebeurtenis met de voor/na-versie vast in dezelfde databasetransactie. Er is nog geen aparte versiegeschiedenis of terugzetknop in het participatiescherm.

## Techniek en uitrol

De module gebruikt `/api/participatiemomenten` voor lijst, detail, aanmaken, bewerken en archiveren; `/meta` levert de keuzelijsten en `/export` de export. Alle routes vereisen authenticatie.

Migratie `20261118_0037` voegt de logboekvelden en de markering voor historische momenten toe aan `participation_moments`, met lege standaardwaarden voor bestaande momenten. Een downgrade weigert zodra een moment deze velden gebruikt; herstel in dat geval een backup.

Migratie `20260909_0031` volgt op `20260909_0029` en voegt uitsluitend `participation_moments`, `participation_participants` en `participation_projects` toe. Bestaande vergaderborden, urenregels en projecten worden niet geconverteerd of verwijderd. Voer de migratie uit vóór het gebruiken van de module. Gebruik voor productie de backup- en uitrolprocedure in [Docker Compose operations](docker-compose-operations.md); een downgrade verwijdert de nieuwe participatietabellen inclusief hun inhoud en is geen herstelprocedure.

De regressietests staan in `backend/tests/test_participation_api.py` en `frontend/src/app/features/participation/ParticipationPage.test.tsx`. Ze gebruiken uitsluitend testgegevens en geïsoleerde databases of gemockte API-antwoorden.
