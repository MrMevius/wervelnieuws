import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AdminUser,
  createBoardCard,
  createBoardProject,
  getBoardCard,
  getBoardProject,
  listAdminUsers,
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

const MOVE_ERROR_FALLBACK = "Opslaan van de kaart is mislukt. Ververs de pagina en probeer het opnieuw.";
const MOVE_UPDATE_MESSAGE_REGEX = /^Kaart verplaatst van (.+) naar (.+)\.$/;

function displayNameForUser(user: Pick<AdminUser, "full_name" | "username">): string {
  return user.full_name?.trim() || user.username;
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
  if (!match) return text;

  const [, oldColumn, newColumn] = match;
  return (
    <>
      Kaart verplaatst van <strong>{oldColumn}</strong> naar <strong>{newColumn}</strong>.
    </>
  );
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
  const skipNextTitleBlurRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);

  const projectsQuery = useQuery({ queryKey: ["board-projects"], queryFn: listBoardProjects });
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: listAdminUsers });
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
          uploadRecordingMutation.mutate({ cardId: finishedCardId, blob, duration: durationAtStop });
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
                  <p>{card.description || "Geen beschrijving"}</p>
                  <div className="chip-row">
                    {card.assignments.map((assn) => (
                      <span key={assn.id} className="user-chip" title={assn.user_display_name}>{assn.user_display_name.slice(0, 2).toUpperCase()}</span>
                    ))}
                  </div>
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
              <label className="vergaderborden-field">
                <span>Beschrijving</span>
                <textarea
                  aria-label="Beschrijving"
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
                  onChange={(evt) => {
                    if (descriptionEdit?.cardId !== cardQuery.data!.card.id) {
                      setDescriptionEdit({
                        cardId: cardQuery.data!.card.id,
                        value: evt.target.value,
                        original: cardQuery.data!.card.description,
                        error: null
                      });
                      return;
                    }
                    setDescriptionEdit((current) => (current ? { ...current, value: evt.target.value, error: null } : current));
                  }}
                  onBlur={() => {
                    void saveDescriptionEdit();
                  }}
                  placeholder="Geen beschrijving"
                  disabled={updateDescriptionMutation.isPending}
                />
              </label>
              {descriptionEdit?.error && <p className="error vergaderborden-inline-error">{descriptionEdit.error}</p>}
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
                <textarea
                  name="message"
                  placeholder="Beschrijf kort de voortgang"
                  value={updateMessage}
                  onChange={(evt) => {
                    setUpdateMessage(evt.target.value);
                    if (updateError) setUpdateError(null);
                  }}
                />
              </label>
              {updateError && <p className="error vergaderborden-inline-error">{updateError}</p>}
              <button type="submit">Update plaatsen</button>
            </form>
            <section className="board-updates-section" aria-live="polite">
              <h3>Updates</h3>
              {[...cardQuery.data.updates]
                .sort((a, b) => {
                  const aTs = new Date(a.created_at || 0).getTime();
                  const bTs = new Date(b.created_at || 0).getTime();
                  return bTs - aTs;
                })
                .map((u) => {
                  const hasDate = Boolean(u.created_at);
                  const dateLabel = hasDate
                    ? new Date(u.created_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })
                    : "Datum onbekend";
                  const authorLabel = u.author_display_name?.trim() || u.author_username?.trim() || "Onbekende auteur";
                  return (
                    <article key={u.id} className="board-update-item">
                      <p className="board-update-message">{renderBoardUpdateMessage(u.message)}</p>
                      <small className="board-update-meta">{dateLabel} · {authorLabel}</small>
                    </article>
                  );
                })}
              {cardQuery.data.updates.length === 0 && <p className="board-updates-empty">Er zijn nog geen updates geplaatst.</p>}
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
            <h3>Opnames</h3>
            {cardQuery.data.recordings.map((r) => (
              <div key={r.id}>
                <audio controls src={r.download_url} />
                <p>
                  <a href={r.download_url}>Download opname</a> · {new Date(r.recorded_at).toLocaleString("nl-NL")}
                </p>
              </div>
            ))}
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
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
        const description = String(fd.get("description") || "").trim();
        const assignment_user_ids = selectedUserIds;
        if (!title) {
          setTitleError("Titel is verplicht.");
          return;
        }
        const success = await onCreate({ title, description, assignment_user_ids });
        if (success) {
          form.reset();
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
          <input name="description" placeholder="Korte toelichting (optioneel)" />
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
                return (
                  <label key={u.id} className="vergaderborden-multiselect-option">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUser(u.id)}
                    />
                    <span>{label}</span>
                  </label>
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
