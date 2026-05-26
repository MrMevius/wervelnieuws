import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  updateBoardCardTitle,
  uploadBoardRecording
} from "../../../lib/api/client";

const KOLOMMEN: Array<"todo" | "doing" | "done"> = ["todo", "doing", "done"];
const KOLOM_TITEL: Record<string, string> = { todo: "Te doen", doing: "Bezig", done: "Klaar" };

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

const MOVE_ERROR_FALLBACK = "Opslaan van de kaart is mislukt. Ververs de pagina en probeer het opnieuw.";

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

export function VergaderbordenPage() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [activeCreateColumn, setActiveCreateColumn] = useState<"todo" | "doing" | "done" | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState("");
  const [dragOverColumn, setDragOverColumn] = useState<"todo" | "doing" | "done" | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [titleEdit, setTitleEdit] = useState<TitleEditState | null>(null);
  const skipNextTitleBlurRef = useRef(false);

  const projectsQuery = useQuery({ queryKey: ["board-projects"], queryFn: listBoardProjects });
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: listAdminUsers });
  const boardQuery = useQuery({ queryKey: ["board-project", projectId], queryFn: () => getBoardProject(projectId || ""), enabled: Boolean(projectId) });
  const cardQuery = useQuery({ queryKey: ["board-card", selectedCardId], queryFn: () => getBoardCard(selectedCardId || ""), enabled: Boolean(selectedCardId) });

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board-project", projectId] })
  });
  const moveCardMutation = useMutation({
    mutationFn: ({ cardId, column, position }: { cardId: string; column: "todo" | "doing" | "done"; position: number }) => moveBoardCard(cardId, { column, position }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board-project", projectId] }),
    onError: (error) => {
      setMoveError(toDutchMoveError(error));
      queryClient.invalidateQueries({ queryKey: ["board-project", projectId] });
    },
    onSettled: () => setSavingCardId(null)
  });
  const updateTitleMutation = useMutation({
    mutationFn: ({ cardId, title }: { cardId: string; title: string }) => updateBoardCardTitle(cardId, { title }),
    onSuccess: async (_card, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["board-card", variables.cardId] })
      ]);
    }
  });
  const postUpdateMutation = useMutation({
    mutationFn: ({ cardId, message }: { cardId: string; message: string }) => postBoardCardUpdate(cardId, message),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board-card", selectedCardId] }),
        queryClient.invalidateQueries({ queryKey: ["board-project", projectId] })
      ]);
      setUpdateMessage("");
      setUpdateError(null);
    }
  });
  const uploadRecordingMutation = useMutation({
    mutationFn: ({ cardId, blob, duration }: { cardId: string; blob: Blob; duration: number }) => uploadBoardRecording(cardId, blob, duration),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board-card", selectedCardId] })
  });

  const usersById = useMemo(() => {
    const map = new Map<string, AdminUser>();
    for (const user of usersQuery.data ?? []) map.set(user.id, user);
    return map;
  }, [usersQuery.data]);

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
  }, [projectId]);

  useEffect(() => {
    setTitleEdit(null);
  }, [selectedCardId]);

  const startOrStopRecording = async () => {
    if (!cardQuery.data) return;
    if (recorder) {
      recorder.stop();
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    const chunks: BlobPart[] = [];
    mr.ondataavailable = (evt) => chunks.push(evt.data);
    mr.onstop = () => {
      setRecorder(null);
      window.clearInterval((window as any).__vergaderbordTimer);
      const blob = new Blob(chunks, { type: "audio/webm" });
      uploadRecordingMutation.mutate({ cardId: cardQuery.data.card.id, blob, duration: recordingSeconds });
      setRecordingSeconds(0);
      stream.getTracks().forEach((track) => track.stop());
    };
    mr.start();
    setRecorder(mr);
    (window as any).__vergaderbordTimer = window.setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
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

  return (
    <section className="panel vergaderborden-page">
      <div className="vergaderborden-header">
        <h1>Vergaderborden</h1>
        <p className="vergaderborden-subtitle">Projecten en kaarten overzichtelijk beheren per fase.</p>
      </div>
      {showCreate && <CreateProjectModal users={usersQuery.data ?? []} onClose={() => setShowCreate(false)} onSubmit={(payload) => createProjectMutation.mutate(payload)} />}
      <button className="vergaderborden-primary-action" onClick={() => setShowCreate(true)}>Nieuw project</button>

      <div className="vergaderborden-project-grid">
        {(projectsQuery.data ?? []).map((project) => (
          <button key={project.id} className="vergaderborden-project-card" onClick={() => setProjectId(project.id)}>
            <strong>{project.name}</strong>
            <small>{project.card_count} kaartjes</small>
            <small>{project.description || "Geen beschrijving"}</small>
            <div className="chip-row">
              {project.invited_user_ids.map((uid) => {
                const user = usersById.get(uid);
                const label = user?.full_name?.trim() || user?.username || "Onbekend";
                return <span key={uid} className="user-chip" title={label}>{label.slice(0, 2).toUpperCase()}</span>;
              })}
            </div>
          </button>
        ))}
      </div>

      {projectId && (
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
                    if (!projectId) return false;
                    try {
                      await createCardMutation.mutateAsync({ projectId, column: kolom, ...payload });
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
                      <span key={assn.id} className="user-chip" title={assn.username}>{assn.username.slice(0, 2).toUpperCase()}</span>
                    ))}
                  </div>
                  <small>Updates: {card.updates_count} · Opnames: {card.recordings_count}</small>
                </article>
              ))}
            </div>
          ))}
        </div>
      )}

      {cardQuery.data && (
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
                  const authorLabel = u.author_username?.trim() || "Onbekende auteur";
                  return (
                    <article key={u.id} className="board-update-item">
                      <p className="board-update-message">{u.message?.trim() || "Update zonder tekst"}</p>
                      <small className="board-update-meta">{dateLabel} · {authorLabel}</small>
                    </article>
                  );
                })}
              {cardQuery.data.updates.length === 0 && <p className="board-updates-empty">Er zijn nog geen updates geplaatst.</p>}
            </section>
            {cardQuery.data.card.column === "doing" && (
              <div>
                <button className="record-button" onClick={startOrStopRecording}>{recorder ? "Stop opname" : "Start opname"}</button>
                <p>Timer: {recordingSeconds}s</p>
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
            <select name="invited_user_ids" multiple>{users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}</select>
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
                const label = u.full_name?.trim() || u.username;
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
