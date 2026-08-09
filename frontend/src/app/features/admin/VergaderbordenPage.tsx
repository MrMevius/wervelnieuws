import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, FocusEvent, ReactNode, RefObject, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AdminUser,
  BoardAccessUser,
  BoardCard,
  BoardRecycleBinCard,
  archiveBoardCard,
  createBoardCard,
  createBoardProject,
  deleteBoardCard,
  deleteBoardCardUpdate,
  deleteBoardCardAttachment,
  editBoardCardUpdate,
  getBoardCard,
  getCurrentUser,
  getBoardProject,
  listAdminUsers,
  getAdminUserAvatarUrl,
  listBoardProjects,
  listBoardRecycleBin,
  moveBoardCard,
  postBoardCardUpdate,
  restoreBoardCard,
  restoreDeletedBoardCard,
  updateBoardCardDescription,
  updateBoardCardTitle,
  uploadBoardRecording,
  uploadBoardCardAttachment
} from "../../../lib/api/client";
import {
  resolveVergaderbordenProjectId,
  VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY
} from "./vergaderbordenProjectSelection";
import { formatAmsterdamDateTime } from "../../../lib/datetime";

const KOLOMMEN: Array<"todo" | "doing" | "done"> = ["todo", "doing", "done"];
const KOLOM_TITEL: Record<string, string> = { todo: "Te doen", doing: "Bezig", done: "Klaar" };
const MIN_RECORDING_SECONDS = 5;
const RECORDING_TOO_SHORT_MESSAGE = "Opname is te kort. Neem minimaal 5 seconden op.";
const BOARD_ACCESS_BADGE_LIMIT = 5;

type DragCardMeta = {
  cardId: string;
  sourceColumn: "todo" | "doing" | "done";
  sourcePosition: number;
};

type DragDropTarget = {
  column: "todo" | "doing" | "done";
  cardId: string | null;
  placement: "before" | "after";
};

type BoardAssignment = {
  id: string;
  user_id: string;
  username: string;
  user_display_name: string;
  has_avatar?: boolean;
  avatar_url?: string | null;
};

type TitleEditState = {
  cardId: string;
  value: string;
  original: string;
  error: string | null;
};

type DescriptionEditState = {
  cardId: string;
  value: string;
  original: string;
  error: string | null;
};

type UpdateEditState = {
  updateId: string;
  value: string;
  original: string;
  removeImage: boolean;
  newImage: File | null;
  error: string | null;
};

type CardActivityItem =
  | {
    kind: "update";
    id: string;
    sortTs: number;
    createdAt: string;
    update: {
      id: string;
      author_user_id: string;
      author_username: string;
      author_display_name: string;
      message: string;
      image_url: string | null;
      edited_from_update_id: string | null;
      created_at: string;
    };
  }
  | {
    kind: "recording";
    id: string;
    sortTs: number;
    createdAt: string;
    recording: {
      id: string;
      uploaded_by_user_id?: string | null;
      uploaded_by_username?: string | null;
      uploaded_by_display_name?: string | null;
      filename: string;
      file_path: string;
      duration?: number | null;
      recorded_at: string;
      transcription_status: "pending" | "done" | "failed";
      transcription_text: string;
      mime_type: string;
      size_bytes?: number | null;
      created_at: string;
      download_url: string;
    };
  };

type CardAttachmentItem = {
  id: string;
  uploaded_by_user_id: string;
  uploaded_by_username?: string | null;
  uploaded_by_display_name?: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  download_url: string;
};

type AttachmentBatchItem = {
  fileName: string;
  status: "queued" | "uploading" | "success" | "error";
  error?: string;
};

const MOVE_ERROR_FALLBACK = "Opslaan van de kaart is mislukt. Ververs de pagina en probeer het opnieuw.";
const MOVE_UPDATE_MESSAGE_REGEX = /^Kaart verplaatst van (.+) naar (.+)\.$/;
const UNDERLINE_MARKER = "++";
const CARD_TITLE_MAX_LENGTH = 80;
const CARD_DESCRIPTION_MAX_LENGTH = 2000;

type UpdateToolbarAction = "bold" | "italic" | "underline" | "bullets" | "numbers";

function displayNameForUser(user: Pick<AdminUser, "full_name" | "username">): string {
  return user.full_name?.trim() || user.username;
}

function avatarUrlForUser(user: AdminUser): string | null {
  const maybeUrl = user.avatar_url?.trim();
  if (maybeUrl) return maybeUrl;
  return user.has_avatar ? getAdminUserAvatarUrl(user.id) : null;
}

function avatarUrlForAssignment(assignment: BoardAssignment): string | null {
  const maybeUrl = assignment.avatar_url?.trim();
  if (maybeUrl) return maybeUrl;
  return assignment.has_avatar ? getAdminUserAvatarUrl(assignment.user_id) : null;
}

function avatarUrlForAccessUser(user: Pick<BoardAccessUser, "id" | "has_avatar">): string | null {
  return user.has_avatar ? getAdminUserAvatarUrl(user.id) : null;
}

function AvatarBadge({
  label,
  avatarUrl,
  className = "",
  ariaLabel = label
}: {
  label: string;
  avatarUrl: string | null;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <span className={`user-chip assignment-avatar${className ? ` ${className}` : ""}`} title={label} aria-label={ariaLabel}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="assignment-avatar-image" />
      ) : (
        <span className="assignment-avatar-initials" aria-hidden="true">{initialsFromName(label)}</span>
      )}
    </span>
  );
}

function AssignedUserAvatarRow({ assignments, className = "" }: { assignments: BoardAssignment[]; className?: string }) {
  if (!assignments.length) return null;
  return (
    <div className={`chip-row assignment-avatar-row${className ? ` ${className}` : ""}`} aria-label="Toegewezen teamleden">
      {assignments.map((assn) => {
        const label = assn.user_display_name;
        const avatarUrl = avatarUrlForAssignment(assn);
        return <AvatarBadge key={assn.id} label={label} avatarUrl={avatarUrl} />;
      })}
    </div>
  );
}

function BoardAccessBadges({ users }: { users: BoardAccessUser[] }) {
  if (!users.length) return null;

  const visibleUsers = users.slice(0, BOARD_ACCESS_BADGE_LIMIT);
  const hiddenUsers = users.slice(BOARD_ACCESS_BADGE_LIMIT);
  const overflowCount = users.length - visibleUsers.length;
  const hiddenUserNames = hiddenUsers.map((user) => displayNameForUser(user)).join(", ");

  return (
    <div className="chip-row vergaderborden-header-access-row" aria-label="Gebruikers met toegang tot dit bord">
      {visibleUsers.map((user) => {
        const label = displayNameForUser(user);
        const avatarUrl = avatarUrlForAccessUser(user);
        return (
          <AvatarBadge
            key={user.id}
            className="vergaderborden-header-access-badge"
            label={label}
            avatarUrl={avatarUrl}
            ariaLabel={`Toegang: ${label}`}
          />
        );
      })}
      {overflowCount > 0 && (
        <span
          className="user-chip assignment-avatar vergaderborden-header-access-badge vergaderborden-header-access-overflow"
          tabIndex={0}
          aria-label={`+${overflowCount} verborgen gebruikers: ${hiddenUserNames}`}
          title={hiddenUserNames}
        >
          +{overflowCount}
        </span>
      )}
    </div>
  );
}

function parseDragCardMeta(raw: string): DragCardMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DragCardMeta;
    if (!parsed.cardId || !parsed.sourceColumn || typeof parsed.sourcePosition !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function cardIdFromTestId(testId: string | null): string | null {
  if (!testId?.startsWith("board-card-")) return null;
  return testId.slice("board-card-".length);
}

function resolveColumnDragTarget(columnElement: HTMLElement, column: "todo" | "doing" | "done", clientY: number): DragDropTarget {
  const cardElements = Array.from(columnElement.querySelectorAll<HTMLElement>('[data-testid^="board-card-"]'));
  for (const cardElement of cardElements) {
    const rect = cardElement.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      return {
        column,
        cardId: cardIdFromTestId(cardElement.getAttribute("data-testid")),
        placement: "before"
      };
    }
  }

  return { column, cardId: null, placement: "after" };
}

function toDutchMoveError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message?.trim();
    if (msg) return `Kaart verplaatsen is mislukt: ${msg}`;
  }
  return MOVE_ERROR_FALLBACK;
}

function renderBoardUpdateMessage(message: string | null | undefined): ReactNode {
  const text = message?.trim() || "Update zonder tekst";
  const match = text.match(MOVE_UPDATE_MESSAGE_REGEX);
  if (!match) {
    return <UpdateMessageRenderer message={text} />;
  }

  const [, oldColumn, newColumn] = match;
  return (
    <span>
      Kaart verplaatst: <strong>{oldColumn}</strong> → <strong>{newColumn}</strong>
    </span>
  );
}

function isAutomaticMoveUpdate(message: string | null | undefined): boolean {
  return MOVE_UPDATE_MESSAGE_REGEX.test(message?.trim() || "");
}

function applyInlineTokens(text: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|\+\+[^+]+\+\+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const full = match[0];
    if (full.startsWith("**") && full.endsWith("**")) {
      tokens.push(<strong key={`b-${match.index}`}>{full.slice(2, -2)}</strong>);
    } else if (full.startsWith("*") && full.endsWith("*")) {
      tokens.push(<em key={`i-${match.index}`}>{full.slice(1, -1)}</em>);
    } else if (full.startsWith(UNDERLINE_MARKER) && full.endsWith(UNDERLINE_MARKER)) {
      tokens.push(<u key={`u-${match.index}`}>{full.slice(UNDERLINE_MARKER.length, -UNDERLINE_MARKER.length)}</u>);
    } else {
      tokens.push(full);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }
  return tokens;
}

function RichTextRenderer({ text, emptyFallback }: { text: string; emptyFallback: ReactNode }) {
  const lines = text.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*[-*]\s+/, "");
        items.push(<li key={`ul-${i}`}>{applyInlineTokens(itemText)}</li>);
        i += 1;
      }
      nodes.push(<ul key={`ul-block-${i}`}>{items}</ul>);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*\d+\.\s+/, "");
        items.push(<li key={`ol-${i}`}>{applyInlineTokens(itemText)}</li>);
        i += 1;
      }
      nodes.push(<ol key={`ol-block-${i}`}>{items}</ol>);
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
      paragraphLines.push(lines[i]);
      i += 1;
    }

    nodes.push(
      <p key={`p-${i}`}>
        {paragraphLines.map((paragraphLine, idx) => (
          <span key={`line-${idx}`}>
            {idx > 0 && <br />}
            {applyInlineTokens(paragraphLine)}
          </span>
        ))}
      </p>
    );
  }
  return <>{nodes.length ? nodes : emptyFallback}</>;
}

function UpdateMessageRenderer({ message }: { message: string }) {
  return <RichTextRenderer text={message} emptyFallback={<p>Update zonder tekst</p>} />;
}

function CardDescriptionRenderer({
  description,
  emptyFallback = <>Geen beschrijving</>
}: {
  description: string | null | undefined;
  emptyFallback?: ReactNode;
}) {
  return <RichTextRenderer text={description?.trim() || ""} emptyFallback={emptyFallback} />;
}

