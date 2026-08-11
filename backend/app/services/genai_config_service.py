import json

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.models.entities import SystemSetting
from app.schemas.genai import (
    GenAIConfig,
    GenAIConfigResponse,
    GenAIModelOptionsResponse,
    UpdateGenAIConfigRequest,
)

GENAI_CONFIG_SETTING_KEY = "genai_config_v1"
DEFAULT_TEXT_MODELS = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"]
DEFAULT_IMAGE_MODELS = ["gpt-image-1"]


def default_genai_config() -> GenAIConfig:
    settings = get_settings()
    return GenAIConfig(
        system_prompt=(
            "Je bent een redacteur voor lokale communicatie over windparknieuws. "
            "Schrijf in helder Nederlands: informatief, toegankelijk, kalm en betrouwbaar. "
            "Gebruik feiten uit aangeleverde bronnen en notities; voeg geen onbewezen claims toe."
        ),
        website_prompt="Schrijf uitgebreid en duidelijk voor lezers op de website.",
        facebook_prompt="Schrijf kort, direct en uitnodigend met focus op kerninformatie.",
        newsletter_prompt="Schrijf informatief en overzichtelijk in nieuwsbriefstijl.",
        text_model=settings.openai_model_text,
        image_model=settings.openai_model_image,
        whisper_model="whisper-1",
        whisper_language="nl",
        websearch_enabled=False,
        websearch_max_results=3,
        openai_api_key=settings.openai_api_key,
    )


class GenAIConfigService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_effective_config(self) -> GenAIConfig:
        base = default_genai_config()
        setting = self.db.scalar(
            select(SystemSetting).where(SystemSetting.key == GENAI_CONFIG_SETTING_KEY)
        )
        if not setting:
            return base
        try:
            parsed = json.loads(setting.value)
        except json.JSONDecodeError:
            return base
        if not isinstance(parsed, dict):
            return base
        merged = {**base.model_dump(), **parsed}
        return GenAIConfig.model_validate(merged)

    def get_admin_config(self) -> GenAIConfigResponse:
        config = self.get_effective_config()
        payload = config.model_dump(exclude={"openai_api_key"})
        return GenAIConfigResponse(**payload, has_api_key=bool(config.openai_api_key))

    def update_config(self, payload: UpdateGenAIConfigRequest) -> GenAIConfigResponse:
        current = self.get_effective_config()
        updates = payload.model_dump(exclude_none=True)
        next_payload = current.model_dump()
        next_payload.update(updates)
        updated = GenAIConfig.model_validate(next_payload)

        setting = self.db.scalar(
            select(SystemSetting).where(SystemSetting.key == GENAI_CONFIG_SETTING_KEY)
        )
        if not setting:
            setting = SystemSetting(
                key=GENAI_CONFIG_SETTING_KEY,
                value=json.dumps(updated.model_dump()),
            )
        else:
            setting.value = json.dumps(updated.model_dump())

        self.db.add(setting)
        self.db.commit()
        return self.get_admin_config()

    def get_model_options(self) -> GenAIModelOptionsResponse:
        config = self.get_effective_config()
        text_models = set(DEFAULT_TEXT_MODELS)
        image_models = set(DEFAULT_IMAGE_MODELS)
        text_models.add(config.text_model)
        image_models.add(config.image_model)

        if config.openai_api_key:
            try:
                client = OpenAI(api_key=config.openai_api_key)
                model_page = client.models.list()
                for model in model_page.data:
                    model_id = str(getattr(model, "id", "") or "").strip()
                    if not model_id:
                        continue
                    if self._is_text_model(model_id):
                        text_models.add(model_id)
                    if self._is_image_model(model_id):
                        image_models.add(model_id)
            except Exception:
                pass

        return GenAIModelOptionsResponse(
            text_models=sorted(text_models),
            image_models=sorted(image_models),
        )

    def _is_text_model(self, model_id: str) -> bool:
        normalized = model_id.lower()
        if not normalized.startswith("gpt-"):
            return False
        return "image" not in normalized

    def _is_image_model(self, model_id: str) -> bool:
        normalized = model_id.lower()
        return normalized.startswith("gpt-image") or normalized.startswith("dall-e")
