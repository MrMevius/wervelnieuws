import { useRef, useState } from "react";
import { MaterialButton } from "../../../design-system/MaterialButton";
import type { BoardAccessUser, BoardCard } from "../../../lib/api/client";

type Props = {
  users: BoardAccessUser[];
  assignments: BoardCard["assignments"];
  onSave: (ids: string[]) => Promise<void>;
};

export function BoardMemberSelector({ users, assignments, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const available = users.filter(user => user.is_active);
  const unavailable = assignments.filter(assignment => !available.some(user => user.id === assignment.user_id));

  function close() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return <div className="board-member-selector" onKeyDown={event => {
    if (open && event.key === "Escape") {
      event.stopPropagation();
      if (!saving) close();
    }
  }}>
    <MaterialButton variant="outlined" size="compact" buttonRef={triggerRef} aria-label="Teamleden wijzigen" aria-expanded={open} onClick={() => {
      if (open) { close(); return; }
      setSelected(assignments.map(assignment => assignment.user_id));
      setError(null);
      setOpen(true);
    }} disabled={saving}>Teamleden</MaterialButton>
    {open && <section className="board-member-picker" aria-label="Teamleden kiezen">
      <p>Selecteer wie bij dit kaartje betrokken is.</p>
      <div className="board-member-options">
        {[...available.map(user => ({ id: user.id, name: user.full_name?.trim() || user.username, available: true })),
          ...unavailable.map(assignment => ({ id: assignment.user_id, name: assignment.user_display_name || assignment.username, available: false }))].map(user => (
          <label key={user.id} className="board-member-option">
            <input type="checkbox" checked={selected.includes(user.id)} disabled={saving || (!user.available && !selected.includes(user.id))} onChange={event => {
              setSelected(current => event.target.checked ? [...current, user.id] : current.filter(id => id !== user.id));
            }} />
            <span>{user.name}{!user.available && <small>Niet meer beschikbaar op dit bord</small>}</span>
          </label>
        ))}
      </div>
      {!available.length && <p>Er zijn geen actieve teamleden beschikbaar.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="board-member-actions">
        <MaterialButton variant="text" size="compact" disabled={saving} onClick={close}>Annuleren</MaterialButton>
        <MaterialButton size="compact" disabled={saving} onClick={async () => {
          setSaving(true);
          setError(null);
          try { await onSave(selected); close(); }
          catch (error) { setError(error instanceof Error ? error.message : "Teamleden opslaan is mislukt. Probeer opnieuw."); }
          finally { setSaving(false); }
        }}>{saving ? "Opslaan…" : "Teamleden opslaan"}</MaterialButton>
      </div>
    </section>}
  </div>;
}
