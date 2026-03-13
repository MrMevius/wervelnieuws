from openai import OpenAI


class OpenAIClient:
    def __init__(
        self,
        *,
        api_key: str,
        text_model: str,
        image_model: str,
    ) -> None:
        self.text_model = text_model
        self.image_model = image_model
        self.client = OpenAI(api_key=api_key) if api_key else None

    def generate_text(
        self,
        prompt: str,
        *,
        websearch_enabled: bool = False,
        websearch_max_results: int = 3,
    ) -> tuple[str, list[dict[str, str]]]:
        if not self.client:
            if websearch_enabled:
                return (
                    "[MOCK]" + prompt[:200],
                    [
                        {
                            "title": "Mock webresultaat",
                            "url": "https://example.com/mock",
                            "snippet": "Mock websearch context voor test- en ontwikkelmodus.",
                        }
                    ],
                )
            return "[MOCK]" + prompt[:200], []

        request_payload: dict = {"model": self.text_model, "input": prompt}
        if websearch_enabled:
            request_payload["tools"] = [{"type": "web_search_preview"}]

        response = self.client.responses.create(**request_payload)
        text = response.output_text
        if not websearch_enabled:
            return text, []

        web_hits = self._extract_web_hits(response)
        if web_hits:
            return text, web_hits[:websearch_max_results]
        return (
            text,
            [
                {
                    "title": "Websearch context",
                    "url": "",
                    "snippet": "Websearch stond aan maar leverde geen expliciete bronlinks op.",
                }
            ],
        )

    def generate_image(self, prompt: str) -> bytes:
        if not self.client:
            return b""
        result = self.client.images.generate(
            model=self.image_model,
            prompt=prompt,
            size="1024x1024",
        )
        b64 = result.data[0].b64_json
        import base64

        return base64.b64decode(b64)

    def _extract_web_hits(self, response: object) -> list[dict[str, str]]:
        model_dump = getattr(response, "model_dump", None)
        if not callable(model_dump):
            return []
        payload = model_dump()
        if not isinstance(payload, dict):
            return []

        hits: list[dict[str, str]] = []
        for output_item in payload.get("output", []):
            if not isinstance(output_item, dict):
                continue
            for content_item in output_item.get("content", []):
                if not isinstance(content_item, dict):
                    continue
                for annotation in content_item.get("annotations", []):
                    if not isinstance(annotation, dict):
                        continue
                    url = str(annotation.get("url") or "").strip()
                    title = str(annotation.get("title") or "").strip()
                    snippet = str(annotation.get("quote") or "").strip()
                    if not (url or title or snippet):
                        continue
                    hits.append({"title": title, "url": url, "snippet": snippet})
        return hits
