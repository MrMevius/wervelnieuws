import json

from fastapi import APIRouter, Depends
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.entities import SystemSetting, User
from app.schemas.meta import AboutResponse, UiSettingsResponse

router = APIRouter(prefix="/meta", tags=["meta"])

ABOUT_SETTING_KEY = "about_page_content"
UI_SETTINGS_KEY = "admin_ui_settings_v1"
DEFAULT_UI_SETTINGS = {"wind_theme_enabled": True}


def _default_about() -> AboutResponse:
    return AboutResponse(
        description=(
            "Wervelnieuws helpt je team om nieuws over het windpark voor te bereiden, "
            "in te plannen en te publiceren."
        ),
        disclaimer=(
            "Controleer teksten en feiten altijd nog even voordat je publiceert."
        ),
        developed_by="Energiek Daarle",
        changelog=[
            {
                "version": "0.35.1",
                "date": "2026-11-18",
                "title": "Compact overzicht van participatiemomenten",
                "highlights": [
                    "Participatiemomenten staan op één regel per moment, gegroepeerd per maand met het aantal momenten, zoals in de urenregistratie.",
                    "Uitvoerders verschijnen als profielfoto; aanwijzen toont alle namen.",
                    "De kop telt de momenten per soort over de hele selectie; kies 25, 50 of 100 momenten per pagina.",
                ],
            },
            {
                "version": "0.35.0",
                "date": "2026-11-18",
                "title": "Participatiemomenten volgen het participatielogboek",
                "highlights": [
                    "Leg naast gesprekken ook bijeenkomsten en communicatie-uitingen vast, zoals brieven, krantenberichten en nieuwsbrieven.",
                    "Per moment noteer je het doel, het participatieniveau, de opgehaalde informatie en de verantwoording: uitnodiging, geïnformeerd, terugkoppeling en of het doel is bereikt.",
                    "Filter op soort, participatieniveau en doelstelling; de exports bevatten alle logboekvelden voor het participatieverslag.",
                    "Historische momenten mogen zonder bekende uitvoerder worden vastgelegd.",
                ],
            },
            {
                "version": "0.34.5",
                "date": "2026-11-18",
                "title": "Profielfoto's van aanwezigen in de urenregistratie",
                "highlights": [
                    "Bij elke registratie zie je de profielfoto's van wie er aanwezig was; zonder foto staan de initialen er.",
                    "Ga met de muis over de foto's of tik erop om de volledige namenlijst van de aanwezigen te zien.",
                ],
            },
            {
                "version": "0.34.4",
                "date": "2026-11-18",
                "title": "Compactere urenregistratie, gegroepeerd per maand",
                "highlights": [
                    "Elke registratie staat op één regel, zodat je ongeveer drie keer zoveel uren in één oogopslag ziet.",
                    "Registraties staan per maand bij elkaar, met per maand het aantal registraties en de persoon-uren over je hele selectie.",
                    "Het totaal staat naast de titel en bewerken en verwijderen zijn kleine knoppen aan het eind van de regel.",
                ],
            },
            {
                "version": "0.34.3",
                "date": "2026-11-18",
                "title": "Vergaderborden verversen automatisch",
                "highlights": [
                    "Kaarten die een ander toevoegt, verplaatst of aanpast verschijnen binnen enkele seconden op je scherm, zonder de pagina te herladen.",
                    "Ook een geopend kaartje toont nieuwe updates, opnames en bijlagen van anderen vanzelf.",
                    "Grote vergaderborden laden merkbaar sneller.",
                ],
            },
            {
                "version": "0.34.2",
                "date": "2026-11-18",
                "title": "Samenvattingen van opnames houden rekening met bijlagen",
                "highlights": [
                    "Bij het samenvatten van een opname leest de AI ook de bijlagen van het kaartje mee, zoals Word-, Excel-, pdf- en tekstbestanden.",
                    "Namen, termen en verwijzingen naar documenten worden daardoor beter geschreven. De samenvatting blijft gaan over wat er in de opname is gezegd.",
                    "Van afbeeldingen en andere bestanden wordt alleen de bestandsnaam gebruikt.",
                ],
            },
            {
                "version": "0.34.1",
                "date": "2026-11-17",
                "title": "Nederlandse wijzigingsgeschiedenis met duidelijke versienummers",
                "highlights": [
                    "Via de link Wijzigingen in de voettekst bekijk je vanuit elke pagina wat er is verbeterd.",
                    "Ook eerdere wijzigingen hebben nu een versienummer: grotere uitbreidingen krijgen een nieuwe tussenversie, kleine verbeteringen een nieuw laatste nummer.",
                    "De wijzigingsgeschiedenis is volledig in het Nederlands en toont de nieuwste versies bovenaan.",
                ],
            },
            {
                "version": "0.34.0",
                "date": "2026-11-17",
                "title": "Opnames worden verder verwerkt nadat je het kaartje sluit",
                "highlights": [
                    "Na het uploaden worden opnames op de achtergrond uitgeschreven, samengevat en geplaatst. Op het kaartje zie je de voortgang.",
                    "Je kunt een mislukte upload of verwerking opnieuw proberen zonder dubbele opname-updates te maken.",
                    "Het aantal opsommingspunten past bij de inhoud van de opname, zonder vaste grens van acht punten.",
                ],
            },
            {
                "version": "0.33.7",
                "date": "2026-11-17",
                "title": "Opnames worden automatisch als kaartupdate geplaatst",
                "highlights": [
                    "Na het stoppen van een opname worden de tekst en het geluid automatisch samen als kaartupdate geplaatst.",
                    "Je kunt de tekst achteraf aanpassen met de bewerkknop. Je concept voor een nieuwe update blijft behouden.",
                ],
            },
            {
                "version": "0.33.6",
                "date": "2026-11-09",
                "title": "Betrouwbaardere controle van de bereikbaarheid van WindWilly",
                "highlights": [
                    "Het statusoverzicht controleert WindWilly via de website, zodat een afgeschermde interne verbinding niet meer onterecht als storing wordt gemeld.",
                ],
            },
            {
                "version": "0.33.5",
                "date": "2026-11-06",
                "title": "Vergaderborden zijn overzichtelijker",
                "highlights": [
                    "Elke kolom laat zien hoeveel kaarten erin staan; een lege kolom vertelt wat je ermee kunt.",
                    "Kaarten tonen naast updates en opnames ook het aantal bijlagen en wanneer er voor het laatst iets gebeurde. Kaarten in Bezig die drie weken stil liggen vallen op.",
                    "Een volle Klaar-kolom toont alleen de recentste kaarten en stelt voor om kaarten die al een maand stil zijn te archiveren.",
                    "De filters Mijn kaarten en Urgent zijn duidelijke knoppen geworden en Import & export zit onder het menu met de drie puntjes.",
                    "Via de bordnaam bovenaan wissel je direct naar een ander bord.",
                ],
            },
            {
                "version": "0.33.4",
                "date": "2026-11-06",
                "title": "Inloggen gaat soepeler en veiliger",
                "highlights": [
                    "Open je een link terwijl je niet bent ingelogd, dan kom je na het inloggen direct op die pagina terecht.",
                    "Ben je al ingelogd, dan zie je bij het openen niet meer kort het inlogscherm voorbijflitsen.",
                    "Is je sessie verlopen, dan zegt het inlogscherm dat; staat Caps Lock aan, dan krijg je een seintje bij het wachtwoord.",
                    "Na tien mislukte pogingen voor dezelfde gebruikersnaam is inloggen voor die naam een kwartier geblokkeerd. Kom je er niet uit, dan kan een beheerder je wachtwoord opnieuw instellen.",
                    "Het logo en de lettertypes worden nu door WindWilly zelf geleverd, zodat alles er overal hetzelfde uitziet.",
                ],
            },
            {
                "version": "0.33.3",
                "date": "2026-11-06",
                "title": "Een vriendelijker inlogscherm",
                "highlights": [
                    "Het inlogscherm toont het logo van Groene Noabers en heet je welkom bij WindWilly, met een korte uitleg waar de werkplek voor is.",
                    "De velden hebben vaste labels en met het oogje zie je wat je als wachtwoord hebt getypt.",
                    "Lukt inloggen niet, dan lees je waarom: een verkeerd wachtwoord, te veel pogingen of een server die even niet bereikbaar is.",
                    "Op de achtergrond draaien rustig een paar windmolens in het landschap, in een lichte en een donkere uitvoering en ook netjes op je telefoon.",
                ],
            },
            {
                "version": "0.33.2",
                "date": "2026-11-05",
                "title": "Een nieuwe startpagina",
                "highlights": [
                    "De startpagina opent met de slogan \"Wij draaien mee\" en laat in één oogopslag zien wat je in WindWilly kunt doen, met een directe link naar elk onderdeel.",
                    "Je leest wie er achter WindWilly zitten: Energiek Daarle, Duurzaam Daarlerveen en Noaber & Co, met een link naar hun eigen website.",
                    "Groene Noabers, de samenwerking van de drie coöperaties, heeft een eigen plek op de pagina, met uitleg over het mede-eigendom van Energiepark Daarle.",
                ],
            },
            {
                "version": "0.33.1",
                "date": "2026-11-05",
                "title": "Admin is overzichtelijker",
                "highlights": [
                    "Bordrechten, Projecten, Gebruikers, Urenhistorie en Uren-audit hebben een rustigere opmaak met duidelijke statuslabels en knoppen.",
                    "Per project kies je nu ook of het zichtbaar is bij Participatiemomenten.",
                    "Een nieuwe gebruiker maak je aan via een compact formulier, zonder dat de browser je eigen inloggegevens invult.",
                    "Het Admin log en de Uren-audit tonen acties in gewone taal; herhaalde acties staan samen op één regel en je filtert met keuzelijsten.",
                ],
            },
            {
                "version": "0.33.0",
                "date": "2026-10-31",
                "title": "Opnames worden samengevat in de update",
                "highlights": [
                    "Een audio-opname bij een kaartje wordt nu getranscribeerd en samengevat in korte bullets met afspraken en actiepunten.",
                    "De samenvatting gebruikt eerdere updates en de andere kaartjes op het bord om namen en verwijzingen goed te krijgen, zonder er feiten bij te verzinnen.",
                    "De opname staat samen met de samenvatting in één update; de volledige transcriptie is daar uit te klappen. Je controleert de tekst voordat je de update plaatst.",
                ],
            },
            {
                "version": "0.32.1",
                "date": "2026-10-31",
                "title": "Transcripties blijven bij de opname bewaard",
                "highlights": [
                    "De uitgeschreven tekst van een audio-opname wordt nu bij de opname zelf bewaard en is onder de opname uit te klappen.",
                    "Opnames zijn daardoor ook te vinden met de zoekfunctie van het bord.",
                    "Lukt een transcriptie niet, dan kun je het opnieuw proberen. Oudere opnames krijgen automatisch alsnog een transcriptie.",
                ],
            },
            {
                "version": "0.32.0",
                "date": "2026-10-31",
                "title": "Snel zoeken op een vergaderbord",
                "highlights": [
                    "Met één zoekveld boven het bord vind je kaartjes op titel, beschrijving, updates, opnametranscripties en bijlagenamen.",
                    "Titels en beschrijvingen filteren direct tijdens het typen; treffers in updates verschijnen een moment later.",
                    "Je ziet hoeveel kaartjes er gevonden zijn. Met Esc of 'Wis filters' zie je weer het hele bord.",
                ],
            },
            {
                "version": "0.31.4",
                "date": "2026-10-31",
                "title": "Nieuwe kaartjes bovenaan de kolom",
                "highlights": [
                    "Een nieuw kaartje op een vergaderbord verschijnt nu bovenaan de kolom, zodat je het direct ziet.",
                    "De volgorde van de bestaande kaartjes blijft daaronder gelijk.",
                ],
            },
            {
                "version": "0.31.3",
                "date": "2026-10-31",
                "title": "Profielfoto's zichtbaar voor alle bordleden",
                "highlights": [
                    "Op vergaderborden zie je nu de profielfoto's van teamleden, ook als je geen beheerder bent.",
                ],
            },
            {
                "version": "0.31.2",
                "date": "2026-10-31",
                "title": "Klikbare links in vergaderbordkaartjes",
                "highlights": [
                    "Webadressen in kaartbeschrijvingen en updates zijn nu klikbare links en openen in een nieuw tabblad.",
                    "Links uit een Trello-import werken ook, en klikken op een link opent niet meer per ongeluk de bewerkmodus.",
                ],
            },
            {
                "version": "0.31.1",
                "date": "2026-10-31",
                "title": "Zien wie een kaartje heeft aangemaakt",
                "highlights": [
                    "In het kaartdetail van een vergaderbord staat nu wie het kaartje heeft aangemaakt en wanneer.",
                    "Voor bestaande kaartjes is de maker waar mogelijk teruggezocht in de activiteitenhistorie.",
                    "Kaartjes uit een Trello-import zijn herkenbaar als geïmporteerd; als de maker niet meer te achterhalen is, staat dat er eerlijk bij.",
                ],
            },
            {
                "version": "0.31.0",
                "date": "2026-09-10",
                "title": "Urenregistratie met een helder overzicht en los formulier",
                "highlights": [
                    "Registreer in een apart, mobielvriendelijk venster met datum, begintijd, één project en één of meer personen. Een post is optioneel.",
                    "Voer een exacte duur in minuten of uren in, gebruik snelkeuzes en zie direct de totale persoon-uren.",
                    "Zoek en filter het compacte overzicht; exporteer de volledige selectie met begintijden en exacte minuten naar CSV.",
                    "Bestaande uren zijn zonder afronding omgezet. Historische deelnemers blijven behouden en niet-opgeslagen invoer wordt beschermd.",
                ],
            },
            {
                "version": "0.30.0",
                "date": "2026-09-09",
                "title": "Participatiegesprekken vastleggen en exporteren",
                "highlights": [
                    "Leg korte en lange gesprekken vast met meerdere uitvoerders en projecten, gesprekspartners, een verslag en afspraken. Een tijdsduur is niet verplicht.",
                    "Zoek op inhoud en filter op periode, project of uitvoerder. Bekijk en bewerk het volledige verslag in een mobielvriendelijk zijpaneel.",
                    "Exporteer de hele selectie als CSV voor Excel, Markdown voor verslaglegging of JSON met alle gegevens.",
                    "Projecttoegang beschermt de verslagen. Archiveren is herstelbaar en versiecontrole voorkomt dat gelijktijdige wijzigingen elkaar ongemerkt overschrijven.",
                ],
            },
            {
                "version": "0.29.0",
                "date": "2026-09-09",
                "title": "Veiliger inloggen en betrouwbaardere verwerking",
                "highlights": [
                    "Uitgeschakelde accounts verliezen toegang en oude sessies worden ongeldig na een wachtwoordwijziging; onthouden sessies verlopen ook op de server.",
                    "Inloggen bevat geen vooraf ingevuld wachtwoord en gevoelige invoer verschijnt niet meer in validatiefouten.",
                    "Nieuwsvoorbeelden en tekstvelden behouden opmaak, maar filteren onveilige HTML bij het weergeven en plakken.",
                    "Uploads worden begrensd en transcriptie blokkeert andere API-verzoeken niet tijdens het wachten.",
                    "Een mislukte herindexering bewaart de eerdere bronindex; productie-instellingen en databasecontroles zijn aangescherpt.",
                ],
            },
            {
                "version": "0.28.0",
                "date": "2026-09-09",
                "title": "De hele applicatie beter bruikbaar op mobiel",
                "highlights": [
                    "Een compact mobiel menu geeft toegang tot alle modules en vergaderborden, zonder hover of bedekte paginatitels.",
                    "Veeg tussen kaartkolommen en scrol per kolom; kaartdetails en nieuwe kaarten benutten het volledige telefoonscherm.",
                    "Planning, bronbestanden en beheertabellen tonen op telefoons overzichtelijke records met veldnamen en bereikbare acties.",
                    "Formulieren, filters en pop-ups passen op smalle schermen, met grotere aanraakvlakken en ruimte rond opslaan en sluiten.",
                ],
            },
            {
                "version": "0.27.22",
                "date": "2026-09-09",
                "title": "Namen van bordleden duidelijk zichtbaar bij hover",
                "highlights": [
                    "Namen verschijnen direct in een los paneeltje, zonder te worden afgeknipt door de avatar.",
                    "De +badge toont overige bordleden onder elkaar; de namen zijn ook met het toetsenbord te bekijken.",
                ],
            },
            {
                "version": "0.27.21",
                "date": "2026-09-09",
                "title": "Update-opnames stoppen en opslaan betrouwbaarder",
                "highlights": [
                    "De opnameknop wacht nu op de laatste audiochunk voordat de opname wordt opgeslagen en getranscribeerd.",
                    "Lege opnames worden afgewezen en uploadfouten tonen een duidelijke melding zonder transcriptie te starten.",
                ],
            },
            {
                "version": "0.27.20",
                "date": "2026-09-09",
                "title": "Teamleden wijzigen op bestaande kaartjes",
                "highlights": [
                    "Onder de kaarttitel kun je via Teamleden betrokkenen toevoegen en verwijderen.",
                    "Na opslaan worden de avatars en het filter Mijn kaarten direct bijgewerkt.",
                ],
            },
            {
                "version": "0.27.19",
                "date": "2026-09-09",
                "title": "Kaartpopup met heldere kolommen en goed uitgelijnde knoppen",
                "highlights": [
                    "Een compacte actiebalk met sluitkruis blijft bovenaan; titel, beschrijving en bijlagen staan links, updates rechts.",
                    "Beide kolommen scrollen zelfstandig en op kleine schermen staan ze netjes onder elkaar.",
                    "Material-knoppen hebben consistente afmetingen en iconen naast hun tekst; opnemen en plaatsen staan op één regel.",
                ],
            },
            {
                "version": "0.27.18",
                "date": "2026-09-09",
                "title": "Kaartdetails krijgen een rustigere indeling",
                "highlights": [
                    "Beschrijving en bijlagen staan op een rustig werkvlak naast reacties met herkenbare tekstballonnen.",
                    "Kaartacties, opnemen en updates plaatsen gebruiken nu Material-knoppen.",
                ],
            },
            {
                "version": "0.27.17",
                "date": "2026-09-09",
                "title": "Kolomkoppen blijven zichtbaar tijdens het scrollen",
                "highlights": [
                    "De kolomtitel en Kaart toevoegen staan compact naast elkaar.",
                    "Op het schermvullende bord scrol je alleen door de kaarten; de kolomkop blijft staan.",
                ],
            },
            {
                "version": "0.27.16",
                "date": "2026-09-09",
                "title": "Trello-import kiest nu eerst je kolommen",
                "highlights": [
                    "Na het kiezen van een Trello-export zie je alle gevonden kolommen met het aantal kaarten en hun bestemming op het vergaderbord.",
                    "Vink alleen de kolommen aan die je wilt meenemen; niet-geselecteerde kaarten worden niet geïmporteerd en staan apart in het overzicht.",
                ],
            },
            {
                "version": "0.27.15",
                "date": "2026-09-09",
                "title": "Bordkop geeft meer ruimte aan je kaarten",
                "highlights": [
                    "De bordtitel en filters sluiten nu compact aan onder de hoofdnavigatie, zodat er meer kaarten tegelijk in beeld zijn.",
                    "Beweeg over een avatar voor de naam; de +badge toont direct de volledige lijst met overige bordleden.",
                ],
            },
            {
                "version": "0.27.14",
                "date": "2026-09-09",
                "title": "Vergaderbord gebruikt een consistente Material-knopset",
                "highlights": [
                    "De belangrijkste acties op het vergaderbord gebruiken nu één herkenbare set Material-knoppen.",
                    "Primaire, secundaire, geselecteerde en destructieve acties volgen dezelfde Groene Noabers-kleuren en duidelijke interactiestaten.",
                ],
            },
            {
                "version": "0.27.13",
                "date": "2026-09-09",
                "title": "Vergaderbord scrolt nu per statuskolom",
                "highlights": [
                    "Op een ruim scherm blijft het vergaderbord als één werkvlak staan; de pagina zelf scrolt niet meer tijdens het werken op het bord.",
                    "Te doen, Bezig en Klaar benutten de beschikbare schermhoogte en hebben elk een eigen kaartlijst die kan scrollen.",
                ],
            },
            {
                "version": "0.27.12",
                "date": "2026-09-09",
                "title": "Vergaderbord veilig leegmaken voor een nieuwe import",
                "highlights": [
                    "Import & export heeft nu een duidelijke rode zone om de inhoud van een bord in één keer leeg te maken.",
                    "Na een extra bevestiging worden actieve én gearchiveerde kaarten naar de prullenbak verplaatst, zodat een beheerder ze kan herstellen.",
                ],
            },
            {
                "version": "0.27.11",
                "date": "2026-08-13",
                "title": "Nieuwe urenregistraties gebruiken alleen WindWilly-personen",
                "highlights": [
                    "Externe personen zijn niet meer te kiezen voor een nieuwe urenregistratie.",
                    "Bestaande registraties met externe deelnemers blijven zichtbaar en kunnen zonder deelnemerswijziging worden bijgewerkt.",
                ],
            },
            {
                "version": "0.27.10",
                "date": "2026-08-13",
                "title": "Urenregistratie toont een rustiger overzicht",
                "highlights": [
                    "De urenlijst heeft nu vaste kolomkoppen en toont de nieuwste werkdatum eerst, zonder filtermenu's.",
                    "CSV export staat direct bij de paginering onder de lijst en de invoerrij op desktop leest rustiger door gelijk hoge velden.",
                ],
            },
            {
                "version": "0.27.9",
                "date": "2026-08-13",
                "title": "Urenregistratie benut ruimte beter",
                "highlights": [
                    "Projecttotalen staan naast de urenlijst en blijven op ruime schermen zichtbaar tijdens scrollen.",
                    "De urenlijst staat standaard op nieuwste datum eerst; de compacte paginering staat direct onder de tabel.",
                ],
            },
            {
                "version": "0.27.8",
                "date": "2026-08-12",
                "title": "Urenregistratie is directer en overzichtelijker",
                "highlights": [
                    "Projecttotalen blijven op ruime schermen zichtbaar terwijl je door registraties scrolt.",
                    "Open Deelnemer(s) om deelnemers direct in één zwevende kiezer te kiezen; na selectie toont dezelfde knop het aantal en externe personen voeg je veilig toe via Admin.",
                    "Datums tonen overal dezelfde dag-maand-jaarweergave en uren kies je tussen een half en acht uur.",
                ],
            },
            {
                "version": "0.27.7",
                "date": "2026-08-12",
                "title": "Urenregistratie toont totalen per project",
                "highlights": [
                    "Bovenaan Urenregistratie zie je nu per project de totale persoon-uren van alle deelnemers, ook wanneer er meerdere pagina's met registraties zijn.",
                ],
            },
            {
                "version": "0.27.6",
                "date": "2026-08-12",
                "title": "Urenhistorie staat overzichtelijk bij Admin",
                "highlights": [
                    "Urenhistorie, identiteiten en de uren-audit staan nu als eigen onderdelen bij Admin, terwijl de dagelijkse urenregistratie overzichtelijk blijft.",
                    "Het bewerken en samenvoegen van externe personen blijft daarbij volledig toegankelijk met toetsenbord en schermlezer.",
                ],
            },
            {
                "version": "0.27.5",
                "date": "2026-08-12",
                "title": "Wervelnieuws start betrouwbaarder na onderhoud",
                "highlights": [
                    "De onderdelen voor website, beheer en achtergrondwerk starten voortaan apart en blijven daardoor beter beschikbaar na gewoon onderhoud.",
                    "Technisch onderhoud aan de database gebeurt nu bewust als aparte release-stap, zodat een normale herstart geen onverwachte wijziging uitvoert.",
                ],
            },
            {
                "version": "0.27.4",
                "date": "2026-08-12",
                "title": "Urenregistratie kiest deelnemers en duur duidelijker",
                "highlights": [
                    "WindWilly-personen en externe personen staan nu in aparte keuzelijsten, zodat je deelnemers sneller kunt controleren en aanpassen.",
                    "De duur kies je nu direct in duidelijke stappen van een half uur, terwijl de compacte registratie op mobiel en desktop bruikbaar blijft.",
                ],
            },
            {
                "version": "0.27.2",
                "date": "2026-08-11",
                "title": "Topicbronnen ondersteunen nu veilige audio-transcriptie",
                "highlights": [
                    "Je kunt een geldige WebM-audio-opname als topicbron toevoegen; de opname wordt daarna veilig verwerkt tot een doorzoekbare tekstbron.",
                    "Bestanden die niet aan de audiocontroles voldoen, worden direct afgewezen zodat alleen bruikbare opnames verdergaan.",
                ],
            },
            {
                "version": "0.27.1",
                "date": "2026-08-10",
                "title": "Admin-fouten zijn duidelijker per onderdeel",
                "highlights": [
                    "Beheerders zien nu welk onderdeel van Admin niet geladen kan worden en kunnen alleen dat onderdeel opnieuw proberen.",
                    "Andere beschikbare beheeronderdelen blijven ondertussen bruikbaar.",
                ],
            },
            {
                "version": "0.27.0",
                "date": "2026-08-10",
                "title": "Projecten zijn per module in te stellen",
                "highlights": [
                    "Beheerders kiezen nu per project of het beschikbaar is in Vergaderborden, Urenregistratie of beide.",
                    "Beschrijvingen bij urenposten hebben meer ruimte voor langere, overzichtelijke teksten.",
                ],
            },
            {
                "version": "0.26.1",
                "date": "2026-08-10",
                "title": "Urenregistratie is eenvoudiger en gebruikt normale systeemback-ups",
                "highlights": [
                    "De aparte JSON-import en -back-up voor uren is verwijderd; CSV-export en het afzonderlijk herstellen van verwijderde registraties en externe personen blijven beschikbaar.",
                    "Beheerders beveiligen de volledige installatie voortaan met de normale database- en storageback-up.",
                ],
            },
            {
                "version": "0.26.0",
                "date": "2026-08-09",
                "title": "Uren sneller registreren met centraal project- en postenbeheer",
                "highlights": [
                    "Registreer uren direct in de compacte bovenste tabelrij, filter vanuit de kolomkoppen en beheer projecten en globale posten voortaan centraal in Admin.",
                ],
            },
            {
                "version": "0.25.2",
                "date": "2026-08-04",
                "title": "Urenregistratie maakt audit en historie beter inzichtelijk",
                "highlights": [
                    "Audits zijn beter doorzoekbaar en gepagineerd, en urenoverzichten tonen datums consequent in Nederlandse notatie.",
                ],
            },
            {
                "version": "0.25.1",
                "date": "2026-08-04",
                "title": "Urenregistratie beschermt historie en persoonsgegevens beter",
                "highlights": [
                    "CSV-export, individueel herstel en samenvoegen volgen strikte controles, terwijl historische namen intact blijven en modals beter met toetsenbord en schermlezer werken.",
                ],
            },
            {
                "version": "0.25.0",
                "date": "2026-08-04",
                "title": "Urenregistratie is veiliger en beter controleerbaar",
                "highlights": [
                    "Deelnemers worden bij aanmaken en bewerken volledig gecontroleerd voordat gegevens worden opgeslagen.",
                    "De personenkeuze bevat alle actieve WindWilly-gebruikers en externe personen, met historische deelnemers alleen-lezen.",
                    "Beheerders kunnen het uren-auditlog gerichter filteren.",
                    "Individueel herstel, gelijktijdig bewerken en totalen zijn extra beveiligd, terwijl mobiel gebruik en toetsenbordbediening toegankelijker zijn.",
                ],
            },
            {
                "version": "0.24.0",
                "date": "2026-07-29",
                "title": "Vergaderbord-kaarten krijgen archief en prullenbak",
                "highlights": [
                    "Kaarten op vergaderborden kunnen nu worden gearchiveerd en later weer teruggezet via een aparte archieftab.",
                    "Soft-verwijderde kaarten verdwijnen uit het bord en komen in een centrale admin-prullenbak terecht, zonder harde database-delete.",
                    "De kaartdata, posities en historie blijven bewaard, met auditlogs voor archiveren, herstellen en verwijderen.",
                ],
            },
            {
                "version": "0.23.4",
                "date": "2026-07-29",
                "title": "Lichtmodusknoppen en invoervelden zijn duidelijker",
                "highlights": [
                    "De knoppen in het vergaderbord-detail zijn nu beter zichtbaar in lichte weergave, inclusief sluit-, upload- en actieknoppen.",
                    "Invoervelden, statuslabels en modals gebruiken rustiger oppervlaktes en duidelijkere contrasten zonder de workflow te veranderen.",
                    "De interface blijft hetzelfde in opbouw, maar lichtmodus is nu minder gevoelig voor contrastregressies.",
                ],
            },
            {
                "version": "0.23.3",
                "date": "2026-07-28",
                "title": "Gebruikersvenster leest rustiger in donkere modus",
                "highlights": [
                    "Het hoofdvenster voor gebruikersbeheer gebruikt nu neutralere charcoal-vlakken in plaats van sterke paarstinten.",
                    "Knoppen, invoervelden en actieblokken vallen duidelijker op, terwijl de indeling hetzelfde blijft.",
                    "De kleuren zijn beter afgestemd op leesbaarheid in donkere weergave zonder andere vensters te raken.",
                ],
            },
            {
                "version": "0.23.2",
                "date": "2026-07-28",
                "title": "Vergaderborden krijgen een duidelijke paarse stijl",
                "highlights": [
                    "Vergaderbordkolommen, knoppen, badges en focusstates hebben nu een herkenbare paarse accentkleur.",
                    "De rest van de interface blijft rustig en goed leesbaar, ook in donkere weergave.",
                    "Modals en overlays sluiten nu visueel aan op de paarse bordstijl zonder dat je werkwijze verandert.",
                ],
            },
            {
                "version": "0.23.1",
                "date": "2026-07-01",
                "title": "Vergaderbord-updates tonen de opmaaktoolbar pas bij focus",
                "highlights": [
                    "Bij een nieuwe update blijft de opmaaktoolbar eerst uit beeld totdat je in het tekstvak klikt of focus geeft.",
                    "Dezelfde rustiger focuservaring geldt nu ook voor het bewerken van een bestaande update.",
                    "De beschrijving-editor in kaartdetail blijft werken zoals je gewend bent en toont de toolbar nog steeds direct.",
                ],
            },
            {
                "version": "0.22.5",
                "date": "2026-06-22",
                "title": "Meerdere bijlagen tegelijk toevoegen in Vergaderborden",
                "highlights": [
                    "Je kunt nu meerdere bestanden in één keer kiezen of slepen bij een vergaderbord-kaart.",
                    "De uploadknop verwerkt de selectie achter elkaar, zodat je niet elk bestand los hoeft toe te voegen.",
                    "Als niet alles lukt, zie je duidelijk welke bestanden wel en niet zijn gelukt.",
                ],
            },
            {
                "version": "0.22.4",
                "date": "2026-06-22",
                "title": "Afbeeldingsbijlagen kun je nu groter bekijken",
                "highlights": [
                    "Afbeeldingsbijlagen tonen nu een klikbare preview in de bijlagenlijst.",
                    "Klikken opent een groter venster dat netjes binnen het scherm past.",
                    "Sluiten blijft eenvoudig via de knop, de achtergrond of Escape.",
                ],
            },
            {
                "version": "0.22.3",
                "date": "2026-06-17",
                "title": "Vergaderbord-kaartdetail voelt rustiger en overzichtelijker",
                "highlights": [
                    "Het kaartdetail heeft nu duidelijkere secties voor titel, beschrijving, update-invoer, bijlagen en geschiedenis.",
                    "Bijlagen zijn makkelijker te uploaden met een drag-and-drop zone en duidelijkere download- en verwijderknoppen.",
                    "De updategeschiedenis is compacter en beter scanbaar, terwijl de editor en sluitknop rustiger in de modal zijn geïntegreerd.",
                ],
            },
            {
                "version": "0.22.2",
                "date": "2026-06-17",
                "title": "Vergaderbord-kaarten kun je nu binnen dezelfde kolom herschikken",
                "highlights": [
                    "Kaarten kunnen nu omhoog en omlaag worden gesleept binnen dezelfde kolom, met een duidelijke invoegindicator tijdens het slepen.",
                    "Droppen onderaan een volle kolom plaatst een kaart nu echt als laatste, ook als je vanuit een andere kolom verplaatst.",
                    "De nieuwe volgorde blijft bewaard na verversen, zodat je bordindeling niet verloren gaat.",
                    "Verplaatsen naar een andere kolom blijft gewoon werken zoals je gewend bent.",
                ],
            },
            {
                "version": "0.22.1",
                "date": "2026-06-17",
                "title": "Bijlagen direct toevoegen bij nieuwe vergaderbord-kaarten",
                "highlights": [
                    "Bij een nieuwe vergaderbord-kaart kun je nu meteen meerdere bestanden kiezen voordat je opslaat.",
                    "Na het aanmaken worden de gekozen bijlagen automatisch gekoppeld aan de kaart.",
                    "Als een upload mislukt, blijft de kaart bestaan en zie je daar een duidelijke melding over.",
                ],
            },
            {
                "version": "0.22.0",
                "date": "2026-06-16",
                "title": "Vergaderbord-kaarten ondersteunen nu bijlagen",
                "highlights": [
                    "Op toegankelijke vergaderbord-kaarten kun je nu bestanden uploaden als bijlage, direct in het kaartdetail.",
                    "Bijlagen zijn zichtbaar in een duidelijke lijst met download- en verwijderacties, en volgen dezelfde bordtoegang als de kaart zelf.",
                    "De nieuwe bijlagefunctionaliteit gebruikt lokale opslag en heeft backend- en frontenddekking voor de belangrijkste CRUD- en permissieflows.",
                ],
            },
            {
                "version": "0.21.17",
                "date": "2026-06-16",
                "title": "Teamleden op vergaderbord-kaarten volgen nu bordtoegang",
                "highlights": [
                    "De Teamleden-selector gebruikt nu de gebruikers die toegang hebben tot het actuele vergaderbord, zodat ook uitgenodigde niet-admins gewoon kunnen selecteren.",
                    "Als teamleden nog laden, niet beschikbaar zijn of er geen actieve bordgebruikers zijn, zie je nu een duidelijke melding in plaats van een leeg vak.",
                    "Alleen actieve en toegestane bordgebruikers kunnen nog aan een kaart worden toegewezen, waardoor foutieve toewijzingen direct worden tegengehouden.",
                ],
            },
            {
                "version": "0.21.16",
                "date": "2026-06-13",
                "title": "Automatische verplaats-updates zijn nu alleen informatief",
                "highlights": [
                    "Kaartverplaatsingen in de kaartmodal tonen voortaan geen bewerk- of verwijderknoppen meer.",
                    "Hierdoor zijn automatische verplaatsingsupdates duidelijker herkenbaar als systeemmelding en minder foutgevoelig.",
                ],
            },
            {
                "version": "0.21.15",
                "date": "2026-06-12",
                "title": "Vergaderbord-header gebruikt avatarbadges",
                "highlights": [
                    "Op het geopende vergaderbord zie je toegangsgebruikers nu als compacte avatarbadges in plaats van naamchips.",
                    "Wanneer een avatar beschikbaar is, wordt die gebruikt; anders zie je automatisch initialen als fallback.",
                    "De +N-overflowbadge laat verborgen toegangsgebruikers nu op hover/focus zien via titel en aria-label, terwijl de header compact blijft met maximaal vijf zichtbare badges.",
                ],
            },
            {
                "version": "0.21.14",
                "date": "2026-06-12",
                "title": "Compacte bordrechtenmatrix met admins",
                "highlights": [
                    "Admins zijn nu zichtbaar in Admin > Bordrechten als alleen-lezen rijen met een duidelijke Admin-badge.",
                    "De matrix is compacter opgebouwd met kleinere spacing, zodat de rechtenpagina rustiger en beter scanbaar is.",
                    "Opslaan blijft beperkt tot niet-admin wijzigingen, terwijl admins automatisch overal toegang houden.",
                ],
            },
            {
                "version": "0.21.13",
                "date": "2026-06-12",
                "title": "Bordrechten werken nu als matrix",
                "highlights": [
                    "In Admin > Bordrechten zie je nu direct welke niet-admin gebruiker toegang heeft tot welk bord.",
                    "Wijzigingen sla je pas op met één centrale knop, zodat je eerst een duidelijk overzicht hebt van alle aanpassingen.",
                    "De bordbeheeracties blijven beschikbaar op dezelfde pagina, zodat aanmaken en archiveren gewoon doorwerken.",
                ],
            },
            {
                "version": "0.21.12",
                "date": "2026-06-12",
                "title": "Bordrechtenbeheer is overzichtelijker geworden",
                "highlights": [
                    "De actieve tab op de pagina Admin > Bordrechten valt nu ook in donkere weergave duidelijker op.",
                    "Bordkaarten zijn rustiger opgebouwd, zodat status, rechten en acties sneller te scannen zijn.",
                    "Zoeken, filters en feedback maken het makkelijker om bordrechten aan te passen met minder misclicks.",
                ],
            },
            {
                "version": "0.21.11",
                "date": "2026-06-12",
                "title": "WindWilly-startpagina verder versoberd",
                "highlights": [
                    "De landing toont nu alleen nog de hero en het blok met samenwerkende coöperaties.",
                    "De CTA-knoppen, het aparte introblok en de extra footerzin zijn verwijderd voor een rustigere pagina.",
                    "De startpagina blijft compact, herkenbaar en in lijn met de bestaande WindWilly-branding.",
                ],
            },
            {
                "version": "0.21.10",
                "date": "2026-06-11",
                "title": "WindWilly-startpagina terug naar de kern",
                "highlights": [
                    "De homepage is teruggebracht tot een rustige start met alleen een heldere hero, korte intro en de samenwerkende coöperaties.",
                    "Extra portaalblokken en update-onderdelen zijn van de startpagina weggehaald.",
                    "De pagina blijft zo overzichtelijk en past beter bij de bestaande WindWilly-branding.",
                ],
            },
            {
                "version": "0.21.9",
                "date": "2026-06-11",
                "title": "Compactere bewerkmodal voor gebruikers",
                "highlights": [
                    "De bewerkmodal in Admin > Gebruikers gebruikt minder witruimte, kortere uitleg en compactere velden.",
                    "Profielgegevens, avatarupload en accountacties blijven bij elkaar zichtbaar, zodat minder scrollen nodig is.",
                    "Alle bestaande beheeracties en bevestigingen blijven behouden, inclusief bescherming bij onopgeslagen wijzigingen.",
                ],
            },
            {
                "version": "0.21.8",
                "date": "2026-06-11",
                "title": "Rustigere gebruikersmodal met veilig sluiten",
                "highlights": [
                    "De bewerkmodal in Admin > Gebruikers sluit nu ook via de overlay of Escape wanneer er geen wijzigingen openstaan.",
                    "Bij gewijzigde profielvelden of een gekozen avatar vraagt de modal eerst bevestiging voordat wijzigingen worden weggegooid.",
                    "Profielgegevens, avatarupload en accountacties zijn duidelijker gegroepeerd met herkenbare risicovolle acties.",
                ],
            },
            {
                "version": "0.21.7",
                "date": "2026-06-11",
                "title": "Overzichtelijkere gebruikersacties voor admins",
                "highlights": [
                    "In Admin > Gebruikers toont de tabel per gebruiker alleen nog de actie Bewerken.",
                    "Adminrechten, status, verwijderen en wachtwoord resetten staan nu overzichtelijk bij Accountacties in de bewerkmodal.",
                    "Bevestigingen en bescherming tegen riskante acties op je eigen account blijven duidelijk zichtbaar aanwezig.",
                ],
            },
            {
                "version": "0.21.6",
                "date": "2026-06-11",
                "title": "Admins kunnen gebruikersprofielen direct bewerken",
                "highlights": [
                    "De actieknoppen in Admin > Gebruikers zijn compacter en staan rustiger uitgelijnd in de tabel.",
                    "Elke gebruiker heeft nu een duidelijke Bewerken-actie waarmee naam, e-mailadres en avatar in een modal aangepast kunnen worden.",
                    "Bestaande bevestigingen en bescherming tegen riskante eigen-accountacties blijven behouden.",
                ],
            },
            {
                "version": "0.21.5",
                "date": "2026-06-11",
                "title": "Veiliger gebruikersbeheer voor admins",
                "highlights": [
                    "De Gebruikers-tab heeft nu duidelijke beheeruitleg, labels en gescheiden secties voor toevoegen en beheren.",
                    "Risicovolle acties zoals uitschakelen, verwijderen, adminrechten verwijderen en wachtwoord resetten vragen eerst bevestiging.",
                    "Admins worden beter beschermd tegen het per ongeluk uitschakelen, verwijderen of degraderen van hun eigen account.",
                ],
            },
            {
                "version": "0.21.3",
                "date": "2026-06-09",
                "title": "Aparte wijzigingsgeschiedenis en duidelijkere voorbeeldmeldingen",
                "highlights": [
                    "De wijzigingsgeschiedenis heeft nu een eigen pagina die vanaf de WindWilly-startpagina bereikbaar is.",
                    "Wijzigingen worden met de nieuwste update bovenaan getoond.",
                    "De WindWilly Assistent en Wervelnieuws tonen duidelijker welke onderdelen nog preview of work in progress zijn.",
                ],
            },
            {
                "version": "0.21.2",
                "date": "2026-06-09",
                "title": "Rustiger startscherm na inloggen",
                "highlights": [
                    "Het WindWilly-startscherm opent nu direct met een korte introductie over de drie samenwerkende energiecoöperaties.",
                    "De tijdelijke suitekaarten en Bestuur-placeholder zijn van de startpagina gehaald, terwijl de bestaande navigatie bovenaan gelijk blijft.",
                ],
            },
            {
                "version": "0.21.1",
                "date": "2026-06-09",
                "title": "Login blijft werken bij tijdelijk Onthoud mij-probleem",
                "highlights": [
                    "Als de onthouden-sessie niet kan worden opgeslagen, lukt inloggen met geldige gegevens nu alsnog als normale sessie.",
                    "Er wordt dan geen Onthoud mij-cookie gezet, zodat de langere sessie niet half wordt geactiveerd.",
                    "Beheerders krijgen een veilige logmelding om ontbrekende migraties of tabelproblemen te herkennen zonder gevoelige tokens te loggen.",
                ],
            },
            {
                "version": "0.21.0",
                "date": "2026-06-09",
                "title": "Ingelogd blijven per apparaat met Onthoud mij",
                "highlights": [
                    "Op het inlogscherm kun je nu Onthoud mij aanvinken om op dit apparaat ingelogd te blijven.",
                    "De langere sessie gebruikt een veilige HTTP-only cookie en kan per apparaat worden ingetrokken door uit te loggen.",
                    "Uitloggen op één browser laat andere apparaten met hun eigen onthouden sessie ongemoeid.",
                ],
            },
            {
                "version": "0.20.1",
                "date": "2026-06-09",
                "title": "Vergaderbord-kaartbeschrijving direct bewerken",
                "highlights": [
                    "In het kaartdetail van vergaderborden wordt de beschrijving nu nog maar één keer getoond.",
                    "Je kunt de zichtbare beschrijving direct aanklikken om deze inline te bewerken en op te slaan.",
                    "Kaarten zonder beschrijving tonen een duidelijke knop om meteen een beschrijving toe te voegen.",
                ],
            },
            {
                "version": "0.20.0",
                "date": "2026-06-03",
                "title": "Admins beheren toegang tot vergaderborden",
                "highlights": [
                    "In Admin is een nieuw onderdeel Bordrechten toegevoegd waarmee admins per vergaderbord gebruikers kunnen selecteren of deselecteren.",
                    "Niet-admin gebruikers zien en openen alleen nog vergaderborden waarvoor ze toegang hebben gekregen.",
                    "Admins houden automatisch toegang tot alle vergaderborden en kunnen borden aanmaken of als soft-delete verwijderen.",
                ],
            },
            {
                "version": "0.19.12",
                "date": "2026-06-02",
                "title": "Update-tijden op vergaderborden tonen nu Amsterdamse tijd",
                "highlights": [
                    "De datumregel bij updates en audio-opnames op vergaderbord-kaarten gebruikt nu expliciet de lokale tijdzone Europe/Amsterdam.",
                    "UTC-tijden uit de backend worden daardoor correct als Nederlandse zomer- of wintertijd getoond.",
                    "Opgeslagen updates en bestaande update-teksten blijven ongewijzigd; alleen de zichtbare tijdweergave is gecorrigeerd.",
                ],
            },
            {
                "version": "0.19.11",
                "date": "2026-06-02",
                "title": "Verplaats-updates op vergaderborden compacter weergegeven",
                "highlights": [
                    "Wanneer een kaartje naar een andere kolom wordt verplaatst, toont de update nu compacter als 'Kaart verplaatst: oude kolom → nieuwe kolom'.",
                    "De datum, auteur en acties bij updates blijven hetzelfde werken, maar de melding breekt minder rommelig over meerdere regels.",
                ],
            },
            {
                "version": "0.19.10",
                "date": "2026-05-29",
                "title": "Titels in planning en kanaalredactie nu begrensd op 80 tekens",
                "highlights": [
                    "Bij het aanmaken of bewerken van Vergaderborden-kaarten en planningsregels accepteren titels nu maximaal 80 tekens, met directe melding als je daaroverheen gaat.",
                    "In de kanaalredactie (Website/Facebook/Nieuwsbrief) geldt nu dezelfde 80-tekensgrens voor handmatig bewerkte titels.",
                    "Backend-validatie dwingt deze limiet nu ook af op API-niveau, zodat te lange titels consistent worden geweigerd.",
                    "Bestaande opgeslagen titels blijven ongewijzigd; de limiet geldt voor nieuwe en aangepaste invoer.",
                ],
            },
            {
                "version": "0.19.9",
                "date": "2026-05-29",
                "title": "Teamleden kiezen op vergaderbord-kaarten nu via avatar-tegels",
                "highlights": [
                    "Bij het toevoegen van een vergaderbord-kaart kies je teamleden nu via compacte, klikbare avatar-tegels in plaats van checkboxen met namen.",
                    "Toegewezen teamleden worden op kaartjes en in kaartdetails nu ook met hun profielfoto getoond wanneer die beschikbaar is.",
                    "Teamleden zonder profielfoto krijgen automatisch een initialen-placeholder, zodat selectie altijd visueel bruikbaar blijft.",
                    "De selector blijft toetsenbordvriendelijk en toegankelijk met focusstijlen en duidelijke aria-labels/titels per teamlid.",
                ],
            },
            {
                "version": "0.19.8",
                "date": "2026-05-29",
                "title": "Vergaderbord-kaartbeschrijvingen nu rijker en beter leesbaar",
                "highlights": [
                    "Bij nieuwe kaarten en het bewerken van kaartbeschrijvingen heb je nu een ruimere editor met opmaakknoppen voor vet, cursief, onderstrepen en lijstjes.",
                    "Beschrijvingen groeien automatisch mee tijdens typen en ondersteunen nu maximaal 2000 tekens met duidelijke teller.",
                    "Dezelfde opmaak wordt veilig en consistent getoond in zowel kaartdetails als het kolomoverzicht, zonder HTML-uitvoering.",
                ],
            },
            {
                "version": "0.19.7",
                "date": "2026-05-28",
                "title": "Audio-opnames tonen nulduur nu als onbekend en bewaren duur robuuster",
                "highlights": [
                    "Nieuwe opnames op vergaderbord-kaarten gebruiken nu een robuustere duurdoorsturing, zodat geldige opnames niet als 0 seconden worden opgeslagen.",
                    "Opnames met duur 0 worden nu consequent als onbekend behandeld, zodat je in kaartupdates geen misleidende '0:00' meer ziet.",
                    "Afspelen en downloaden van audio-opnames blijven ongewijzigd werken via dezelfde speler en downloadlink.",
                ],
            },
            {
                "version": "0.19.6",
                "date": "2026-05-28",
                "title": "Audio-opnames tonen nu duur en bestandsgrootte in kaartupdates",
                "highlights": [
                    "Bij audio-opnames in vergaderbord-kaarten zie je nu direct de opnameduur en bestandsgrootte in een aparte metadataregel.",
                    "Ook oudere opnames zonder complete metadata blijven netjes zichtbaar met een duidelijke 'onbekend'-weergave.",
                    "Afspelen en downloaden van opnames werken zoals voorheen via dezelfde speler en downloadlink.",
                ],
            },
            {
                "version": "0.19.5",
                "date": "2026-05-28",
                "title": "Updateveld op vergaderbord-kaarten gebruikt nu de volle breedte",
                "highlights": [
                    "Het veld voor een nieuwe kaartupdate vult nu netjes de beschikbare kaartbreedte.",
                    "De opmaakbalk en het tekstveld blijven gelijk uitgelijnd, zodat langere updates prettiger te schrijven zijn.",
                    "De bestaande kaartdetailweergave en updateflow blijven verder ongewijzigd.",
                ],
            },
            {
                "version": "0.19.4",
                "date": "2026-05-28",
                "title": "Vergaderbord-updates editor nu compacter en Trello-achtiger",
                "highlights": [
                    "De editor voor zowel nieuwe updates als update-bewerking heeft nu een compactere, rustigere opmaak met duidelijke editor-shell en toolbar.",
                    "Opmaakknoppen reageren duidelijker met hover- en focusstijlen, zodat snelwerken met muis én toetsenbord prettiger is.",
                    "Op kleinere schermen blijft de toolbar bruikbaar doordat knoppen netjes meewrappen zonder dat acties buiten beeld vallen.",
                ],
            },
            {
                "version": "0.19.3",
                "date": "2026-05-28",
                "title": "Rijkere update-editor op vergaderbord-kaarten",
                "highlights": [
                    "Bij nieuwe en bestaande kaartupdates kun je nu opmaakknoppen gebruiken voor vet, cursief, onderstrepen en lijstjes.",
                    "Regelafbrekingen en lijstweergave blijven nu zichtbaar in de updatekaart, zodat voortgangsnotities leesbaarder zijn.",
                    "De updateweergave blijft veilig: HTML uit berichttekst wordt niet als code uitgevoerd en oude platte-tekstupdates blijven gewoon leesbaar.",
                ],
            },
            {
                "version": "0.19.2",
                "date": "2026-05-28",
                "title": "Compacte update-acties en veilig verwijderen op vergaderbord-kaarten",
                "highlights": [
                    "Onder je eigen kaartupdates zie je nu compacte acties als kleine tekstlinks: 'Bewerken • Verwijderen'.",
                    "Updates van andere gebruikers tonen geen acties, zodat alleen de auteur eigen updates kan aanpassen of verwijderen.",
                    "Bij verwijderen krijg je eerst een bevestiging; na bevestigen verdwijnt de update direct uit de activiteitenlijst.",
                ],
            },
            {
                "version": "0.19.1",
                "date": "2026-05-28",
                "title": "Vergaderbord-updates als overzichtelijke activiteitenkaarten",
                "highlights": [
                    "Updates in kaartdetails worden nu getoond als overzichtelijke activity cards met auteur, datum/tijd en berichttekst.",
                    "Alleen jouw eigen updates tonen een bewerkactie binnen dezelfde activity card; updates van anderen blijven alleen leesbaar.",
                    "Afbeeldingen bij updates blijven zichtbaar in de activity card, met behoud van bestaande update- en bewerkflow.",
                ],
            },
            {
                "version": "0.19.0",
                "date": "2026-05-28",
                "title": "Vergaderbord-updates: eigen update bewerken met revisie",
                "highlights": [
                    "Bij vergaderbord-updates kan nu alleen de auteur zelf een geplaatste update bewerken.",
                    "Bewerken van een update maakt een nieuwe revisie, zodat eerdere inhoud bewaard blijft in de updatehistorie.",
                    "Bij een update-edit kun je nu ook een afbeelding toevoegen, vervangen of verwijderen zonder automatische herpublicatie of nieuwsbrief-resend.",
                ],
            },
            {
                "version": "0.18.5",
                "date": "2026-05-28",
                "title": "Vergaderborden: duidelijke verplaatsingsupdates met kolomnamen",
                "highlights": [
                    "Nieuwe automatische kaartverplaatsingen gebruiken nu exact: 'Kaart verplaatst van <oude kolom> naar <nieuwe kolom>.'",
                    "In kaartdetail-updates worden de oude en nieuwe kolomnaam vet weergegeven voor dit automatische verplaatsingspatroon.",
                    "Bestaande opgeslagen updates en handmatige updates blijven ongewijzigd; datum, tijd en auteur blijven in de metadataregel staan.",
                ],
            },
            {
                "version": "0.18.3",
                "date": "2026-05-27",
                "title": "Vergaderbord-opnameknop duidelijker en minimale opnameduur",
                "highlights": [
                    "De opnameknop op vergaderbord-kaarten is nu duidelijk rood en rond, zodat starten direct herkenbaar is.",
                    "Tijdens opnemen verandert de knop zichtbaar naar een donkere stop-state voor extra duidelijkheid.",
                    "Opnames korter dan 5 seconden worden nu direct afgekeurd met melding: 'Opname is te kort. Neem minimaal 5 seconden op.'",
                ],
            },
            {
                "version": "0.17.8",
                "date": "2026-05-27",
                "title": "Kaartbeschrijving direct bewerken in Vergaderborden",
                "highlights": [
                    "In het kaartdetail kun je de beschrijving nu direct inline aanpassen zonder extra scherm.",
                    "Een gewijzigde beschrijving wordt automatisch opgeslagen zodra je uit het veld klikt.",
                    "Bij ongewijzigde tekst wordt geen onnodige opslagaanroep gedaan, waardoor werken rustiger blijft.",
                ],
            },
            {
                "version": "0.1.0",
                "date": "2026-03-12",
                "title": "Duidelijker dashboard en betere navigatie",
                "highlights": [
                    "Het dashboard heeft een frisse nieuwe uitstraling gekregen.",
                    "Je kunt nu bovenaan snel schakelen tussen Main, Planning, Database, Log en About.",
                    "In de wijzigingsgeschiedenis lees je per versie wat er is verbeterd.",
                ],
            },
            {
                "version": "0.2.0",
                "date": "2026-03-12",
                "title": "Persoonlijke instellingen in eigen beheer",
                "highlights": [
                    "Je kunt nu je volledige naam en e-mailadres zelf invullen of aanpassen.",
                    "Je kunt een thema kiezen dat past bij je voorkeur: licht, donker of systeem volgen.",
                    "De instellingenpagina geeft ook suggesties voor extra voorkeuren die later kunnen worden toegevoegd.",
                ],
            },
            {
                "version": "0.2.1",
                "date": "2026-03-12",
                "title": "Profielfoto uploaden en rond bijsnijden",
                "highlights": [
                    "Je kunt nu een eigen profielfoto uploaden vanuit je instellingen.",
                    "Voor het opslaan kun je de foto direct rond bijsnijden en netjes centreren.",
                    "Zo is je profiel in het menu direct herkenbaar voor jou en je team.",
                ],
            },
            {
                "version": "0.3.0",
                "date": "2026-03-12",
                "title": "Admin-menu en rollenbeheer",
                "highlights": [
                    "Admins zien nu een extra Admin-optie in het gebruikersmenu.",
                    "Op de Admin-pagina kunnen admins rechten geven of weghalen bij andere gebruikers.",
                    "Het systeem voorkomt dat de laatste admin per ongeluk adminrechten verliest.",
                ],
            },
            {
                "version": "0.4.0",
                "date": "2026-03-12",
                "title": "Centrale Database-pagina voor bronbestanden",
                "highlights": [
                    "Uploaden is verplaatst van Main naar Database met drag-and-drop ondersteuning.",
                    "Je ziet nu per bestand direct het gekoppelde project, wie het heeft geupload en wanneer.",
                    "Admins kunnen in het Admin-menu de projectenlijst beheren, inclusief het standaardproject Windpark de Boldijk.",
                ],
            },
            {
                "version": "0.5.0",
                "date": "2026-03-12",
                "title": "AI-bronindexering en transparante bronweergave",
                "highlights": [
                    "Database-bronbestanden worden nu geindexeerd zodat AI er relevante passages uit kan ophalen.",
                    "Bij generatie worden nu zowel topicbronnen als databasebronnen gecombineerd met duidelijke herkomst.",
                    "In Planning zie je bij de review direct welke bronpassages zijn gebruikt, inclusief document en project.",
                ],
            },
            {
                "version": "0.6.0",
                "date": "2026-03-13",
                "title": "Planningimport met doelmedia per bericht",
                "highlights": [
                    "In Planning kun je nu een CSV importeren met vaste kolommen voor onderwerp, datum en doelmedia.",
                    "Je kunt ook handmatig losse planningsregels toevoegen, waarbij elke regel precies een bericht is.",
                    "Per regel kun je Website, Facebook en Nieuwsbrief apart aan- of uitzetten en regels ook verwijderen.",
                ],
            },
            {
                "version": "0.7.0",
                "date": "2026-03-13",
                "title": "Multichannel redactie op de planningsdetailpagina",
                "highlights": [
                    "Per doelmedium werk je nu met een eigen artikel, samenvatting en illustratie in de detailpagina.",
                    "Je kunt GenAI-opmerkingen vrij invullen, opslaan en direct gebruiken voor opnieuw genereren.",
                    "Goedkeuren of afwijzen gebeurt nu per medium, met akkoord op regelniveau pas wanneer alle media akkoord zijn.",
                ],
            },
            {
                "version": "0.8.0",
                "date": "2026-03-13",
                "title": "GenAI-instellingen vanuit Admin en optionele websearch",
                "highlights": [
                    "In Admin kun je nu centrale GenAI-instellingen beheren, zoals prompts en modelkeuze.",
                    "Websearch is nu als optie beschikbaar voor generatie, maar staat standaard uit.",
                    "Wanneer websearch aan staat, zie je in bronweergave duidelijk welke webcontext is gebruikt.",
                ],
            },
            {
                "version": "0.9.0",
                "date": "2026-03-14",
                "title": "Planningregels nu gekoppeld aan projecten",
                "highlights": [
                    "Elke planningsregel krijgt nu een verplicht project, zodat direct duidelijk is waar het bericht bij hoort.",
                    "In Planning zie je het project als extra kolom en kun je regels filteren per project.",
                    "AI gebruikt nu alleen databasebronnen uit hetzelfde project als de planningsregel.",
                ],
            },
            {
                "version": "0.10.0",
                "date": "2026-03-14",
                "title": "Admin-tabs, themabeheer en slimme planningssjablonen",
                "highlights": [
                    "De Admin-pagina is opgedeeld in duidelijke tabs voor gebruikers, projecten, thema's, AI, scheduler en activiteit.",
                    "Admins kunnen nu thema's beheren; Planning gebruikt direct de actieve themalijst uit de backend.",
                    "In Planning kun je logische sjablonen kiezen om onderwerp, thema, opmerkingen en planning sneller voor te vullen.",
                ],
            },
            {
                "version": "0.10.1",
                "date": "2026-03-14",
                "title": "Duidelijke melding bij ontbrekende kanaalvariant-migratie",
                "highlights": [
                    "Bij artikelgeneratie en kanaalvarianten krijg je nu een duidelijke foutmelding als een database-migratie ontbreekt.",
                    "De melding vertelt precies welk commando je moet draaien om de migratie uit te voeren.",
                    "Hierdoor is de storing sneller op te lossen zonder onduidelijke serverfouten in Planning.",
                ],
            },
            {
                "version": "0.10.2",
                "date": "2026-03-14",
                "title": "Main-pagina met live dashboard en duidelijkere start",
                "highlights": [
                    "Bovenaan Main staat nu een korte inleiding, zodat direct duidelijk is waar je vandaag op stuurt.",
                    "De cijfers op Main zijn nu live gebaseerd op planningdata, zoals totaal onderwerpen en publicatiestatus.",
                    "De indeling is opgeschoond zodat het dashboard compacter leest en geen leeg wit vlak meer toont.",
                ],
            },
            {
                "version": "0.11.0",
                "date": "2026-03-14",
                "title": "Admin Scheduler-overzicht met recente runs en planning",
                "highlights": [
                    "In het admin-menu staat nu een aparte Scheduler-pagina voor snelle controle van de achtergrondtaken.",
                    "Je ziet nu per taak wanneer deze recent is gedraaid en welke taken nog op de planning staan.",
                    "Ook retrytaken zijn zichtbaar, inclusief volgende runmoment en pogingnummer.",
                ],
            },
            {
                "version": "0.11.1",
                "date": "2026-03-14",
                "title": "Planning detail met kanaalpreviews en rustigere werkindeling",
                "highlights": [
                    "De detailpagina is opnieuw ingedeeld met een duidelijke bovenkant voor planning en een aparte kanaalwerkruimte.",
                    "Per medium zie je nu direct een leesbare preview naast de editor, zodat review sneller en betrouwbaarder gaat.",
                    "Ook als content als JSON binnenkomt, wordt die nu automatisch netjes getoond als titel, artikel en samenvatting.",
                ],
            },
            {
                "version": "0.11.2",
                "date": "2026-03-14",
                "title": "Admin log toont nu onderwerpregels in plaats van technische IDs",
                "highlights": [
                    "In Admin heet het tabblad nu Admin log, zodat direct duidelijk is waar je beheeracties terugvindt.",
                    "Bij logregels zie je nu de onderwerpregel van het topic in plaats van een lastig leesbare topic-ID.",
                    "Lange onderwerpregels worden automatisch kort getoond, met de volledige tekst beschikbaar op hover.",
                ],
            },
            {
                "version": "0.12.0",
                "date": "2026-03-15",
                "title": "Logpagina live met filters en dagstart op Main",
                "highlights": [
                    "De Log-pagina toont nu echte systeemacties met duidelijke labels in gewone taal.",
                    "Je kunt logregels filteren op periode, onderwerp en type actie zodat je sneller vindt wat je zoekt.",
                    "Op Main staat nu een compact blok met recente logregels plus een concrete feature-suggestie.",
                ],
            },
            {
                "version": "0.13.0",
                "date": "2026-03-15",
                "title": "n8n-meldingen zichtbaar en centraal afgehandeld",
                "highlights": [
                    "Succes- en foutmeldingen voor generatie en publicatie lopen nu via een n8n-koppeling.",
                    "Op Main en Log zie je deze meldingen direct terug, inclusief status en onderwerp.",
                    "Dubbele meldingen worden voorkomen, zodat admins geen herhaalde Telegram-meldingen krijgen.",
                ],
            },
            {
                "version": "0.13.1",
                "date": "2026-03-15",
                "title": "Subtiel wind-thema met centrale adminschakelaar",
                "highlights": [
                    "De interface gebruikt nu subtiele windturbine-accenten die passen bij het projectthema.",
                    "In Admin kan het team het wind-thema centraal aan- of uitzetten voor alle gebruikers.",
                    "De instelling wordt direct toegepast in de hele omgeving, zonder extra handmatige stappen.",
                ],
            },
            {
                "version": "0.13.2",
                "date": "2026-03-16",
                "title": "Planning detail nu rustiger, leesbaarder en met vaste 3-media preview",
                "highlights": [
                    "De detailpagina toont nu standaard Facebook, Nieuwsbrief en Website naast elkaar op desktop en onder elkaar op mobiel.",
                    "Statusbadges en kaartkleuren zijn aangescherpt voor betere leesbaarheid en duidelijker semantisch kleurgebruik.",
                    "Bronpassages staan nu in een compacte accordion met bron, chunk en scorebadge zodat review sneller gaat.",
                ],
            },
            {
                "version": "0.14.0",
                "date": "2026-03-16",
                "title": "Planning detail met aparte tekst/afbeelding-goedkeuring en directe afwijs-webhook",
                "highlights": [
                    "Per kanaal kun je nu tekst en afbeelding apart op akkoord zetten of afwijzen, met duidelijke onderdeelstatussen.",
                    "Er zijn nu aparte opmerkingenvelden voor tekst en afbeelding, zodat feedback gerichter kan worden meegegeven.",
                    "Bij afwijzen stuurt de backend direct een stille n8n-webhook en previews tonen AI-afbeeldingen nu echt als beeld.",
                ],
            },
            {
                "version": "0.14.1",
                "date": "2026-03-16",
                "title": "Planning detail opnieuw uitgelijnd met strakke rasteropbouw",
                "highlights": [
                    "De hele detailpagina gebruikt nu een consistente 12-koloms opbouw, waardoor secties niet meer schots en scheef staan.",
                    "Bovenaan staan Opmerkingen en Planningvoortgang nu strak naast elkaar in een duidelijke 8/4 verdeling.",
                    "De drie kanaalpreviews hebben nu gelijke kaartopbouw en stabielere hoogte, met compacte actiebalken per sectie.",
                ],
            },
            {
                "version": "0.15.0",
                "date": "2026-03-24",
                "title": "WindWilly-suite start met Wervelnieuws als subdienst",
                "highlights": [
                    "De omgeving heeft nu een WindWilly-suite navigatie met modules voor Chatbot, Wervelnieuws en twee nieuwe placeholders.",
                    "Wervelnieuws draait nu als subdienst onder /wervelnieuws, zodat de suite klaar is voor verdere uitbreiding.",
                    "Bestaande routes blijven bruikbaar via automatische doorverwijzing naar de nieuwe suite-structuur.",
                ],
            },
            {
                "version": "0.15.1",
                "date": "2026-03-24",
                "title": "Main opgeschoond en bronbestanden standaard projectoverstijgend",
                "highlights": [
                    "De bovenste welkomkaart op Main is verwijderd, waardoor het dashboard direct met kerninformatie start.",
                    "In het Wervelnieuws submenu heet Database nu Bronbestanden voor duidelijker taalgebruik.",
                    "Op de databasepagina zie je nu standaard bestanden van alle projecten, met behoud van projectfilter en upload per gekozen project.",
                ],
            },
            {
                "version": "0.15.2",
                "date": "2026-03-24",
                "title": "Nieuwe Trello-placeholder in de WindWilly-suite",
                "highlights": [
                    "In de hoofdnavigatie staat nu een extra Trello-tab naast Urenregistratie.",
                    "De nieuwe Trello-pagina is als duidelijke placeholder toegevoegd voor een komende interne projectboardmodule.",
                    "De pagina heeft nu alvast een herkenbare board-achtergrond, zodat de toekomstige richting direct zichtbaar is.",
                ],
            },
            {
                "version": "0.16.0",
                "date": "2026-03-24",
                "title": "Technische upgrade: stabielere basis, veiligere configuratie en betrouwbaardere achtergrondtaken",
                "highlights": [
                    "De applicatie is intern opgeschoond met een modulaire frontend-opzet, waardoor doorontwikkeling en onderhoud sneller en overzichtelijker worden.",
                    "Beveiligingsinstellingen zijn aangescherpt: productie draait nu alleen met expliciete CORS-origins en een veilige geheime sleutel.",
                    "Rate limiting en worker-afhandeling zijn robuuster gemaakt, zodat piekverkeer en parallelle workers betrouwbaarder en consistenter worden verwerkt.",
                ],
            },
            {
                "version": "0.16.1",
                "date": "2026-03-25",
                "title": "Landingspagina rustiger met coöperatiecontext en vaste voettekst",
                "highlights": [
                    "De bovenste startsectie op de WindWilly-landing gebruikt nu themakleuren, zodat het storende witte vlak verdwijnt.",
                    "Op de landing staat nu ook algemene informatie over Energiek Daarle, Duurzaam Daarlerveen en Noaber & Co.",
                    "Onderaan de omgeving staat nu een subtiele voettekst met copyright en makersvermelding.",
                ],
            },
            {
                "version": "0.16.2",
                "date": "2026-03-25",
                "title": "WindWilly-chatpagina als gerichte placeholder voor windinformatie",
                "highlights": [
                    "De WindWilly-module heeft nu een chat-achtige opzet, zodat de toekomstige assistent direct herkenbaar is.",
                    "De voorbeeldvragen en voorbeeldantwoorden zijn toegespitst op windprojectinformatie, planning en bewonerscommunicatie.",
                    "Het is bewust nog een placeholder: de schermopbouw staat klaar, maar zonder daadwerkelijke AI-gesprekken in deze versie.",
                ],
            },
            {
                "version": "0.17.0",
                "date": "2026-05-14",
                "title": "Nieuwe adminmodule Vergaderborden met kaarten, updates en opnames",
                "highlights": [
                    "Admins en uitgenodigde gebruikers kunnen nu werken met projectgebonden vergaderborden in drie vaste kolommen: Te doen, Bezig en Klaar.",
                    "Kaarten ondersteunen drag-and-drop verplaatsen, updatehistorie en directe samenwerking met toegewezen gebruikers.",
                    "Voor kaarten in Bezig kun je nu audio-opnames maken en uploaden, met veilige opslag op de server en download in het kaartdetail.",
                ],
            },
            {
                "version": "0.17.1",
                "date": "2026-05-22",
                "title": "Vergaderborden vervangt Trello-placeholder in navigatie en landing",
                "highlights": [
                    "De hoofdnavigatie toont nu Vergaderborden als vaste module-entry, zodat je direct in het werkende bordenoverzicht terechtkomt.",
                    "De oude /trello-placeholderroute is verwijderd; de primaire route voor borden is nu /vergaderborden.",
                    "Ook op de landing is de kaart bijgewerkt naar echte Vergaderborden-functionaliteit in plaats van placeholdertekst.",
                ],
            },
            {
                "version": "0.17.2",
                "date": "2026-05-22",
                "title": "Vergaderborden rustiger en consistenter ingedeeld",
                "highlights": [
                    "Het formulier Nieuw project is opnieuw uitgelijnd met duidelijke velden, labels en een stabiele actieknoppenrij.",
                    "Per bordkolom zijn de kaart-toevoegregels compacter en consistenter opgebouwd, met betere uitlijning van invoer en acties.",
                    "Spacing, typografie en responsive gedrag zijn aangescherpt voor mobiel, tablet en desktop zonder wijziging van functionaliteit.",
                ],
            },
            {
                "version": "0.17.3",
                "date": "2026-05-26",
                "title": "Vergaderborden: kaart toevoegen en update-flow duidelijker gemaakt",
                "highlights": [
                    "Het compacte kaartformulier in alle kolommen is nu strakker uitgelijnd met verplichte titel en directe inline foutmelding.",
                    "Het kaartdetailvenster heeft een kleinere sluitknop rechtsboven en sluit nu ook direct bij een klik buiten het venster.",
                    "Updates worden nu onder het formulier getoond (nieuwste bovenaan) met datum/tijd en auteur, plus nette fallback en lege statusmelding.",
                ],
            },
            {
                "version": "0.17.4",
                "date": "2026-05-26",
                "title": "Vergaderborden: rustiger kaart-aanmaak en teamselectie verbeterd",
                "highlights": [
                    "Per bordkolom staat het kaartformulier nu standaard verborgen achter een duidelijke '+ Kaart toevoegen'-knop, waardoor het bord rustiger leest.",
                    "Er kan nu maar één kaartformulier tegelijk openstaan en na succesvol opslaan sluit het formulier automatisch.",
                    "Teamleden kies je nu via een overzichtelijke dropdown met multi-select, terwijl de koppeling op de achtergrond hetzelfde blijft werken.",
                ],
            },
            {
                "version": "0.17.5",
                "date": "2026-05-26",
                "title": "Vergaderborden: kaartjes verslepen nu duidelijker en betrouwbaarder",
                "highlights": [
                    "Kaartjes tussen Te doen, Bezig en Klaar opslaan nu direct bij loslaten, zodat de nieuwe status meteen wordt bewaard.",
                    "Tijdens slepen en opslaan zie je nu duidelijkere visuele feedback per kolom, inclusief melding als een kaart wordt opgeslagen.",
                    "Bij een fout krijg je een heldere Nederlandstalige melding en het bord wordt automatisch opnieuw opgehaald voor consistente weergave.",
                ],
            },
            {
                "version": "0.17.6",
                "date": "2026-05-26",
                "title": "Vergaderborden: kolomverplaatsingen nu zichtbaar in kaartupdates",
                "highlights": [
                    "Bij het verplaatsen van een kaart tussen Te doen, Bezig en Klaar wordt nu automatisch een zichtbare kaartupdate toegevoegd.",
                    "De update toont van/naar-kolom in het Nederlands, inclusief gebruiker en tijdstip van de verplaatsing.",
                    "Bij een same-column drop/no-op wordt geen extra systeemupdate aangemaakt, zodat de timeline schoon blijft.",
                ],
            },
            {
                "version": "0.17.7",
                "date": "2026-05-26",
                "title": "Vergaderborden: kaarttitels direct aanpassen",
                "highlights": [
                    "Vergaderbord-kaarten tonen nu een handje bij hover, zodat direct duidelijk is dat je ze kunt openen.",
                    "Kaarttitels kun je nu rechtstreeks op het bord aanpassen zonder eerst het kaartdetail te openen.",
                    "Een aangepaste titel wordt direct opgeslagen en lege titels worden met een duidelijke melding tegengehouden.",
                ],
            },
            {
                "version": "0.17.9",
                "date": "2026-05-27",
                "title": "Vergaderborden: kaarttitels bewerken vanuit kaartdetail",
                "highlights": [
                    "Kaarttitels pas je nu alleen aan nadat je een kaart hebt geopend, zodat het bordoverzicht rustig blijft voor scannen en slepen.",
                    "In het kaartdetail kun je de titel nog steeds direct inline wijzigen met dezelfde duidelijke validatie.",
                    "Kaarten in het overzicht blijven klikbaar met een handcursor en openen gewoon de detailweergave.",
                ],
            },
            {
                "version": "0.17.10",
                "date": "2026-05-27",
                "title": "Vergaderborden: compact project kiezen via dropdown",
                "highlights": [
                    "Bovenaan Vergaderborden kies je nu een project via een compacte dropdown in plaats van grote projectkaarten.",
                    "Als het project 'Algemeen' beschikbaar is, wordt dat nu automatisch als standaard gekozen.",
                    "De bordkaarten en kaartinteracties blijven hetzelfde, met meer zichtbare ruimte voor het bord zelf.",
                ],
            },
            {
                "version": "0.17.11",
                "date": "2026-05-27",
                "title": "Vergaderborden: projectkeuze via hoofdmenu en admin-only projectaanmaak",
                "highlights": [
                    "Projectkeuze voor Vergaderborden loopt nu via het hoofdmenu, met directe links per project naar /vergaderborden?project=<id>.",
                    "De Vergaderborden-pagina leest projectselectie nu uit de URL, inclusief fallback naar 'Algemeen' bij ontbrekende of ongeldige query.",
                    "Nieuw project aanmaken staat niet meer in de reguliere weergave en is alleen nog beschikbaar via de admin-context.",
                ],
            },
            {
                "version": "0.17.12",
                "date": "2026-05-27",
                "title": "Vergaderborden: sneller terug naar je laatst gekozen bord",
                "highlights": [
                    "De hoofdmenu-link Vergaderborden opent nu automatisch het laatst gekozen geldige project in dezelfde browser.",
                    "Als een oude projectkeuze niet meer bestaat, valt de pagina automatisch terug op Algemeen of het eerste beschikbare project.",
                    "Bovenaan Vergaderborden zie je nu alleen de naam van het geopende bord, zonder de generieke subtitel.",
                ],
            },
            {
                "version": "0.17.13",
                "date": "2026-05-27",
                "title": "Vergaderborden: duidelijkere verplaatsingsupdates en volledige namen",
                "highlights": [
                    "Automatische kaartverplaatsingsupdates zijn korter en tonen alleen nog van/naar-kolom plus wie de verplaatsing deed.",
                    "De tijd staat niet meer dubbel in de update-tekst, omdat datum en tijd al apart als metadata onder elke update zichtbaar blijven.",
                    "Waar gebruikers in Vergaderborden zichtbaar zijn, tonen we nu bij voorkeur de volledige naam met een nette fallback naar gebruikersnaam.",
                ],
            },
            {
                "version": "0.17.14",
                "date": "2026-05-27",
                "title": "Admin: nieuw vergaderbord aanmaken nu direct zichtbaar",
                "highlights": [
                    "Op de Admin-pagina staat nu een duidelijk hoofditem ‘Nieuw vergaderbord aanmaken’.",
                    "De oude admin-optie is weggehaald uit de Vergaderborden-projectdropdown bovenin.",
                    "De knop opent nog steeds dezelfde bestaande flow om een nieuw vergaderbordproject aan te maken.",
                ],
            },
            {
                "version": "0.18.0",
                "date": "2026-05-27",
                "title": "Ingelogd blijven na verversen of browser herstart",
                "highlights": [
                    "Adminsessies blijven nu standaard 30 dagen actief, zodat je niet telkens opnieuw hoeft in te loggen.",
                    "De app controleert bij het opstarten automatisch je sessie via een veilige servercheck.",
                    "Uitloggen sluit de sessie nu direct af en verwijdert de login-cookie netjes.",
                ],
            },
            {
                "version": "0.18.1",
                "date": "2026-05-27",
                "title": "Vergaderborden: direct opnemen op elk kaartje",
                "highlights": [
                    "Elk kaartje in Te doen, Bezig en Klaar heeft nu een eigen opnameknop, zodat je direct kunt starten zonder eerst detail te openen.",
                    "Tijdens opname draait de timer alleen op het actieve kaartje en er kan maar één opname tegelijk actief zijn.",
                    "Opname-uploads worden nu voor alle kaartkolommen geaccepteerd; na upload verversen bord en kaartdetail direct.",
                ],
            },
            {
                "version": "0.18.2",
                "date": "2026-05-27",
                "title": "Vergaderborden: compacte opnameknop op kaartjes",
                "highlights": [
                    "De opnameknop op kaartjes is nu compact en staat rechtsboven als icoonknop, zodat kaarten rustiger en overzichtelijker blijven.",
                    "Bij actieve opname verandert de knop direct naar een duidelijke rode stopknop, terwijl de timer zichtbaar blijft op het actieve kaartje.",
                    "De opnamebediening blijft volledig toegankelijk met Nederlandstalige knoplabels en tooltips voor start en stop.",
                ],
            },
            {
                "version": "0.21.4",
                "date": "2026-06-11",
                "title": "Vergaderborden: recordicoon subtieler en rechtsonder",
                "highlights": [
                    "De recordknop op Vergaderborden-kaarten is nu kleiner, subtieler en rechtsonder gepositioneerd voor een rustigere kaartlayout.",
                    "De knop gebruikt nu een compact SVG-icoon in plaats van een opvallende glyph, terwijl start/stop-opname hetzelfde blijft werken.",
                    "Kaartruimte is minimaal aangepast met extra padding en titelclamping, zodat tekst en opnameknop elkaar niet overlappen.",
                ],
            },
            {
                "version": "0.18.4",
                "date": "2026-05-28",
                "title": "Vergaderborden: audio-opnames nu in dezelfde updates-tijdlijn",
                "highlights": [
                    "In kaartdetails staan audio-opnames nu tussen de gewone updates, zodat je één chronologische activiteitenlijst hebt.",
                    "De aparte sectie 'Opnames' is verwijderd; audio-items tonen nu dezelfde kaartstijl met speler en downloadlink.",
                    "Updates en opnames worden samen van nieuw naar oud gesorteerd op datum en tijd, met behoud van bestaande update- en opnameflows.",
                ],
            },
            {
                "version": "0.23.0",
                "date": "2026-06-30",
                "title": "Wervelnieuws: audio-opnames automatisch omgezet naar doorzoekbare bron",
                "highlights": [
                    "Bij topic-updates kun je nu een audio-opname uploaden; de transcriptie start automatisch op de achtergrond.",
                    "Na verwerking verschijnt de transcriptie als normale, alleen-lezen tekstbron die mee kan in zoekresultaten en generatie.",
                    "Bij een mislukte transcriptie blijft de opname bewaard en kun je de bron direct opnieuw laten verwerken.",
                ],
            },
            {
                "version": "0.27.3",
                "date": "2026-08-12",
                "title": "Urenbeheer overzichtelijker in Admin",
                "highlights": [
                    "De dagelijkse urenregistratie is rustiger doordat historie en audit nu onder eigen Admin-tabs staan.",
                    "Beheerders vinden historische identiteiten, externe personen en de uren-audit sneller terug in het Admin-submenu.",
                    "De bestaande Admin log blijft een afzonderlijk overzicht voor algemene beheeracties.",
                ],
            },
        ],
    )


