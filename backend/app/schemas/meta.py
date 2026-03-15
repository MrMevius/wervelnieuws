from pydantic import BaseModel, Field


class ChangelogEntry(BaseModel):
    iteration: str
    date: str
    title: str
    highlights: list[str] = Field(default_factory=list)


class AboutResponse(BaseModel):
    description: str
    disclaimer: str
    developed_by: str
    changelog: list[ChangelogEntry] = Field(default_factory=list)


class UiSettingsResponse(BaseModel):
    wind_theme_enabled: bool = True
