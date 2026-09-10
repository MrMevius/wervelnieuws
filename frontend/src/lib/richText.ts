import DOMPurify from "dompurify";

/** Formatting only: media is handled separately, never by pasted HTML. */
export function sanitizeRichText(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [
      "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s",
      "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6",
      "a", "pre", "code", "hr", "table", "thead", "tbody", "tr", "th", "td"
    ],
    ALLOWED_ATTR: ["href", "title", "colspan", "rowspan"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false
  });
}

export function plainTextHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;").replace(/\n/g, "<br />");
}

export function toPreviewHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "<p>Nog geen inhoud toegevoegd.</p>";
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) return sanitizeRichText(trimmed);
  return `<p>${plainTextHtml(trimmed)}</p>`;
}
