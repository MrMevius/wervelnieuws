import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "./RichTextEditor";
import { sanitizeRichText, toPreviewHtml } from "../lib/richText";

const unsafe = '<p onclick="alert(1)">Veilige <strong>inhoud</strong></p><img src=x onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">Klik</a><iframe srcdoc="bad"></iframe>';

describe("safe rich text", () => {
  it("keeps formatting without executable HTML in previews", () => {
    const result = toPreviewHtml(unsafe);
    expect(result).toContain("<strong>inhoud</strong>");
    expect(result).not.toMatch(/onclick|onerror|javascript:|<script|<iframe|<img/);
  });
  it("escapes plain text and keeps line breaks", () => {
    expect(toPreviewHtml("A & B\n2 < 3")).toBe("<p>A &amp; B<br />2 &lt; 3</p>");
  });
  it("removes CSS, form controls, clobbering IDs and SVG", () => {
    expect(sanitizeRichText('<svg onload="alert(1)"></svg><form id="location"><input name="cookie"></form><p style="position:fixed" id="body">Tekst</p>')).toBe("<p>Tekst</p>");
  });
  it("sanitizes existing editor content before inserting it into the document", () => {
    render(<RichTextEditor label="Artikel" value={unsafe} onChange={vi.fn()} />);
    const editor = screen.getByRole("textbox", { name: "Artikel" });
    expect(editor.innerHTML).toBe(sanitizeRichText(unsafe));
  });
  it("sanitizes rich HTML pasted into the editor", () => {
    const change = vi.fn();
    render(<RichTextEditor label="Artikel" value="" onChange={change} />);
    const editor = screen.getByRole("textbox", { name: "Artikel" });
    fireEvent.paste(editor, { clipboardData: { getData: (type: string) => type === "text/html" ? unsafe : "Tekst" } });
    expect(change).toHaveBeenCalledWith(sanitizeRichText(unsafe));
    expect(editor.innerHTML).not.toMatch(/onclick|onerror|javascript:|<script|<iframe/);
  });
});