function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function applyToolbarAction(value: string, selectionStart: number, selectionEnd: number, action: UpdateToolbarAction): { value: string; nextSelectionStart: number; nextSelectionEnd: number } {
  const before = value.slice(0, selectionStart);
  const selected = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);

  if (action === "bold" || action === "italic" || action === "underline") {
    const marker = action === "bold" ? "**" : action === "italic" ? "*" : UNDERLINE_MARKER;
    const nextValue = `${before}${marker}${selected}${marker}${after}`;
    const start = selectionStart + marker.length;
    const end = start + selected.length;
    return { value: nextValue, nextSelectionStart: start, nextSelectionEnd: end };
  }

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEndRaw = value.indexOf("\n", selectionEnd);
  const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");

  const prefixed = lines.map((line, idx) => {
    if (!line.trim()) return line;
    if (action === "bullets") return `- ${line}`;
    return `${idx + 1}. ${line}`;
  }).join("\n");

  const nextValue = `${value.slice(0, lineStart)}${prefixed}${value.slice(lineEnd)}`;
  return {
    value: nextValue,
    nextSelectionStart: lineStart,
    nextSelectionEnd: lineStart + prefixed.length
  };
}

const BOARD_DETAIL_FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

const ATTACHMENT_PREVIEW_OVERLAY_SELECTOR = ".board-attachment-preview-overlay";

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(BOARD_DETAIL_FOCUSABLE_SELECTOR)).filter((element) => !element.hasAttribute("disabled") && element.tabIndex >= 0);
}

function isInsideAttachmentPreview(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(ATTACHMENT_PREVIEW_OVERLAY_SELECTOR));
}

function UpdateFormattingToolbar({
  onAction
}: {
  onAction: (action: UpdateToolbarAction) => void;
}) {
  return (
    <div className="board-update-toolbar" role="toolbar" aria-label="Opmaak knoppen">
      <button className="board-update-toolbar-button" type="button" aria-label="B" onMouseDown={(evt) => evt.preventDefault()} onClick={() => onAction("bold")}><strong>B</strong></button>
      <button className="board-update-toolbar-button" type="button" aria-label="I" onMouseDown={(evt) => evt.preventDefault()} onClick={() => onAction("italic")}><em>I</em></button>
      <button className="board-update-toolbar-button" type="button" aria-label="U" onMouseDown={(evt) => evt.preventDefault()} onClick={() => onAction("underline")}><u>U</u></button>
      <button className="board-update-toolbar-button" type="button" onMouseDown={(evt) => evt.preventDefault()} onClick={() => onAction("bullets")}>• Lijst</button>
      <button className="board-update-toolbar-button" type="button" onMouseDown={(evt) => evt.preventDefault()} onClick={() => onAction("numbers")}>1. Lijst</button>
    </div>
  );
}

function RecordIcon({ active }: { active: boolean }) {
  if (active) {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="record-icon-glyph">
        <rect x="4.5" y="4.5" width="7" height="7" rx="1.2" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="record-icon-glyph">
      <rect x="6.25" y="1.75" width="3.5" height="7.5" rx="1.75" fill="none" stroke="currentColor" strokeWidth="1.35" />
      <path d="M4.5 7.75a3.5 3.5 0 0 0 7 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.35" />
      <path d="M8 11.25v2.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.35" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="board-icon-glyph">
      <path d="M2.5 4.5h11v2h-11z" fill="currentColor" opacity="0.8" />
      <path d="M3.5 6.5h9v5.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M8 4.6v5.1m0 0 1.9-1.9M8 9.7 6.1 7.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="board-icon-glyph">
      <path d="M4.2 7.1a4.2 4.2 0 1 1 1.1 3.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
      <path d="M4.2 7.1h2.4V4.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="board-icon-glyph">
      <path d="M5 4.5h6m-4.5 0V3.6h3V4.5m-5 0 .6 7.1a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-7.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
      <path d="M6.6 7v3.6m2.8-3.6v3.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
    </svg>
  );
}

