import { useEffect, useRef, type ClipboardEvent } from "react";
import { plainTextHtml, sanitizeRichText } from "../lib/richText";

export function RichTextEditor({ label, value, onChange, compact = false }: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const clean = sanitizeRichText(value);
    if (ref.current && ref.current.innerHTML !== clean) ref.current.innerHTML = clean;
  }, [value]);

  function runCommand(command: "bold" | "italic" | "insertUnorderedList") {
    if (typeof document.execCommand !== "function") return;
    ref.current?.focus();
    document.execCommand(command);
    onChange(sanitizeRichText(ref.current?.innerHTML ?? ""));
  }

  function paste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const clean = html ? sanitizeRichText(html) : plainTextHtml(event.clipboardData.getData("text/plain"));
    const editor = event.currentTarget;
    if (typeof document.execCommand === "function") {
      document.execCommand("insertHTML", false, clean);
    } else {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : document.createRange();
      if (!editor.contains(range.commonAncestorContainer)) {
        range.selectNodeContents(editor);
        range.collapse(false);
      }
      range.deleteContents();
      const fragment = range.createContextualFragment(clean);
      const lastNode = fragment.lastChild;
      range.insertNode(fragment);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
    onChange(sanitizeRichText(editor.innerHTML));
  }

  return (
    <div className="wysiwyg-field">
      <span>{label}</span>
      <div className="wysiwyg-toolbar" role="toolbar" aria-label={`${label} toolbar`}>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("bold")}>Vet</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("italic")}>Cursief</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("insertUnorderedList")}>Lijst</button>
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        className={compact ? "wysiwyg-editor compact" : "wysiwyg-editor"}
        contentEditable
        suppressContentEditableWarning
        onPaste={paste}
        onDrop={(event) => event.preventDefault()}
        onInput={(event) => onChange(sanitizeRichText(event.currentTarget.innerHTML))}
      />
    </div>
  );
}
