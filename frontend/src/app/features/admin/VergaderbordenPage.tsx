import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
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
  uploadBoardRecording
} from "../../../lib/api/client";

const KOLOMMEN: Array<"todo" | "doing" | "done"> = ["todo", "doing", "done"];
const KOLOM_TITEL: Record<string, string> = { todo: "Te doen", doing: "Bezig", done: "Klaar" };

export function VergaderbordenPage() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board-project", projectId] })
  });
  const postUpdateMutation = useMutation({
    mutationFn: ({ cardId, message }: { cardId: string; message: string }) => postBoardCardUpdate(cardId, message),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board-card", selectedCardId] })
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

  return (
    <section className="panel vergaderborden-page">
      <h1>Vergaderborden</h1>
      {showCreate && <CreateProjectModal users={usersQuery.data ?? []} onClose={() => setShowCreate(false)} onSubmit={(payload) => createProjectMutation.mutate(payload)} />}
      <button onClick={() => setShowCreate(true)}>Nieuw project</button>

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
          {KOLOMMEN.map((kolom) => (
            <div
              key={kolom}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const cardId = e.dataTransfer.getData("text/plain");
                const position = (cardsByColumn[kolom] ?? []).length;
                moveCardMutation.mutate({ cardId, column: kolom, position });
              }}
            >
              <h3>{KOLOM_TITEL[kolom]}</h3>
              <CreateCardInline
                users={usersQuery.data ?? []}
                onCreate={(payload) => projectId && createCardMutation.mutate({ projectId, column: kolom, ...payload })}
              />
              {cardsByColumn[kolom].map((card) => (
                <article key={card.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)} onClick={() => setSelectedCardId(card.id)}>
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
        <div className="board-detail-overlay" role="dialog" aria-modal="true">
          <div className="board-detail-modal">
            <button type="button" onClick={() => setSelectedCardId(null)}>Sluiten</button>
            <h2>Kaartdetail</h2>
            <p>{cardQuery.data.card.title}</p>
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget as HTMLFormElement);
                const message = String(fd.get("message") || "").trim();
                if (!message) return;
                postUpdateMutation.mutate({ cardId: cardQuery.data!.card.id, message });
                (e.currentTarget as HTMLFormElement).reset();
              }}
            >
              <textarea name="message" placeholder="Nieuwe update" />
              <button type="submit">Update plaatsen</button>
            </form>
            {cardQuery.data.card.column === "doing" && (
              <div>
                <button className="record-button" onClick={startOrStopRecording}>{recorder ? "Stop opname" : "Start opname"}</button>
                <p>Timer: {recordingSeconds}s</p>
              </div>
            )}
            <h3>Updates</h3>
            {cardQuery.data.updates.map((u) => (
              <p key={u.id}>
                <strong>{u.author_username}</strong>: {u.message}
              </p>
            ))}
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
        <input name="name" placeholder="Projectnaam" required />
        <textarea name="description" placeholder="Beschrijving" />
        <label>Uitgenodigde gebruikers</label>
        <select name="invited_user_ids" multiple>{users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}</select>
        <button type="submit">Opslaan</button>
        <button type="button" onClick={onClose}>Sluiten</button>
      </form>
    </div>
  );
}

function CreateCardInline({ users, onCreate }: { users: AdminUser[]; onCreate: (payload: { title: string; description: string; assignment_user_ids: string[] }) => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const title = String(fd.get("title") || "").trim();
        const description = String(fd.get("description") || "").trim();
        const assignment_user_ids = fd.getAll("assignment_user_ids").map(String);
        if (!title) return;
        onCreate({ title, description, assignment_user_ids });
        (e.currentTarget as HTMLFormElement).reset();
      }}
    >
      <input name="title" placeholder="Titel kaart" required />
      <input name="description" placeholder="Beschrijving" />
      <select name="assignment_user_ids" multiple>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.username}</option>
        ))}
      </select>
      <button type="submit">Kaart toevoegen</button>
    </form>
  );
}
