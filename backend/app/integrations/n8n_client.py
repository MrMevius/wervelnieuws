import httpx

from app.core.settings import get_settings


class N8NWebhookClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    def is_enabled(self) -> bool:
        return bool(self.settings.n8n_webhook_url)

    def send(self, payload: dict) -> None:
        if not self.settings.n8n_webhook_url:
            return
        response = httpx.post(
            self.settings.n8n_webhook_url,
            json=payload,
            timeout=self.settings.n8n_webhook_timeout_seconds,
        )
        response.raise_for_status()
