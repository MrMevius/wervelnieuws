from pydantic import BaseModel, Field, computed_field


class ChangelogEntry(BaseModel):
    version: str = Field(pattern=r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
    date: str
    title: str
    highlights: list[str] = Field(default_factory=list)


class AboutResponse(BaseModel):
    description: str
    disclaimer: str
    developed_by: str
    changelog: list[ChangelogEntry] = Field(default_factory=list)

    @computed_field
    @property
    def version(self) -> str:
        """The release version is owned by the versioned changelog."""
        return max((entry.version for entry in self.changelog), key=lambda value: tuple(map(int, value.split("."))), default="0.0.0")


class UiSettingsResponse(BaseModel):
    wind_theme_enabled: bool = True
