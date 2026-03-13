import json
import re
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.integrations.openai_client import OpenAIClient
from app.models.entities import ContentChannelVariant, GeneratedImage, Topic
from app.models.enums import ChannelName, WorkflowState
from app.repositories.topic_repository import ContentVersionRepository
from app.services.genai_config_service import GenAIConfigService
from app.services.retrieval_service import RetrievalService


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:120] or "nieuws-update"


class GenerationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.settings = get_settings()
        self.genai_config = GenAIConfigService(db).get_effective_config()
        self.openai = OpenAIClient(
            api_key=self.genai_config.openai_api_key,
            text_model=self.genai_config.text_model,
            image_model=self.genai_config.image_model,
        )
        self.retrieval = RetrievalService(db)
        self.versions = ContentVersionRepository(db)

    def generate_for_topic(
        self, topic: Topic, channels: list[ChannelName] | None = None
    ) -> str:
        topic.workflow_state = WorkflowState.generating
        self.db.add(topic)
        self.db.commit()

        context_hits = self.retrieval.retrieve_context(topic, limit=10)
        normalized_local_hits = [
            self._normalize_trace_hit(topic.id, hit) for hit in context_hits
        ]
        context_text = self._format_context_for_prompt(normalized_local_hits)

        selected_channels = channels or list(topic.target_channels)
        if not selected_channels:
            selected_channels = [ChannelName.website]

        variant_payloads: list[dict[str, str | ChannelName | None]] = []
        web_trace_hits: list[dict[str, str]] = []
        for channel in selected_channels:
            parsed, web_hits = self._generate_channel_text(topic, channel, context_text)
            web_trace_hits.extend(
                [
                    self._normalize_web_trace_hit(topic.id, channel, hit, index)
                    for index, hit in enumerate(web_hits)
                ]
            )
            image = self._generate_channel_image(
                topic, channel, parsed.get("title") or topic.title
            )
            variant_payloads.append(
                {
                    "channel": channel,
                    "title": parsed.get("title") or topic.title,
                    "article_body": parsed.get("article_body") or "",
                    "summary": parsed.get("summary") or "",
                    "generated_image_id": image.id if image else None,
                }
            )

        primary = self._pick_primary_variant(variant_payloads)

        latest = self.versions.latest_for_topic(topic.id)
        version_num = (latest.version_number + 1) if latest else 1
        all_trace_hits = normalized_local_hits + web_trace_hits
        version = self.versions.create(
            topic_id=topic.id,
            version_number=version_num,
            title=str(primary.get("title") or topic.title),
            slug=slugify(str(primary.get("title") or topic.title)),
            article_body=str(primary.get("article_body") or ""),
            summary=str(primary.get("summary") or ""),
            source_trace_json=json.dumps(all_trace_hits),
            generated_image_id=str(primary.get("generated_image_id") or "") or None,
            is_current=True,
            is_published=False,
        )

        for payload in variant_payloads:
            self.db.add(
                ContentChannelVariant(
                    content_version_id=version.id,
                    topic_id=topic.id,
                    channel=payload["channel"],
                    title=str(payload["title"]),
                    article_body=str(payload["article_body"]),
                    summary=str(payload["summary"]),
                    generated_image_id=str(payload.get("generated_image_id") or "")
                    or None,
                )
            )

        topic.workflow_state = WorkflowState.review
        self.db.add(topic)
        self.db.commit()
        return version.id

    def _generate_channel_text(
        self, topic: Topic, channel: ChannelName, context_text: str
    ) -> tuple[dict[str, str], list[dict[str, str]]]:
        channel_hint = {
            ChannelName.website: self.genai_config.website_prompt,
            ChannelName.facebook: self.genai_config.facebook_prompt,
            ChannelName.newsletter: self.genai_config.newsletter_prompt,
        }[channel]
        article_prompt = (
            f"Systeemprompt:\n{self.genai_config.system_prompt}\n\n"
            "Werkinstructie:\n"
            "- Schrijf in het Nederlands.\n"
            "- Gebruik feiten uit lokale bronpassages en redactionele notities als primaire bron.\n"
            "- Voeg geen onbewezen claims toe.\n"
            "- Geef uitsluitend JSON terug met keys: title, article_body, summary.\n\n"
            f"Doelkanaal: {channel.value}\n"
            f"Kanaalrichtlijn: {channel_hint}\n"
            f"Onderwerp: {topic.subject}\n"
            f"Thema: {topic.theme}\n"
            f"Opmerkingen voor GenAI: {topic.editorial_notes}\n"
            f"Bronpassages:\n{context_text}\n"
        )
        raw, web_hits = self.openai.generate_text(
            article_prompt,
            websearch_enabled=self.genai_config.websearch_enabled,
            websearch_max_results=self.genai_config.websearch_max_results,
        )
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return (
                    {
                        "title": str(parsed.get("title") or topic.title),
                        "article_body": str(parsed.get("article_body") or raw),
                        "summary": str(parsed.get("summary") or raw[:220]),
                    },
                    web_hits,
                )
        except json.JSONDecodeError:
            pass
        return (
            {
                "title": topic.title,
                "article_body": raw,
                "summary": raw[:220],
            },
            web_hits,
        )

    def _generate_channel_image(
        self, topic: Topic, channel: ChannelName, title: str
    ) -> GeneratedImage | None:
        img_prompt_text = (
            "Maak een realistische illustratieprompt voor een Nederlands lokaal windparkbericht, "
            "zonder activistische of fantasie-elementen. "
            f"Doelkanaal: {channel.value}. "
            f"Titel: {title}"
        )
        img_prompt, _ = self.openai.generate_text(img_prompt_text)
        image_bytes = self.openai.generate_image(img_prompt)
        (self.settings.storage_root / self.settings.generated_dir).mkdir(
            parents=True, exist_ok=True
        )
        image_name = f"{topic.id}-{channel.value}-{uuid.uuid4().hex[:8]}.png"
        image_path = (
            self.settings.storage_root / self.settings.generated_dir / image_name
        )
        if image_bytes:
            image_path.write_bytes(image_bytes)

        image = GeneratedImage(prompt=img_prompt, image_path=str(image_path))
        self.db.add(image)
        self.db.flush()
        return image

    def _pick_primary_variant(
        self, payloads: list[dict[str, str | ChannelName | None]]
    ) -> dict[str, str | ChannelName | None]:
        for payload in payloads:
            if payload.get("channel") == ChannelName.website:
                return payload
        return payloads[0]

    def _normalize_trace_hit(
        self, topic_id: str, hit: dict[str, str]
    ) -> dict[str, str]:
        source_type = hit.get("source_type") or hit.get("source") or "topic"
        normalized = {
            "source": source_type,
            "source_type": source_type,
            "chunk_id": hit.get("chunk_id", ""),
            "chunk_index": str(hit.get("chunk_index", "")),
            "text": hit.get("text", ""),
            "document_id": hit.get("document_id")
            or hit.get("knowledge_document_id")
            or "",
            "document_name": hit.get("document_name", ""),
            "topic_id": hit.get("topic_id") or topic_id,
            "project_id": hit.get("project_id", ""),
            "project_name": hit.get("project_name", ""),
        }
        return normalized

    def _format_context_for_prompt(self, hits: list[dict[str, str]]) -> str:
        if not hits:
            return "Geen bronpassages gevonden."
        lines: list[str] = []
        for hit in hits:
            source_type = hit.get("source_type", "onbekend")
            document_name = hit.get("document_name", "onbekend document")
            chunk_index = hit.get("chunk_index", "?")
            if source_type == "database":
                project_name = hit.get("project_name", "onbekend project")
                label = f"[Bron: database | project: {project_name} | document: {document_name} | chunk: {chunk_index}]"
            else:
                label = (
                    f"[Bron: topic | document: {document_name} | chunk: {chunk_index}]"
                )
            lines.append(f"{label}\n{hit.get('text', '')}")
        return "\n\n".join(lines)

    def _normalize_web_trace_hit(
        self,
        topic_id: str,
        channel: ChannelName,
        hit: dict[str, str],
        index: int,
    ) -> dict[str, str]:
        title = hit.get("title", "").strip() or "Webbron"
        url = hit.get("url", "").strip()
        snippet = hit.get("snippet", "").strip()
        content = snippet or title
        if url:
            content = f"{content}\n{url}"
        return {
            "source": "websearch",
            "source_type": "websearch",
            "chunk_id": f"web-{channel.value}-{index}-{uuid.uuid4().hex[:8]}",
            "chunk_index": str(index),
            "text": content,
            "document_id": "",
            "document_name": title,
            "topic_id": topic_id,
            "project_id": "",
            "project_name": "",
        }
