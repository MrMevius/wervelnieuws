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
            }
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
