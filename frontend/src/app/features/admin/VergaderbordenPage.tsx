import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, ReactNode, RefObject, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AdminUser,
  createBoardCard,
  createBoardProject,
  deleteBoardCardUpdate,
  editBoardCardUpdate,
  getBoardCard,
  getCurrentUser,
  getBoardProject,
  listAdminUsers,
  getAdminUserAvatarUrl,
  listBoardProjects,
  moveBoardCard,
  postBoardCardUpdate,
  updateBoardCardDescription,
  updateBoardCardTitle,
  uploadBoardRecording
} from "../../../lib/api/client";
import {
  resolveVergaderbordenProjectId,
  VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY
} from "./vergaderbordenProjectSelection";

const KOLOMMEN: Array<"todo" | "doing" | "done"> = ["todo", "doing", "done"];
const KOLOM_TITEL: Record<string, string> = { todo: "Te doen", doing: "Bezig", done: "Klaar" };
const MIN_RECORDING_SECONDS = 5;
const RECORDING_TOO_SHORT_MESSAGE = "Opname is te kort. Neem minimaal 5 seconden op.";

type DragCardMeta = {
  cardId: string;
  sourceColumn: "todo" | "doing" | "done";
  sourcePosition: number;
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

const MOVE_ERROR_FALLBACK = "Opslaan van de kaart is mislukt. Ververs de pagina en probeer het opnieuw.";
const MOVE_UPDATE_MESSAGE_REGEX = /^Kaart verplaatst van (.+) naar (.+)\.$/;
const UNDERLINE_MARKER = "++";
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

function AssignedUserAvatarRow({ assignments, className = "" }: { assignments: BoardAssignment[]; className?: string }) {
  if (!assignments.length) return null;
  return (
    <div className={`chip-row assignment-avatar-row${className ? ` ${className}` : ""}`} aria-label="Toegewezen teamleden">
      {assignments.map((assn) => {
        const label = assn.user_display_name;
        const avatarUrl = avatarUrlForAssignment(assn);
        return (
          <span key={assn.id} className="user-chip assignment-avatar" title={label} aria-label={label}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="assignment-avatar-image" />
            ) : (
              <span className="assignment-avatar-initials" aria-hidden="true">{initialsFromName(label)}</span>
            )}
          </span>
        );
      })}
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
    <>
      Kaart verplaatst van <strong>{oldColumn}</strong> naar <strong>{newColumn}</strong>.
    </>
  );
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

