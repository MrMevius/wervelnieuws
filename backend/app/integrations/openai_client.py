from openai import OpenAI

from app.core.settings import get_settings


class OpenAIClient:
    def __init__(self) -> None:
        settings = get_settings()
        self.settings = settings
        self.client = (
            OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
        )

    def generate_text(self, prompt: str) -> str:
        if not self.client:
            return "[MOCK]" + prompt[:200]
        response = self.client.responses.create(
            model=self.settings.openai_model_text, input=prompt
        )
        return response.output_text

    def generate_image(self, prompt: str) -> bytes:
        if not self.client:
            return b""
        result = self.client.images.generate(
            model=self.settings.openai_model_image, prompt=prompt, size="1024x1024"
        )
        b64 = result.data[0].b64_json
        import base64

        return base64.b64decode(b64)
