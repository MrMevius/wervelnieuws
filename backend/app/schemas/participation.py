from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ContactType = Literal["in_person", "phone", "video", "other"]


class ParticipationWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=180)
    occurred_on: date
    contact_type: ContactType = "in_person"
    conversation_partners: str = Field(default="", max_length=2000)
    location: str = Field(default="", max_length=240)
    duration_minutes: int | None = Field(default=None, gt=0, le=1440)
    report: str = Field(min_length=1, max_length=30000)
    agreements: str = Field(default="", max_length=10000)
    participant_ids: list[str] = Field(min_length=1, max_length=100)
    project_ids: list[str] = Field(min_length=1, max_length=100)

    @field_validator("participant_ids", "project_ids")
    @classmethod
    def unique_ids(cls, values: list[str]) -> list[str]:
        if any(not value.strip() or len(value) > 36 for value in values):
            raise ValueError("Selecteer geldige personen en projecten.")
        if len(set(values)) != len(values):
            raise ValueError("Selecteer iedere persoon en ieder project maximaal één keer.")
        return values


class ParticipationUpdate(ParticipationWrite):
    expected_row_version: int = Field(ge=1)


class ParticipationArchive(BaseModel):
    model_config = ConfigDict(extra="forbid")
    archived: bool
    expected_row_version: int = Field(ge=1)


class ParticipationOption(BaseModel):
    id: str
    name: str
    selectable: bool = True


class ParticipationMeta(BaseModel):
    participants: list[ParticipationOption]
    projects: list[ParticipationOption]
    current_user_id: str


class ParticipationResponse(BaseModel):
    id: str
    title: str
    occurred_on: date
    contact_type: ContactType
    conversation_partners: str
    location: str
    duration_minutes: int | None
    report: str
    agreements: str
    participants: list[ParticipationOption]
    projects: list[ParticipationOption]
    created_by_name: str
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None
    row_version: int
    can_edit: bool


class ParticipationFilters(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(default="", max_length=200)
    date_from: date | None = None
    date_to: date | None = None
    project_id: str | None = None
    participant_id: str | None = None
    archived: bool = False
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=100)
    format: Literal["csv", "markdown", "json"] = "csv"

    @model_validator(mode="after")
    def date_range(self):
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("De begindatum moet vóór of op de einddatum liggen.")
        return self


class ParticipationList(BaseModel):
    items: list[ParticipationResponse]
    total: int
    page: int
    page_size: int
