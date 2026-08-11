from types import SimpleNamespace

import pytest

from app.integrations.openai_client import OpenAIClient


class _FakeChatCompletions:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content='{"title":"Titel","article_body":"Body","summary":"Samenvatting"}'
                    )
                )
            ]
        )


def test_generate_text_falls_back_to_chat_when_responses_api_missing():
    client = OpenAIClient(
        api_key="dummy", text_model="gpt-4o-mini", image_model="gpt-image-1"
    )

    fake_chat_completions = _FakeChatCompletions()
    client.client = SimpleNamespace(
        chat=SimpleNamespace(completions=fake_chat_completions)
    )

    text, web_hits = client.generate_text(
        "Schrijf JSON over onderhoud",
        websearch_enabled=True,
        websearch_max_results=2,
    )

    assert text.startswith('{"title":"Titel"')
    assert len(fake_chat_completions.calls) == 1
    assert fake_chat_completions.calls[0]["model"] == "gpt-4o-mini"
    assert web_hits
    assert web_hits[0]["title"] == "Websearch niet beschikbaar"


def test_transcribe_audio_fails_clearly_when_api_key_missing(tmp_path):
    audio_path = tmp_path / "opname.webm"
    audio_path.write_bytes(b"fake-audio")

    client = OpenAIClient(
        api_key="",
        text_model="gpt-4o-mini",
        image_model="gpt-image-1",
    )

    with pytest.raises(RuntimeError, match="OPENAI_API_KEY is missing"):
        client.transcribe_audio(str(audio_path), model="whisper-1", language="nl")