function CardDescriptionRenderer({ description }: { description: string | null | undefined }) {
  return <RichTextRenderer text={description?.trim() || ""} emptyFallback={<>Geen beschrijving</>} />;
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

function UpdateFormattingToolbar({
  onAction
}: {
  onAction: (action: UpdateToolbarAction) => void;
}) {
  return (
    <div className="board-update-toolbar" aria-label="Opmaak knoppen">
      <button className="board-update-toolbar-button" type="button" aria-label="B" onClick={() => onAction("bold")}><strong>B</strong></button>
      <button className="board-update-toolbar-button" type="button" aria-label="I" onClick={() => onAction("italic")}><em>I</em></button>
      <button className="board-update-toolbar-button" type="button" aria-label="U" onClick={() => onAction("underline")}><u>U</u></button>
      <button className="board-update-toolbar-button" type="button" onClick={() => onAction("bullets")}>• Lijst</button>
      <button className="board-update-toolbar-button" type="button" onClick={() => onAction("numbers")}>1. Lijst</button>
    </div>
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
  onBlur?: () => void;
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

export function VergaderbordenPage({ canManageProjects = false }: { canManageProjects?: boolean }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [activeCreateColumn, setActiveCreateColumn] = useState<"todo" | "doing" | "done" | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeRecordingCardId, setActiveRecordingCardId] = useState<string | null>(null);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState("");
  const [dragOverColumn, setDragOverColumn] = useState<"todo" | "doing" | "done" | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [titleEdit, setTitleEdit] = useState<TitleEditState | null>(null);
  const [descriptionEdit, setDescriptionEdit] = useState<DescriptionEditState | null>(null);
  const [updateEdit, setUpdateEdit] = useState<UpdateEditState | null>(null);
  const newUpdateTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editUpdateTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const detailDescriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const skipNextTitleBlurRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);

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
  const cardQuery = useQuery({ queryKey: ["board-card", selectedCardId], queryFn: () => getBoardCard(selectedCardId || ""), enabled: Boolean(selectedCardId) });
  const resolvedProjectName = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    const selected = projects.find((project) => project.id === resolvedProjectId);
    return selected?.name ?? boardQuery.data?.project_name ?? null;
  }, [projectsQuery.data, resolvedProjectId, boardQuery.data?.project_name]);

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

  const cardsByColumn = useMemo(() => {
    const cards = boardQuery.data?.cards ?? [];
    return {
      todo: cards.filter((c) => c.column === "todo").sort((a, b) => a.position - b.position),
      doing: cards.filter((c) => c.column === "doing").sort((a, b) => a.position - b.position),
      done: cards.filter((c) => c.column === "done").sort((a, b) => a.position - b.position)
    };
  }, [boardQuery.data]);

  useEffect(() => {
    setActiveCreateColumn(null);
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

  const saveTitleEdit = async () => {
    if (!titleEdit || updateTitleMutation.isPending) return;
    const nextTitle = titleEdit.value.trim();
    if (!nextTitle) {
      setTitleEdit((current) => (current ? { ...current, error: "Vul een kaarttitel in." } : current));
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

  return (
    <section className="panel vergaderborden-page">
      <div className="vergaderborden-header">
        {resolvedProjectName && <h1>{resolvedProjectName}</h1>}
      </div>
      {canManageProjects && (
        <>
          {showCreate && <CreateProjectModal users={usersQuery.data ?? []} onClose={() => setShowCreate(false)} onSubmit={(payload) => createProjectMutation.mutate(payload)} />}
          <button className="vergaderborden-primary-action" onClick={() => setShowCreate(true)}>Nieuw project</button>
        </>
      )}

      {resolvedProjectId && (
        <div className="board-grid">
          {moveError && <p className="error vergaderborden-inline-error vergaderborden-move-error">{moveError}</p>}
          {savingCardId && <p className="vergaderborden-saving-indicator" aria-live="polite">Kaart wordt opgeslagen…</p>}
          {KOLOMMEN.map((kolom) => (
            <div
              className={`vergaderborden-column${dragOverColumn === kolom ? " is-drag-over" : ""}${savingCardId ? " is-saving" : ""}`}
              key={kolom}
              data-testid={`board-column-${kolom}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverColumn !== kolom) setDragOverColumn(kolom);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                setDragOverColumn((current) => (current === kolom ? null : current));
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverColumn(null);
                const cardMeta = parseDragCardMeta(e.dataTransfer.getData("application/json"));
                if (!cardMeta) return;

                const isSameColumn = cardMeta.sourceColumn === kolom;
                if (isSameColumn) {
                  return;
                }

                const targetCards = cardsByColumn[kolom] ?? [];
                const targetPosition = targetCards.length;

                setMoveError(null);
                setSavingCardId(cardMeta.cardId);
                moveCardMutation.mutate({ cardId: cardMeta.cardId, column: kolom, position: targetPosition });
              }}
            >
              <h3>{KOLOM_TITEL[kolom]}</h3>
              {activeCreateColumn !== kolom ? (
                <button
                  type="button"
                  className="vergaderborden-card-add-toggle"
                  onClick={() => setActiveCreateColumn(kolom)}
                >
                  + Kaart toevoegen
                </button>
              ) : (
                <CreateCardInline
                  users={usersQuery.data ?? []}
                  onCreate={async (payload) => {
                    if (!resolvedProjectId) return false;
                    try {
                      await createCardMutation.mutateAsync({ projectId: resolvedProjectId, column: kolom, ...payload });
                      setActiveCreateColumn(null);
                      return true;
                    } catch {
                      return false;
                    }
                  }}
                  onCancel={() => setActiveCreateColumn(null)}
                />
              )}
              {cardsByColumn[kolom].map((card) => (
                <article
                  key={card.id}
                  className="vergaderborden-board-card"
                  data-testid={`board-card-${card.id}`}
                  draggable
                  onDragStart={(e) => {
                    setMoveError(null);
                    const payload: DragCardMeta = { cardId: card.id, sourceColumn: card.column, sourcePosition: card.position };
                    e.dataTransfer.setData("application/json", JSON.stringify(payload));
                    e.dataTransfer.setData("text/plain", card.id);
                  }}
                  onDragEnd={() => setDragOverColumn(null)}
                  onClick={() => setSelectedCardId(card.id)}
                >
                  <strong>{card.title}</strong>
                  <div className="board-card-description-rich"><CardDescriptionRenderer description={card.description} /></div>
                  <AssignedUserAvatarRow assignments={card.assignments} />
                  <small>Updates: {card.updates_count} · Opnames: {card.recordings_count}</small>
                  <div className="board-card-recording-controls">
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
                      <span aria-hidden="true">{activeRecordingCardId === card.id ? "⏹" : "🎤"}</span>
                    </button>
                    {activeRecordingCardId === card.id && <p className="board-card-recording-timer">Timer: {recordingSeconds}s</p>}
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
      )}
      {recordingError && <p className="error vergaderborden-inline-error">{recordingError}</p>}

      {cardQuery.data?.card && (
        <div className="board-detail-overlay" role="dialog" aria-modal="true" onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedCardId(null);
        }}>
          <div className="board-detail-modal">
            <button type="button" className="board-detail-close" onClick={() => setSelectedCardId(null)} aria-label="Kaartdetail sluiten">×</button>
            {titleEdit?.cardId === cardQuery.data.card.id ? (
              <div className="board-detail-title-edit">
                <label className="vergaderborden-field">
                  <span>Kaarttitel</span>
                  <input
                    autoFocus
                    name="kaarttitel"
                    value={titleEdit.value}
                    onChange={(evt) => setTitleEdit((current) => (current ? { ...current, value: evt.target.value, error: null } : current))}
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
            <div className="board-detail-description-edit">
              <AssignedUserAvatarRow assignments={cardQuery.data.card.assignments} className="board-detail-assignment-avatars" />
              <label className="vergaderborden-field">
                <span>Beschrijving</span>
                <DescriptionEditor
                  ariaLabel="Beschrijving"
                  textareaRef={detailDescriptionTextareaRef}
                  value={descriptionEdit?.cardId === cardQuery.data.card.id ? descriptionEdit.value : cardQuery.data.card.description}
                  onFocus={() => {
                    if (descriptionEdit?.cardId === cardQuery.data!.card.id) return;
                    setDescriptionEdit({
                      cardId: cardQuery.data!.card.id,
                      value: cardQuery.data!.card.description,
                      original: cardQuery.data!.card.description,
                      error: null
                    });
                  }}
                  onChange={(nextValue) => {
                    if (descriptionEdit?.cardId !== cardQuery.data!.card.id) {
                      setDescriptionEdit({
                        cardId: cardQuery.data!.card.id,
                        value: nextValue,
                        original: cardQuery.data!.card.description,
                        error: null
                      });
                      return;
                    }
                    setDescriptionEdit((current) => (current ? { ...current, value: nextValue, error: null } : current));
                  }}
                  onBlur={() => {
                    void saveDescriptionEdit();
                  }}
                  placeholder="Geen beschrijving"
                  disabled={updateDescriptionMutation.isPending}
                  maxLength={CARD_DESCRIPTION_MAX_LENGTH}
                  onToolbarAction={handleDetailDescriptionToolbarAction}
                  error={descriptionEdit?.error}
                />
              </label>
              <div className="board-card-description-preview" aria-label="Beschrijving preview">
                <CardDescriptionRenderer description={descriptionEdit?.cardId === cardQuery.data.card.id ? descriptionEdit.value : cardQuery.data.card.description} />
              </div>
            </div>
            <form
              className="board-update-form"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                const message = updateMessage.trim();
                if (!message) {
                  setUpdateError("Vul eerst een update in.");
                  return;
                }
                postUpdateMutation.mutate({ cardId: cardQuery.data!.card.id, message });
              }}
            >
              <label className="vergaderborden-field">
                <span>Nieuwe update</span>
                <div className="board-update-editor-shell">
                  <UpdateFormattingToolbar onAction={handleUpdateToolbarAction} />
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
              <button type="submit">Update plaatsen</button>
            </form>
            <section className="board-updates-section" aria-live="polite">
              <h3>Updates</h3>
              {cardActivityItems.map((activity) => {
                  if (activity.kind === "recording") {
                    const r = activity.recording;
                    const hasDate = Boolean(activity.createdAt);
                    const dateLabel = hasDate
                      ? new Date(activity.createdAt).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })
                      : "Datum onbekend";
                    const authorLabel = r.uploaded_by_display_name?.trim() || r.uploaded_by_username?.trim() || "Onbekende auteur";
                    return (
                      <article key={activity.id} className="board-update-item">
                        <div className="board-update-header">
                          <span className="board-update-author-badge" aria-hidden="true">{initialsFromName(authorLabel)}</span>
                          <div className="board-update-header-text">
                            <strong className="board-update-author">{authorLabel}</strong>
                            <small className="board-update-meta">{dateLabel}</small>
                          </div>
                        </div>
                        <div className="board-update-message">
                          <p><strong>Audio-opname</strong></p>
                          <p>Duur: {formatRecordingDuration(r.duration)} · Grootte: {formatRecordingSize(r.size_bytes)}</p>
                          <audio controls src={r.download_url} />
                          <p><a href={r.download_url}>Download opname</a></p>
                        </div>
                      </article>
                    );
                  }

                  const u = activity.update;
                  const hasDate = Boolean(u.created_at);
                  const dateLabel = hasDate
                    ? new Date(u.created_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })
                    : "Datum onbekend";
                  const authorLabel = u.author_display_name?.trim() || u.author_username?.trim() || "Onbekende auteur";
                  return (
                    <article key={u.id} className="board-update-item">
                      <div className="board-update-header">
                        <span className="board-update-author-badge" aria-hidden="true">{initialsFromName(authorLabel)}</span>
                        <div className="board-update-header-text">
                          <strong className="board-update-author">{authorLabel}</strong>
                          <small className="board-update-meta">{dateLabel}</small>
                        </div>
                      </div>
                      {updateEdit?.updateId === u.id ? (
                        <div className="board-update-editor">
                          <div className="board-update-editor-shell">
                            <UpdateFormattingToolbar onAction={handleUpdateEditToolbarAction} />
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
                            >Opslaan</button>
                            <button type="button" onClick={() => setUpdateEdit(null)} disabled={editUpdateMutation.isPending}>Annuleren</button>
                          </div>
                          {updateEdit.error && <p className="error vergaderborden-inline-error">{updateEdit.error}</p>}
                        </div>
                      ) : (
                        <>
                          <div className="board-update-message">{renderBoardUpdateMessage(u.message)}</div>
                          {u.image_url && <img src={u.image_url} alt="Update-afbeelding" className="board-update-image" />}
                          {u.author_user_id === currentUserQuery.data?.id && (
                            <div className="board-update-actions">
                              <button
                                type="button"
                                className="board-update-action-link"
                                onClick={() =>
                                  setUpdateEdit({
                                    updateId: u.id,
                                    value: u.message,
                                    original: u.message,
                                    removeImage: false,
                                    newImage: null,
                                    error: null
                                  })
                                }
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

function CreateCardInline({ users, onCreate, onCancel }: { users: AdminUser[]; onCreate: (payload: { title: string; description: string; assignment_user_ids: string[] }) => Promise<boolean>; onCancel: () => void }) {
  const [titleError, setTitleError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
    : "Selecteer teamleden";

  return (
    <form
      className="vergaderborden-card-add-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
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
        const success = await onCreate({ title, description: normalizedDescription, assignment_user_ids });
        if (success) {
          form.reset();
          setDescription("");
          setDescriptionError(null);
          setSelectedUserIds([]);
          setDropdownOpen(false);
          setTitleError(null);
        }
      }}
    >
      <div className="vergaderborden-card-add-grid">
        <label className="vergaderborden-field vergaderborden-field-full">
          <span>Titel</span>
          <input name="title" placeholder="Titel kaart" required onChange={() => {
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
        <div className="vergaderborden-field vergaderborden-field-full" ref={containerRef}>
          <span>Teamleden</span>
          <button
            type="button"
            className="vergaderborden-multiselect-trigger"
            onClick={() => setDropdownOpen((open) => !open)}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
          >
            {selectedUserLabel}
          </button>
          {selectedUserIds.map((id) => (
            <input key={id} type="hidden" name="assignment_user_ids" value={id} />
          ))}
          {dropdownOpen && (
            <div className="vergaderborden-multiselect-menu" role="listbox" aria-label="Teamleden kiezen" aria-multiselectable="true">
              {users.map((u) => {
                const checked = selectedUserIds.includes(u.id);
                const label = displayNameForUser(u);
                const initials = initialsFromName(label);
                const avatarUrl = avatarUrlForUser(u);
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
        <button type="submit">Kaart toevoegen</button>
      </div>
    </form>
  );
}
