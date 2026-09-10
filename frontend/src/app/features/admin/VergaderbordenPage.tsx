import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, FocusEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AdminUser,
  BoardAccessUser,
  BoardCard,
  BoardRecycleBinCard,
  BoardTrelloImportResult,
  archiveBoardCard,
  clearBoardCards,
  createBoardCard,
  createBoardProject,
  deleteBoardCard,
  deleteBoardCardUpdate,
  deleteBoardCardAttachment,
  editBoardCardUpdate,
  getBoardCard,
  getCurrentUser,
  getBoardProject,
  importTrelloBoard,
  downloadBoardJson,
  downloadBoardMarkdown,
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
  updateBoardCardUrgency,
  updateBoardCardAssignments,
  uploadBoardRecording,
  uploadBoardCardAttachment,
  transcribeBoardAudioChunk,
  reviewBoardTranscript,
  suggestBoardCardTitle
} from "../../../lib/api/client";
import { MaterialButton } from "../../../design-system/MaterialButton";
import { HoverTooltip } from "../../../design-system/HoverTooltip";
import { BoardMemberSelector } from "./BoardMemberSelector";
import {
  resolveVergaderbordenProjectId,
  VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY
} from "./vergaderbordenProjectSelection";
import { formatAmsterdamDateTime } from "../../../lib/datetime";

const KOLOMMEN: Array<"todo" | "doing" | "done"> = ["todo", "doing", "done"];
const KOLOM_TITEL: Record<string, string> = { todo: "Te doen", doing: "Bezig", done: "Klaar" };
const URGENTIE_TITEL: Record<"normal" | "urgent", string> = { normal: "Normaal", urgent: "Urgent" };
const BOARD_ACCESS_BADGE_LIMIT = 5;
const BOARD_RECORDING_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];

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

function cardUrgencyValue(card: Pick<BoardCard, "urgency">): "normal" | "urgent" {
  return card.urgency === "urgent" ? "urgent" : "normal";
}

function suggestCardTitleFromTranscript(value: string) {
  const firstSentence = value
    .replace(/\s+/g, " ")
    .trim()
    .split(/[.!?](?:\s|$)/)[0]
    ?.trim() ?? "";
  if (!firstSentence) return "";
  const words = firstSentence.split(" ").filter(Boolean).slice(0, 9);
  const suggestion = words.join(" ");
  return `${suggestion.charAt(0).toUpperCase()}${suggestion.slice(1)}`.slice(0, CARD_TITLE_MAX_LENGTH);
}

function pickSupportedRecordingMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  return BOARD_RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

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
type TrelloImportListOption = {
  id: string;
  name: string;
  cardCount: number;
  targetColumn: "todo" | "doing" | "done";
  isArchived: boolean;
};

function targetColumnForTrelloList(listName: string): "todo" | "doing" | "done" {
  const normalized = listName.toLocaleLowerCase("nl-NL");
  if (["doing", "bezig", "in uitvoering"].some((marker) => normalized.includes(marker))) return "doing";
  if (["done", "klaar", "afgerond", "gereed"].some((marker) => normalized.includes(marker))) return "done";
  return "todo";
}

