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
                "iteration": "46",
                "date": "2026-05-28",
                "title": "Vergaderborden: duidelijke verplaatsingsupdates met kolomnamen",
                "highlights": [
                    "Nieuwe automatische kaartverplaatsingen gebruiken nu exact: 'Kaart verplaatst van <oude kolom> naar <nieuwe kolom>.'",
                    "In kaartdetail-updates worden de oude en nieuwe kolomnaam vet weergegeven voor dit automatische verplaatsingspatroon.",
                    "Bestaande opgeslagen updates en handmatige updates blijven ongewijzigd; datum, tijd en auteur blijven in de metadataregel staan.",
                ],
            },
            {
                "iteration": "45",
                "date": "2026-05-27",
                "title": "Vergaderbord-opnameknop duidelijker en minimale opnameduur",
                "highlights": [
                    "De opnameknop op vergaderbord-kaarten is nu duidelijk rood en rond, zodat starten direct herkenbaar is.",
                    "Tijdens opnemen verandert de knop zichtbaar naar een donkere stop-state voor extra duidelijkheid.",
                    "Opnames korter dan 5 seconden worden nu direct afgekeurd met melding: 'Opname is te kort. Neem minimaal 5 seconden op.'",
                ],
            },
            {
                "iteration": "33",
                "date": "2026-05-27",
                "title": "Kaartbeschrijving direct bewerken in Vergaderborden",
                "highlights": [
                    "In het kaartdetail kun je de beschrijving nu direct inline aanpassen zonder extra scherm.",
                    "Een gewijzigde beschrijving wordt automatisch opgeslagen zodra je uit het veld klikt.",
                    "Bij ongewijzigde tekst wordt geen onnodige opslagaanroep gedaan, waardoor werken rustiger blijft.",
                ],
            },
            {
                "iteration": "02",
                "date": "2026-03-12",
                "title": "Duidelijker dashboard en betere navigatie",
                "highlights": [
                    "Het dashboard heeft een frisse nieuwe uitstraling gekregen.",
                    "Je kunt nu bovenaan snel schakelen tussen Main, Planning, Database, Log en About.",
                    "In About zie je nu per iteratie wat er is verbeterd, opgehaald via de backend API.",
                ],
            },
            {
                "iteration": "03",
                "date": "2026-03-12",
                "title": "Persoonlijke instellingen in eigen beheer",
                "highlights": [
                    "Je kunt nu je volledige naam en e-mailadres zelf invullen of aanpassen.",
                    "Je kunt een thema kiezen dat past bij je voorkeur: licht, donker of systeem volgen.",
                    "De instellingenpagina geeft ook suggesties voor extra voorkeuren die later kunnen worden toegevoegd.",
                ],
            },
            {
                "iteration": "04",
                "date": "2026-03-12",
                "title": "Profielfoto uploaden en rond bijsnijden",
                "highlights": [
                    "Je kunt nu een eigen profielfoto uploaden vanuit je instellingen.",
                    "Voor het opslaan kun je de foto direct rond bijsnijden en netjes centreren.",
                    "Zo is je profiel in het menu direct herkenbaar voor jou en je team.",
                ],
            },
            {
                "iteration": "05",
                "date": "2026-03-12",
                "title": "Admin-menu en rollenbeheer",
                "highlights": [
                    "Admins zien nu een extra Admin-optie in het gebruikersmenu.",
                    "Op de Admin-pagina kunnen admins rechten geven of weghalen bij andere gebruikers.",
                    "Het systeem voorkomt dat de laatste admin per ongeluk adminrechten verliest.",
                ],
            },
            {
                "iteration": "06",
                "date": "2026-03-12",
                "title": "Centrale Database-pagina voor bronbestanden",
                "highlights": [
                    "Uploaden is verplaatst van Main naar Database met drag-and-drop ondersteuning.",
                    "Je ziet nu per bestand direct het gekoppelde project, wie het heeft geupload en wanneer.",
                    "Admins kunnen in het Admin-menu de projectenlijst beheren, inclusief het standaardproject Windpark de Boldijk.",
                ],
            },
            {
                "iteration": "07",
                "date": "2026-03-12",
                "title": "AI-bronindexering en transparante bronweergave",
                "highlights": [
                    "Database-bronbestanden worden nu geindexeerd zodat AI er relevante passages uit kan ophalen.",
                    "Bij generatie worden nu zowel topicbronnen als databasebronnen gecombineerd met duidelijke herkomst.",
                    "In Planning zie je bij de review direct welke bronpassages zijn gebruikt, inclusief document en project.",
                ],
            },
            {
                "iteration": "07B",
                "date": "2026-03-13",
                "title": "Planningimport met doelmedia per bericht",
                "highlights": [
                    "In Planning kun je nu een CSV importeren met vaste kolommen voor onderwerp, datum en doelmedia.",
                    "Je kunt ook handmatig losse planningsregels toevoegen, waarbij elke regel precies een bericht is.",
                    "Per regel kun je Website, Facebook en Nieuwsbrief apart aan- of uitzetten en regels ook verwijderen.",
                ],
            },
            {
                "iteration": "08",
                "date": "2026-03-13",
                "title": "Multichannel redactie op de planningsdetailpagina",
                "highlights": [
                    "Per doelmedium werk je nu met een eigen artikel, samenvatting en illustratie in de detailpagina.",
                    "Je kunt GenAI-opmerkingen vrij invullen, opslaan en direct gebruiken voor opnieuw genereren.",
                    "Goedkeuren of afwijzen gebeurt nu per medium, met akkoord op regelniveau pas wanneer alle media akkoord zijn.",
                ],
            },
            {
                "iteration": "09",
                "date": "2026-03-13",
                "title": "GenAI-instellingen vanuit Admin en optionele websearch",
                "highlights": [
                    "In Admin kun je nu centrale GenAI-instellingen beheren, zoals prompts en modelkeuze.",
                    "Websearch is nu als optie beschikbaar voor generatie, maar staat standaard uit.",
                    "Wanneer websearch aan staat, zie je in bronweergave duidelijk welke webcontext is gebruikt.",
                ],
            },
            {
                "iteration": "10",
                "date": "2026-03-14",
                "title": "Planningregels nu gekoppeld aan projecten",
                "highlights": [
                    "Elke planningsregel krijgt nu een verplicht project, zodat direct duidelijk is waar het bericht bij hoort.",
                    "In Planning zie je het project als extra kolom en kun je regels filteren per project.",
                    "AI gebruikt nu alleen databasebronnen uit hetzelfde project als de planningsregel.",
                ],
            },
            {
                "iteration": "10B",
                "date": "2026-03-14",
                "title": "Admin-tabs, themabeheer en slimme planningssjablonen",
                "highlights": [
                    "De Admin-pagina is opgedeeld in duidelijke tabs voor gebruikers, projecten, thema's, AI, scheduler en activiteit.",
                    "Admins kunnen nu thema's beheren; Planning gebruikt direct de actieve themalijst uit de backend.",
                    "In Planning kun je logische sjablonen kiezen om onderwerp, thema, opmerkingen en planning sneller voor te vullen.",
                ],
            },
            {
                "iteration": "11",
                "date": "2026-03-14",
                "title": "Duidelijke melding bij ontbrekende kanaalvariant-migratie",
                "highlights": [
                    "Bij artikelgeneratie en kanaalvarianten krijg je nu een duidelijke foutmelding als een database-migratie ontbreekt.",
                    "De melding vertelt precies welk commando je moet draaien om de migratie uit te voeren.",
                    "Hierdoor is de storing sneller op te lossen zonder onduidelijke serverfouten in Planning.",
                ],
            },
            {
                "iteration": "12",
                "date": "2026-03-14",
                "title": "Main-pagina met live dashboard en duidelijkere start",
                "highlights": [
                    "Bovenaan Main staat nu een korte inleiding, zodat direct duidelijk is waar je vandaag op stuurt.",
                    "De cijfers op Main zijn nu live gebaseerd op planningdata, zoals totaal onderwerpen en publicatiestatus.",
                    "De indeling is opgeschoond zodat het dashboard compacter leest en geen leeg wit vlak meer toont.",
                ],
            },
            {
                "iteration": "13",
                "date": "2026-03-14",
                "title": "Admin Scheduler-overzicht met recente runs en planning",
                "highlights": [
                    "In het admin-menu staat nu een aparte Scheduler-pagina voor snelle controle van de achtergrondtaken.",
                    "Je ziet nu per taak wanneer deze recent is gedraaid en welke taken nog op de planning staan.",
                    "Ook retrytaken zijn zichtbaar, inclusief volgende runmoment en pogingnummer.",
                ],
            },
            {
                "iteration": "14",
                "date": "2026-03-14",
                "title": "Planning detail met kanaalpreviews en rustigere werkindeling",
                "highlights": [
                    "De detailpagina is opnieuw ingedeeld met een duidelijke bovenkant voor planning en een aparte kanaalwerkruimte.",
                    "Per medium zie je nu direct een leesbare preview naast de editor, zodat review sneller en betrouwbaarder gaat.",
                    "Ook als content als JSON binnenkomt, wordt die nu automatisch netjes getoond als titel, artikel en samenvatting.",
                ],
            },
            {
                "iteration": "15",
                "date": "2026-03-14",
                "title": "Admin log toont nu onderwerpregels in plaats van technische IDs",
                "highlights": [
                    "In Admin heet het tabblad nu Admin log, zodat direct duidelijk is waar je beheeracties terugvindt.",
                    "Bij logregels zie je nu de onderwerpregel van het topic in plaats van een lastig leesbare topic-ID.",
                    "Lange onderwerpregels worden automatisch kort getoond, met de volledige tekst beschikbaar op hover.",
                ],
            },
            {
                "iteration": "16",
                "date": "2026-03-15",
                "title": "Logpagina live met filters en dagstart op Main",
                "highlights": [
                    "De Log-pagina toont nu echte systeemacties met duidelijke labels in gewone taal.",
                    "Je kunt logregels filteren op periode, onderwerp en type actie zodat je sneller vindt wat je zoekt.",
                    "Op Main staat nu een compact blok met recente logregels plus een concrete feature-suggestie.",
                ],
            },
            {
                "iteration": "17",
                "date": "2026-03-15",
                "title": "n8n-meldingen zichtbaar en centraal afgehandeld",
                "highlights": [
                    "Succes- en foutmeldingen voor generatie en publicatie lopen nu via een n8n-koppeling.",
                    "Op Main en Log zie je deze meldingen direct terug, inclusief status en onderwerp.",
                    "Dubbele meldingen worden voorkomen, zodat admins geen herhaalde Telegram-meldingen krijgen.",
                ],
            },
            {
                "iteration": "18",
                "date": "2026-03-15",
                "title": "Subtiel wind-thema met centrale adminschakelaar",
                "highlights": [
                    "De interface gebruikt nu subtiele windturbine-accenten die passen bij het projectthema.",
                    "In Admin kan het team het wind-thema centraal aan- of uitzetten voor alle gebruikers.",
                    "De instelling wordt direct toegepast in de hele omgeving, zonder extra handmatige stappen.",
                ],
            },
            {
                "iteration": "19",
                "date": "2026-03-16",
                "title": "Planning detail nu rustiger, leesbaarder en met vaste 3-media preview",
                "highlights": [
                    "De detailpagina toont nu standaard Facebook, Nieuwsbrief en Website naast elkaar op desktop en onder elkaar op mobiel.",
                    "Statusbadges en kaartkleuren zijn aangescherpt voor betere leesbaarheid en duidelijker semantisch kleurgebruik.",
                    "Bronpassages staan nu in een compacte accordion met bron, chunk en scorebadge zodat review sneller gaat.",
                ],
            },
            {
                "iteration": "20",
                "date": "2026-03-16",
                "title": "Planning detail met aparte tekst/afbeelding-goedkeuring en directe afwijs-webhook",
                "highlights": [
                    "Per kanaal kun je nu tekst en afbeelding apart op akkoord zetten of afwijzen, met duidelijke onderdeelstatussen.",
                    "Er zijn nu aparte opmerkingenvelden voor tekst en afbeelding, zodat feedback gerichter kan worden meegegeven.",
                    "Bij afwijzen stuurt de backend direct een stille n8n-webhook en previews tonen AI-afbeeldingen nu echt als beeld.",
                ],
            },
            {
                "iteration": "21",
                "date": "2026-03-16",
                "title": "Planning detail opnieuw uitgelijnd met strakke rasteropbouw",
                "highlights": [
                    "De hele detailpagina gebruikt nu een consistente 12-koloms opbouw, waardoor secties niet meer schots en scheef staan.",
                    "Bovenaan staan Opmerkingen en Planningvoortgang nu strak naast elkaar in een duidelijke 8/4 verdeling.",
                    "De drie kanaalpreviews hebben nu gelijke kaartopbouw en stabielere hoogte, met compacte actiebalken per sectie.",
                ],
            },
            {
                "iteration": "22",
                "date": "2026-03-24",
                "title": "WindWilly-suite start met Wervelnieuws als subdienst",
                "highlights": [
                    "De omgeving heeft nu een WindWilly-suite navigatie met modules voor Chatbot, Wervelnieuws en twee nieuwe placeholders.",
                    "Wervelnieuws draait nu als subdienst onder /wervelnieuws, zodat de suite klaar is voor verdere uitbreiding.",
                    "Bestaande routes blijven bruikbaar via automatische doorverwijzing naar de nieuwe suite-structuur.",
                ],
            },
            {
                "iteration": "23",
                "date": "2026-03-24",
                "title": "Main opgeschoond en bronbestanden standaard projectoverstijgend",
                "highlights": [
                    "De bovenste welkomkaart op Main is verwijderd, waardoor het dashboard direct met kerninformatie start.",
                    "In het Wervelnieuws submenu heet Database nu Bronbestanden voor duidelijker taalgebruik.",
                    "Op de databasepagina zie je nu standaard bestanden van alle projecten, met behoud van projectfilter en upload per gekozen project.",
                ],
            },
            {
                "iteration": "24",
                "date": "2026-03-24",
                "title": "Nieuwe Trello-placeholder in de WindWilly-suite",
                "highlights": [
                    "In de hoofdnavigatie staat nu een extra Trello-tab naast Urenverantwoording.",
                    "De nieuwe Trello-pagina is als duidelijke placeholder toegevoegd voor een komende interne projectboardmodule.",
                    "De pagina heeft nu alvast een herkenbare board-achtergrond, zodat de toekomstige richting direct zichtbaar is.",
                ],
            },
            {
                "iteration": "25",
                "date": "2026-03-24",
                "title": "Technische upgrade: stabielere basis, veiligere configuratie en betrouwbaardere achtergrondtaken",
                "highlights": [
                    "De applicatie is intern opgeschoond met een modulaire frontend-opzet, waardoor doorontwikkeling en onderhoud sneller en overzichtelijker worden.",
                    "Beveiligingsinstellingen zijn aangescherpt: productie draait nu alleen met expliciete CORS-origins en een veilige geheime sleutel.",
                    "Rate limiting en worker-afhandeling zijn robuuster gemaakt, zodat piekverkeer en parallelle workers betrouwbaarder en consistenter worden verwerkt.",
                ],
            },
            {
                "iteration": "26",
                "date": "2026-03-25",
                "title": "Landingspagina rustiger met coöperatiecontext en vaste voettekst",
                "highlights": [
                    "De bovenste startsectie op de WindWilly-landing gebruikt nu themakleuren, zodat het storende witte vlak verdwijnt.",
                    "Op de landing staat nu ook algemene informatie over Energiek Daarle, Duurzaam Daarlerveen en Noaber & Co.",
                    "Onderaan de omgeving staat nu een subtiele voettekst met copyright en makersvermelding.",
                ],
            },
            {
                "iteration": "27",
                "date": "2026-03-25",
                "title": "WindWilly-chatpagina als gerichte placeholder voor windinformatie",
                "highlights": [
                    "De WindWilly-module heeft nu een chat-achtige opzet, zodat de toekomstige assistent direct herkenbaar is.",
                    "De voorbeeldvragen en voorbeeldantwoorden zijn toegespitst op windprojectinformatie, planning en bewonerscommunicatie.",
                    "Het is bewust nog een placeholder: de schermopbouw staat klaar, maar zonder live AI-gesprekken in deze iteratie.",
                ],
            },
            {
                "iteration": "28",
                "date": "2026-05-14",
                "title": "Nieuwe adminmodule Vergaderborden met kaarten, updates en opnames",
                "highlights": [
                    "Admins en uitgenodigde gebruikers kunnen nu werken met projectgebonden vergaderborden in drie vaste kolommen: Te doen, Bezig en Klaar.",
                    "Kaarten ondersteunen drag-and-drop verplaatsen, updatehistorie en directe samenwerking met toegewezen gebruikers.",
                    "Voor kaarten in Bezig kun je nu audio-opnames maken en uploaden, met veilige opslag op de server en download in het kaartdetail.",
                ],
            },
            {
                "iteration": "29",
                "date": "2026-05-22",
                "title": "Vergaderborden vervangt Trello-placeholder in navigatie en landing",
                "highlights": [
                    "De hoofdnavigatie toont nu Vergaderborden als vaste module-entry, zodat je direct in het werkende bordenoverzicht terechtkomt.",
                    "De oude /trello-placeholderroute is verwijderd; de primaire route voor borden is nu /vergaderborden.",
                    "Ook op de landing is de kaart bijgewerkt naar echte Vergaderborden-functionaliteit in plaats van placeholdertekst.",
                ],
            },
            {
                "iteration": "30",
                "date": "2026-05-22",
                "title": "Vergaderborden rustiger en consistenter ingedeeld",
                "highlights": [
                    "Het formulier Nieuw project is opnieuw uitgelijnd met duidelijke velden, labels en een stabiele actieknoppenrij.",
                    "Per bordkolom zijn de kaart-toevoegregels compacter en consistenter opgebouwd, met betere uitlijning van invoer en acties.",
                    "Spacing, typografie en responsive gedrag zijn aangescherpt voor mobiel, tablet en desktop zonder wijziging van functionaliteit.",
                ],
            },
            {
                "iteration": "31",
                "date": "2026-05-26",
                "title": "Vergaderborden: kaart toevoegen en update-flow duidelijker gemaakt",
                "highlights": [
                    "Het compacte kaartformulier in alle kolommen is nu strakker uitgelijnd met verplichte titel en directe inline foutmelding.",
                    "Het kaartdetailvenster heeft een kleinere sluitknop rechtsboven en sluit nu ook direct bij een klik buiten het venster.",
                    "Updates worden nu onder het formulier getoond (nieuwste bovenaan) met datum/tijd en auteur, plus nette fallback en lege statusmelding.",
                ],
            },
            {
                "iteration": "32",
                "date": "2026-05-26",
                "title": "Vergaderborden: rustiger kaart-aanmaak en teamselectie verbeterd",
                "highlights": [
                    "Per bordkolom staat het kaartformulier nu standaard verborgen achter een duidelijke '+ Kaart toevoegen'-knop, waardoor het bord rustiger leest.",
                    "Er kan nu maar één kaartformulier tegelijk openstaan en na succesvol opslaan sluit het formulier automatisch.",
                    "Teamleden kies je nu via een overzichtelijke dropdown met multi-select, terwijl de koppeling op de achtergrond hetzelfde blijft werken.",
                ],
            },
            {
                "iteration": "33",
                "date": "2026-05-26",
                "title": "Vergaderborden: kaartjes verslepen nu duidelijker en betrouwbaarder",
                "highlights": [
                    "Kaartjes tussen Te doen, Bezig en Klaar opslaan nu direct bij loslaten, zodat de nieuwe status meteen wordt bewaard.",
                    "Tijdens slepen en opslaan zie je nu duidelijkere visuele feedback per kolom, inclusief melding als een kaart wordt opgeslagen.",
                    "Bij een fout krijg je een heldere Nederlandstalige melding en het bord wordt automatisch opnieuw opgehaald voor consistente weergave.",
                ],
            },
            {
                "iteration": "34",
                "date": "2026-05-26",
                "title": "Vergaderborden: kolomverplaatsingen nu zichtbaar in kaartupdates",
                "highlights": [
                    "Bij het verplaatsen van een kaart tussen Te doen, Bezig en Klaar wordt nu automatisch een zichtbare kaartupdate toegevoegd.",
                    "De update toont van/naar-kolom in het Nederlands, inclusief gebruiker en tijdstip van de verplaatsing.",
                    "Bij een same-column drop/no-op wordt geen extra systeemupdate aangemaakt, zodat de timeline schoon blijft.",
                ],
            },
            {
                "iteration": "35",
                "date": "2026-05-26",
                "title": "Vergaderborden: kaarttitels direct aanpassen",
                "highlights": [
                    "Vergaderbord-kaarten tonen nu een handje bij hover, zodat direct duidelijk is dat je ze kunt openen.",
                    "Kaarttitels kun je nu rechtstreeks op het bord aanpassen zonder eerst het kaartdetail te openen.",
                    "Een aangepaste titel wordt direct opgeslagen en lege titels worden met een duidelijke melding tegengehouden.",
                ],
            },
            {
                "iteration": "36",
                "date": "2026-05-27",
                "title": "Vergaderborden: kaarttitels bewerken vanuit kaartdetail",
                "highlights": [
                    "Kaarttitels pas je nu alleen aan nadat je een kaart hebt geopend, zodat het bordoverzicht rustig blijft voor scannen en slepen.",
                    "In het kaartdetail kun je de titel nog steeds direct inline wijzigen met dezelfde duidelijke validatie.",
                    "Kaarten in het overzicht blijven klikbaar met een handcursor en openen gewoon de detailweergave.",
                ],
            },
            {
                "iteration": "37",
                "date": "2026-05-27",
                "title": "Vergaderborden: compact project kiezen via dropdown",
                "highlights": [
                    "Bovenaan Vergaderborden kies je nu een project via een compacte dropdown in plaats van grote projectkaarten.",
                    "Als het project 'Algemeen' beschikbaar is, wordt dat nu automatisch als standaard gekozen.",
                    "De bordkaarten en kaartinteracties blijven hetzelfde, met meer zichtbare ruimte voor het bord zelf.",
                ],
            },
            {
                "iteration": "38",
                "date": "2026-05-27",
                "title": "Vergaderborden: projectkeuze via hoofdmenu en admin-only projectaanmaak",
                "highlights": [
                    "Projectkeuze voor Vergaderborden loopt nu via het hoofdmenu, met directe links per project naar /vergaderborden?project=<id>.",
                    "De Vergaderborden-pagina leest projectselectie nu uit de URL, inclusief fallback naar 'Algemeen' bij ontbrekende of ongeldige query.",
                    "Nieuw project aanmaken staat niet meer in de reguliere weergave en is alleen nog beschikbaar via de admin-context.",
                ],
            },
            {
                "iteration": "39",
                "date": "2026-05-27",
                "title": "Vergaderborden: sneller terug naar je laatst gekozen bord",
                "highlights": [
                    "De hoofdmenu-link Vergaderborden opent nu automatisch het laatst gekozen geldige project in dezelfde browser.",
                    "Als een oude projectkeuze niet meer bestaat, valt de pagina automatisch terug op Algemeen of het eerste beschikbare project.",
                    "Bovenaan Vergaderborden zie je nu alleen de naam van het geopende bord, zonder de generieke subtitel.",
                ],
            },
            {
                "iteration": "40",
                "date": "2026-05-27",
                "title": "Vergaderborden: duidelijkere verplaatsingsupdates en volledige namen",
                "highlights": [
                    "Automatische kaartverplaatsingsupdates zijn korter en tonen alleen nog van/naar-kolom plus wie de verplaatsing deed.",
                    "De tijd staat niet meer dubbel in de update-tekst, omdat datum en tijd al apart als metadata onder elke update zichtbaar blijven.",
                    "Waar gebruikers in Vergaderborden zichtbaar zijn, tonen we nu bij voorkeur de volledige naam met een nette fallback naar gebruikersnaam.",
                ],
            },
            {
                "iteration": "41",
                "date": "2026-05-27",
                "title": "Admin: nieuw vergaderbord aanmaken nu direct zichtbaar",
                "highlights": [
                    "Op de Admin-pagina staat nu een duidelijk hoofditem ‘Nieuw vergaderbord aanmaken’.",
                    "De oude admin-optie is weggehaald uit de Vergaderborden-projectdropdown bovenin.",
                    "De knop opent nog steeds dezelfde bestaande flow om een nieuw vergaderbordproject aan te maken.",
                ],
            },
            {
                "iteration": "42",
                "date": "2026-05-27",
                "title": "Ingelogd blijven na verversen of browser herstart",
                "highlights": [
                    "Adminsessies blijven nu standaard 30 dagen actief, zodat je niet telkens opnieuw hoeft in te loggen.",
                    "De app controleert bij het opstarten automatisch je sessie via een veilige servercheck.",
                    "Uitloggen sluit de sessie nu direct af en verwijdert de login-cookie netjes.",
                ],
            },
            {
                "iteration": "43",
                "date": "2026-05-27",
                "title": "Vergaderborden: direct opnemen op elk kaartje",
                "highlights": [
                    "Elk kaartje in Te doen, Bezig en Klaar heeft nu een eigen opnameknop, zodat je direct kunt starten zonder eerst detail te openen.",
                    "Tijdens opname draait de timer alleen op het actieve kaartje en er kan maar één opname tegelijk actief zijn.",
                    "Opname-uploads worden nu voor alle kaartkolommen geaccepteerd; na upload verversen bord en kaartdetail direct.",
                ],
            },
            {
                "iteration": "44",
                "date": "2026-05-27",
                "title": "Vergaderborden: compacte opnameknop op kaartjes",
                "highlights": [
                    "De opnameknop op kaartjes is nu compact en staat rechtsboven als icoonknop, zodat kaarten rustiger en overzichtelijker blijven.",
                    "Bij actieve opname verandert de knop direct naar een duidelijke rode stopknop, terwijl de timer zichtbaar blijft op het actieve kaartje.",
                    "De opnamebediening blijft volledig toegankelijk met Nederlandstalige knoplabels en tooltips voor start en stop.",
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
