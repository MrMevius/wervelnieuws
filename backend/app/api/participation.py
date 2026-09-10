from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.entities import User
from app.repositories.participation_repository import ParticipationRepository
from app.schemas.participation import (
    ParticipationArchive, ParticipationFilters, ParticipationList, ParticipationMeta,
    ParticipationResponse, ParticipationUpdate, ParticipationWrite,
)
from app.services.participation_export import export_participation
from app.services.participation_service import ParticipationService

router = APIRouter(prefix="/participatiemomenten", tags=["participatiemomenten"])


def service(db: Session = Depends(get_db)) -> ParticipationService:
    return ParticipationService(ParticipationRepository(db))


@router.get("/meta", response_model=ParticipationMeta)
def metadata(current: User = Depends(get_current_user), svc: ParticipationService = Depends(service)):
    return svc.metadata(current)


@router.get("", response_model=ParticipationList)
def listing(
    filters: Annotated[ParticipationFilters, Query()],
    current: User = Depends(get_current_user), svc: ParticipationService = Depends(service),
):
    return svc.list(current, filters, filters.page, filters.page_size)


@router.get("/export")
def export(
    filters: Annotated[ParticipationFilters, Query()],
    current: User = Depends(get_current_user), svc: ParticipationService = Depends(service),
):
    content, mime_type, extension = export_participation(svc.export(current, filters), filters, filters.format)
    return Response(content=content, media_type=mime_type, headers={
        "Content-Disposition": f'attachment; filename="participatiemomenten.{extension}"',
    })


@router.post("", response_model=ParticipationResponse, status_code=201)
def create(payload: ParticipationWrite, current: User = Depends(get_current_user), svc: ParticipationService = Depends(service)):
    return svc.create(current, payload)


@router.get("/{moment_id}", response_model=ParticipationResponse)
def detail(moment_id: str, current: User = Depends(get_current_user), svc: ParticipationService = Depends(service)):
    return svc.response(svc.get(current, moment_id), current)


@router.put("/{moment_id}", response_model=ParticipationResponse)
def update(moment_id: str, payload: ParticipationUpdate, current: User = Depends(get_current_user), svc: ParticipationService = Depends(service)):
    return svc.update(current, moment_id, payload)


@router.patch("/{moment_id}/archive", response_model=ParticipationResponse)
def archive(moment_id: str, payload: ParticipationArchive, current: User = Depends(get_current_user), svc: ParticipationService = Depends(service)):
    return svc.archive(current, moment_id, payload)