function IconActionButton({
  label,
  title,
  onClick,
  disabled,
  className = "",
  children,
  stopPropagation = true
}: {
  label: string;
  title?: string;
  onClick: (evt: ReactMouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  stopPropagation?: boolean;
}) {
  return (
    <button
      type="button"
      className={`board-icon-action-button${className ? ` ${className}` : ""}`}
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={(evt) => {
        if (stopPropagation) evt.stopPropagation();
        onClick(evt);
      }}
    >
      {children}
    </button>
  );
}

function DescriptionEditor({
  value,
  onChange,
  placeholder,
  disabled,
  maxLength,
  error,
  textareaRef,
  onToolbarAction,
  onBlur,
  onFocus,
  ariaLabel
}: {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder: string;
  disabled?: boolean;
  maxLength: number;
  error?: string | null;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onToolbarAction: (action: UpdateToolbarAction) => void;
  onBlur?: (event: FocusEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  ariaLabel: string;
}) {
  return (
    <div className="board-update-editor-shell board-description-editor-shell">
      <UpdateFormattingToolbar onAction={onToolbarAction} />
      <textarea
        ref={textareaRef}
        className="board-update-textarea board-description-textarea"
        rows={3}
        maxLength={maxLength}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onFocus={onFocus}
        onChange={(evt) => {
          onChange(evt.target.value);
          autoResizeTextarea(evt.target);
        }}
        onInput={(evt) => autoResizeTextarea(evt.currentTarget)}
        onBlur={onBlur}
        disabled={disabled}
      />
      <div className="board-description-meta-row">
        <small className="board-description-char-counter">{value.length}/{maxLength}</small>
        {error && <small className="error">{error}</small>}
      </div>
    </div>
  );
}

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatRecordingDuration(durationSeconds: number | null | undefined): string {
  if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return "Duur onbekend";
  }
  const rounded = Math.round(durationSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatRecordingSize(sizeBytes: number | null | undefined): string {
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return "Grootte onbekend";
  }
  if (sizeBytes < 1024) return `${Math.round(sizeBytes)} B`;
  const kb = sizeBytes / 1024;
  if (kb < 1024) {
    return `${new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(kb)} KB`;
  }
  const mb = kb / 1024;
  return `${new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(mb)} MB`;
}

const IMAGE_ATTACHMENT_EXTENSIONS = new Set(["avif", "gif", "heic", "heif", "ico", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"]);

function isImageAttachment(attachment: Pick<CardAttachmentItem, "filename" | "mime_type">): boolean {
  const mimeType = attachment.mime_type.trim().toLowerCase();
  if (mimeType.startsWith("image/")) return true;

  const extension = attachment.filename.trim().toLowerCase().split(".").pop();
  return Boolean(extension && IMAGE_ATTACHMENT_EXTENSIONS.has(extension));
}

function AttachmentPreviewModal({ attachment, onClose }: { attachment: CardAttachmentItem; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previewModalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [attachment.id]);

  const handleKeyDownCapture = (evt: React.KeyboardEvent<HTMLDivElement>) => {
    if (evt.key === "Escape") {
      evt.preventDefault();
      evt.stopPropagation();
      onClose();
      return;
    }

    if (evt.key !== "Tab") return;

    const focusables = getFocusableElements(previewModalRef.current);
    if (!focusables.length) {
      evt.preventDefault();
      evt.stopPropagation();
      closeButtonRef.current?.focus();
      return;
    }

    const activeElement = document.activeElement as HTMLElement | null;
    const currentIndex = activeElement ? focusables.indexOf(activeElement) : -1;

    if (evt.shiftKey) {
      if (currentIndex <= 0) {
        evt.preventDefault();
        evt.stopPropagation();
        focusables[focusables.length - 1]?.focus();
      }
      return;
    }

    if (currentIndex === -1 || currentIndex === focusables.length - 1) {
      evt.preventDefault();
      evt.stopPropagation();
      focusables[0]?.focus();
    }
  };

  return (
    <div
      className="modal board-attachment-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Voorbeeld van ${attachment.filename}`}
      onKeyDownCapture={handleKeyDownCapture}
      onClick={(evt) => {
        if (evt.target === evt.currentTarget) onClose();
      }}
    >
      <div ref={previewModalRef} className="board-attachment-preview-modal" onClick={(evt) => evt.stopPropagation()}>
        <div className="board-attachment-preview-header">
          <div>
            <h3>Bijlagevoorbeeld</h3>
            <p className="board-attachment-preview-filename">{attachment.filename}</p>
          </div>
          <button type="button" className="board-attachment-preview-close" autoFocus ref={closeButtonRef} onClick={onClose}>
            Sluiten
          </button>
        </div>
        <div className="board-attachment-preview-frame">
          <img className="board-attachment-preview-image" src={attachment.download_url} alt={`Voorbeeld van ${attachment.filename}`} />
        </div>
      </div>
    </div>
  );
}

export function VergaderbordenPage({ canManageProjects = false }: { canManageProjects?: boolean }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [activeCreateColumn, setActiveCreateColumn] = useState<"todo" | "doing" | "done" | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [boardView, setBoardView] = useState<"active" | "archive" | "recycle">("active");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeRecordingCardId, setActiveRecordingCardId] = useState<string | null>(null);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentResults, setAttachmentResults] = useState<AttachmentBatchItem[]>([]);
  const [attachmentStatusMessage, setAttachmentStatusMessage] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentDragActive, setAttachmentDragActive] = useState(false);
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<CardAttachmentItem | null>(null);
  const [createCardNotice, setCreateCardNotice] = useState<string | null>(null);
  const [createCardProgress, setCreateCardProgress] = useState<string | null>(null);
  const [dragDropTarget, setDragDropTarget] = useState<DragDropTarget | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [cardActionMessage, setCardActionMessage] = useState<string | null>(null);
  const [cardActionError, setCardActionError] = useState<string | null>(null);
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [titleEdit, setTitleEdit] = useState<TitleEditState | null>(null);
  const [descriptionEdit, setDescriptionEdit] = useState<DescriptionEditState | null>(null);
  const [updateEdit, setUpdateEdit] = useState<UpdateEditState | null>(null);
  const [isNewUpdateToolbarVisible, setIsNewUpdateToolbarVisible] = useState(false);
  const [isUpdateEditToolbarVisible, setIsUpdateEditToolbarVisible] = useState(false);
  const newUpdateTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editUpdateTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const detailDescriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const boardDetailModalRef = useRef<HTMLDivElement | null>(null);
  const boardDetailCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const boardDetailTriggerRef = useRef<HTMLElement | null>(null);
  const attachmentPreviewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const skipNextTitleBlurRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const dragCardMetaRef = useRef<DragCardMeta | null>(null);

  const clearAttachmentSelection = () => {
    setAttachmentFiles([]);
    setAttachmentError(null);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  };

  const selectAttachmentFiles = (files: File[]) => {
    setAttachmentFiles(files);
    setAttachmentResults(files.map((file) => ({ fileName: file.name, status: "queued" })));
    setAttachmentStatusMessage(null);
    setAttachmentError(null);
  };

  useEffect(() => {
    const shouldRestoreFocus = attachmentPreview === null && attachmentPreviewTriggerRef.current;
    if (!shouldRestoreFocus) return;
    attachmentPreviewTriggerRef.current?.focus();
  }, [attachmentPreview]);

  useEffect(() => {
    setIsNewUpdateToolbarVisible(false);
  }, [selectedCardId]);

  useEffect(() => {
    setIsUpdateEditToolbarVisible(false);
  }, [updateEdit?.updateId]);

  const handleUpdateToolbarAction = (action: UpdateToolbarAction) => {
    const textarea = newUpdateTextareaRef.current;
    if (!textarea) return;
    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const next = applyToolbarAction(updateMessage, selectionStart, selectionEnd, action);
    setUpdateMessage(next.value);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(next.nextSelectionStart, next.nextSelectionEnd);
    });
  };

  const handleUpdateEditToolbarAction = (action: UpdateToolbarAction) => {
    const textarea = editUpdateTextareaRef.current;
    if (!textarea || !updateEdit) return;
    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const next = applyToolbarAction(updateEdit.value, selectionStart, selectionEnd, action);
    setUpdateEdit((current) => (current ? { ...current, value: next.value } : current));
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(next.nextSelectionStart, next.nextSelectionEnd);
    });
  };

  const showNewUpdateToolbar = () => setIsNewUpdateToolbarVisible(true);

  const hideNewUpdateToolbar = (evt: FocusEvent<HTMLDivElement>) => {
    const relatedTarget = evt.relatedTarget as Node | null;
    if (relatedTarget) {
      if (evt.currentTarget.contains(relatedTarget)) {
        return;
      }
      setIsNewUpdateToolbarVisible(false);
      return;
    }

    const shell = evt.currentTarget;
    window.requestAnimationFrame(() => {
      if (shell.contains(document.activeElement)) {
        return;
      }
      setIsNewUpdateToolbarVisible(false);
    });
  };

  const showUpdateEditToolbar = () => setIsUpdateEditToolbarVisible(true);

  const hideUpdateEditToolbar = (evt: FocusEvent<HTMLDivElement>) => {
    const relatedTarget = evt.relatedTarget as Node | null;
    if (relatedTarget) {
      if (evt.currentTarget.contains(relatedTarget)) {
        return;
      }
      setIsUpdateEditToolbarVisible(false);
      return;
    }

    const shell = evt.currentTarget;
    window.requestAnimationFrame(() => {
      if (shell.contains(document.activeElement)) {
        return;
      }
      setIsUpdateEditToolbarVisible(false);
    });
  };

  const handleDetailDescriptionToolbarAction = (action: UpdateToolbarAction) => {
    const textarea = detailDescriptionTextareaRef.current;
    if (!textarea || !cardQuery.data?.card) return;
    const source = descriptionEdit?.cardId === cardQuery.data.card.id ? descriptionEdit.value : cardQuery.data.card.description;
    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const next = applyToolbarAction(source, selectionStart, selectionEnd, action);
    const boundedValue = next.value.slice(0, CARD_DESCRIPTION_MAX_LENGTH);
    if (descriptionEdit?.cardId === cardQuery.data.card.id) {
      setDescriptionEdit((current) => (current ? { ...current, value: boundedValue, error: null } : current));
    } else {
      setDescriptionEdit({
        cardId: cardQuery.data.card.id,
        value: boundedValue,
        original: cardQuery.data.card.description,
        error: null
      });
    }
    window.requestAnimationFrame(() => {
      autoResizeTextarea(textarea);
      textarea.focus();
      const cap = boundedValue.length;
      textarea.setSelectionRange(Math.min(next.nextSelectionStart, cap), Math.min(next.nextSelectionEnd, cap));
    });
  };

  const projectsQuery = useQuery({ queryKey: ["board-projects"], queryFn: listBoardProjects });
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: listAdminUsers });
  const currentUserQuery = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });
  const requestedProjectId = searchParams.get("project");
  const resolvedProjectId = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    return resolveVergaderbordenProjectId(projects, requestedProjectId);
  }, [projectsQuery.data, requestedProjectId]);

  const boardQuery = useQuery({
    queryKey: ["board-project", resolvedProjectId],
    queryFn: () => getBoardProject(resolvedProjectId || ""),
    enabled: Boolean(resolvedProjectId)
  });
  const recycleBinQuery = useQuery({
    queryKey: ["board-recycle-bin"],
    queryFn: listBoardRecycleBin,
    enabled: canManageProjects
  });
  const cardQuery = useQuery({ queryKey: ["board-card", selectedCardId], queryFn: () => getBoardCard(selectedCardId || ""), enabled: Boolean(selectedCardId) });
  const resolvedProjectName = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    const selected = projects.find((project) => project.id === resolvedProjectId);
    return selected?.name ?? boardQuery.data?.project_name ?? null;
  }, [projectsQuery.data, resolvedProjectId, boardQuery.data?.project_name]);

  const boardAccessUsers = boardQuery.data?.access_users ?? [];
  const boardAssignableUsers = useMemo(
    () => boardAccessUsers.filter((user) => user.is_active),
    [boardAccessUsers]
  );

  const archivedCards = useMemo<BoardCard[]>(() => boardQuery.data?.archived_cards ?? [], [boardQuery.data]);
  const archivedCardsByColumn = useMemo(() => {
    return {
      todo: archivedCards.filter((c) => c.column === "todo").sort((a, b) => a.position - b.position),
      doing: archivedCards.filter((c) => c.column === "doing").sort((a, b) => a.position - b.position),
      done: archivedCards.filter((c) => c.column === "done").sort((a, b) => a.position - b.position)
    };
  }, [archivedCards]);
  const recycleBinCards: BoardRecycleBinCard[] = recycleBinQuery.data ?? [];

  const cardActivityItems = useMemo<CardActivityItem[]>(() => {
    if (!cardQuery.data) return [];
    const updates: CardActivityItem[] = cardQuery.data.updates.map((u) => ({
      kind: "update",
      id: `update-${u.id}`,
      sortTs: new Date(u.created_at || 0).getTime(),
      createdAt: u.created_at,
      update: u
    }));
    const recordings: CardActivityItem[] = cardQuery.data.recordings.map((r) => {
      const sourceTs = r.recorded_at || r.created_at;
      return {
        kind: "recording",
        id: `recording-${r.id}`,
        sortTs: new Date(sourceTs || 0).getTime(),
        createdAt: sourceTs,
        recording: r
      };
    });
    return [...updates, ...recordings].sort((a, b) => b.sortTs - a.sortTs);
  }, [cardQuery.data]);

  const cardAttachments = useMemo<CardAttachmentItem[]>(() => cardQuery.data?.attachments ?? [], [cardQuery.data]);

  useEffect(() => {
    setAttachmentPreview(null);
  }, [selectedCardId]);

  const createProjectMutation = useMutation({
    mutationFn: createBoardProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-projects"] });
      setShowCreate(false);
    }
  });
  const createCardMutation = useMutation({
    mutationFn: ({ projectId: id, title, description, column, assignment_user_ids }: { projectId: string; title: string; description: string; column: "todo" | "doing" | "done"; assignment_user_ids: string[] }) =>
      createBoardCard(id, { title, description, column, assignment_user_ids }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] })
  });
  const moveCardMutation = useMutation({
    mutationFn: ({ cardId, column, position }: { cardId: string; column: "todo" | "doing" | "done"; position: number }) => moveBoardCard(cardId, { column, position }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] }),
    onError: (error) => {
      setMoveError(toDutchMoveError(error));
      queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] });
    },
    onSettled: () => setSavingCardId(null)
  });
  const updateTitleMutation = useMutation({
    mutationFn: ({ cardId, title }: { cardId: string; title: string }) => updateBoardCardTitle(cardId, { title }),
    onSuccess: async (_card, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] }),
        queryClient.invalidateQueries({ queryKey: ["board-card", variables.cardId] })
      ]);
    }
  });
  const updateDescriptionMutation = useMutation({
    mutationFn: ({ cardId, description }: { cardId: string; description: string }) => updateBoardCardDescription(cardId, { description }),
    onSuccess: async (_card, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] }),
        queryClient.invalidateQueries({ queryKey: ["board-card", variables.cardId] })
      ]);
    }
  });
  const postUpdateMutation = useMutation({
    mutationFn: ({ cardId, message }: { cardId: string; message: string }) => postBoardCardUpdate(cardId, message),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-card", selectedCardId] }),
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] })
      ]);
      setUpdateMessage("");
      setUpdateError(null);
    }
  });
  const editUpdateMutation = useMutation({
    mutationFn: ({ cardId, updateId, message, removeImage, image }: { cardId: string; updateId: string; message: string; removeImage?: boolean; image?: File | null }) =>
      editBoardCardUpdate(cardId, updateId, { message, remove_image: removeImage, image }),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-card", variables.cardId] }),
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] })
      ]);
      setUpdateEdit(null);
    }
  });
  const uploadRecordingMutation = useMutation({
    mutationFn: ({ cardId, blob, duration }: { cardId: string; blob: Blob; duration: number }) => uploadBoardRecording(cardId, blob, duration),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] }),
        queryClient.invalidateQueries({ queryKey: ["board-card", variables.cardId] })
      ]);
    },
    onError: () => {
      setRecordingError("Uploaden van de opname is mislukt. Probeer het opnieuw.");
    }
  });
  const deleteUpdateMutation = useMutation({
    mutationFn: ({ cardId, updateId }: { cardId: string; updateId: string }) => deleteBoardCardUpdate(cardId, updateId),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-card", variables.cardId] }),
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] })
      ]);
    }
  });
  const deleteAttachmentMutation = useMutation({
    mutationFn: ({ cardId, attachmentId }: { cardId: string; attachmentId: string }) => deleteBoardCardAttachment(cardId, attachmentId),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-card", variables.cardId] }),
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] })
      ]);
    },
    onError: () => {
      setAttachmentError("Verwijderen van de bijlage is mislukt. Probeer het opnieuw.");
    }
  });
  const archiveCardMutation = useMutation({
    mutationFn: (cardId: string) => archiveBoardCard(cardId),
    onSuccess: async (_result, cardId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] }),
        queryClient.invalidateQueries({ queryKey: ["board-card", cardId] })
      ]);
    }
  });
  const restoreCardMutation = useMutation({
    mutationFn: (cardId: string) => restoreBoardCard(cardId),
    onSuccess: async (_result, cardId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] }),
        queryClient.invalidateQueries({ queryKey: ["board-card", cardId] })
      ]);
    }
  });
  const deleteCardMutation = useMutation({
    mutationFn: (cardId: string) => deleteBoardCard(cardId),
    onMutate: () => {
      setCardActionMessage(null);
      setCardActionError(null);
    },
    onSuccess: async (_result, cardId) => {
      setSelectedCardId((current) => (current === cardId ? null : current));
      setCardActionError(null);
      setCardActionMessage("Kaart verwijderd.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] }),
        queryClient.invalidateQueries({ queryKey: ["board-card", cardId] }),
        queryClient.invalidateQueries({ queryKey: ["board-recycle-bin"] })
      ]);
    },
    onError: () => {
      setCardActionMessage(null);
      setCardActionError("Verwijderen van de kaart is mislukt. Probeer het opnieuw.");
    }
  });
  const restoreDeletedCardMutation = useMutation({
    mutationFn: (cardId: string) => restoreDeletedBoardCard(cardId),
    onMutate: () => {
      setCardActionMessage(null);
      setCardActionError(null);
    },
    onSuccess: async () => {
      setCardActionError(null);
      setCardActionMessage("Kaart teruggezet uit de prullenbak.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] }),
        queryClient.invalidateQueries({ queryKey: ["board-recycle-bin"] })
      ]);
    },
    onError: () => {
      setCardActionMessage(null);
      setCardActionError("Terugzetten van de kaart is mislukt. Probeer het opnieuw.");
    }
  });

  const uploadSelectedAttachments = async () => {
    if (!cardQuery.data?.card || isAttachmentUploading) return;
    if (!attachmentFiles.length) {
      setAttachmentError("Kies eerst een of meer bestanden om toe te voegen.");
      return;
    }

    setAttachmentError(null);
    setAttachmentStatusMessage(`Bijlage 1 van ${attachmentFiles.length} wordt geüpload…`);
    setAttachmentResults(attachmentFiles.map((file) => ({ fileName: file.name, status: "queued" })));
    setIsAttachmentUploading(true);

    let successCount = 0;
    const failedFiles: Array<{ fileName: string; error: string }> = [];

    try {
      for (const [index, file] of attachmentFiles.entries()) {
        setAttachmentStatusMessage(`Bijlage ${index + 1} van ${attachmentFiles.length} wordt geüpload…`);
        setAttachmentResults((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, status: "uploading" } : item)));

        try {
          await uploadBoardCardAttachment(cardQuery.data.card.id, file);
          successCount += 1;
          setAttachmentResults((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, status: "success" } : item)));
        } catch (error) {
          const message = error instanceof Error && error.message ? error.message : "Upload mislukt.";
          failedFiles.push({ fileName: file.name, error: message });
          setAttachmentResults((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, status: "error", error: message } : item)));
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-card", cardQuery.data.card.id] }),
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] })
      ]);

      if (failedFiles.length > 0) {
        const failedNames = failedFiles.map((item) => item.fileName).join(", ");
        setAttachmentStatusMessage(
          successCount > 0
            ? `${successCount} van de ${attachmentFiles.length} bijlagen geüpload. Mislukt: ${failedNames}.`
            : `Geen van de ${attachmentFiles.length} bijlagen kon worden geüpload. Mislukt: ${failedNames}.`
        );
      } else {
        setAttachmentStatusMessage(`${successCount} bijlage${successCount === 1 ? "" : "n"} geüpload.`);
      }

      clearAttachmentSelection();
      setAttachmentDragActive(false);
    } catch {
      setAttachmentStatusMessage(null);
      setAttachmentError("Uploaden van de bijlage is mislukt. Probeer het opnieuw.");
    } finally {
      setIsAttachmentUploading(false);
    }
  };

  const cardsByColumn = useMemo(() => {
    const cards = boardQuery.data?.cards ?? [];
    return {
      todo: cards.filter((c) => c.column === "todo").sort((a, b) => a.position - b.position),
      doing: cards.filter((c) => c.column === "doing").sort((a, b) => a.position - b.position),
      done: cards.filter((c) => c.column === "done").sort((a, b) => a.position - b.position)
    };
  }, [boardQuery.data]);

  const activeCardCount = cardsByColumn.todo.length + cardsByColumn.doing.length + cardsByColumn.done.length;

  const renderBoardCard = (card: BoardCard, column: "todo" | "doing" | "done", variant: "active" | "archive") => {
    const isArchiveView = variant === "archive";
    return (
      <div key={card.id}>
        {!isArchiveView && dragDropTarget?.column === column && dragDropTarget.cardId === card.id && dragDropTarget.placement === "before" && (
          <div className="vergaderborden-drop-indicator" data-testid={`board-drop-indicator-${column}-${card.id}-before`} aria-hidden="true" />
        )}
        <article
          className={`vergaderborden-board-card${card.is_archived ? " is-archived" : ""}${isArchiveView ? " is-archive-view" : ""}`}
          data-testid={`board-card-${card.id}`}
          tabIndex={-1}
          draggable={!isArchiveView}
          onDragStart={
            isArchiveView
              ? undefined
              : (e) => {
                  setMoveError(null);
                  const payload: DragCardMeta = { cardId: card.id, sourceColumn: card.column, sourcePosition: card.position };
                  dragCardMetaRef.current = payload;
                  e.dataTransfer.setData("application/json", JSON.stringify(payload));
                  e.dataTransfer.setData("text/plain", card.id);
                }
          }
          onDragOver={
            isArchiveView
              ? undefined
              : (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!dragCardMetaRef.current) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const placement = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                  setDragDropTarget({ column, cardId: card.id, placement });
                }
          }
          onDragLeave={
            isArchiveView
              ? undefined
              : (e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                  setDragDropTarget((current) => (current?.cardId === card.id ? null : current));
                }
          }
          onDragEnd={
            isArchiveView
              ? undefined
              : () => {
                  dragCardMetaRef.current = null;
                  setDragDropTarget(null);
                }
          }
          onDrop={
            isArchiveView
              ? undefined
              : (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragDropTarget(null);
                  const cardMeta = dragCardMetaRef.current ?? parseDragCardMeta(e.dataTransfer.getData("application/json"));
                  if (!cardMeta || cardMeta.cardId === card.id) return;
                  dragCardMetaRef.current = null;

                  const targetCards = cardsByColumn[column] ?? [];
                  const rect = e.currentTarget.getBoundingClientRect();
                  const placement = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                  const targetPosition = resolveMoveTargetPosition(targetCards, column, cardMeta, card.id, placement);

                  setMoveError(null);
                  setSavingCardId(cardMeta.cardId);
                  moveCardMutation.mutate({ cardId: cardMeta.cardId, column, position: targetPosition });
                }
          }
          onClick={(evt) => {
            boardDetailTriggerRef.current = evt.currentTarget;
            evt.currentTarget.focus();
            setSelectedCardId(card.id);
          }}
        >
          <strong className="vergaderborden-card-title">{card.title}</strong>
          <div className="board-card-description-rich">
            <CardDescriptionRenderer description={card.description} />
          </div>
          <AssignedUserAvatarRow assignments={card.assignments} />
          <small>Updates: {card.updates_count} · Opnames: {card.recordings_count} · Bijlagen: {card.attachments_count ?? 0}</small>
          {isArchiveView ? (
            <div className="board-card-recording-controls board-card-archive-controls">
              <IconActionButton
                label={`Kaart terugzetten: ${card.title}`}
                title={`Kaart terugzetten: ${card.title}`}
                disabled={restoreCardMutation.isPending}
                onClick={() => restoreCardMutation.mutate(card.id)}
              >
                <RestoreIcon />
              </IconActionButton>
              <IconActionButton
                label={`Kaart verwijderen: ${card.title}`}
                title={`Kaart verwijderen: ${card.title}`}
                disabled={deleteCardMutation.isPending}
                onClick={() => {
                  const shouldDelete = window.confirm("Weet je zeker dat je deze kaart wilt verwijderen? Dit kan later door een admin worden teruggezet.");
                  if (!shouldDelete) return;
                  deleteCardMutation.mutate(card.id);
                }}
              >
                <TrashIcon />
              </IconActionButton>
            </div>
          ) : (
            <div className="board-card-recording-controls">
              {activeRecordingCardId === card.id && <p className="board-card-recording-timer">Timer: {recordingSeconds}s</p>}
              <button
                type="button"
                className={`record-icon-button${activeRecordingCardId === card.id ? " is-active" : ""}`}
                onClick={(evt) => {
                  evt.stopPropagation();
                  void startOrStopRecording(card.id);
                }}
                disabled={Boolean(recorder && activeRecordingCardId !== card.id)}
                aria-label={activeRecordingCardId === card.id ? `Stop opname voor ${card.title}` : `Start opname voor ${card.title}`}
                title={activeRecordingCardId === card.id ? `Stop opname voor ${card.title}` : `Start opname voor ${card.title}`}
              >
                <RecordIcon active={activeRecordingCardId === card.id} />
              </button>
            </div>
          )}
        </article>
        {!isArchiveView && dragDropTarget?.column === column && dragDropTarget.cardId === card.id && dragDropTarget.placement === "after" && (
          <div className="vergaderborden-drop-indicator" data-testid={`board-drop-indicator-${column}-${card.id}-after`} aria-hidden="true" />
        )}
      </div>
    );
  };

  const renderBoardColumn = (column: "todo" | "doing" | "done", variant: "active" | "archive") => {
    const cards = variant === "active" ? cardsByColumn[column] : archivedCardsByColumn[column];
    const isActiveView = variant === "active";

    return (
      <div
        className={`vergaderborden-column${dragDropTarget?.column === column && isActiveView ? " is-drag-over" : ""}${savingCardId && isActiveView ? " is-saving" : ""}`}
        key={column}
        data-testid={`board-column-${column}`}
        onDragOver={
          isActiveView
            ? (e) => {
                e.preventDefault();
                if (!dragCardMetaRef.current) return;
                setDragDropTarget(resolveColumnDragTarget(e.currentTarget, column, e.clientY));
              }
            : undefined
        }
        onDragLeave={
          isActiveView
            ? (e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                setDragDropTarget((current) => (current?.column === column ? null : current));
              }
            : undefined
        }
        onDrop={
          isActiveView
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragDropTarget(null);
                const cardMeta = dragCardMetaRef.current ?? parseDragCardMeta(e.dataTransfer.getData("application/json"));
                if (!cardMeta) return;
                dragCardMetaRef.current = null;

                const targetCards = cardsByColumn[column] ?? [];
                const targetDrop = resolveColumnDragTarget(e.currentTarget, column, e.clientY);
                const targetPosition = resolveMoveTargetPosition(targetCards, column, cardMeta, targetDrop.cardId, targetDrop.placement);

                setMoveError(null);
                setSavingCardId(cardMeta.cardId);
                moveCardMutation.mutate({ cardId: cardMeta.cardId, column, position: targetPosition });
              }
            : undefined
        }
      >
        <h3>{KOLOM_TITEL[column]}</h3>
        {isActiveView ? (
          activeCreateColumn !== column ? (
            <button
              type="button"
              className="vergaderborden-card-add-toggle"
              onClick={() => {
                setCreateCardNotice(null);
                setActiveCreateColumn(column);
              }}
            >
              + Kaart toevoegen
            </button>
          ) : (
            <CreateCardInline
              users={boardAssignableUsers}
              isLoading={boardQuery.isLoading}
              hasError={boardQuery.isError}
              onCreate={async (payload) => {
                if (!resolvedProjectId) return false;
                try {
                  setCreateCardNotice(null);
                  setCreateCardProgress("Kaart wordt aangemaakt…");
                  const createdCard = await createCardMutation.mutateAsync({
                    projectId: resolvedProjectId,
                    column,
                    title: payload.title,
                    description: payload.description,
                    assignment_user_ids: payload.assignment_user_ids
                  });
                  let uploadFailures = 0;
                  for (const [index, file] of payload.attachments.entries()) {
                    setCreateCardProgress(`Kaart is aangemaakt. Bijlage ${index + 1} van ${payload.attachments.length} wordt geüpload…`);
                    try {
                      await uploadBoardCardAttachment(createdCard.id, file);
                    } catch {
                      uploadFailures += 1;
                    }
                  }
                  if (payload.attachments.length > 0) {
                    setCreateCardProgress("Bijlagen verwerkt…");
                    await Promise.all([
                      queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] }),
                      queryClient.invalidateQueries({ queryKey: ["board-card", createdCard.id] })
                    ]);
                  }
                  if (uploadFailures > 0) {
                    setCreateCardNotice(
                      `Kaart is aangemaakt, maar ${uploadFailures} van de ${payload.attachments.length} bijlagen konden niet worden geüpload. De kaart blijft beschikbaar.`
                    );
                  } else {
                    setCreateCardNotice(null);
                  }
                  setCreateCardProgress(null);
                  setActiveCreateColumn(null);
                  return true;
                } catch {
                  setCreateCardProgress(null);
                  return false;
                }
              }}
              onCancel={() => setActiveCreateColumn(null)}
            />
          )
        ) : null}
        {cards.map((card) => renderBoardCard(card, column, variant))}
        {isActiveView && dragDropTarget?.column === column && dragDropTarget.cardId === null && (
          <div className="vergaderborden-drop-indicator vergaderborden-drop-indicator--end" data-testid={`board-drop-indicator-${column}-end`} aria-hidden="true" />
        )}
      </div>
    );
  };

  const resolveMoveTargetPosition = (
    targetCards: typeof cardsByColumn.todo,
    targetColumn: "todo" | "doing" | "done",
    cardMeta: DragCardMeta,
    targetCardId: string | null,
    placement: "before" | "after"
  ) => {
    if (!targetCardId) {
      return targetCards.length;
    }

    const targetIndex = targetCards.findIndex((card) => card.id === targetCardId);
    if (targetIndex < 0) {
      return targetCards.length;
    }

    if (cardMeta.sourceColumn === targetColumn) {
      if (placement === "before") {
        return cardMeta.sourcePosition < targetIndex ? targetIndex - 1 : targetIndex;
      }
      return cardMeta.sourcePosition < targetIndex ? targetIndex : targetIndex + 1;
    }

    return placement === "before" ? targetIndex : targetIndex + 1;
  };

  useEffect(() => {
    setActiveCreateColumn(null);
  }, [resolvedProjectId]);

  useEffect(() => {
    setDragDropTarget(null);
  }, [resolvedProjectId]);

  useEffect(() => {
    dragCardMetaRef.current = null;
  }, [resolvedProjectId]);

  useEffect(() => {
    const projects = projectsQuery.data ?? [];
    if (!projects.length || !resolvedProjectId) {
      return;
    }
    if (requestedProjectId === resolvedProjectId) {
      return;
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("project", resolvedProjectId);
      return next;
    }, { replace: true });
  }, [projectsQuery.data, requestedProjectId, resolvedProjectId, setSearchParams]);

  useEffect(() => {
    const projects = projectsQuery.data ?? [];
    if (!projects.length || !resolvedProjectId) return;

    if (projects.some((project) => project.id === resolvedProjectId)) {
      window.localStorage.setItem(VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY, resolvedProjectId);
      return;
    }

    window.localStorage.removeItem(VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY);
  }, [projectsQuery.data, resolvedProjectId]);

  useEffect(() => {
    setTitleEdit(null);
  }, [selectedCardId]);

  useEffect(() => {
    setDescriptionEdit(null);
  }, [selectedCardId]);

  useEffect(() => {
    setAttachmentFiles([]);
    setAttachmentResults([]);
    setAttachmentStatusMessage(null);
    setAttachmentError(null);
    setIsAttachmentUploading(false);
  }, [selectedCardId]);

  useEffect(() => {
    setCreateCardNotice(null);
  }, [resolvedProjectId]);

  useEffect(() => {
    setDragDropTarget(null);
  }, [boardQuery.data?.project_id]);

  useEffect(() => {
    setBoardView("active");
  }, [resolvedProjectId]);

  useEffect(() => {
    setCardActionMessage(null);
    setCardActionError(null);
  }, [resolvedProjectId]);

  useEffect(() => {
    return () => {
      window.clearInterval((window as any).__vergaderbordTimer);
    };
  }, []);

  const startOrStopRecording = async (cardId: string) => {
    if (recorder && activeRecordingCardId === cardId) {
      recorder.requestData();
      recorder.stop();
      return;
    }
    if (recorder && activeRecordingCardId && activeRecordingCardId !== cardId) {
      setRecordingError("Er kan maar één opname tegelijk actief zijn.");
      return;
    }
    try {
      setRecordingError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          chunks.push(evt.data);
        }
      };
      mr.onstop = () => {
        const finishedCardId = cardId;
        const startedAt = recordingStartedAtRef.current;
        const elapsedByClock = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
        const durationAtStop = Math.max(recordingSeconds, elapsedByClock);
        recordingStartedAtRef.current = null;
        setRecorder(null);
        setActiveRecordingCardId(null);
        window.clearInterval((window as any).__vergaderbordTimer);
        const blob = new Blob(chunks, { type: "audio/webm" });
        if (durationAtStop < MIN_RECORDING_SECONDS) {
          setRecordingError(RECORDING_TOO_SHORT_MESSAGE);
        } else if (blob.size > 0) {
          setRecordingError(null);
          uploadRecordingMutation.mutate({ cardId: finishedCardId, blob, duration: Math.max(1, durationAtStop) });
        } else {
          setRecordingError("Geen audiogegevens opgenomen. Probeer opnieuw.");
        }
        setRecordingSeconds(0);
        stream.getTracks().forEach((track) => track.stop());
      };
      mr.start();
      setActiveRecordingCardId(cardId);
      setRecorder(mr);
      setRecordingSeconds(0);
      recordingStartedAtRef.current = Date.now();
      (window as any).__vergaderbordTimer = window.setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      setRecordingError("Microfoon starten is mislukt. Controleer toestemming en probeer opnieuw.");
    }
  };

  const startTitleEdit = (cardId: string, title: string) => {
    setTitleEdit({ cardId, value: title, original: title, error: null });
  };

  const closeCardDetail = () => {
    setAttachmentPreview(null);
    setSelectedCardId(null);
    window.requestAnimationFrame(() => {
      boardDetailTriggerRef.current?.focus();
    });
  };

  const startDescriptionEdit = (cardId: string, description: string) => {
    setDescriptionEdit({ cardId, value: description, original: description, error: null });
    window.requestAnimationFrame(() => {
      autoResizeTextarea(detailDescriptionTextareaRef.current);
      detailDescriptionTextareaRef.current?.focus();
    });
  };

  const saveTitleEdit = async () => {
    if (!titleEdit || updateTitleMutation.isPending) return;
    const nextTitle = titleEdit.value.trim();
    if (!nextTitle) {
      setTitleEdit((current) => (current ? { ...current, error: "Vul een kaarttitel in." } : current));
      return;
    }
    if (nextTitle.length > CARD_TITLE_MAX_LENGTH) {
      setTitleEdit((current) => (current ? { ...current, error: `Kaarttitel mag maximaal ${CARD_TITLE_MAX_LENGTH} tekens bevatten.` } : current));
      return;
    }
    if (nextTitle === titleEdit.original.trim()) {
      setTitleEdit(null);
      return;
    }
    try {
      await updateTitleMutation.mutateAsync({ cardId: titleEdit.cardId, title: nextTitle });
      setTitleEdit(null);
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Kaarttitel opslaan is mislukt.";
      setTitleEdit((current) => (current ? { ...current, error: message } : current));
    }
  };

  const saveDescriptionEdit = async () => {
    if (!descriptionEdit || updateDescriptionMutation.isPending) return;
    const nextDescription = descriptionEdit.value.trim();
    if (nextDescription.length > CARD_DESCRIPTION_MAX_LENGTH) {
      setDescriptionEdit((current) => (current ? { ...current, error: `Beschrijving mag maximaal ${CARD_DESCRIPTION_MAX_LENGTH} tekens bevatten.` } : current));
      return;
    }
    if (nextDescription === descriptionEdit.original.trim()) {
      setDescriptionEdit(null);
      return;
    }
    try {
      await updateDescriptionMutation.mutateAsync({ cardId: descriptionEdit.cardId, description: nextDescription });
      setDescriptionEdit(null);
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Kaartbeschrijving opslaan is mislukt.";
      setDescriptionEdit((current) => (current ? { ...current, error: message } : current));
    }
  };

  useEffect(() => {
    autoResizeTextarea(detailDescriptionTextareaRef.current);
  }, [descriptionEdit?.value, cardQuery.data?.card?.id]);

  useEffect(() => {
    if (!selectedCardId || !cardQuery.data?.card) return;
    if (titleEdit || descriptionEdit || updateEdit) return;

    const frame = window.requestAnimationFrame(() => {
      const focusTarget = boardDetailCloseButtonRef.current ?? getFocusableElements(boardDetailModalRef.current)[0] ?? boardDetailModalRef.current;
      focusTarget?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedCardId, cardQuery.data?.card?.id, titleEdit, descriptionEdit, updateEdit]);

  useEffect(() => {
    if (!selectedCardId || !cardQuery.data?.card) return;

    const onDocumentKeyDown = (evt: KeyboardEvent) => {
      if (evt.key !== "Tab") return;
      const modal = boardDetailModalRef.current;
      if (!modal || !modal.contains(document.activeElement)) return;

      const focusables = getFocusableElements(modal);
      if (!focusables.length) {
        evt.preventDefault();
        modal.focus();
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      const currentIndex = activeElement ? focusables.indexOf(activeElement) : -1;
      if (evt.shiftKey) {
        if (currentIndex <= 0) {
          evt.preventDefault();
          focusables[focusables.length - 1]?.focus();
        }
        return;
      }

      if (currentIndex === focusables.length - 1) {
        evt.preventDefault();
        focusables[0]?.focus();
      }
    };

    document.addEventListener("keydown", onDocumentKeyDown, true);
    return () => document.removeEventListener("keydown", onDocumentKeyDown, true);
  }, [selectedCardId, cardQuery.data?.card?.id]);

  return (
    <section className="panel vergaderborden-page">
      <div className="vergaderborden-board-header-row">
        <div className="vergaderborden-header">
          {resolvedProjectName && <h1>{resolvedProjectName}</h1>}
          {resolvedProjectId && <BoardAccessBadges users={boardAccessUsers} />}
        </div>
        {resolvedProjectId && (
          <div className="vergaderborden-board-tabs" role="group" aria-label="Kaartweergave">
            <button
              type="button"
              aria-pressed={boardView === "active"}
              className={boardView === "active" ? "is-active" : ""}
              onClick={() => setBoardView("active")}
            >
              Actief ({activeCardCount})
            </button>
            <button
              type="button"
              aria-pressed={boardView === "archive"}
              className={boardView === "archive" ? "is-active" : ""}
              onClick={() => setBoardView("archive")}
            >
              Archief ({archivedCards.length})
            </button>
            {canManageProjects && (
              <button
                type="button"
                aria-pressed={boardView === "recycle"}
                className={boardView === "recycle" ? "is-active" : ""}
                onClick={() => setBoardView("recycle")}
              >
                Prullenbak ({recycleBinCards.length})
              </button>
            )}
          </div>
        )}
      </div>
      {canManageProjects && (
        <>
          {showCreate && <CreateProjectModal users={usersQuery.data ?? []} onClose={() => setShowCreate(false)} onSubmit={(payload) => createProjectMutation.mutate(payload)} />}
          <button className="vergaderborden-primary-action" onClick={() => setShowCreate(true)}>Nieuw project</button>
        </>
      )}

      {resolvedProjectId && (
        <>
          {(cardActionMessage || cardActionError) && (
            <div className="vergaderborden-card-action-feedback">
              {cardActionMessage && (
                <p className="vergaderborden-saving-indicator" role="status" aria-live="polite">
                  {cardActionMessage}
                </p>
              )}
              {cardActionError && (
                <p className="error vergaderborden-inline-error" role="alert">
                  {cardActionError}
                </p>
              )}
            </div>
          )}

          {boardView === "active" && (
            <div className="board-grid">
              {createCardProgress && <p className="vergaderborden-saving-indicator" role="status" aria-live="polite">Kaart wordt aangemaakt…</p>}
              {createCardNotice && <p className="error vergaderborden-inline-error" role="alert">{createCardNotice}</p>}
              {moveError && <p className="error vergaderborden-inline-error vergaderborden-move-error">{moveError}</p>}
              {savingCardId && <p className="vergaderborden-saving-indicator" aria-live="polite">Kaart wordt opgeslagen…</p>}
              {KOLOMMEN.map((kolom) => renderBoardColumn(kolom, "active"))}
            </div>
          )}

          {boardView === "archive" && (
            <section className="board-archive-panel" aria-label="Archief">
              <div className="board-detail-section-heading">
                <h3>Archief</h3>
                <p className="board-section-help">Gearchiveerde kaarten blijven bewaard en kun je hier terugzetten.</p>
              </div>
              {archivedCards.length === 0 && <p className="board-archive-empty">Er zijn nog geen gearchiveerde kaarten.</p>}
              <div className="board-grid board-archive-grid" aria-label="Gearchiveerde kaarten">
                {KOLOMMEN.map((kolom) => renderBoardColumn(kolom, "archive"))}
              </div>
            </section>
          )}

          {boardView === "recycle" && canManageProjects && (
            <section className="board-recycle-panel" aria-label="Prullenbak">
              <div className="board-detail-section-heading">
                <h3>Prullenbak</h3>
                <p className="board-section-help">Hier staan kaarten die soft-verwijderd zijn en alleen door een admin kunnen worden teruggezet.</p>
              </div>
              {recycleBinCards.length === 0 ? (
                <p className="board-archive-empty">De prullenbak is leeg.</p>
              ) : (
                <div className="board-archive-list" role="list" aria-label="Verwijderde kaarten">
                  {recycleBinCards.map((card) => (
                    <article key={card.id} className="board-archive-card" role="listitem">
                      <div className="board-archive-card-copy">
                        <strong>{card.title}</strong>
                        <CardDescriptionRenderer description={card.description} emptyFallback={<>Geen beschrijving</>} />
                        <small>
                          Bord: {card.project_name} · Verwijderd door {card.deleted_by_display_name ?? card.deleted_by_username ?? "onbekend"}
                        </small>
                      </div>
                      <div className="board-archive-card-actions">
                        <IconActionButton
                          label={`Kaart herstellen: ${card.title}`}
                          title={`Kaart herstellen: ${card.title}`}
                          disabled={restoreDeletedCardMutation.isPending}
                          onClick={() => restoreDeletedCardMutation.mutate(card.id)}
                        >
                          <RestoreIcon />
                        </IconActionButton>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
      {recordingError && <p className="error vergaderborden-inline-error">{recordingError}</p>}

      {selectedCardId && cardQuery.data?.card && (
        <div
          className="board-detail-overlay"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          ref={boardDetailModalRef}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCardDetail();
          }}
          onKeyDownCapture={(evt) => {
            if (isInsideAttachmentPreview(evt.target)) return;

            if (evt.key !== "Tab") return;

            const focusables = getFocusableElements(boardDetailModalRef.current);
            if (!focusables.length) {
              evt.preventDefault();
              boardDetailModalRef.current?.focus();
              return;
            }

            const activeElement = document.activeElement as HTMLElement | null;
            const currentIndex = activeElement ? focusables.indexOf(activeElement) : -1;
            if (evt.shiftKey) {
              if (currentIndex <= 0) {
                evt.preventDefault();
                focusables[focusables.length - 1]?.focus();
              }
              return;
            }

            if (currentIndex === focusables.length - 1) {
              evt.preventDefault();
              focusables[0]?.focus();
            }
          }}
          onKeyDown={(evt) => {
            if (isInsideAttachmentPreview(evt.target)) return;

            if (evt.key === "Escape") {
              evt.preventDefault();
              closeCardDetail();
            }
          }}
        >
          <div className="board-detail-modal">
            <header className="board-detail-header">
              <div className="board-detail-header-copy">
                {titleEdit?.cardId === cardQuery.data.card.id ? (
                  <div className="board-detail-title-edit">
                    <label className="vergaderborden-field">
                      <span>Kaarttitel</span>
                      <input
                        autoFocus
                        name="kaarttitel"
                        value={titleEdit.value}
                        onChange={(evt) => setTitleEdit((current) => (current ? { ...current, value: evt.target.value, error: null } : current))}
                        maxLength={CARD_TITLE_MAX_LENGTH}
                        onBlur={() => {
                          if (skipNextTitleBlurRef.current) {
                            skipNextTitleBlurRef.current = false;
                            return;
                          }
                          void saveTitleEdit();
                        }}
                        onKeyDown={(evt) => {
                          if (evt.key === "Enter") {
                            evt.preventDefault();
                            skipNextTitleBlurRef.current = true;
                            void saveTitleEdit();
                          }
                          if (evt.key === "Escape") {
                            evt.preventDefault();
                            evt.stopPropagation();
                            skipNextTitleBlurRef.current = true;
                            setTitleEdit(null);
                          }
                        }}
                        disabled={updateTitleMutation.isPending}
                      />
                    </label>
                    {titleEdit.error && <p className="error vergaderborden-inline-error">{titleEdit.error}</p>}
                  </div>
                ) : (
                  <div className="board-detail-title-row">
                    <h2
                      role="button"
                      tabIndex={0}
                      aria-label={`Kaarttitel bewerken: ${cardQuery.data.card.title}`}
                      onClick={() => startTitleEdit(cardQuery.data!.card.id, cardQuery.data!.card.title)}
                      onKeyDown={(evt) => {
                        if (evt.key === "Enter" || evt.key === " ") {
                          evt.preventDefault();
                          startTitleEdit(cardQuery.data!.card.id, cardQuery.data!.card.title);
                        }
                      }}
                    >
                      {cardQuery.data.card.title}
                    </h2>
                  </div>
                )}
                <AssignedUserAvatarRow assignments={cardQuery.data.card.assignments} className="board-detail-assignment-avatars" />
              </div>
              <div className="board-detail-header-actions">
                {cardQuery.data.card.is_archived ? (
                  <IconActionButton
                    label={`Kaart terugzetten: ${cardQuery.data.card.title}`}
                    title={`Kaart terugzetten: ${cardQuery.data.card.title}`}
                    disabled={restoreCardMutation.isPending}
                    onClick={() => restoreCardMutation.mutate(cardQuery.data!.card.id)}
                  >
                    <RestoreIcon />
                  </IconActionButton>
                ) : (
                  <IconActionButton
                    label={`Kaart archiveren: ${cardQuery.data.card.title}`}
                    title={`Kaart archiveren: ${cardQuery.data.card.title}`}
                    disabled={archiveCardMutation.isPending}
                    onClick={() => archiveCardMutation.mutate(cardQuery.data!.card.id)}
                  >
                    <ArchiveIcon />
                  </IconActionButton>
                )}
                <IconActionButton
                  label={`Kaart verwijderen: ${cardQuery.data.card.title}`}
                  title={`Kaart verwijderen: ${cardQuery.data.card.title}`}
                  disabled={deleteCardMutation.isPending}
                  onClick={() => {
                    const shouldDelete = window.confirm("Weet je zeker dat je deze kaart wilt verwijderen? Deze actie kan later door een admin worden teruggedraaid.");
                    if (!shouldDelete) return;
                    deleteCardMutation.mutate(cardQuery.data!.card.id);
                  }}
                >
                  <TrashIcon />
                </IconActionButton>
                <button type="button" className="board-detail-close" ref={boardDetailCloseButtonRef} onClick={closeCardDetail} aria-label="Kaartdetail sluiten">Sluiten</button>
              </div>
            </header>

            <section className="board-detail-section board-detail-description-panel">
              <div className="board-detail-section-heading">
                <h3>Beschrijving</h3>
              </div>
              {descriptionEdit?.cardId === cardQuery.data.card.id ? (
                <label className="vergaderborden-field">
                  <DescriptionEditor
                    ariaLabel="Beschrijving"
                    textareaRef={detailDescriptionTextareaRef}
                    value={descriptionEdit.value}
                    onChange={(nextValue) => {
                      setDescriptionEdit((current) => (current ? { ...current, value: nextValue, error: null } : current));
                    }}
                    onBlur={(evt) => {
                      const relatedTarget = evt.relatedTarget as Node | null;
                      if (relatedTarget && evt.currentTarget.parentElement?.contains(relatedTarget)) {
                        return;
                      }
                      void saveDescriptionEdit();
                    }}
                    placeholder="Beschrijving toevoegen"
                    disabled={updateDescriptionMutation.isPending}
                    maxLength={CARD_DESCRIPTION_MAX_LENGTH}
                    onToolbarAction={handleDetailDescriptionToolbarAction}
                    error={descriptionEdit.error}
                  />
                </label>
              ) : (
                <div className="vergaderborden-field">
                  <div
                    role="button"
                    tabIndex={0}
                    className="board-card-description-preview board-card-description-edit-trigger"
                    aria-label={cardQuery.data.card.description.trim() ? "Beschrijving bewerken" : "Beschrijving toevoegen"}
                    onClick={() => startDescriptionEdit(cardQuery.data!.card.id, cardQuery.data!.card.description)}
                    onKeyDown={(evt) => {
                      if (evt.key === "Enter" || evt.key === " ") {
                        evt.preventDefault();
                        startDescriptionEdit(cardQuery.data!.card.id, cardQuery.data!.card.description);
                      }
                    }}
                  >
                    <CardDescriptionRenderer description={cardQuery.data.card.description} emptyFallback={<>Beschrijving toevoegen</>} />
                  </div>
                </div>
              )}
            </section>

            <form
              className="board-update-form board-detail-section"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                const message = updateMessage.trim();
                if (!message) {
                  setUpdateError("Vul eerst een update in.");
                  return;
                }
                setIsNewUpdateToolbarVisible(false);
                postUpdateMutation.mutate({ cardId: cardQuery.data!.card.id, message });
              }}
              >
              <div className="board-detail-section-heading">
                <h3>Nieuwe update</h3>
              </div>
              <label className="vergaderborden-field">
                <div className="board-update-editor-shell" onFocus={showNewUpdateToolbar} onBlur={hideNewUpdateToolbar}>
                  {isNewUpdateToolbarVisible ? <UpdateFormattingToolbar onAction={handleUpdateToolbarAction} /> : null}
                  <textarea
                    ref={newUpdateTextareaRef}
                    className="board-update-textarea"
                    name="message"
                    placeholder="Beschrijf kort de voortgang"
                    value={updateMessage}
                    onChange={(evt) => {
                      setUpdateMessage(evt.target.value);
                      if (updateError) setUpdateError(null);
                    }}
                  />
                </div>
              </label>
              {updateError && <p className="error vergaderborden-inline-error">{updateError}</p>}
              <div className="board-update-actions board-update-actions-editor">
                <button
                  type="submit"
                  className="board-update-submit"
                  disabled={postUpdateMutation.isPending}
                  onMouseDown={() => setIsNewUpdateToolbarVisible(false)}
                  onClick={() => setIsNewUpdateToolbarVisible(false)}
                >
                  {postUpdateMutation.isPending ? "Update plaatsen…" : "Update plaatsen"}
                </button>
              </div>
            </form>

            <section className="board-detail-section board-attachments-section">
              <div className="board-detail-section-heading">
                <h3>Bijlagen</h3>
              </div>
              <form
                className={`board-attachment-form ${attachmentDragActive ? "is-drag-active" : ""}`}
                onDragOver={(evt) => {
                  evt.preventDefault();
                  if (isAttachmentUploading) return;
                  setAttachmentDragActive(true);
                }}
                onDragEnter={(evt) => {
                  evt.preventDefault();
                  if (isAttachmentUploading) return;
                  setAttachmentDragActive(true);
                }}
                onDragLeave={() => setAttachmentDragActive(false)}
                onDrop={(evt) => {
                  evt.preventDefault();
                  setAttachmentDragActive(false);
                  if (isAttachmentUploading) return;
                  const files = Array.from(evt.dataTransfer.files ?? []);
                  selectAttachmentFiles(files);
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void uploadSelectedAttachments();
                }}
                >
                <label className="board-attachment-dropzone">
                  <input
                    ref={attachmentInputRef}
                    className="board-attachment-dropzone-input"
                    type="file"
                    multiple
                    aria-label="Bijlagen selecteren"
                    onChange={(evt) => {
                      selectAttachmentFiles(Array.from(evt.target.files ?? []));
                    }}
                    disabled={isAttachmentUploading}
                  />
                  <span className="board-attachment-dropzone-title">Sleep een of meer bijlagen hierheen</span>
                  <span className="board-attachment-dropzone-hint">of klik om bestanden te kiezen</span>
                </label>
                <div className="board-attachment-form-actions">
                  {attachmentFiles.length > 0 ? (
                    <div className="board-attachment-selected-row">
                      <p className="board-attachment-selected muted">
                        Geselecteerd ({attachmentFiles.length}): {attachmentFiles.map((file) => file.name).join(", ")}
                      </p>
                      <button type="button" className="board-attachment-action board-attachment-action--secondary" onClick={clearAttachmentSelection} disabled={isAttachmentUploading}>
                        Wissen
                      </button>
                    </div>
                  ) : null}
                  {attachmentStatusMessage && (
                    <p
                      className={`${attachmentStatusMessage.includes("Mislukt") || attachmentStatusMessage.includes("Geen van") ? "error vergaderborden-inline-error" : "board-attachments-empty"}`}
                      role={attachmentStatusMessage.includes("Mislukt") || attachmentStatusMessage.includes("Geen van") ? "alert" : "status"}
                    >
                      {attachmentStatusMessage}
                    </p>
                  )}
                  {attachmentError && <p className="error vergaderborden-inline-error">{attachmentError}</p>}
                  {attachmentResults.some((item) => item.status !== "queued") && (
                    <ul className="board-attachments-list board-attachment-results" role="list" aria-label="Uploadresultaten bijlagen">
                      {attachmentResults.map((item) => (
                        <li key={`${item.fileName}-${item.status}`} className="board-attachment-result-item" role="listitem">
                          <strong>{item.fileName}</strong> — {item.status === "queued" ? "Geselecteerd" : item.status === "uploading" ? "Wordt geüpload" : item.status === "success" ? "Geüpload" : "Mislukt"}
                          {item.error ? `: ${item.error}` : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="submit" className="board-attachment-submit" disabled={isAttachmentUploading || !attachmentFiles.length}>
                    {isAttachmentUploading ? "Toevoegen…" : "Toevoegen"}
                  </button>
                </div>
              </form>
              {cardAttachments.length === 0 ? (
                <p className="board-attachments-empty">Er zijn nog geen bijlagen toegevoegd.</p>
              ) : (
                <div className="board-attachments-list" role="list" aria-label="Bijlagenlijst">
                  {cardAttachments.map((attachment) => {
                    const isImage = isImageAttachment(attachment);
                    const uploadedBy = attachment.uploaded_by_display_name?.trim() || attachment.uploaded_by_username?.trim() || "Onbekende gebruiker";
                    const createdAtLabel = attachment.created_at ? formatAmsterdamDateTime(attachment.created_at) : "Datum onbekend";
                    return (
                      <article key={attachment.id} className="board-attachment-item" role="listitem">
                        {isImage ? (
                          <button
                            type="button"
                            className="board-attachment-preview-button"
                            aria-label={`Voorbeeld van ${attachment.filename}`}
                            onClick={(evt) => {
                              attachmentPreviewTriggerRef.current = evt.currentTarget;
                              setAttachmentPreview(attachment);
                            }}
                          >
                            <img className="board-attachment-preview-thumb" src={attachment.download_url} alt={`Voorvertoning van ${attachment.filename}`} loading="lazy" />
                          </button>
                        ) : null}
                        <div className="board-attachment-header">
                          <strong className="board-attachment-name">{attachment.filename}</strong>
                          <small className="board-attachment-meta">{uploadedBy} · {createdAtLabel} · {formatRecordingSize(attachment.size_bytes)}</small>
                        </div>
                        <div className="board-attachment-actions">
                          <a className="board-attachment-action board-attachment-action--download" href={attachment.download_url}>
                            Downloaden
                          </a>
                          <button
                            type="button"
                            className="board-attachment-action board-attachment-action--danger"
                            disabled={deleteAttachmentMutation.isPending}
                            onClick={() => {
                              const shouldDelete = window.confirm("Weet je zeker dat je deze bijlage wilt verwijderen?");
                              if (!shouldDelete) return;
                              deleteAttachmentMutation.mutate({ cardId: cardQuery.data!.card.id, attachmentId: attachment.id });
                            }}
                          >
                            Verwijderen
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {attachmentPreview && isImageAttachment(attachmentPreview) && (
              <AttachmentPreviewModal attachment={attachmentPreview} onClose={() => setAttachmentPreview(null)} />
            )}

            <section className="board-updates-section board-detail-section" aria-live="polite">
              <div className="board-detail-section-heading">
                <div>
                  <h3>Updates</h3>
                  <p className="board-section-help">De nieuwste activiteit staat bovenaan in een compacte timeline.</p>
                </div>
              </div>
              <div className="board-updates-timeline" role="list" aria-label="Chronologische updates">
              {cardActivityItems.map((activity) => {
                  if (activity.kind === "recording") {
                    const r = activity.recording;
                    const hasDate = Boolean(activity.createdAt);
                    const dateLabel = hasDate ? formatAmsterdamDateTime(activity.createdAt) : "Datum onbekend";
                    const authorLabel = r.uploaded_by_display_name?.trim() || r.uploaded_by_username?.trim() || "Onbekende auteur";
                    return (
                      <article key={activity.id} className="board-update-item" role="listitem">
                        <div className="board-update-header">
                          <span className="board-update-author-badge" aria-hidden="true">{initialsFromName(authorLabel)}</span>
                          <div className="board-update-header-text">
                            <strong className="board-update-author">{authorLabel}</strong>
                            <small className="board-update-meta">{dateLabel}</small>
                          </div>
                        </div>
                        <div className="board-update-message">
                          <p className="board-recording-summary"><strong>Audio-opname</strong> · Duur: {formatRecordingDuration(r.duration)} · Grootte: {formatRecordingSize(r.size_bytes)}</p>
                          <audio controls src={r.download_url} />
                        </div>
                      </article>
                    );
                  }

                  const u = activity.update;
                  const hasDate = Boolean(u.created_at);
                  const dateLabel = hasDate ? formatAmsterdamDateTime(u.created_at) : "Datum onbekend";
                  const authorLabel = u.author_display_name?.trim() || u.author_username?.trim() || "Onbekende auteur";
                  const isMoveUpdate = isAutomaticMoveUpdate(u.message);
                  return (
                    <article key={u.id} className="board-update-item" role="listitem">
                      <div className="board-update-header">
                        <span className="board-update-author-badge" aria-hidden="true">{initialsFromName(authorLabel)}</span>
                        <div className="board-update-header-text">
                          <strong className="board-update-author">{authorLabel}</strong>
                          <small className="board-update-meta">{dateLabel}</small>
                        </div>
                      </div>
                      {updateEdit?.updateId === u.id && !isMoveUpdate ? (
                        <div className="board-update-editor">
                          <div className="board-update-editor-shell" onFocus={showUpdateEditToolbar} onBlur={hideUpdateEditToolbar}>
                            {isUpdateEditToolbarVisible ? <UpdateFormattingToolbar onAction={handleUpdateEditToolbarAction} /> : null}
                            <textarea
                              ref={editUpdateTextareaRef}
                              className="board-update-textarea"
                              aria-label="Update bewerken"
                              value={updateEdit.value}
                              onChange={(evt) => setUpdateEdit((current) => (current ? { ...current, value: evt.target.value, error: null } : current))}
                              disabled={editUpdateMutation.isPending}
                            />
                          </div>
                          <div className="board-update-editor-image-row">
                            <input
                              aria-label="Afbeelding bij update"
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={(evt) => {
                                const file = evt.target.files?.[0] ?? null;
                                setUpdateEdit((current) => (current ? { ...current, newImage: file, removeImage: file ? false : current.removeImage } : current));
                              }}
                              disabled={editUpdateMutation.isPending}
                            />
                            {(u.image_url || updateEdit.newImage) && (
                              <button
                                type="button"
                                onClick={() => setUpdateEdit((current) => (current ? { ...current, removeImage: true, newImage: null } : current))}
                                disabled={editUpdateMutation.isPending}
                              >
                                Afbeelding verwijderen
                              </button>
                            )}
                          </div>
                          <div className="board-update-actions board-update-actions-editor">
                            <button
                              type="button"
                              disabled={editUpdateMutation.isPending}
                              onClick={() => {
                                setIsUpdateEditToolbarVisible(false);
                                const next = updateEdit.value.trim();
                                if (!next) {
                                  setUpdateEdit((current) => (current ? { ...current, error: "Updatetekst mag niet leeg zijn" } : current));
                                  return;
                                }
                                editUpdateMutation.mutate({
                                  cardId: cardQuery.data!.card.id,
                                  updateId: u.id,
                                  message: next,
                                  removeImage: updateEdit.removeImage,
                                  image: updateEdit.newImage
                                }, {
                                  onError: (err) => {
                                    const msg = err instanceof Error && err.message ? err.message : "Update opslaan is mislukt";
                                    setUpdateEdit((current) => (current ? { ...current, error: msg } : current));
                                  }
                                });
                              }}
                            >
                              Opslaan
                            </button>
                            <button type="button" onClick={() => setUpdateEdit(null)} disabled={editUpdateMutation.isPending}>Annuleren</button>
                          </div>
                          {updateEdit.error && <p className="error vergaderborden-inline-error">{updateEdit.error}</p>}
                        </div>
                      ) : (
                        <>
                          <div className="board-update-message">{renderBoardUpdateMessage(u.message)}</div>
                          {u.image_url && <img src={u.image_url} alt="Update-afbeelding" className="board-update-image" />}
                          {!isMoveUpdate && u.author_user_id === currentUserQuery.data?.id && (
                            <div className="board-update-actions">
                              <button
                                type="button"
                                className="board-update-action-link"
                                onClick={() => {
                                  setIsNewUpdateToolbarVisible(false);
                                  setIsUpdateEditToolbarVisible(false);
                                  setUpdateEdit({
                                    updateId: u.id,
                                    value: u.message,
                                    original: u.message,
                                    removeImage: false,
                                    newImage: null,
                                    error: null
                                  });
                                }}
                              >
                                Bewerken
                              </button>
                              <span aria-hidden="true">•</span>
                              <button
                                type="button"
                                className="board-update-action-link"
                                disabled={deleteUpdateMutation.isPending}
                                onClick={() => {
                                  const shouldDelete = window.confirm("Weet je zeker dat je deze update wilt verwijderen?");
                                  if (!shouldDelete) {
                                    return;
                                  }
                                  deleteUpdateMutation.mutate({ cardId: cardQuery.data!.card.id, updateId: u.id });
                                }}
                              >
                                Verwijderen
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </article>
                    );
                  })}
              </div>
              {cardActivityItems.length === 0 && <p className="board-updates-empty">Er zijn nog geen updates geplaatst.</p>}
            </section>
            {cardQuery.data.card.column === "doing" && (
              <div>
                <button
                  type="button"
                  className="record-button"
                  onClick={() => {
                    void startOrStopRecording(cardQuery.data.card.id);
                  }}
                  disabled={Boolean(recorder && activeRecordingCardId !== cardQuery.data.card.id)}
                >
                  {activeRecordingCardId === cardQuery.data.card.id ? "Stop opname" : "Start opname"}
                </button>
                {activeRecordingCardId === cardQuery.data.card.id && <p>Timer: {recordingSeconds}s</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CreateProjectModal({ users, onClose, onSubmit }: { users: AdminUser[]; onClose: () => void; onSubmit: (payload: { name: string; description: string; invited_user_ids: string[] }) => void }) {
  return (
    <div className="modal">
      <form
        className="vergaderborden-create-form"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const name = String(fd.get("name") || "").trim();
          const description = String(fd.get("description") || "").trim();
          const invited = fd.getAll("invited_user_ids").map(String);
          if (!name) return;
          onSubmit({ name, description, invited_user_ids: invited });
        }}
      >
        <h2>Nieuw project</h2>
        <p className="vergaderborden-form-help">Vul de basisgegevens in en nodig teamleden uit.</p>
        <div className="vergaderborden-form-grid">
          <label className="vergaderborden-field">
            <span>Projectnaam</span>
            <input name="name" placeholder="Projectnaam" required />
          </label>
          <label className="vergaderborden-field vergaderborden-field-full">
            <span>Beschrijving</span>
            <textarea name="description" placeholder="Beschrijving" />
          </label>
          <label className="vergaderborden-field vergaderborden-field-full">
            <span>Uitgenodigde gebruikers</span>
            <select name="invited_user_ids" multiple>{users.map((u) => <option key={u.id} value={u.id}>{displayNameForUser(u)}</option>)}</select>
          </label>
        </div>
        <div className="vergaderborden-form-actions">
          <button type="submit">Opslaan</button>
          <button type="button" onClick={onClose}>Sluiten</button>
        </div>
      </form>
    </div>
  );
}

function CreateCardInline({ users, isLoading, hasError, onCreate, onCancel }: { users: BoardAccessUser[]; isLoading: boolean; hasError: boolean; onCreate: (payload: { title: string; description: string; assignment_user_ids: string[]; attachments: File[] }) => Promise<boolean>; onCancel: () => void }) {
  const [titleError, setTitleError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const onDocClick = (evt: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(evt.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const selectedUserLabel = selectedUserIds.length
    ? `${selectedUserIds.length} teamlid${selectedUserIds.length === 1 ? "" : "en"} geselecteerd`
    : isLoading
      ? "Teamleden laden…"
      : hasError
        ? "Teamleden niet beschikbaar"
        : users.length
          ? "Selecteer teamleden"
          : "Geen actieve teamleden beschikbaar";
  const hasSelectableUsers = !isLoading && !hasError && users.length > 0;

  return (
    <form
      className="vergaderborden-card-add-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        const form = e.currentTarget as HTMLFormElement;
        const fd = new FormData(e.currentTarget);
        const title = String(fd.get("title") || "").trim();
        const normalizedDescription = description.trim();
        if (normalizedDescription.length > CARD_DESCRIPTION_MAX_LENGTH) {
          setDescriptionError(`Beschrijving mag maximaal ${CARD_DESCRIPTION_MAX_LENGTH} tekens bevatten.`);
          return;
        }
        const assignment_user_ids = selectedUserIds;
        if (!title) {
          setTitleError("Titel is verplicht.");
          return;
        }
        if (title.length > CARD_TITLE_MAX_LENGTH) {
          setTitleError(`Titel mag maximaal ${CARD_TITLE_MAX_LENGTH} tekens bevatten.`);
          return;
        }
        setIsSubmitting(true);
        try {
          const success = await onCreate({ title, description: normalizedDescription, assignment_user_ids, attachments: selectedAttachments });
          if (success) {
            form.reset();
            setDescription("");
            setSelectedAttachments([]);
            setDescriptionError(null);
            setSelectedUserIds([]);
            setDropdownOpen(false);
            setTitleError(null);
          }
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <div className="vergaderborden-card-add-grid">
        <label className="vergaderborden-field vergaderborden-field-full">
          <span>Titel</span>
          <input name="title" placeholder="Titel kaart" required maxLength={CARD_TITLE_MAX_LENGTH} onChange={() => {
            if (titleError) setTitleError(null);
          }} />
        </label>
        {titleError && <p className="error vergaderborden-inline-error vergaderborden-field-full">{titleError}</p>}
        <label className="vergaderborden-field vergaderborden-field-full">
          <span>Beschrijving</span>
          <DescriptionEditor
            ariaLabel="Beschrijving nieuwe kaart"
            textareaRef={descriptionTextareaRef}
            value={description}
            onChange={(nextValue) => {
              setDescription(nextValue.slice(0, CARD_DESCRIPTION_MAX_LENGTH));
              if (descriptionError) setDescriptionError(null);
            }}
            placeholder="Korte toelichting (optioneel)"
            maxLength={CARD_DESCRIPTION_MAX_LENGTH}
            onToolbarAction={(action) => {
              const textarea = descriptionTextareaRef.current;
              if (!textarea) return;
              const selectionStart = textarea.selectionStart ?? 0;
              const selectionEnd = textarea.selectionEnd ?? selectionStart;
              const next = applyToolbarAction(description, selectionStart, selectionEnd, action);
              const boundedValue = next.value.slice(0, CARD_DESCRIPTION_MAX_LENGTH);
              setDescription(boundedValue);
              window.requestAnimationFrame(() => {
                autoResizeTextarea(textarea);
                textarea.focus();
                const cap = boundedValue.length;
                textarea.setSelectionRange(Math.min(next.nextSelectionStart, cap), Math.min(next.nextSelectionEnd, cap));
              });
            }}
            error={descriptionError}
          />
          <input type="hidden" name="description" value={description} />
        </label>
        <label className="vergaderborden-field vergaderborden-field-full">
          <span>Bijlagen (optioneel)</span>
          <input
            type="file"
            multiple
            onChange={(evt) => {
              setSelectedAttachments(Array.from(evt.target.files ?? []));
            }}
            disabled={isSubmitting}
            aria-label="Bijlagen selecteren"
          />
        </label>
        {selectedAttachments.length > 0 && (
          <div className="vergaderborden-field vergaderborden-field-full">
            <p className="vergaderborden-inline-status muted">Geselecteerd: {selectedAttachments.map((file) => file.name).join(", ")}</p>
          </div>
        )}
        <div className="vergaderborden-field vergaderborden-field-full" ref={containerRef}>
          <span>Teamleden</span>
          <button
            type="button"
            className="vergaderborden-multiselect-trigger"
            onClick={() => setDropdownOpen((open) => !open)}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
            aria-describedby={isLoading || hasError || !users.length ? "vergaderborden-teamleden-status" : undefined}
          >
            {selectedUserLabel}
          </button>
          {selectedUserIds.map((id) => (
            <input key={id} type="hidden" name="assignment_user_ids" value={id} />
          ))}
          {(isLoading || hasError || !users.length) && (
            <p
              id="vergaderborden-teamleden-status"
              className={`vergaderborden-inline-status${hasError ? " error" : " muted"}`}
              role={hasError ? "alert" : "status"}
              aria-live="polite"
            >
              {isLoading
                ? "Teamleden worden geladen…"
                : hasError
                  ? "Teamleden konden niet worden geladen. Probeer het later opnieuw."
                  : "Er zijn geen actieve teamleden beschikbaar voor dit bord."}
            </p>
          )}
          {dropdownOpen && hasSelectableUsers && (
            <div className="vergaderborden-multiselect-menu" role="listbox" aria-label="Teamleden kiezen" aria-multiselectable="true">
              {users.map((u) => {
                const checked = selectedUserIds.includes(u.id);
                const label = displayNameForUser(u);
                const initials = initialsFromName(label);
                const avatarUrl = avatarUrlForAccessUser(u);
                return (
                  <button
                    key={u.id}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    aria-label={label}
                    title={label}
                    className={`vergaderborden-member-tile${checked ? " is-selected" : ""}`}
                    onClick={() => toggleUser(u.id)}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="vergaderborden-member-tile-avatar" />
                    ) : (
                      <span className="vergaderborden-member-tile-initials" aria-hidden="true">{initials}</span>
                    )}
                    <span className="sr-only">{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="vergaderborden-card-add-actions">
        <button type="button" className="vergaderborden-card-add-cancel" onClick={onCancel}>Sluiten</button>
        <button type="submit" disabled={isSubmitting}>Kaart toevoegen</button>
      </div>
    </form>
  );
}
