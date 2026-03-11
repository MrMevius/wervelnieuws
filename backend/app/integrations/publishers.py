from datetime import UTC, datetime

import httpx

from app.core.settings import get_settings


class WebsitePublisher:
    def __init__(self) -> None:
        self.settings = get_settings()

    def publish(self, payload: dict) -> str:
        if not self.settings.website_publish_url:
            return "mock-website-id"
        headers = {"Authorization": f"Bearer {self.settings.website_publish_token}"}
        response = httpx.post(
            self.settings.website_publish_url, json=payload, headers=headers, timeout=30
        )
        response.raise_for_status()
        return str(
            response.json().get("id", f"website-{datetime.now(UTC).isoformat()}")
        )


class FacebookPublisher:
    def __init__(self) -> None:
        self.settings = get_settings()

    def publish(self, message: str, image_url: str | None = None) -> str:
        if (
            not self.settings.facebook_page_id
            or not self.settings.facebook_access_token
        ):
            return "mock-facebook-id"
        url = f"https://graph.facebook.com/v19.0/{self.settings.facebook_page_id}/feed"
        data = {"message": message, "access_token": self.settings.facebook_access_token}
        response = httpx.post(url, data=data, timeout=30)
        response.raise_for_status()
        return str(response.json().get("id"))

    def update(self, post_id: str, message: str) -> str:
        if not self.settings.facebook_access_token:
            return post_id
        url = f"https://graph.facebook.com/v19.0/{post_id}"
        data = {"message": message, "access_token": self.settings.facebook_access_token}
        response = httpx.post(url, data=data, timeout=30)
        response.raise_for_status()
        return post_id


class MailgunPublisher:
    def __init__(self) -> None:
        self.settings = get_settings()

    def publish_newsletter(self, subject: str, html: str) -> str:
        if not self.settings.mailgun_api_key or not self.settings.mailgun_domain:
            return "mock-mailgun-id"
        response = httpx.post(
            f"https://api.mailgun.net/v3/{self.settings.mailgun_domain}/messages",
            auth=("api", self.settings.mailgun_api_key),
            data={
                "from": f"Wervelnieuws <nieuws@{self.settings.mailgun_domain}>",
                "to": self.settings.mailgun_list_address,
                "subject": subject,
                "html": html,
            },
            timeout=30,
        )
        response.raise_for_status()
        return str(response.json().get("id", ""))


class TelegramNotifier:
    def __init__(self) -> None:
        self.settings = get_settings()

    def send(self, message: str) -> None:
        if not self.settings.telegram_bot_token or not self.settings.telegram_chat_id:
            return
        url = f"https://api.telegram.org/bot{self.settings.telegram_bot_token}/sendMessage"
        httpx.post(
            url,
            json={"chat_id": self.settings.telegram_chat_id, "text": message},
            timeout=20,
        ).raise_for_status()
