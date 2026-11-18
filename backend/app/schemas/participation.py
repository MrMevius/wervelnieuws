from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ContactType = Literal["in_person", "phone", "email", "video", "meeting", "letter", "newspaper", "online", "other"]
MomentType = Literal["conversation", "meeting", "communication"]
ParticipationLevel = Literal["inform", "consult", "advise", "coproduce", "codecide"]
YesNoStatus = Literal["", "yes", "no", "na"]
GoalStatus = Literal["", "yes", "partial", "no", "pending", "na"]
LEVEL_ORDER: tuple[str, ...] = ("inform", "consult", "advise", "coproduce", "codecide")


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
    moment_type: MomentType = "conversation"
    goal: str = Field(default="", max_length=2000)
    participation_levels: list[ParticipationLevel] = Field(default_factory=list, max_length=5)
    collected_information: str = Field(default="", max_length=30000)
    invitation_status: YesNoStatus = ""
    invitation_note: str = Field(default="", max_length=500)
    informed_status: YesNoStatus = ""
    informed_note: str = Field(default="", max_length=500)
    feedback_status: YesNoStatus = ""
    feedback_note: str = Field(default="", max_length=500)
    goal_status: GoalStatus = ""
    notes: str = Field(default="", max_length=10000)
    is_historical: bool = False
    participant_ids: list[str] = Field(default_factory=list, max_length=100)
    project_ids: list[str] = Field(min_length=1, max_length=100)

    @field_validator("participant_ids", "project_ids")
    @classmethod
    def unique_ids(cls, values: list[str]) -> list[str]:
        if any(not value.strip() or len(value) > 36 for value in values):
            raise ValueError("Selecteer geldige personen en projecten.")
        if len(set(values)) != len(values):
            raise ValueError("Selecteer iedere persoon en ieder project maximaal één keer.")
        return values

    @field_validator("participation_levels")
    @classmethod
    def ordered_levels(cls, values: list[str]) -> list[str]:
        return [level for level in LEVEL_ORDER if level in values]

    @model_validator(mode="after")
    def executor_required(self):
        # Only historical moments may be recorded without a known executor.
        if not self.participant_ids and not self.is_historical:
            raise ValueError("Selecteer minimaal één uitvoerder, of markeer het moment als historisch.")
        return self


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
    # Set for executors who have a WindWilly profile photo.
    avatar_user_id: str | None = None


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
    moment_type: MomentType
    goal: str
    participation_levels: list[ParticipationLevel]
    collected_information: str
    invitation_status: YesNoStatus
    invitation_note: str
    informed_status: YesNoStatus
    informed_note: str
    feedback_status: YesNoStatus
    feedback_note: str
    goal_status: GoalStatus
    notes: str
    is_historical: bool
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
    moment_type: MomentType | None = None
    participation_level: ParticipationLevel | None = None
    goal_status: GoalStatus | None = None
    archived: bool = False
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=100)
    format: Literal["csv", "markdown", "json"] = "csv"

    @model_validator(mode="after")
    def date_range(self):
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("De begindatum moet vóór of op de einddatum liggen.")
        return self


class ParticipationMonthCount(BaseModel):
    month: str
    moments: int


class ParticipationList(BaseModel):
    items: list[ParticipationResponse]
    total: int
    page: int
    page_size: int
    # Counts over the whole filtered selection, across pages.
    month_counts: list[ParticipationMonthCount] = []
    type_counts: dict[str, int] = {}
