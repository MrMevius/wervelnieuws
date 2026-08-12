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
                "iteration": "102",
                "date": "2026-08-12",
                "title": "Wervelnieuws start betrouwbaarder na onderhoud",
                "highlights": [
                    "De onderdelen voor website, beheer en achtergrondwerk starten voortaan apart en blijven daardoor beter beschikbaar na gewoon onderhoud.",
                    "Technisch onderhoud aan de database gebeurt nu bewust als aparte release-stap, zodat een normale herstart geen onverwachte wijziging uitvoert.",
                ],
            },
            {
                "iteration": "101",
                "date": "2026-08-12",
                "title": "Urenregistratie kiest deelnemers en duur duidelijker",
                "highlights": [
                    "WindWilly-personen en externe personen staan nu in aparte keuzelijsten, zodat je deelnemers sneller kunt controleren en aanpassen.",
                    "De duur kies je nu direct in duidelijke stappen van een half uur, terwijl de compacte registratie op mobiel en desktop bruikbaar blijft.",
                ],
            },
            {
                "iteration": "100",
                "date": "2026-08-11",
                "title": "Topicbronnen ondersteunen nu veilige audio-transcriptie",
                "highlights": [
                    "Je kunt een geldige WebM-audio-opname als topicbron toevoegen; de opname wordt daarna veilig verwerkt tot een doorzoekbare tekstbron.",
                    "Bestanden die niet aan de audiocontroles voldoen, worden direct afgewezen zodat alleen bruikbare opnames verdergaan.",
                ],
            },
            {
                "iteration": "99",
                "date": "2026-08-10",
                "title": "Admin-fouten zijn duidelijker per onderdeel",
                "highlights": [
                    "Beheerders zien nu welk onderdeel van Admin niet geladen kan worden en kunnen alleen dat onderdeel opnieuw proberen.",
                    "Andere beschikbare beheeronderdelen blijven ondertussen bruikbaar.",
                ],
            },
            {
                "iteration": "98",
                "date": "2026-08-10",
                "title": "Projecten zijn per module in te stellen",
                "highlights": [
                    "Beheerders kiezen nu per project of het beschikbaar is in Vergaderborden, Urenverantwoording of beide.",
                    "Beschrijvingen bij urenposten hebben meer ruimte voor langere, overzichtelijke teksten.",
                ],
            },
            {
                "iteration": "97",
                "date": "2026-08-10",
                "title": "Urenregistratie is eenvoudiger en gebruikt normale systeemback-ups",
                "highlights": [
                    "De aparte JSON-import en -back-up voor uren is verwijderd; CSV-export en het afzonderlijk herstellen van verwijderde registraties en externe personen blijven beschikbaar.",
                    "Beheerders beveiligen de volledige installatie voortaan met de normale database- en storageback-up.",
                ],
            },
            {
                "iteration": "96",
                "date": "2026-08-09",
                "title": "Uren sneller registreren met centraal project- en postenbeheer",
                "highlights": [
                    "Registreer uren direct in de compacte bovenste tabelrij, filter vanuit de kolomkoppen en beheer projecten en globale posten voortaan centraal in Admin.",
                ],
            },
            {
                "iteration": "95",
                "date": "2026-08-04",
                "title": "Urenregistratie maakt audit en historie beter inzichtelijk",
                "highlights": [
                    "Audits zijn beter doorzoekbaar en gepagineerd, en urenoverzichten tonen datums consequent in Nederlandse notatie.",
                ],
            },
            {
                "iteration": "94",
                "date": "2026-08-04",
                "title": "Urenregistratie beschermt historie en persoonsgegevens beter",
                "highlights": [
                    "CSV-export, individueel herstel en samenvoegen volgen strikte controles, terwijl historische namen intact blijven en modals beter met toetsenbord en schermlezer werken.",
                ],
            },
            {
                "iteration": "93",
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
                "iteration": "92",
                "date": "2026-07-29",
                "title": "Vergaderbord-kaarten krijgen archief en prullenbak",
                "highlights": [
                    "Kaarten op vergaderborden kunnen nu worden gearchiveerd en later weer teruggezet via een aparte archieftab.",
                    "Soft-verwijderde kaarten verdwijnen uit het bord en komen in een centrale admin-prullenbak terecht, zonder harde database-delete.",
                    "De kaartdata, posities en historie blijven bewaard, met auditlogs voor archiveren, herstellen en verwijderen.",
                ],
            },
            {
                "iteration": "91",
                "date": "2026-07-29",
                "title": "Lichtmodusknoppen en invoervelden zijn duidelijker",
                "highlights": [
                    "De knoppen in het vergaderbord-detail zijn nu beter zichtbaar in lichte weergave, inclusief sluit-, upload- en actieknoppen.",
                    "Invoervelden, statuslabels en modals gebruiken rustiger oppervlaktes en duidelijkere contrasten zonder de workflow te veranderen.",
                    "De interface blijft hetzelfde in opbouw, maar lichtmodus is nu minder gevoelig voor contrastregressies.",
                ],
            },
            {
                "iteration": "90",
                "date": "2026-07-28",
                "title": "Gebruikersvenster leest rustiger in donkere modus",
                "highlights": [
                    "Het hoofdvenster voor gebruikersbeheer gebruikt nu neutralere charcoal-vlakken in plaats van sterke paarstinten.",
                    "Knoppen, invoervelden en actieblokken vallen duidelijker op, terwijl de indeling hetzelfde blijft.",
                    "De kleuren zijn beter afgestemd op leesbaarheid in donkere weergave zonder andere vensters te raken.",
                ],
            },
            {
                "iteration": "89",
                "date": "2026-07-28",
                "title": "Vergaderborden krijgen een duidelijke paarse stijl",
                "highlights": [
                    "Vergaderbordkolommen, knoppen, badges en focusstates hebben nu een herkenbare paarse accentkleur.",
                    "De rest van de interface blijft rustig en goed leesbaar, ook in donkere weergave.",
                    "Modals en overlays sluiten nu visueel aan op de paarse bordstijl zonder dat je werkwijze verandert.",
                ],
            },
            {
                "iteration": "88",
                "date": "2026-07-01",
                "title": "Vergaderbord-updates tonen de opmaaktoolbar pas bij focus",
                "highlights": [
                    "Bij een nieuwe update blijft de opmaaktoolbar eerst uit beeld totdat je in het tekstvak klikt of focus geeft.",
                    "Dezelfde rustiger focuservaring geldt nu ook voor het bewerken van een bestaande update.",
                    "De beschrijving-editor in kaartdetail blijft werken zoals je gewend bent en toont de toolbar nog steeds direct.",
                ],
            },
            {
                "iteration": "87",
                "date": "2026-06-22",
                "title": "Meerdere bijlagen tegelijk toevoegen in Vergaderborden",
                "highlights": [
                    "Je kunt nu meerdere bestanden in één keer kiezen of slepen bij een vergaderbord-kaart.",
                    "De uploadknop verwerkt de selectie achter elkaar, zodat je niet elk bestand los hoeft toe te voegen.",
                    "Als niet alles lukt, zie je duidelijk welke bestanden wel en niet zijn gelukt.",
                ],
            },
            {
                "iteration": "86",
                "date": "2026-06-22",
                "title": "Afbeeldingsbijlagen kun je nu groter bekijken",
                "highlights": [
                    "Afbeeldingsbijlagen tonen nu een klikbare preview in de bijlagenlijst.",
                    "Klikken opent een groter venster dat netjes binnen het scherm past.",
                    "Sluiten blijft eenvoudig via de knop, de achtergrond of Escape.",
                ],
            },
            {
                "iteration": "85",
                "date": "2026-06-17",
                "title": "Vergaderbord-kaartdetail voelt rustiger en overzichtelijker",
                "highlights": [
                    "Het kaartdetail heeft nu duidelijkere secties voor titel, beschrijving, update-invoer, bijlagen en geschiedenis.",
                    "Bijlagen zijn makkelijker te uploaden met een drag-and-drop zone en duidelijkere download- en verwijderknoppen.",
                    "De updategeschiedenis is compacter en beter scanbaar, terwijl de editor en sluitknop rustiger in de modal zijn geïntegreerd.",
                ],
            },
            {
                "iteration": "84",
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
                "iteration": "83",
                "date": "2026-06-17",
                "title": "Bijlagen direct toevoegen bij nieuwe vergaderbord-kaarten",
                "highlights": [
                    "Bij een nieuwe vergaderbord-kaart kun je nu meteen meerdere bestanden kiezen voordat je opslaat.",
                    "Na het aanmaken worden de gekozen bijlagen automatisch gekoppeld aan de kaart.",
                    "Als een upload mislukt, blijft de kaart bestaan en zie je daar een duidelijke melding over.",
                ],
            },
            {
                "iteration": "82",
                "date": "2026-06-16",
                "title": "Vergaderbord-kaarten ondersteunen nu bijlagen",
                "highlights": [
                    "Op toegankelijke vergaderbord-kaarten kun je nu bestanden uploaden als bijlage, direct in het kaartdetail.",
                    "Bijlagen zijn zichtbaar in een duidelijke lijst met download- en verwijderacties, en volgen dezelfde bordtoegang als de kaart zelf.",
                    "De nieuwe bijlagefunctionaliteit gebruikt lokale opslag en heeft backend- en frontenddekking voor de belangrijkste CRUD- en permissieflows.",
                ],
            },
            {
                "iteration": "81",
                "date": "2026-06-16",
                "title": "Teamleden op vergaderbord-kaarten volgen nu bordtoegang",
                "highlights": [
                    "De Teamleden-selector gebruikt nu de gebruikers die toegang hebben tot het actuele vergaderbord, zodat ook uitgenodigde niet-admins gewoon kunnen selecteren.",
                    "Als teamleden nog laden, niet beschikbaar zijn of er geen actieve bordgebruikers zijn, zie je nu een duidelijke melding in plaats van een leeg vak.",
                    "Alleen actieve en toegestane bordgebruikers kunnen nog aan een kaart worden toegewezen, waardoor foutieve toewijzingen direct worden tegengehouden.",
                ],
            },
            {
                "iteration": "80",
                "date": "2026-06-13",
                "title": "Automatische verplaats-updates zijn nu alleen informatief",
                "highlights": [
                    "Kaartverplaatsingen in de kaartmodal tonen voortaan geen bewerk- of verwijderknoppen meer.",
                    "Hierdoor zijn automatische verplaatsingsupdates duidelijker herkenbaar als systeemmelding en minder foutgevoelig.",
                ],
            },
            {
                "iteration": "79",
                "date": "2026-06-12",
                "title": "Vergaderbord-header gebruikt avatarbadges",
                "highlights": [
                    "Op het geopende vergaderbord zie je toegangsgebruikers nu als compacte avatarbadges in plaats van naamchips.",
                    "Wanneer een avatar beschikbaar is, wordt die gebruikt; anders zie je automatisch initialen als fallback.",
                    "De +N-overflowbadge laat verborgen toegangsgebruikers nu op hover/focus zien via titel en aria-label, terwijl de header compact blijft met maximaal vijf zichtbare badges.",
                ],
            },
            {
                "iteration": "77",
                "date": "2026-06-12",
                "title": "Compacte bordrechtenmatrix met admins",
                "highlights": [
                    "Admins zijn nu zichtbaar in Admin > Bordrechten als read-only rijen met een duidelijke Admin-badge.",
                    "De matrix is compacter opgebouwd met kleinere spacing, zodat de rechtenpagina rustiger en beter scanbaar is.",
                    "Opslaan blijft beperkt tot niet-admin wijzigingen, terwijl admins automatisch overal toegang houden.",
                ],
            },
            {
                "iteration": "76",
                "date": "2026-06-12",
                "title": "Bordrechten werken nu als matrix",
                "highlights": [
                    "In Admin > Bordrechten zie je nu direct welke niet-admin gebruiker toegang heeft tot welk bord.",
                    "Wijzigingen sla je pas op met één centrale knop, zodat je eerst een duidelijk overzicht hebt van alle aanpassingen.",
                    "De bordbeheeracties blijven beschikbaar op dezelfde pagina, zodat aanmaken en archiveren gewoon doorwerken.",
                ],
            },
            {
                "iteration": "75",
                "date": "2026-06-12",
                "title": "Bordrechtenbeheer is overzichtelijker geworden",
                "highlights": [
                    "De actieve tab op de pagina Admin > Bordrechten valt nu ook in donkere weergave duidelijker op.",
                    "Bordkaarten zijn rustiger opgebouwd, zodat status, rechten en acties sneller te scannen zijn.",
                    "Zoeken, filters en feedback maken het makkelijker om bordrechten aan te passen met minder misclicks.",
                ],
            },
            {
                "iteration": "74",
                "date": "2026-06-12",
                "title": "WindWilly-startpagina verder versoberd",
                "highlights": [
                    "De landing toont nu alleen nog de hero en het blok met samenwerkende coöperaties.",
                    "De CTA-knoppen, het aparte introblok en de extra footerzin zijn verwijderd voor een rustigere pagina.",
                    "De startpagina blijft compact, herkenbaar en in lijn met de bestaande WindWilly-branding.",
                ],
            },
            {
                "iteration": "73",
                "date": "2026-06-11",
                "title": "WindWilly-startpagina terug naar de kern",
                "highlights": [
                    "De homepage is teruggebracht tot een rustige start met alleen een heldere hero, korte intro en de samenwerkende coöperaties.",
                    "Extra portaalblokken en update-onderdelen zijn van de startpagina weggehaald.",
                    "De pagina blijft zo overzichtelijk en past beter bij de bestaande WindWilly-branding.",
                ],
            },
            {
                "iteration": "72",
                "date": "2026-06-11",
                "title": "Compactere bewerkmodal voor gebruikers",
                "highlights": [
                    "De bewerkmodal in Admin > Gebruikers gebruikt minder witruimte, kortere uitleg en compactere velden.",
                    "Profielgegevens, avatarupload en accountacties blijven bij elkaar zichtbaar, zodat minder scrollen nodig is.",
                    "Alle bestaande beheeracties en bevestigingen blijven behouden, inclusief bescherming bij onopgeslagen wijzigingen.",
                ],
            },
            {
                "iteration": "71",
                "date": "2026-06-11",
                "title": "Rustigere gebruikersmodal met veilig sluiten",
                "highlights": [
                    "De bewerkmodal in Admin > Gebruikers sluit nu ook via de overlay of Escape wanneer er geen wijzigingen openstaan.",
                    "Bij gewijzigde profielvelden of een gekozen avatar vraagt de modal eerst bevestiging voordat wijzigingen worden weggegooid.",
                    "Profielgegevens, avatarupload en accountacties zijn duidelijker gegroepeerd met herkenbare risicovolle acties.",
                ],
            },
            {
                "iteration": "70",
                "date": "2026-06-11",
                "title": "Overzichtelijkere gebruikersacties voor admins",
                "highlights": [
                    "In Admin > Gebruikers toont de tabel per gebruiker alleen nog de actie Bewerken.",
                    "Adminrechten, status, verwijderen en wachtwoord resetten staan nu overzichtelijk bij Accountacties in de bewerkmodal.",
                    "Bevestigingen en bescherming tegen riskante acties op je eigen account blijven duidelijk zichtbaar aanwezig.",
                ],
            },
            {
                "iteration": "69",
                "date": "2026-06-11",
                "title": "Admins kunnen gebruikersprofielen direct bewerken",
                "highlights": [
                    "De actieknoppen in Admin > Gebruikers zijn compacter en staan rustiger uitgelijnd in de tabel.",
                    "Elke gebruiker heeft nu een duidelijke Bewerken-actie waarmee naam, e-mailadres en avatar in een modal aangepast kunnen worden.",
                    "Bestaande bevestigingen en bescherming tegen riskante eigen-accountacties blijven behouden.",
                ],
            },
            {
                "iteration": "68",
                "date": "2026-06-11",
                "title": "Veiliger gebruikersbeheer voor admins",
                "highlights": [
                    "De Gebruikers-tab heeft nu duidelijke beheeruitleg, labels en gescheiden secties voor toevoegen en beheren.",
                    "Risicovolle acties zoals uitschakelen, verwijderen, adminrechten verwijderen en wachtwoord resetten vragen eerst bevestiging.",
                    "Admins worden beter beschermd tegen het per ongeluk uitschakelen, verwijderen of degraderen van hun eigen account.",
                ],
            },
            {
                "iteration": "67",
                "date": "2026-06-09",
                "title": "Aparte changelog en duidelijkere previewmeldingen",
                "highlights": [
                    "De changelog heeft nu een eigen pagina die vanaf de WindWilly-startpagina bereikbaar is.",
                    "Wijzigingen worden met de nieuwste update bovenaan getoond.",
                    "De WindWilly Assistent en Wervelnieuws tonen duidelijker welke onderdelen nog preview of work in progress zijn.",
                ],
            },
            {
                "iteration": "66",
                "date": "2026-06-09",
                "title": "Rustiger startscherm na inloggen",
                "highlights": [
                    "Het WindWilly-startscherm opent nu direct met een korte introductie over de drie samenwerkende energiecoöperaties.",
                    "De tijdelijke suitekaarten en Bestuur-placeholder zijn van de startpagina gehaald, terwijl de bestaande navigatie bovenaan gelijk blijft.",
                ],
            },
            {
                "iteration": "65",
                "date": "2026-06-09",
                "title": "Login blijft werken bij tijdelijk Onthoud mij-probleem",
                "highlights": [
                    "Als de onthouden-sessie niet kan worden opgeslagen, lukt inloggen met geldige gegevens nu alsnog als normale sessie.",
                    "Er wordt dan geen Onthoud mij-cookie gezet, zodat de langere sessie niet half wordt geactiveerd.",
                    "Beheerders krijgen een veilige logmelding om ontbrekende migraties of tabelproblemen te herkennen zonder gevoelige tokens te loggen.",
                ],
            },
            {
                "iteration": "64",
                "date": "2026-06-09",
                "title": "Ingelogd blijven per apparaat met Onthoud mij",
                "highlights": [
                    "Op het inlogscherm kun je nu Onthoud mij aanvinken om op dit apparaat ingelogd te blijven.",
                    "De langere sessie gebruikt een veilige HTTP-only cookie en kan per apparaat worden ingetrokken door uit te loggen.",
                    "Uitloggen op één browser laat andere apparaten met hun eigen onthouden sessie ongemoeid.",
                ],
            },
            {
                "iteration": "63",
                "date": "2026-06-09",
                "title": "Vergaderbord-kaartbeschrijving direct bewerken",
                "highlights": [
                    "In het kaartdetail van vergaderborden wordt de beschrijving nu nog maar één keer getoond.",
                    "Je kunt de zichtbare beschrijving direct aanklikken om deze inline te bewerken en op te slaan.",
                    "Kaarten zonder beschrijving tonen een duidelijke knop om meteen een beschrijving toe te voegen.",
                ],
            },
            {
                "iteration": "62",
                "date": "2026-06-03",
                "title": "Admins beheren toegang tot vergaderborden",
                "highlights": [
                    "In Admin is een nieuw onderdeel Bordrechten toegevoegd waarmee admins per vergaderbord gebruikers kunnen selecteren of deselecteren.",
                    "Niet-admin gebruikers zien en openen alleen nog vergaderborden waarvoor ze toegang hebben gekregen.",
                    "Admins houden automatisch toegang tot alle vergaderborden en kunnen borden aanmaken of als soft-delete verwijderen.",
                ],
            },
            {
                "iteration": "60",
                "date": "2026-06-02",
                "title": "Update-tijden op vergaderborden tonen nu Amsterdamse tijd",
                "highlights": [
                    "De datumregel bij updates en audio-opnames op vergaderbord-kaarten gebruikt nu expliciet de lokale tijdzone Europe/Amsterdam.",
                    "UTC-tijden uit de backend worden daardoor correct als Nederlandse zomer- of wintertijd getoond.",
                    "Opgeslagen updates en bestaande update-teksten blijven ongewijzigd; alleen de zichtbare tijdweergave is gecorrigeerd.",
                ],
            },
            {
                "iteration": "58",
                "date": "2026-06-02",
                "title": "Verplaats-updates op vergaderborden compacter weergegeven",
                "highlights": [
                    "Wanneer een kaartje naar een andere kolom wordt verplaatst, toont de update nu compacter als 'Kaart verplaatst: oude kolom → nieuwe kolom'.",
                    "De datum, auteur en acties bij updates blijven hetzelfde werken, maar de melding breekt minder rommelig over meerdere regels.",
                ],
            },
            {
                "iteration": "57",
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
                "iteration": "56",
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
                "iteration": "55",
                "date": "2026-05-29",
                "title": "Vergaderbord-kaartbeschrijvingen nu rijker en beter leesbaar",
                "highlights": [
                    "Bij nieuwe kaarten en het bewerken van kaartbeschrijvingen heb je nu een ruimere editor met opmaakknoppen voor vet, cursief, onderstrepen en lijstjes.",
                    "Beschrijvingen groeien automatisch mee tijdens typen en ondersteunen nu maximaal 2000 tekens met duidelijke teller.",
                    "Dezelfde opmaak wordt veilig en consistent getoond in zowel kaartdetails als het kolomoverzicht, zonder HTML-uitvoering.",
                ],
            },
            {
                "iteration": "54",
                "date": "2026-05-28",
                "title": "Audio-opnames tonen nulduur nu als onbekend en bewaren duur robuuster",
                "highlights": [
                    "Nieuwe opnames op vergaderbord-kaarten gebruiken nu een robuustere duurdoorsturing, zodat geldige opnames niet als 0 seconden worden opgeslagen.",
                    "Opnames met duur 0 worden nu consequent als onbekend behandeld, zodat je in kaartupdates geen misleidende '0:00' meer ziet.",
                    "Afspelen en downloaden van audio-opnames blijven ongewijzigd werken via dezelfde speler en downloadlink.",
                ],
            },
            {
                "iteration": "53",
                "date": "2026-05-28",
                "title": "Audio-opnames tonen nu duur en bestandsgrootte in kaartupdates",
                "highlights": [
                    "Bij audio-opnames in vergaderbord-kaarten zie je nu direct de opnameduur en bestandsgrootte in een aparte metadataregel.",
                    "Ook oudere opnames zonder complete metadata blijven netjes zichtbaar met een duidelijke 'onbekend'-weergave.",
                    "Afspelen en downloaden van opnames werken zoals voorheen via dezelfde speler en downloadlink.",
                ],
            },
            {
                "iteration": "52",
                "date": "2026-05-28",
                "title": "Updateveld op vergaderbord-kaarten gebruikt nu de volle breedte",
                "highlights": [
                    "Het veld voor een nieuwe kaartupdate vult nu netjes de beschikbare kaartbreedte.",
                    "De opmaakbalk en het tekstveld blijven gelijk uitgelijnd, zodat langere updates prettiger te schrijven zijn.",
                    "De bestaande kaartdetailweergave en updateflow blijven verder ongewijzigd.",
                ],
            },
            {
                "iteration": "51",
                "date": "2026-05-28",
                "title": "Vergaderbord-updates editor nu compacter en Trello-achtiger",
                "highlights": [
                    "De editor voor zowel nieuwe updates als update-bewerking heeft nu een compactere, rustigere opmaak met duidelijke editor-shell en toolbar.",
                    "Opmaakknoppen reageren duidelijker met hover- en focusstijlen, zodat snelwerken met muis én toetsenbord prettiger is.",
                    "Op kleinere schermen blijft de toolbar bruikbaar doordat knoppen netjes meewrappen zonder dat acties buiten beeld vallen.",
                ],
            },
            {
                "iteration": "50",
                "date": "2026-05-28",
                "title": "Rijkere update-editor op vergaderbord-kaarten",
                "highlights": [
                    "Bij nieuwe en bestaande kaartupdates kun je nu opmaakknoppen gebruiken voor vet, cursief, onderstrepen en lijstjes.",
                    "Regelafbrekingen en lijstweergave blijven nu zichtbaar in de updatekaart, zodat voortgangsnotities leesbaarder zijn.",
                    "De updateweergave blijft veilig: HTML uit berichttekst wordt niet als code uitgevoerd en oude platte-tekstupdates blijven gewoon leesbaar.",
                ],
            },
            {
                "iteration": "49",
                "date": "2026-05-28",
                "title": "Compacte update-acties en veilig verwijderen op vergaderbord-kaarten",
                "highlights": [
                    "Onder je eigen kaartupdates zie je nu compacte acties als kleine tekstlinks: 'Bewerken • Verwijderen'.",
                    "Updates van andere gebruikers tonen geen acties, zodat alleen de auteur eigen updates kan aanpassen of verwijderen.",
                    "Bij verwijderen krijg je eerst een bevestiging; na bevestigen verdwijnt de update direct uit de activiteitenlijst.",
                ],
            },
            {
                "iteration": "48",
                "date": "2026-05-28",
                "title": "Vergaderbord-kaartupdates als duidelijke activity cards",
                "highlights": [
                    "Updates in kaartdetails worden nu getoond als overzichtelijke activity cards met auteur, datum/tijd en berichttekst.",
                    "Alleen jouw eigen updates tonen een bewerkactie binnen dezelfde activity card; updates van anderen blijven alleen leesbaar.",
                    "Afbeeldingen bij updates blijven zichtbaar in de activity card, met behoud van bestaande update- en bewerkflow.",
                ],
            },
            {
                "iteration": "47",
                "date": "2026-05-28",
                "title": "Vergaderbord-updates: eigen update bewerken met revisie",
                "highlights": [
                    "Bij vergaderbord-updates kan nu alleen de auteur zelf een geplaatste update bewerken.",
                    "Bewerken van een update maakt een nieuwe revisie, zodat eerdere inhoud bewaard blijft in de updatehistorie.",
                    "Bij een update-edit kun je nu ook een afbeelding toevoegen, vervangen of verwijderen zonder automatische herpublicatie of nieuwsbrief-resend.",
                ],
            },
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
            {
                "iteration": "46",
                "date": "2026-06-11",
                "title": "Vergaderborden: recordicoon subtieler en rechtsonder",
                "highlights": [
                    "De recordknop op Vergaderborden-kaarten is nu kleiner, subtieler en rechtsonder gepositioneerd voor een rustigere kaartlayout.",
                    "De knop gebruikt nu een compact SVG-icoon in plaats van een opvallende glyph, terwijl start/stop-opname hetzelfde blijft werken.",
                    "Kaartruimte is minimaal aangepast met extra padding en titelclamping, zodat tekst en opnameknop elkaar niet overlappen.",
                ],
            },
            {
                "iteration": "45",
                "date": "2026-05-28",
                "title": "Vergaderborden: audio-opnames nu in dezelfde updates-tijdlijn",
                "highlights": [
                    "In kaartdetails staan audio-opnames nu tussen de gewone updates, zodat je één chronologische activiteitenlijst hebt.",
                    "De aparte sectie 'Opnames' is verwijderd; audio-items tonen nu dezelfde kaartstijl met speler en downloadlink.",
                    "Updates en opnames worden samen newest-first gesorteerd op datum en tijd, met behoud van bestaande update- en opnameflows.",
                ],
            },
            {
                "iteration": "47",
                "date": "2026-06-30",
                "title": "Wervelnieuws: audio-opnames automatisch omgezet naar doorzoekbare bron",
                "highlights": [
                    "Bij topic-updates kun je nu een audio-opname uploaden; de transcriptie start automatisch op de achtergrond.",
                    "Na verwerking verschijnt de transcriptie als normale, read-only tekstbron die mee kan in zoekresultaten en generatie.",
                    "Bij een mislukte transcriptie blijft de opname bewaard en kun je de bron direct opnieuw laten verwerken.",
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
