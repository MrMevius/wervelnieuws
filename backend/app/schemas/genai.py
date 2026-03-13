from pydantic import BaseModel, Field, field_validator


class GenAIConfig(BaseModel):
    system_prompt: str = Field(min_length=10)
    website_prompt: str = Field(min_length=5)
    facebook_prompt: str = Field(min_length=5)
    newsletter_prompt: str = Field(min_length=5)
    text_model: str = Field(min_length=2, max_length=120)
    image_model: str = Field(min_length=2, max_length=120)
    websearch_enabled: bool = False
    websearch_max_results: int = Field(default=3, ge=1, le=10)
    openai_api_key: str = ""

    @field_validator(
        "system_prompt",
        "website_prompt",
        "facebook_prompt",
        "newsletter_prompt",
        "text_model",
        "image_model",
        mode="before",
    )
    @classmethod
    def strip_text_fields(cls, value: str) -> str:
        return value.strip()


class GenAIConfigResponse(BaseModel):
    system_prompt: str
    website_prompt: str
    facebook_prompt: str
    newsletter_prompt: str
    text_model: str
    image_model: str
    websearch_enabled: bool
    websearch_max_results: int
    has_api_key: bool


class GenAIModelOptionsResponse(BaseModel):
    text_models: list[str]
    image_models: list[str]


class UpdateGenAIConfigRequest(BaseModel):
    system_prompt: str | None = Field(default=None, min_length=10)
    website_prompt: str | None = Field(default=None, min_length=5)
    facebook_prompt: str | None = Field(default=None, min_length=5)
    newsletter_prompt: str | None = Field(default=None, min_length=5)
    text_model: str | None = Field(default=None, min_length=2, max_length=120)
    image_model: str | None = Field(default=None, min_length=2, max_length=120)
    websearch_enabled: bool | None = None
    websearch_max_results: int | None = Field(default=None, ge=1, le=10)
    openai_api_key: str | None = Field(default=None, max_length=512)

    @field_validator(
        "system_prompt",
        "website_prompt",
        "facebook_prompt",
        "newsletter_prompt",
        "text_model",
        "image_model",
        "openai_api_key",
        mode="before",
    )
    @classmethod
    def strip_optional_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()
