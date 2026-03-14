import json

from fastapi import APIRouter, Depends
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.entities import SystemSetting, User
from app.schemas.meta import AboutResponse

router = APIRouter(prefix="/meta", tags=["meta"])

ABOUT_SETTING_KEY = "about_page_content"


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
        ],
    )


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
