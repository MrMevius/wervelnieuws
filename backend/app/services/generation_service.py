import json
import re
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.integrations.openai_client import OpenAIClient
from app.models.entities import GeneratedImage, Topic
from app.models.enums import WorkflowState
from app.repositories.topic_repository import ContentVersionRepository
from app.services.ingestion_service import IngestionService


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:120] or "nieuws-update"


class GenerationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.settings = get_settings()
        self.openai = OpenAIClient()
        self.ingestion = IngestionService(db)
        self.versions = ContentVersionRepository(db)

    def generate_for_topic(self, topic: Topic) -> str:
        topic.workflow_state = WorkflowState.generating
        self.db.add(topic)
        self.db.commit()

        context_hits = self.ingestion.search_chunks(topic.id, topic.subject, limit=10)
        context_text = "\n\n".join([h["text"] for h in context_hits])

        article_prompt = (
            "Schrijf een Nederlandstalig nieuwsartikel over een lokaal windparkproject. "
            "Gebruik alleen feiten uit de bronpassages en redactionele notities. "
            "Toon rustige, betrouwbare en begrijpelijke toon. "
            "Voeg geen onbewezen claims toe.\n\n"
            f"Onderwerp: {topic.subject}\n"
            f"Thema: {topic.theme}\n"
            f"Notities: {topic.editorial_notes}\n"
            f"Bronpassages:\n{context_text}\n"
            "Geef JSON terug met keys: title, article_body, summary."
        )

        raw = self.openai.generate_text(article_prompt)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {
                "title": topic.title,
                "article_body": raw,
                "summary": raw[:220],
            }

        img_prompt_text = (
            "Maak een realistische illustratieprompt voor een Nederlands lokaal windparkbericht, "
            "zonder activistische of fantasie-elementen. "
            f"Titel: {parsed['title']}"
        )
        img_prompt = self.openai.generate_text(img_prompt_text)
        image_bytes = self.openai.generate_image(img_prompt)

        image_path = (
            self.settings.storage_root / self.settings.generated_dir / f"{topic.id}.png"
        )
        if image_bytes:
            image_path.write_bytes(image_bytes)

        image = GeneratedImage(prompt=img_prompt, image_path=str(image_path))
        self.db.add(image)
        self.db.flush()

        latest = self.versions.latest_for_topic(topic.id)
        version_num = (latest.version_number + 1) if latest else 1
        version = self.versions.create(
            topic_id=topic.id,
            version_number=version_num,
            title=parsed.get("title") or topic.title,
            slug=slugify(parsed.get("title") or topic.title),
            article_body=parsed.get("article_body") or "",
            summary=parsed.get("summary") or "",
            source_trace_json=json.dumps(context_hits),
            generated_image_id=image.id,
            is_current=True,
            is_published=False,
        )

        topic.workflow_state = WorkflowState.review
        self.db.add(topic)
        self.db.commit()
        return version.id
