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
from app.services.retrieval_service import RetrievalService


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:120] or "nieuws-update"


class GenerationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.settings = get_settings()
        self.openai = OpenAIClient()
        self.retrieval = RetrievalService(db)
        self.versions = ContentVersionRepository(db)

    def generate_for_topic(
        self, topic: Topic, channels: list[ChannelName] | None = None
    ) -> str:
        topic.workflow_state = WorkflowState.generating
        self.db.add(topic)
        self.db.commit()

        context_hits = self.retrieval.retrieve_context(topic, limit=10)
        normalized_hits = [
            self._normalize_trace_hit(topic.id, hit) for hit in context_hits
        ]
        context_text = self._format_context_for_prompt(normalized_hits)

        selected_channels = channels or list(topic.target_channels)
        if not selected_channels:
            selected_channels = [ChannelName.website]

        variant_payloads: list[dict[str, str | ChannelName | None]] = []
        for channel in selected_channels:
            parsed = self._generate_channel_text(topic, channel, context_text)
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
        version = self.versions.create(
            topic_id=topic.id,
            version_number=version_num,
            title=str(primary.get("title") or topic.title),
            slug=slugify(str(primary.get("title") or topic.title)),
            article_body=str(primary.get("article_body") or ""),
            summary=str(primary.get("summary") or ""),
            source_trace_json=json.dumps(normalized_hits),
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
    ) -> dict[str, str]:
        channel_hint = {
            ChannelName.website: "Schrijf uitgebreid en helder voor websitelezers.",
            ChannelName.facebook: "Schrijf compact en direct met focus op kerninformatie.",
            ChannelName.newsletter: "Schrijf informatief en overzichtelijk in nieuwsbriefstijl.",
        }[channel]
        article_prompt = (
            "Schrijf een Nederlandstalig nieuwsartikel over een lokaal windparkproject. "
            "Gebruik alleen feiten uit de bronpassages en redactionele notities. "
            "Toon rustige, betrouwbare en begrijpelijke toon. "
            "Voeg geen onbewezen claims toe.\n\n"
            f"Doelkanaal: {channel.value}\n"
            f"Kanaalrichtlijn: {channel_hint}\n"
            f"Onderwerp: {topic.subject}\n"
            f"Thema: {topic.theme}\n"
            f"Opmerkingen voor GenAI: {topic.editorial_notes}\n"
            f"Bronpassages:\n{context_text}\n"
            "Geef JSON terug met keys: title, article_body, summary."
        )
        raw = self.openai.generate_text(article_prompt)
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return {
                    "title": str(parsed.get("title") or topic.title),
                    "article_body": str(parsed.get("article_body") or raw),
                    "summary": str(parsed.get("summary") or raw[:220]),
                }
        except json.JSONDecodeError:
            pass
        return {
            "title": topic.title,
            "article_body": raw,
            "summary": raw[:220],
        }

    def _generate_channel_image(
        self, topic: Topic, channel: ChannelName, title: str
    ) -> GeneratedImage | None:
        img_prompt_text = (
            "Maak een realistische illustratieprompt voor een Nederlands lokaal windparkbericht, "
            "zonder activistische of fantasie-elementen. "
            f"Doelkanaal: {channel.value}. "
            f"Titel: {title}"
        )
        img_prompt = self.openai.generate_text(img_prompt_text)
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