def _ui_settings(db: Session) -> UiSettingsResponse:
    setting = db.scalar(
        select(SystemSetting).where(SystemSetting.key == UI_SETTINGS_KEY)
    )
    if not setting:
        setting = SystemSetting(
            key=UI_SETTINGS_KEY, value=json.dumps(DEFAULT_UI_SETTINGS)
        )
        db.add(setting)
        db.commit()
        return UiSettingsResponse(**DEFAULT_UI_SETTINGS)
    try:
        parsed = json.loads(setting.value)
    except json.JSONDecodeError:
        parsed = DEFAULT_UI_SETTINGS
    enabled = (
        bool(parsed.get("wind_theme_enabled", True))
        if isinstance(parsed, dict)
        else True
    )
    normalized = {"wind_theme_enabled": enabled}
    if setting.value != json.dumps(normalized):
        setting.value = json.dumps(normalized)
        db.add(setting)
        db.commit()
    return UiSettingsResponse(**normalized)


@router.get("/about", response_model=AboutResponse)
def about(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AboutResponse:
    del current
    setting = db.scalar(
        select(SystemSetting).where(SystemSetting.key == ABOUT_SETTING_KEY)
    )
    if not setting:
        return _default_about()

    try:
        parsed = json.loads(setting.value)
        # Normalize legacy stored overrides on read, without rewriting user settings.
        if isinstance(parsed, dict) and isinstance(parsed.get("changelog"), list) and all(isinstance(entry, dict) for entry in parsed["changelog"]):
            defaults = _default_about()
            canonical = {(entry.date, entry.title): entry for entry in defaults.changelog}
            historical_titles = {
                "Recording updates keep processing after you close the card": "Opnames worden verder verwerkt nadat je het kaartje sluit",
                "Recordings are posted automatically on meeting cards": "Opnames worden automatisch als kaartupdate geplaatst",
                "Reliable WindWilly availability monitoring": "Betrouwbaardere controle van de bereikbaarheid van WindWilly",
                "Vergaderbord-kaartupdates als duidelijke activity cards": "Vergaderbord-updates als overzichtelijke activiteitenkaarten",
                "Aparte changelog en duidelijkere previewmeldingen": "Aparte wijzigingsgeschiedenis en duidelijkere voorbeeldmeldingen",
            }
            entries = sorted(parsed["changelog"], key=lambda entry: (str(entry.get("date", "")), str(entry.get("iteration", ""))))
            for index, entry in enumerate(entries, 1):
                if "version" not in entry and "iteration" in entry:
                    original_title = entry.get("title")
                    if not isinstance(original_title, str) or not isinstance(entry.get("date"), str):
                        continue  # Let schema validation reject malformed settings below.
                    title = historical_titles.get(original_title, original_title)
                    known = canonical.get((entry.get("date"), title))
                    if known:
                        entry.update(known.model_dump())
                    else:
                        entry["version"] = f"0.0.{index}"
                    entry.pop("iteration", None)
        return AboutResponse.model_validate(parsed)
    except (json.JSONDecodeError, ValidationError):
        return _default_about()


@router.get("/ui-settings", response_model=UiSettingsResponse)
def ui_settings(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UiSettingsResponse:
    del current
    return _ui_settings(db)
