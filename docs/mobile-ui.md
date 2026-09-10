# Mobiele interface

De responsive laag staat in `frontend/src/responsive.css`, na de bestaande stijlen. De kleuren en Material Web-componenten blijven hetzelfde op desktop en mobiel.

## Indeling

- Tot en met 1100 px: compacte header met accountknop en een mobiel navigatievenster. Bordkeuze en overige modules werken door tikken. Het native dialoogvenster houdt de focus vast, sluit met Escape en herstelt de pagina na sluiten.
- Tot en met 760 px: formulieren staan onder elkaar, invoervelden gebruiken minimaal 16 px tekst en acties krijgen grotere aanraakvlakken. De gewone tabellen worden records met veldnamen. Sorteren en selecteren blijven mogelijk.
- De rechtenmatrix behoudt de vergelijking tussen gebruikers en borden, met een vastgezette gebruikerskolom en een eigen horizontaal scrollgebied.
- Het actieve vergaderbord vult de viewport. Op smallere schermen veeg je tussen de kolommen; iedere kaartlijst scrolt onafhankelijk van de kolomkop. De footer is op dit mobiele werkvlak verborgen om ruimte voor kaarten te houden; andere pagina's behouden de footer.
- Kaartdetails en het aanmaakpaneel vullen het telefoonscherm. De aanmaakknop blijft onderaan staan terwijl het formulier scrolt. Liggende telefoons krijgen een extra compacte bordbalk.
- Bij navigatie naar een andere pagina of een ander bord begint de pagina bovenaan. Schermuitsparingen worden meegenomen via safe-area-insets. Android-browsers die dit ondersteunen mogen de viewport bij een schermtoetsenbord verkleinen.

## Tabellen uitbreiden

Gebruik `ResponsiveTable` met `ResponsiveRow` voor normale gegevenslijsten. Kolomnamen komen uit de bestaande `thead` (tekst of `aria-label`); de rij koppelt die aan de cellen via `data-label`. Dit werkt ook voor afzonderlijke rijcomponenten via React-context. Er wordt geen tweede kopie van de formulieren of acties gerenderd. Samengevoegde cellen krijgen geen onjuiste veldnaam.

## Controle uitgevoerd

In de lokale browser gecontroleerd op 320, 390, 768, 844 (liggend) en 1280 px:

- Start, WindWilly, participatiemomenten, Wervelnieuws-overzicht, planning, een bestaand planningsdetail, bronbestanden, log, instellingen, About, changelog en scheduler.
- Urenregistratie en het mobiele aanmaakformulier.
- Alle negen beheertabs, inclusief de rechtenmatrix, AI-instellingen en urenbeheer.
- Vergaderbord, namenlijst, mobiele bordkeuze, kaartdetails en nieuw kaartpaneel; scrollgebieden en viewportgrenzen zijn gemeten.
- Mobiele navigatie opent en sluit, navigeert naar het gekozen bord en markeert alleen dat bord als actief.

De frontend-tests dekken daarnaast onder andere authenticatie, bestaande mutaties, kaartstatus, import/export, uploads, urenregistratie en de nieuwe navigatie- en tabelcomponenten. Externe services worden in tests gemockt.

Dit is een browsercontrole op verschillende viewportformaten, geen fysieke iOS-/Android-apparaattest. Camera, microfoon, werkelijk schermtoetsenbord en publicatie naar externe diensten zijn voor deze layoutwijziging niet opnieuw uitgevoerd.

Herhaal de checks na layoutwijzigingen: geen horizontale paginascroll, paginatitel onder de header, lange teksten/bestandsnamen blijven binnen hun container, sorteren en selecteren bereikbaar, opslaan/sluiten bereikbaar, en desktoplayout behouden. Controleer lange lijsten en een open toetsenbord ook op een echte telefoon.