async function readTrelloImportLists(file: File): Promise<TrelloImportListOption[]> {
  let payload: unknown;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new Error("Dit bestand is geen geldige Trello-JSON-export.");
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("Dit bestand is geen geldige Trello-JSON-export.");
  }

  const exportData = payload as { lists?: unknown; cards?: unknown };
  if (!Array.isArray(exportData.lists) || !Array.isArray(exportData.cards)) {
    throw new Error("Dit bestand bevat geen Trello-lijsten en -kaarten.");
  }

  const cardsPerList = new Map<string, number>();
  for (const row of exportData.cards) {
    if (!row || typeof row !== "object") continue;
    const listId = String((row as { idList?: unknown }).idList ?? "").trim();
    if (listId) cardsPerList.set(listId, (cardsPerList.get(listId) ?? 0) + 1);
  }

  const lists = exportData.lists.flatMap((row): TrelloImportListOption[] => {
    if (!row || typeof row !== "object") return [];
    const list = row as { id?: unknown; name?: unknown; closed?: unknown };
    const id = String(list.id ?? "").trim();
    const name = String(list.name ?? "").trim();
    if (!id || !name) return [];
    return [{
      id,
      name,
      cardCount: cardsPerList.get(id) ?? 0,
      targetColumn: targetColumnForTrelloList(name),
      isArchived: Boolean(list.closed)
    }];
  });

  if (!lists.length) throw new Error("Dit bestand bevat geen bruikbare Trello-kolommen.");
  return lists;
}

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
  ariaLabel = label,
  showNativeTooltip = true
}: {
  label: string;
  avatarUrl: string | null;
  className?: string;
  ariaLabel?: string;
  showNativeTooltip?: boolean;
}) {
  return (
    <span
      className={`user-chip assignment-avatar${className ? ` ${className}` : ""}`}
      title={showNativeTooltip ? label : undefined}
      aria-label={showNativeTooltip ? ariaLabel : undefined}
    >
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
          <HoverTooltip key={user.id} label={`Toegang: ${label}`} content={label}>
            <AvatarBadge
              className="vergaderborden-header-access-badge"
              label={label}
              avatarUrl={avatarUrl}
              showNativeTooltip={false}
            />
          </HoverTooltip>
        );
      })}
      {overflowCount > 0 && (
        <HoverTooltip
          label={`+${overflowCount} verborgen gebruikers: ${hiddenUserNames}`}
          content={
            <>
              <div className="board-members-tooltip-heading">Overige bordleden ({overflowCount})</div>
              <ul className="board-members-tooltip-list">
                {hiddenUsers.map((user) => <li key={user.id}>{displayNameForUser(user)}</li>)}
              </ul>
            </>
          }
        >
          <span className="user-chip assignment-avatar vergaderborden-header-access-badge vergaderborden-header-access-overflow" aria-hidden="true">
            +{overflowCount}
          </span>
        </HoverTooltip>
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

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
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
      <MaterialButton variant="text" size="compact" className="board-formatting-action" type="button" aria-label="B" onMouseDown={(evt) => evt.preventDefault()} onClick={() => onAction("bold")}><strong>B</strong></MaterialButton>
      <MaterialButton variant="text" size="compact" className="board-formatting-action" type="button" aria-label="I" onMouseDown={(evt) => evt.preventDefault()} onClick={() => onAction("italic")}><em>I</em></MaterialButton>
      <MaterialButton variant="text" size="compact" className="board-formatting-action" type="button" aria-label="U" onMouseDown={(evt) => evt.preventDefault()} onClick={() => onAction("underline")}><u>U</u></MaterialButton>
      <MaterialButton variant="text" size="compact" className="board-formatting-action" type="button" onMouseDown={(evt) => evt.preventDefault()} onClick={() => onAction("bullets")}>• Lijst</MaterialButton>
      <MaterialButton variant="text" size="compact" className="board-formatting-action" type="button" onMouseDown={(evt) => evt.preventDefault()} onClick={() => onAction("numbers")}>1. Lijst</MaterialButton>
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

function UpdateIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="board-card-activity-icon">
      <path d="M3 3.25h10v7.1a1.4 1.4 0 0 1-1.4 1.4H7l-2.7 1.9v-1.9H4.4A1.4 1.4 0 0 1 3 10.35z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.4 6.25h5.2M5.4 8.55h3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function UrgencyIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="board-urgency-icon">
      <path d="M8 1.7 14 13H2z" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M8 5.25v3.6m0 2.2v.05" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
    <MaterialButton
      variant="outlined"
      size="compact"
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
    </MaterialButton>
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
  const [showBoardTransfer, setShowBoardTransfer] = useState(false);
  const [isBoardClearConfirming, setIsBoardClearConfirming] = useState(false);
  const [trelloImportFile, setTrelloImportFile] = useState<File | null>(null);
  const [trelloImportLists, setTrelloImportLists] = useState<TrelloImportListOption[]>([]);
  const [selectedTrelloListIds, setSelectedTrelloListIds] = useState<string[]>([]);
  const [trelloImportResult, setTrelloImportResult] = useState<BoardTrelloImportResult | null>(null);
  const [trelloTransferError, setTrelloTransferError] = useState<string | null>(null);
  const [isBoardExporting, setIsBoardExporting] = useState<"json" | "markdown" | null>(null);
  const [boardView, setBoardView] = useState<"active" | "archive" | "recycle">("active");
  const [showMyCardsOnly, setShowMyCardsOnly] = useState(false);
  const [showUrgentOnly, setShowUrgentOnly] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeRecordingCardId, setActiveRecordingCardId] = useState<string | null>(null);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [updateRecordingProgress, setUpdateRecordingProgress] = useState<string | null>(null);
  const [isUpdateTranscribing, setIsUpdateTranscribing] = useState(false);
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
  const boardDetailCloseButtonRef = useRef<HTMLElement | null>(null);
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
  const [missingDirectProjectId, setMissingDirectProjectId] = useState<string | null>(null);
  const resolvedProjectId = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    // A known URL can target a project that is deliberately absent from the
    // selector. The API decides whether it is an authorized historical board.
    if (
      requestedProjectId
      && !projects.some((project) => project.id === requestedProjectId)
      && missingDirectProjectId !== requestedProjectId
    ) return requestedProjectId;
    return resolveVergaderbordenProjectId(projects, requestedProjectId);
  }, [projectsQuery.data, requestedProjectId, missingDirectProjectId]);

  const boardQuery = useQuery({
    queryKey: ["board-project", resolvedProjectId],
    queryFn: () => getBoardProject(resolvedProjectId || ""),
    enabled: Boolean(resolvedProjectId)
  });
  useEffect(() => {
    if (boardQuery.isError && requestedProjectId && resolvedProjectId === requestedProjectId) {
      setMissingDirectProjectId(requestedProjectId);
    }
  }, [boardQuery.isError, requestedProjectId, resolvedProjectId]);
  useEffect(() => {
    setMissingDirectProjectId(null);
  }, [requestedProjectId]);
  const recycleBinQuery = useQuery({
    queryKey: ["board-recycle-bin"],
    queryFn: listBoardRecycleBin,
    // A hidden board is historical read-only, including for admins. Do not
    // load or expose its restore-only recycle-bin surface.
    enabled: canManageProjects && boardQuery.data?.is_read_only !== true
  });
  const cardQuery = useQuery({ queryKey: ["board-card", selectedCardId], queryFn: () => getBoardCard(selectedCardId || ""), enabled: Boolean(selectedCardId) });
  const resolvedProjectName = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    const selected = projects.find((project) => project.id === resolvedProjectId);
    return selected?.name ?? boardQuery.data?.project_name ?? null;
  }, [projectsQuery.data, resolvedProjectId, boardQuery.data?.project_name]);

  const boardAccessUsers = boardQuery.data?.access_users ?? [];
  const isReadOnly = boardQuery.data?.is_read_only === true;
  useEffect(() => {
    if (isReadOnly && boardView === "recycle") {
      setBoardView("active");
    }
  }, [boardView, isReadOnly]);
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
    mutationFn: ({ projectId: id, title, description, column, urgency, assignment_user_ids }: { projectId: string; title: string; description: string; column: "todo" | "doing" | "done"; urgency: "normal" | "urgent"; assignment_user_ids: string[] }) =>
      createBoardCard(id, { title, description, column, urgency, assignment_user_ids }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] })
  });
  const importTrelloMutation = useMutation({
    mutationFn: ({ projectId, file, selectedListIds }: { projectId: string; file: File; selectedListIds: string[] }) => importTrelloBoard(projectId, file, selectedListIds),
    onSuccess: async (result) => {
      setTrelloImportResult(result);
      setTrelloTransferError(null);
      await queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] });
    },
    onError: () => setTrelloTransferError("Importeren is mislukt. Controleer of dit een Trello-JSON-export is en probeer opnieuw.")
  });
  const clearBoardMutation = useMutation({
    mutationFn: (projectId: string) => clearBoardCards(projectId),
    onMutate: () => {
      setCardActionMessage(null);
      setCardActionError(null);
      setTrelloTransferError(null);
    },
    onSuccess: async (result) => {
      setIsBoardClearConfirming(false);
      setTrelloImportFile(null);
      setTrelloImportResult(null);
      setSelectedCardId(null);
      setBoardView("active");
      setShowMyCardsOnly(false);
      setShowUrgentOnly(false);
      setCardActionError(null);
      setCardActionMessage(
        result.cleared === 0
          ? "Het bord was al leeg."
          : `${result.cleared} ${result.cleared === 1 ? "kaart is" : "kaarten zijn"} naar de prullenbak verplaatst.`
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] }),
        queryClient.invalidateQueries({ queryKey: ["board-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["board-recycle-bin"] })
      ]);
    },
    onError: () => {
      setCardActionMessage(null);
      setCardActionError("Bord leegmaken is mislukt. Probeer het opnieuw.");
    }
  });
  const moveCardMutation = useMutation({
    mutationFn: ({ cardId, column, position }: { cardId: string; column: "todo" | "doing" | "done"; position: number }) => moveBoardCard(cardId, { column, position }),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] }),
        queryClient.invalidateQueries({ queryKey: ["board-card", variables.cardId] })
      ]);
    },
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
  const updateUrgencyMutation = useMutation({
    mutationFn: ({ cardId, urgency }: { cardId: string; urgency: "normal" | "urgent" }) => updateBoardCardUrgency(cardId, { urgency }),
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
      setUpdateError("Uploaden van de opname is mislukt. Probeer het opnieuw.");
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

  const activeCards = boardQuery.data?.cards ?? [];
  const myCardCount = activeCards.filter((card) => card.assignments.some((assignment) => assignment.user_id === currentUserQuery.data?.id)).length;
  const urgentCardCount = activeCards.filter((card) => cardUrgencyValue(card) === "urgent").length;
  const hasActiveBoardFilters = showMyCardsOnly || showUrgentOnly;

  const cardsByColumn = useMemo(() => {
    const cards = activeCards.filter((card) => {
      if (showMyCardsOnly && !card.assignments.some((assignment) => assignment.user_id === currentUserQuery.data?.id)) return false;
      if (showUrgentOnly && cardUrgencyValue(card) !== "urgent") return false;
      return true;
    });
    return {
      todo: cards.filter((c) => c.column === "todo").sort((a, b) => a.position - b.position),
      doing: cards.filter((c) => c.column === "doing").sort((a, b) => a.position - b.position),
      done: cards.filter((c) => c.column === "done").sort((a, b) => a.position - b.position)
    };
  }, [activeCards, currentUserQuery.data?.id, showMyCardsOnly, showUrgentOnly]);

  const activeCardCount = activeCards.length;

  const renderBoardCard = (card: BoardCard, column: "todo" | "doing" | "done", variant: "active" | "archive") => {
    const isArchiveView = variant === "archive";
    const hasActivity = card.updates_count > 0 || card.recordings_count > 0;
    return (
      <div key={card.id}>
        {!isArchiveView && dragDropTarget?.column === column && dragDropTarget.cardId === card.id && dragDropTarget.placement === "before" && (
          <div className="vergaderborden-drop-indicator" data-testid={`board-drop-indicator-${column}-${card.id}-before`} aria-hidden="true" />
        )}
        <article
          className={`vergaderborden-board-card${card.is_archived ? " is-archived" : ""}${isArchiveView ? " is-archive-view" : ""}`}
          data-testid={`board-card-${card.id}`}
          tabIndex={-1}
          draggable={!isArchiveView && !isReadOnly && !hasActiveBoardFilters}
          onDragStart={
            isArchiveView || isReadOnly || hasActiveBoardFilters
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
            isArchiveView || isReadOnly || hasActiveBoardFilters
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
            isArchiveView || isReadOnly || hasActiveBoardFilters
              ? undefined
              : (e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                  setDragDropTarget((current) => (current?.cardId === card.id ? null : current));
                }
          }
          onDragEnd={
            isArchiveView || isReadOnly || hasActiveBoardFilters
              ? undefined
              : () => {
                  dragCardMetaRef.current = null;
                  setDragDropTarget(null);
                }
          }
          onDrop={
            isArchiveView || isReadOnly
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
          {cardUrgencyValue(card) === "urgent" && (
            <span className="board-card-urgency" aria-label="Urgente kaart" title="Urgente kaart"><UrgencyIcon /></span>
          )}
          <strong className="vergaderborden-card-title" title={card.title}>{card.title}</strong>
          {(card.assignments.length > 0 || hasActivity) && (
            <div className="board-card-footer">
              <AssignedUserAvatarRow assignments={card.assignments} />
              {hasActivity && (
                <div className="board-card-signals" aria-label={`${card.updates_count} updates, ${card.recordings_count} opnames`}>
                  {card.updates_count > 0 && (
                    <span className="board-card-activity" title={`${card.updates_count} update${card.updates_count === 1 ? "" : "s"}`}>
                      <UpdateIcon />
                      <span>{card.updates_count}</span>
                    </span>
                  )}
                  {card.recordings_count > 0 && (
                    <span className="board-card-activity" title={`${card.recordings_count} opname${card.recordings_count === 1 ? "" : "s"}`}>
                      <RecordIcon active={false} />
                      <span>{card.recordings_count}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          {isArchiveView && !isReadOnly ? (
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
          ) : null}
        </article>
        {!isArchiveView && dragDropTarget?.column === column && dragDropTarget.cardId === card.id && dragDropTarget.placement === "after" && (
          <div className="vergaderborden-drop-indicator" data-testid={`board-drop-indicator-${column}-${card.id}-after`} aria-hidden="true" />
        )}
      </div>
    );
  };

  const createCardInColumn = async (
    column: "todo" | "doing" | "done",
    payload: { title: string; description: string; urgency: "normal" | "urgent"; assignment_user_ids: string[]; attachments: File[] }
  ) => {
    if (!resolvedProjectId) return false;
    try {
      setCreateCardNotice(null);
      setCreateCardProgress("Kaart wordt aangemaakt…");
      const createdCard = await createCardMutation.mutateAsync({
        projectId: resolvedProjectId,
        column,
        urgency: payload.urgency,
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
  };

  const renderBoardColumn = (column: "todo" | "doing" | "done", variant: "active" | "archive") => {
    const cards = variant === "active" ? cardsByColumn[column] : archivedCardsByColumn[column];
    const isActiveView = variant === "active";
    const canDragInColumn = isActiveView && !isReadOnly && !hasActiveBoardFilters;

    return (
      <div
        className={`vergaderborden-column${dragDropTarget?.column === column && isActiveView ? " is-drag-over" : ""}${savingCardId && isActiveView ? " is-saving" : ""}`}
        key={column}
        data-testid={`board-column-${column}`}
        onDragOver={
          canDragInColumn
            ? (e) => {
                if (isReadOnly) return;
                e.preventDefault();
                if (!dragCardMetaRef.current) return;
                setDragDropTarget(resolveColumnDragTarget(e.currentTarget, column, e.clientY));
              }
            : undefined
        }
        onDragLeave={
          canDragInColumn
            ? (e) => {
                if (isReadOnly) return;
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                setDragDropTarget((current) => (current?.column === column ? null : current));
              }
            : undefined
        }
        onDrop={
          canDragInColumn
            ? (e) => {
                if (isReadOnly) return;
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
        <div className="vergaderborden-column-header">
        <h3>{KOLOM_TITEL[column]}</h3>
        {isActiveView && !isReadOnly && (
          <MaterialButton
            variant="outlined"
            size="compact"
            className={`vergaderborden-card-add-toggle${activeCreateColumn === column ? " is-active" : ""}`}
            aria-pressed={activeCreateColumn === column}
            onClick={() => {
              setCreateCardNotice(null);
              setActiveCreateColumn(column);
            }}
          >
            + Kaart toevoegen
          </MaterialButton>
        )}
        </div>
        <div className="vergaderborden-column-cards" role="region" aria-label={`Kaarten: ${KOLOM_TITEL[column]}`} tabIndex={0}>
        {cards.map((card) => renderBoardCard(card, column, variant))}
        {isActiveView && dragDropTarget?.column === column && dragDropTarget.cardId === null && (
          <div className="vergaderborden-drop-indicator vergaderborden-drop-indicator--end" data-testid={`board-drop-indicator-${column}-end`} aria-hidden="true" />
        )}
        </div>
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

  const startOrStopUpdateRecording = async (cardId: string) => {
    if (recorder && activeRecordingCardId === cardId) {
      try {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      } catch {
        setUpdateError("Stoppen van de opname is mislukt. Probeer opnieuw.");
      }
      return;
    }
    if (recorder && activeRecordingCardId && activeRecordingCardId !== cardId) {
      setUpdateError("Er kan maar één opname tegelijk actief zijn.");
      return;
    }
    try {
      setUpdateError(null);
      setUpdateRecordingProgress(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickSupportedRecordingMimeType();
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          chunks.push(evt.data);
        }
      };
      mr.onstop = async () => {
        const finishedCardId = cardId;
        const startedAt = recordingStartedAtRef.current;
        const elapsedByClock = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
        const durationAtStop = Math.max(recordingSeconds, elapsedByClock);
        recordingStartedAtRef.current = null;
        setRecorder(null);
        setActiveRecordingCardId(null);
        window.clearInterval((window as any).__vergaderbordTimer);
        const recordingMimeType = mr.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: recordingMimeType });
        if (blob.size > 0) {
          setIsUpdateTranscribing(true);
          try {
            setUpdateRecordingProgress("Opname wordt opgeslagen…");
            await uploadRecordingMutation.mutateAsync({ cardId: finishedCardId, blob, duration: Math.max(1, durationAtStop) });
          } catch {
            setUpdateError("Uploaden van de opname is mislukt. Probeer het opnieuw.");
            setIsUpdateTranscribing(false);
            setUpdateRecordingProgress(null);
            setRecordingSeconds(0);
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          try {
            setUpdateRecordingProgress("Opname wordt getranscribeerd…");
            const { text: transcript } = await transcribeBoardAudioChunk(blob);
            const normalizedTranscript = transcript.trim();
            if (!normalizedTranscript) {
              setUpdateError("Er is geen tekst uit de opname gekomen. Probeer het opnieuw.");
              return;
            }
            setUpdateRecordingProgress("Tekst wordt verbeterd…");
            const { text: reviewedTranscript } = await reviewBoardTranscript(normalizedTranscript, true);
            const nextText = reviewedTranscript.trim() || normalizedTranscript;
            setUpdateMessage((current) => [current.trim(), nextText].filter(Boolean).join(current.trim() ? "\n\n" : ""));
            setUpdateError(null);
          } catch {
            setUpdateError("Transcriptie of tekstverbetering is mislukt. Probeer het opnieuw.");
          } finally {
            setIsUpdateTranscribing(false);
            setUpdateRecordingProgress(null);
          }
        } else {
          setUpdateError("Geen audiogegevens opgenomen. Probeer opnieuw.");
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
      setUpdateError("Microfoon starten is mislukt. Controleer toestemming en probeer opnieuw.");
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
      // Do not steal focus after the user already entered the card or a preview.
      if (boardDetailModalRef.current?.contains(document.activeElement) || document.querySelector(".board-attachment-preview-overlay")) return;
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
    <section className={`panel vergaderborden-page${boardView === "active" && resolvedProjectId ? " is-active-board-view" : ""}`}>
      <div className="board-context-bar">
        <div className="board-context-project">
          <div className="vergaderborden-header">
            {resolvedProjectName && <h1 title={resolvedProjectName}>{resolvedProjectName}</h1>}
          </div>
          {resolvedProjectId && <BoardAccessBadges users={boardAccessUsers} />}
        </div>
        {resolvedProjectId && (
          <div className="board-context-controls">
            <div className="vergaderborden-board-tabs" role="group" aria-label="Kaartweergave">
              <MaterialButton
                variant={boardView === "active" ? "tonal" : "text"}
                size="compact"
                aria-pressed={boardView === "active"}
                className={boardView === "active" ? "is-active" : ""}
                onClick={() => setBoardView("active")}
              >
                Actief ({activeCardCount})
              </MaterialButton>
              <MaterialButton
                variant={boardView === "archive" ? "tonal" : "text"}
                size="compact"
                aria-pressed={boardView === "archive"}
                className={boardView === "archive" ? "is-active" : ""}
                onClick={() => setBoardView("archive")}
              >
                Archief ({archivedCards.length})
              </MaterialButton>
              {canManageProjects && !isReadOnly && (
                <MaterialButton
                  variant={boardView === "recycle" ? "tonal" : "text"}
                  size="compact"
                  aria-pressed={boardView === "recycle"}
                  className={boardView === "recycle" ? "is-active" : ""}
                  onClick={() => setBoardView("recycle")}
                >
                  Prullenbak ({recycleBinCards.length})
                </MaterialButton>
              )}
            </div>
            {!isReadOnly && (
              <MaterialButton
                variant="outlined"
                size="compact"
                className="board-transfer-trigger"
                onClick={() => {
                  setShowBoardTransfer(true);
                  setIsBoardClearConfirming(false);
                  setTrelloTransferError(null);
                }}
              >
                Import & export
              </MaterialButton>
            )}
            {boardView === "active" && (
              <div className="board-filter-bar" role="group" aria-label="Kaarten filteren">
                <MaterialButton
                  variant={showMyCardsOnly ? "tonal" : "text"}
                  size="compact"
                  aria-pressed={showMyCardsOnly}
                  className={showMyCardsOnly ? "is-active" : ""}
                  onClick={() => setShowMyCardsOnly((active) => !active)}
                >
                  Mijn kaarten ({myCardCount})
                </MaterialButton>
                <MaterialButton
                  variant={showUrgentOnly ? "tonal" : "text"}
                  size="compact"
                  aria-pressed={showUrgentOnly}
                  className={showUrgentOnly ? "is-active" : ""}
                  onClick={() => setShowUrgentOnly((active) => !active)}
                >
                  Urgent ({urgentCardCount})
                </MaterialButton>
                {hasActiveBoardFilters && (
                  <MaterialButton variant="text" size="compact" className="board-filter-clear" onClick={() => {
                    setShowMyCardsOnly(false);
                    setShowUrgentOnly(false);
                  }}>
                    Wis filters
                  </MaterialButton>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {canManageProjects && (
        <>
          {showCreate && <CreateProjectModal users={usersQuery.data ?? []} onClose={() => setShowCreate(false)} onSubmit={(payload) => createProjectMutation.mutate(payload)} />}
          <MaterialButton className="vergaderborden-primary-action" onClick={() => setShowCreate(true)}>Nieuw project</MaterialButton>
        </>
      )}

      {showBoardTransfer && resolvedProjectId && (
        <div className="board-transfer-overlay" role="dialog" aria-modal="true" aria-labelledby="board-transfer-title" onClick={(event) => {
          if (event.target === event.currentTarget && !importTrelloMutation.isPending && !clearBoardMutation.isPending) {
            setShowBoardTransfer(false);
            setIsBoardClearConfirming(false);
          }
        }}>
          <section className="board-transfer-panel">
            <header className="board-transfer-heading">
              <div>
                <h2 id="board-transfer-title">Import & export</h2>
                <p>Breng Trello-kaarten veilig over of maak een volledige kopie van dit bord.</p>
              </div>
              <button type="button" className="board-create-sidebar-close" aria-label="Import en export sluiten" disabled={importTrelloMutation.isPending || clearBoardMutation.isPending} onClick={() => {
                setShowBoardTransfer(false);
                setIsBoardClearConfirming(false);
              }}>×</button>
            </header>

            <section className="board-transfer-section">
              <div>
                <h3>Trello importeren</h3>
                <p>Upload een Trello JSON-export. Kaarten met een al bekende Trello-ID worden overgeslagen.</p>
              </div>
              <label className="board-transfer-file">
                <span>JSON-bestand</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={async (event) => {
                    const file = event.target.files?.[0] ?? null;
                    setTrelloImportFile(file);
                    setTrelloImportLists([]);
                    setSelectedTrelloListIds([]);
                    setTrelloImportResult(null);
                    setTrelloTransferError(null);
                    if (!file) return;
                    try {
                      const lists = await readTrelloImportLists(file);
                      setTrelloImportLists(lists);
                      setSelectedTrelloListIds(lists.map((list) => list.id));
                    } catch (error) {
                      setTrelloTransferError(error instanceof Error ? error.message : "De Trello-kolommen konden niet worden gelezen.");
                    }
                  }}
                />
              </label>
              {trelloImportFile && <small>Geselecteerd: {trelloImportFile.name}</small>}
              {trelloImportLists.length > 0 && (
                <fieldset className="trello-import-list-picker">
                  <legend>Kolommen meenemen <span>{selectedTrelloListIds.length} van {trelloImportLists.length}</span></legend>
                  <p>Kies alleen de Trello-kolommen die je op dit bord wilt importeren.</p>
                  <div className="trello-import-list-actions">
                    <MaterialButton variant="text" size="compact" onClick={() => setSelectedTrelloListIds(trelloImportLists.map((list) => list.id))}>Alles selecteren</MaterialButton>
                    <MaterialButton variant="text" size="compact" onClick={() => setSelectedTrelloListIds([])}>Alles wissen</MaterialButton>
                  </div>
                  <div className="trello-import-list-options">
                    {trelloImportLists.map((list) => {
                      const selected = selectedTrelloListIds.includes(list.id);
                      const destination = list.isArchived ? "Archief" : KOLOM_TITEL[list.targetColumn];
                      return (
                        <label key={list.id} className={selected ? "is-selected" : ""}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => setSelectedTrelloListIds((current) => (
                              current.includes(list.id)
                                ? current.filter((id) => id !== list.id)
                                : [...current, list.id]
                            ))}
                          />
                          <span className="trello-import-list-name">{list.name}</span>
                          <span className="trello-import-list-meta">{list.cardCount} {list.cardCount === 1 ? "kaart" : "kaarten"} · {destination}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              <MaterialButton
                className="vergaderborden-primary-action"
                disabled={!trelloImportFile || !trelloImportLists.length || !selectedTrelloListIds.length || importTrelloMutation.isPending}
                onClick={() => {
                  if (!trelloImportFile || !selectedTrelloListIds.length) return;
                  importTrelloMutation.mutate({ projectId: resolvedProjectId, file: trelloImportFile, selectedListIds: selectedTrelloListIds });
                }}
              >
                {importTrelloMutation.isPending ? "Trello importeren…" : "Trello importeren"}
              </MaterialButton>
            </section>

            <section className="board-transfer-section">
              <div>
                <h3>Bord exporteren</h3>
                <p>JSON is geschikt als complete gegevenskopie. Markdown downloadt als ZIP met een map per status en een bestand per kaart.</p>
              </div>
              <div className="board-transfer-export-actions">
                <MaterialButton variant="outlined" disabled={isBoardExporting !== null} onClick={() => {
                  setIsBoardExporting("json");
                  void downloadBoardJson(resolvedProjectId)
                    .then((blob) => downloadBlob(blob, "vergaderbord.json"))
                    .catch(() => setTrelloTransferError("JSON-export maken is mislukt. Probeer het opnieuw."))
                    .finally(() => setIsBoardExporting(null));
                }}>{isBoardExporting === "json" ? "JSON voorbereiden…" : "Download JSON"}</MaterialButton>
                <MaterialButton variant="outlined" disabled={isBoardExporting !== null} onClick={() => {
                  setIsBoardExporting("markdown");
                  void downloadBoardMarkdown(resolvedProjectId)
                    .then((blob) => downloadBlob(blob, "vergaderbord-markdown.zip"))
                    .catch(() => setTrelloTransferError("Markdown-export maken is mislukt. Probeer het opnieuw."))
                    .finally(() => setIsBoardExporting(null));
                }}>{isBoardExporting === "markdown" ? "Markdown voorbereiden…" : "Download Markdown-map"}</MaterialButton>
              </div>
            </section>

            <section className="board-transfer-section board-transfer-danger-zone">
              <div>
                <h3>Inhoud bord leegmaken</h3>
                <p>Verplaats alle actieve en gearchiveerde kaarten naar de prullenbak voordat je een nieuwe import uitvoert. Een beheerder kan ze daar later terugzetten.</p>
              </div>
              {isBoardClearConfirming ? (
                <div className="board-transfer-clear-confirmation" role="alert">
                  <strong>Weet je het zeker?</strong>
                  <p>Alle kaarten van {resolvedProjectName ?? "dit bord"} verdwijnen uit het bord en komen in de prullenbak terecht.</p>
                  <div className="board-transfer-clear-actions">
                    <MaterialButton variant="outlined" disabled={clearBoardMutation.isPending} onClick={() => setIsBoardClearConfirming(false)}>Annuleren</MaterialButton>
                    <MaterialButton variant="danger" disabled={clearBoardMutation.isPending} onClick={() => clearBoardMutation.mutate(resolvedProjectId)}>
                      {clearBoardMutation.isPending ? "Bord leegmaken…" : "Ja, bord leegmaken"}
                    </MaterialButton>
                  </div>
                </div>
              ) : (
                <MaterialButton variant="danger" className="board-transfer-clear-button" disabled={importTrelloMutation.isPending} onClick={() => setIsBoardClearConfirming(true)}>
                  Bord leegmaken
                </MaterialButton>
              )}
            </section>

            {trelloTransferError && <p className="error vergaderborden-inline-error" role="alert">{trelloTransferError}</p>}
            {trelloImportResult && (
              <section className="board-transfer-result" aria-live="polite">
                <h3>Importoverzicht</h3>
                <p><strong>{trelloImportResult.imported.length}</strong> geïmporteerd · <strong>{trelloImportResult.skipped.length}</strong> overgeslagen · <strong>{trelloImportResult.failed.length}</strong> mislukt{trelloImportResult.not_selected_count > 0 && <> · <strong>{trelloImportResult.not_selected_count}</strong> niet geselecteerd</>}</p>
                {(trelloImportResult.skipped.length > 0 || trelloImportResult.failed.length > 0) && (
                  <ul>
                    {[...trelloImportResult.skipped, ...trelloImportResult.failed].map((item, index) => (
                      <li key={`${item.source_id ?? item.title}-${index}`}><strong>{item.title}</strong> — {item.reason}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </section>
        </div>
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
            <>
              <div className="board-live-feedback" aria-live="polite">
                {isReadOnly && <p className="muted" role="status">Dit verborgen vergaderbord is alleen-lezen. Historische kaarten en updates blijven zichtbaar.</p>}
                {createCardProgress && <p className="vergaderborden-saving-indicator" role="status" aria-live="polite">Kaart wordt aangemaakt…</p>}
                {createCardNotice && <p className="error vergaderborden-inline-error" role="alert">{createCardNotice}</p>}
                {moveError && <p className="error vergaderborden-inline-error vergaderborden-move-error">{moveError}</p>}
                {savingCardId && <p className="vergaderborden-saving-indicator" aria-live="polite">Kaart wordt opgeslagen…</p>}
              </div>
              <div className="board-grid" aria-label="Kaartkolommen">
                {KOLOMMEN.map((kolom) => renderBoardColumn(kolom, "active"))}
              </div>
              {!isReadOnly && activeCreateColumn && (
                <div className="board-create-overlay" onClick={() => setActiveCreateColumn(null)}>
                  <aside className="board-create-sidebar" aria-label="Nieuwe kaart" onClick={(event) => event.stopPropagation()}>
                  <div className="board-create-sidebar-heading">
                    <div>
                      <h2>Nieuwe kaart</h2>
                      <p className="board-section-help">
                        Wordt toegevoegd aan: {KOLOM_TITEL[activeCreateColumn]}.
                      </p>
                    </div>
                    <button type="button" className="board-create-sidebar-close" onClick={() => setActiveCreateColumn(null)} aria-label="Nieuw kaartpaneel sluiten" title="Sluiten">
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                  <CreateCardInline
                    users={boardAssignableUsers}
                    isLoading={boardQuery.isLoading}
                    hasError={boardQuery.isError}
                    onCreate={(payload) => createCardInColumn(activeCreateColumn, payload)}
                  />
                  </aside>
                </div>
              )}
            </>
          )}

          {boardView === "archive" && (
            <section className="board-archive-panel" aria-label="Archief">
              <div className="board-detail-section-heading">
                <h3>Archief</h3>
                <p className="board-section-help">Gearchiveerde kaarten blijven bewaard{isReadOnly ? "." : " en kun je hier terugzetten."}</p>
              </div>
              {archivedCards.length === 0 && <p className="board-archive-empty">Er zijn nog geen gearchiveerde kaarten.</p>}
              <div className="board-grid board-archive-grid" aria-label="Gearchiveerde kaarten">
                {KOLOMMEN.map((kolom) => renderBoardColumn(kolom, "archive"))}
              </div>
            </section>
          )}

          {boardView === "recycle" && canManageProjects && !isReadOnly && (
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
      {selectedCardId && cardQuery.data?.card && (
        <div
          className="board-detail-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Kaart: ${cardQuery.data.card.title}`}
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
                <label className="board-detail-status">
                  <span>Status</span>
                  {isReadOnly ? (
                    <strong className={`board-detail-status-value status-${cardQuery.data.card.column}`}>{KOLOM_TITEL[cardQuery.data.card.column]}</strong>
                  ) : (
                    <select
                      aria-label="Kaartstatus"
                      className={`board-detail-status-control status-${cardQuery.data.card.column}`}
                      value={cardQuery.data.card.column}
                      disabled={moveCardMutation.isPending}
                      onChange={(event) => {
                        const column = event.target.value as "todo" | "doing" | "done";
                        if (column === cardQuery.data!.card.column) return;
                        setMoveError(null);
                        setSavingCardId(cardQuery.data!.card.id);
                        const position = cardsByColumn[column].filter((card) => card.id !== cardQuery.data!.card.id).length;
                        moveCardMutation.mutate({ cardId: cardQuery.data!.card.id, column, position });
                      }}
                    >
                      {KOLOMMEN.map((column) => <option key={column} value={column}>{KOLOM_TITEL[column]}</option>)}
                    </select>
                  )}
                </label>
                <label className="board-detail-status board-detail-urgency">
                  <span>Urgentie</span>
                  {isReadOnly ? (
                    <strong className={`board-detail-status-value urgency-${cardUrgencyValue(cardQuery.data.card)}`}>{URGENTIE_TITEL[cardUrgencyValue(cardQuery.data.card)]}</strong>
                  ) : (
                    <select
                      aria-label="Kaarturgentie"
                      className={`board-detail-status-control urgency-${cardUrgencyValue(cardQuery.data.card)}`}
                      value={cardUrgencyValue(cardQuery.data.card)}
                      disabled={updateUrgencyMutation.isPending}
                      onChange={(event) => {
                        const urgency = event.target.value as "normal" | "urgent";
                        if (urgency !== cardUrgencyValue(cardQuery.data!.card)) updateUrgencyMutation.mutate({ cardId: cardQuery.data!.card.id, urgency });
                      }}
                    >
                      <option value="normal">Normaal</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  )}
                </label>
              </div>
              <div className="board-detail-header-actions">
                {!isReadOnly && (cardQuery.data.card.is_archived ? (
                  <MaterialButton variant="outlined" size="compact"
                    aria-label={`Kaart terugzetten: ${cardQuery.data.card.title}`}
                    title={`Kaart terugzetten: ${cardQuery.data.card.title}`}
                    disabled={restoreCardMutation.isPending}
                    onClick={() => restoreCardMutation.mutate(cardQuery.data!.card.id)}
                  >
                    <RestoreIcon />
                    <span className="board-detail-action-label">Terugzetten</span>
                  </MaterialButton>
                ) : (
                  <MaterialButton variant="outlined" size="compact"
                    aria-label={`Kaart archiveren: ${cardQuery.data.card.title}`}
                    title={`Kaart archiveren: ${cardQuery.data.card.title}`}
                    disabled={archiveCardMutation.isPending}
                    onClick={() => archiveCardMutation.mutate(cardQuery.data!.card.id)}
                  >
                    <ArchiveIcon />
                    <span className="board-detail-action-label">Archiveren</span>
                  </MaterialButton>
                ))}
                {!isReadOnly && <MaterialButton variant="outlined" size="compact"
                  aria-label={`Kaart verwijderen: ${cardQuery.data.card.title}`}
                  title={`Kaart verwijderen: ${cardQuery.data.card.title}`}
                  disabled={deleteCardMutation.isPending}
                  onClick={() => {
                    const shouldDelete = window.confirm("Weet je zeker dat je deze kaart wilt verwijderen? Deze actie kan later door een admin worden teruggedraaid.");
                    if (!shouldDelete) return;
                    deleteCardMutation.mutate(cardQuery.data!.card.id);
                  }}
                >
                  <TrashIcon />
                  <span className="board-detail-action-label">Verwijderen</span>
                </MaterialButton>}
                <MaterialButton variant="icon" className="board-detail-dismiss" buttonRef={boardDetailCloseButtonRef} onClick={closeCardDetail} aria-label="Kaartdetail sluiten" title="Sluiten (Esc)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </MaterialButton>
              </div>
            </header>

            <div className="board-detail-layout">
              <div className="board-detail-main">
                {!isReadOnly && titleEdit?.cardId === cardQuery.data.card.id ? (
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
                    <h2 {...(!isReadOnly ? {
                      role: "button",
                      tabIndex: 0,
                      "aria-label": `Kaarttitel bewerken: ${cardQuery.data.card.title}`,
                      onClick: () => startTitleEdit(cardQuery.data!.card.id, cardQuery.data!.card.title),
                      onKeyDown: (evt: ReactKeyboardEvent) => {
                        if (evt.key === "Enter" || evt.key === " ") {
                          evt.preventDefault();
                          startTitleEdit(cardQuery.data!.card.id, cardQuery.data!.card.title);
                        }
                      }
                    } : {})}>
                      {cardQuery.data.card.title}
                    </h2>
                  </div>
                )}
                <div className="board-detail-members"><span>Betrokken</span>
                <AssignedUserAvatarRow assignments={cardQuery.data.card.assignments} className="board-detail-assignment-avatars" />
                {!isReadOnly && <BoardMemberSelector key={cardQuery.data.card.id} users={boardAccessUsers} assignments={cardQuery.data.card.assignments} onSave={async (ids) => {
                  const cardId = cardQuery.data!.card.id;
                  await updateBoardCardAssignments(cardId, ids);
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["board-card", cardId] }),
                    queryClient.invalidateQueries({ queryKey: ["board-project", resolvedProjectId] })
                  ]);
                }} />}
                </div>
            <section className="board-detail-section board-detail-description-panel">
              <div className="board-detail-section-heading">
                <h3>Beschrijving</h3>
              </div>
              {!isReadOnly && descriptionEdit?.cardId === cardQuery.data.card.id ? (
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
                    {...(!isReadOnly ? {
                      role: "button",
                      tabIndex: 0,
                      "aria-label": cardQuery.data.card.description.trim() ? "Beschrijving bewerken" : "Beschrijving toevoegen",
                      onClick: () => startDescriptionEdit(cardQuery.data!.card.id, cardQuery.data!.card.description),
                      onKeyDown: (evt: ReactKeyboardEvent) => {
                        if (evt.key === "Enter" || evt.key === " ") {
                          evt.preventDefault();
                          startDescriptionEdit(cardQuery.data!.card.id, cardQuery.data!.card.description);
                        }
                      }
                    } : {})}
                    className="board-card-description-preview board-card-description-edit-trigger"
                  >
                    <CardDescriptionRenderer description={cardQuery.data.card.description} emptyFallback={<>Beschrijving toevoegen</>} />
                  </div>
                </div>
              )}
            </section>
              <aside className="board-detail-sidebar" aria-label="Bijlagen">
            <section className="board-detail-section board-attachments-section">
              <div className="board-detail-section-heading">
                <h3>Bijlagen</h3>
              </div>
              {!isReadOnly && <form
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
                      <MaterialButton variant="text" size="compact" onClick={clearAttachmentSelection} disabled={isAttachmentUploading}>
                        Wissen
                      </MaterialButton>
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
                  {attachmentFiles.length > 0 && <MaterialButton type="submit" className="board-detail-upload-submit" disabled={isAttachmentUploading}>
                    {isAttachmentUploading ? "Toevoegen…" : "Toevoegen"}
                  </MaterialButton>}
                </div>
              </form>}
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
                          {!isReadOnly && <MaterialButton variant="text" size="compact"
                            type="button"
                            className="board-detail-danger-action"
                            disabled={deleteAttachmentMutation.isPending}
                            onClick={() => {
                              const shouldDelete = window.confirm("Weet je zeker dat je deze bijlage wilt verwijderen?");
                              if (!shouldDelete) return;
                              deleteAttachmentMutation.mutate({ cardId: cardQuery.data!.card.id, attachmentId: attachment.id });
                            }}
                          >
                            Verwijderen
                          </MaterialButton>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

              </aside>
              </div>
              <aside className="board-detail-activity" aria-label="Reacties en activiteit">
            {!isReadOnly && <form
              className="board-update-form board-detail-section"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                const message = updateMessage.trim();
                if (!message) {
                  setUpdateError("Vul eerst een update in.");
                  return;
                }
                // Disabling the submit component must not drop focus outside the dialog.
                newUpdateTextareaRef.current?.focus({ preventScroll: true });
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
              <div className="board-detail-composer-actions">
                <MaterialButton variant="outlined"
                  type="button"
                  className={`board-detail-record-button${activeRecordingCardId === cardQuery.data.card.id ? " is-recording" : ""}`}
                  onClick={() => {
                    void startOrStopUpdateRecording(cardQuery.data!.card.id);
                  }}
                  disabled={isUpdateTranscribing || Boolean(recorder && activeRecordingCardId !== cardQuery.data.card.id)}
                >
                  <RecordIcon active={activeRecordingCardId === cardQuery.data.card.id} />
                  {activeRecordingCardId === cardQuery.data.card.id ? `Stop opname (${recordingSeconds}s)` : "Start opname"}
                </MaterialButton>
                <MaterialButton
                  type="submit"
                  className="board-detail-submit"
                  disabled={!updateMessage.trim() || postUpdateMutation.isPending || isUpdateTranscribing || activeRecordingCardId === cardQuery.data.card.id}
                >
                  {postUpdateMutation.isPending ? "Update plaatsen…" : "Update plaatsen"}
                </MaterialButton>
              </div>
              {updateRecordingProgress && <p className="board-detail-recording-progress" role="status">{updateRecordingProgress}</p>}
              {updateError && <p className="error vergaderborden-inline-error">{updateError}</p>}
            </form>}

            <section className="board-updates-section board-detail-section" aria-live="polite">
              <div className="board-detail-section-heading">
                <div>
                  <h3>Updates</h3>
                  <p className="board-section-help">Nieuwste eerst</p>
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
                          <p className="board-recording-summary"><strong>Audio-opname</strong><span> · Duur: {formatRecordingDuration(r.duration)} · Grootte: {formatRecordingSize(r.size_bytes)}</span></p>
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
                      {updateEdit?.updateId === u.id && !isMoveUpdate && !isReadOnly ? (
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
                              <MaterialButton variant="text" size="compact"
                                type="button"
                                onClick={() => setUpdateEdit((current) => (current ? { ...current, removeImage: true, newImage: null } : current))}
                                disabled={editUpdateMutation.isPending}
                              >
                                Afbeelding verwijderen
                              </MaterialButton>
                            )}
                          </div>
                          <div className="board-update-actions board-update-actions-editor">
                            <MaterialButton variant="text" size="compact"
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
                            </MaterialButton>
                            <MaterialButton variant="text" size="compact" type="button" onClick={() => setUpdateEdit(null)} disabled={editUpdateMutation.isPending}>Annuleren</MaterialButton>
                          </div>
                          {updateEdit.error && <p className="error vergaderborden-inline-error">{updateEdit.error}</p>}
                        </div>
                      ) : (
                        <>
                          <div className="board-update-message">{renderBoardUpdateMessage(u.message)}</div>
                          {u.image_url && <img src={u.image_url} alt="Update-afbeelding" className="board-update-image" />}
                          {!isReadOnly && !isMoveUpdate && u.author_user_id === currentUserQuery.data?.id && (
                            <div className="board-update-actions">
                              <MaterialButton variant="text" size="compact"
                                type="button"
                                className="board-detail-text-action"
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
                              </MaterialButton>
                              <span aria-hidden="true">•</span>
                              <MaterialButton variant="text" size="compact"
                                type="button"
                                className="board-detail-text-action"
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
                              </MaterialButton>
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
              </aside>
            </div>

            {attachmentPreview && isImageAttachment(attachmentPreview) && (
              <AttachmentPreviewModal attachment={attachmentPreview} onClose={() => setAttachmentPreview(null)} />
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

function CreateCardInline({ users, isLoading, hasError, onCreate }: { users: BoardAccessUser[]; isLoading: boolean; hasError: boolean; onCreate: (payload: { title: string; description: string; urgency: "normal" | "urgent"; assignment_user_ids: string[]; attachments: File[] }) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "urgent">("normal");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTitleSuggesting, setIsTitleSuggesting] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceTranscribing, setIsVoiceTranscribing] = useState(false);
  const [isVoiceReviewing, setIsVoiceReviewing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voicePrefixRef = useRef("");
  const voiceTranscriptRef = useRef("");
  const pendingVoiceTranscriptionsRef = useRef(0);
  const voiceTranscriptionQueueRef = useRef(Promise.resolve());
  const voiceCaptureActiveRef = useRef(false);
  const voiceChunkStopTimerRef = useRef<number | null>(null);
  const titleWasEditedRef = useRef(false);

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

  useEffect(() => () => {
    voiceCaptureActiveRef.current = false;
    if (voiceChunkStopTimerRef.current !== null) window.clearTimeout(voiceChunkStopTimerRef.current);
    if (voiceRecorderRef.current?.state !== "inactive") voiceRecorderRef.current?.stop();
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
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

  const applyVoiceTranscript = (transcriptPart: string) => {
    const normalizedPart = transcriptPart.replace(/\s+/g, " ").trim();
    if (!normalizedPart) return;
    const currentTranscript = voiceTranscriptRef.current.trim();
    if (currentTranscript === normalizedPart || currentTranscript.endsWith(normalizedPart)) return;
    voiceTranscriptRef.current = normalizedPart.startsWith(currentTranscript)
      ? normalizedPart
      : [currentTranscript, normalizedPart].filter(Boolean).join(" ").trim();
    const nextDescription = [voicePrefixRef.current, voiceTranscriptRef.current].filter(Boolean).join(voicePrefixRef.current && voiceTranscriptRef.current ? "\n\n" : "").slice(0, CARD_DESCRIPTION_MAX_LENGTH);
    setDescription(nextDescription);
    if (!titleWasEditedRef.current) {
      setTitle(suggestCardTitleFromTranscript(voiceTranscriptRef.current));
      setTitleError(null);
    }
  };

  const transcribeVoiceChunk = (chunk: Blob) => {
    if (!chunk.size) return;
    pendingVoiceTranscriptionsRef.current += 1;
    setIsVoiceTranscribing(true);
    voiceTranscriptionQueueRef.current = voiceTranscriptionQueueRef.current
      .then(async () => {
        const { text } = await transcribeBoardAudioChunk(chunk);
        applyVoiceTranscript(text);
      })
      .catch(() => {
        setVoiceError("Een stukje audio kon niet worden getranscribeerd. Spreek verder of probeer opnieuw.");
      })
      .finally(() => {
        pendingVoiceTranscriptionsRef.current -= 1;
        if (pendingVoiceTranscriptionsRef.current <= 0) setIsVoiceTranscribing(false);
      });
  };

  const reviewText = async (text: string, allowContentChanges = false) => {
    setIsVoiceReviewing(true);
    try {
      const { text: reviewedText } = await reviewBoardTranscript(text, allowContentChanges);
      return reviewedText.trim() || null;
    } catch {
      setVoiceError("De review lukte niet; de oorspronkelijke tekst is behouden.");
      return null;
    } finally {
      setIsVoiceReviewing(false);
    }
  };

  const reviewCompletedVoiceTranscript = () => {
    void voiceTranscriptionQueueRef.current.then(async () => {
      const transcript = voiceTranscriptRef.current.trim();
      if (!transcript) return;
      const reviewedTranscript = await reviewText(transcript, true);
      if (!reviewedTranscript) return;
      voiceTranscriptRef.current = reviewedTranscript;
      const nextDescription = [voicePrefixRef.current, reviewedTranscript]
        .filter(Boolean)
        .join(voicePrefixRef.current ? "\n\n" : "")
        .slice(0, CARD_DESCRIPTION_MAX_LENGTH);
      setDescription(nextDescription);
      if (!titleWasEditedRef.current) {
        setTitle(suggestCardTitleFromTranscript(reviewedTranscript));
        setTitleError(null);
      }
    });
  };

  const reviewCurrentDescription = () => {
    const currentDescription = description.trim();
    if (!currentDescription) {
      setDescriptionError("Vul eerst een beschrijving in om te verbeteren.");
      return;
    }
    void reviewText(currentDescription, true).then((reviewedDescription) => {
      if (!reviewedDescription) return;
      setDescription(reviewedDescription.slice(0, CARD_DESCRIPTION_MAX_LENGTH));
      setDescriptionError(null);
    });
  };

  const suggestTitleFromDescription = () => {
    const currentDescription = description.trim();
    if (!currentDescription) {
      setTitleError("Vul eerst een beschrijving in voor een titelvoorstel.");
      return;
    }
    setIsTitleSuggesting(true);
    void suggestBoardCardTitle(currentDescription)
      .then(({ title: suggestedTitle }) => {
        const title = suggestedTitle.trim().slice(0, CARD_TITLE_MAX_LENGTH);
        if (!title) return;
        titleWasEditedRef.current = true;
        setTitle(title);
        setTitleError(null);
      })
      .catch(() => setTitleError("Titelvoorstel is mislukt. Probeer het opnieuw."))
      .finally(() => setIsTitleSuggesting(false));
  };

  const startVoiceTranscription = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Audio opnemen wordt niet ondersteund door deze browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voicePrefixRef.current = description.trim();
      voiceTranscriptRef.current = "";
      voiceStreamRef.current = stream;
      voiceCaptureActiveRef.current = true;

      const recordNextCompleteChunk = () => {
        if (!voiceCaptureActiveRef.current || voiceStreamRef.current !== stream) return;
        const recorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        voiceRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => {
          if (voiceChunkStopTimerRef.current !== null) {
            window.clearTimeout(voiceChunkStopTimerRef.current);
            voiceChunkStopTimerRef.current = null;
          }
          if (voiceRecorderRef.current === recorder) voiceRecorderRef.current = null;
          const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          transcribeVoiceChunk(audio);

          if (voiceCaptureActiveRef.current && voiceStreamRef.current === stream) {
            window.setTimeout(recordNextCompleteChunk, 0);
            return;
          }
          reviewCompletedVoiceTranscript();
          if (voiceStreamRef.current === stream) voiceStreamRef.current = null;
          stream.getTracks().forEach((track) => track.stop());
          setIsVoiceRecording(false);
        };
        recorder.onerror = () => {
          voiceCaptureActiveRef.current = false;
          setVoiceError("Audio opnemen is onderbroken. Probeer opnieuw.");
        };
        recorder.start();
        voiceChunkStopTimerRef.current = window.setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, 2500);
      };

      setVoiceError(null);
      setIsVoiceRecording(true);
      recordNextCompleteChunk();
    } catch {
      voiceCaptureActiveRef.current = false;
      setVoiceError("Microfoon starten is mislukt. Controleer toestemming en probeer opnieuw.");
    }
  };

  const stopVoiceTranscription = () => {
    voiceCaptureActiveRef.current = false;
    if (voiceChunkStopTimerRef.current !== null) {
      window.clearTimeout(voiceChunkStopTimerRef.current);
      voiceChunkStopTimerRef.current = null;
    }
    const recorder = voiceRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
    setIsVoiceRecording(false);
  };

  return (
    <form
      className="vergaderborden-card-add-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (isVoiceRecording || isVoiceTranscribing || isVoiceReviewing) {
          setVoiceError("Stop eerst het dicteren en wacht tot transcriptie en review klaar zijn.");
          return;
        }
        const form = e.currentTarget as HTMLFormElement;
        const normalizedTitle = title.trim();
        const normalizedDescription = description.trim();
        if (normalizedDescription.length > CARD_DESCRIPTION_MAX_LENGTH) {
          setDescriptionError(`Beschrijving mag maximaal ${CARD_DESCRIPTION_MAX_LENGTH} tekens bevatten.`);
          return;
        }
        const assignment_user_ids = selectedUserIds;
        if (!normalizedTitle) {
          setTitleError("Titel is verplicht.");
          return;
        }
        if (normalizedTitle.length > CARD_TITLE_MAX_LENGTH) {
          setTitleError(`Titel mag maximaal ${CARD_TITLE_MAX_LENGTH} tekens bevatten.`);
          return;
        }
        setIsSubmitting(true);
        try {
          const success = await onCreate({ title: normalizedTitle, description: normalizedDescription, urgency, assignment_user_ids, attachments: selectedAttachments });
          if (success) {
            form.reset();
            setTitle("");
            titleWasEditedRef.current = false;
            setDescription("");
            setUrgency("normal");
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
          <div className="board-title-suggestion-action">
            <input
              name="title"
              placeholder="Titel kaart"
              required
              maxLength={CARD_TITLE_MAX_LENGTH}
              aria-describedby="board-title-suggestion-hint"
              value={title}
              onChange={(event) => {
                titleWasEditedRef.current = true;
                setTitle(event.target.value);
                if (titleError) setTitleError(null);
              }}
            />
            <button
              type="button"
              onClick={suggestTitleFromDescription}
              disabled={isSubmitting || isTitleSuggesting || !description.trim()}
            >
              {isTitleSuggesting ? "Titel maken…" : "Titel voorstellen"}
            </button>
          </div>
        </label>
        <small id="board-title-suggestion-hint" className="vergaderborden-field-hint vergaderborden-field-full">Wordt voorgesteld vanuit je gesproken inhoud.</small>
        <label className="vergaderborden-field vergaderborden-field-full">
          <span>Urgentie</span>
          <select aria-label="Urgentie nieuwe kaart" value={urgency} onChange={(event) => setUrgency(event.target.value as "normal" | "urgent")} disabled={isSubmitting}>
            <option value="normal">Normaal</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        {titleError && <p className="error vergaderborden-inline-error vergaderborden-field-full">{titleError}</p>}
        <div className="board-voice-capture vergaderborden-field-full">
          <div>
            <strong>Inspreken</strong>
            <p>Audio gaat naar onze server voor transcriptie. De beschrijving wordt tijdens het spreken aangevuld; de titel volgt als voorstel uit de inhoud.</p>
          </div>
          <button
            type="button"
            className={`board-voice-button${isVoiceRecording ? " is-recording" : ""}`}
            aria-pressed={isVoiceRecording}
            onClick={isVoiceRecording ? stopVoiceTranscription : () => void startVoiceTranscription()}
            disabled={isSubmitting || isVoiceReviewing}
          >
            <RecordIcon active={isVoiceRecording} />
            {isVoiceRecording ? "Stop dicteren" : "Start dicteren"}
          </button>
          {(isVoiceRecording || isVoiceTranscribing || isVoiceReviewing) && <p className="board-voice-live" role="status" aria-live="polite">{isVoiceRecording ? "Luistert mee; transcriptie wordt elke paar seconden aangevuld…" : isVoiceTranscribing ? "Laatste audiofragment wordt getranscribeerd…" : "Transcriptie wordt als geheel geredigeerd tot een heldere kaartbeschrijving…"}</p>}
          {voiceError && <p className="error vergaderborden-inline-error" role="alert">{voiceError}</p>}
        </div>
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
          <div className="board-description-review-action">
            <button
              type="button"
              onClick={reviewCurrentDescription}
              disabled={isSubmitting || isVoiceRecording || isVoiceTranscribing || isVoiceReviewing || !description.trim()}
            >
              Verbeter deze tekst
            </button>
            <small>Maakt de tekst helderder en mag formuleringen herschrijven.</small>
          </div>
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
        <button type="submit" disabled={isSubmitting || isVoiceRecording || isVoiceTranscribing}>Kaart toevoegen</button>
      </div>
    </form>
  );
}
