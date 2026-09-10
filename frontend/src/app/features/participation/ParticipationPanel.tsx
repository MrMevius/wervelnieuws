import { useEffect, useRef, useState, type FormEvent } from "react";
import { MaterialButton } from "../../../design-system/MaterialButton";
import {
  archiveParticipationMoment, createParticipationMoment, updateParticipationMoment, participationError,
  type ContactType, type ParticipationDraft, type ParticipationMeta, type ParticipationMoment, type ParticipationOption,
} from "../../../lib/api/participation";

export const contactLabels: Record<ContactType, string> = {
  in_person: "Op locatie", phone: "Telefonisch", video: "Videogesprek", other: "Anders",
};
export const formatDate = (value: string) => new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));

function initialDraft(meta: ParticipationMeta, moment?: ParticipationMoment): ParticipationDraft {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return moment ? {
    title: moment.title, occurred_on: moment.occurred_on, contact_type: moment.contact_type,
    conversation_partners: moment.conversation_partners, location: moment.location,
    duration_minutes: moment.duration_minutes, report: moment.report, agreements: moment.agreements,
    participant_ids: moment.participants.map(person => person.id), project_ids: moment.projects.map(project => project.id),
  } : {
    title: "", occurred_on: today, contact_type: "in_person", conversation_partners: "", location: "",
    duration_minutes: null, report: "", agreements: "", participant_ids: [meta.current_user_id],
    project_ids: meta.projects.filter(project => project.selectable).length === 1 ? meta.projects.filter(project => project.selectable).map(project => project.id) : [],
  };
}

function Options({ label, options, previous, selected, onChange }: {
  label: string; options: ParticipationOption[]; previous: ParticipationOption[]; selected: string[]; onChange: (ids: string[]) => void;
}) {
  const choices = [...options, ...previous.filter(item => !options.some(option => option.id === item.id)).map(item => ({ ...item, selectable: false }))];
  return <fieldset className="participation-options">
    <legend>{label} <span>{selected.length} geselecteerd</span></legend>
    <div className="participation-choice-list">
      {choices.map(option => <label key={option.id}>
        <input type="checkbox" checked={selected.includes(option.id)} disabled={!option.selectable && !selected.includes(option.id)} onChange={event => onChange(event.target.checked ? [...selected, option.id] : selected.filter(id => id !== option.id))} />
        <span>{option.name}{!option.selectable && <small>Historisch</small>}</span>
      </label>)}
      {!choices.length && <p className="muted">Geen {label.toLowerCase()} beschikbaar.</p>}
    </div>
  </fieldset>;
}

export function ParticipationPanel({ meta, moment: initialMoment, onClose, onSaved }: {
  meta: ParticipationMeta; moment?: ParticipationMoment; onClose: () => void; onSaved: (row: ParticipationMoment) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Pin the edit baseline/version so background refetches cannot turn stale
  // form values into an apparently up-to-date overwrite.
  const [moment] = useState(initialMoment);
  const [editing, setEditing] = useState(!moment);
  const [draft, setDraft] = useState(() => initialDraft(meta, moment));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<"discard" | "archive" | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft(meta, moment));

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
    return () => {
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);

  function close() {
    if (busy) return;
    if (editing && dirty) setConfirmation("discard");
    else onClose();
  }
  const change = <K extends keyof ParticipationDraft>(key: K, value: ParticipationDraft[K]) => setDraft(current => ({ ...current, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.participant_ids.length || !draft.project_ids.length) {
      setError("Selecteer minimaal één uitvoerder en één project.");
      return;
    }
    setBusy(true); setError("");
    try {
      const row = moment ? await updateParticipationMoment(moment.id, draft, moment.row_version) : await createParticipationMoment(draft);
      onSaved(row);
    } catch (error) { setError(participationError(error)); }
    finally { setBusy(false); }
  }

  async function archive() {
    if (!moment) return;
    setBusy(true); setError("");
    try { onSaved(await archiveParticipationMoment(moment.id, !moment.archived_at, moment.row_version)); }
    catch (error) { setError(participationError(error)); }
    finally { setBusy(false); setConfirmation(null); }
  }

  return <dialog ref={dialogRef} className="participation-dialog" aria-labelledby="participation-panel-title" onCancel={event => { event.preventDefault(); close(); }}>
    <form onSubmit={save}>
      <header className="participation-panel-header">
        <div><p className="participation-kicker">{moment ? "Gespreksverslag" : "Gesprek vastleggen"}</p><h2 id="participation-panel-title">{editing ? moment ? "Verslag bewerken" : "Nieuw participatiemoment" : moment?.title}</h2></div>
        <MaterialButton variant="icon" aria-label="Paneel sluiten" disabled={busy} onClick={close}><span aria-hidden="true" className="participation-close">×</span></MaterialButton>
      </header>
      <div className="participation-panel-body">
        {error && <p className="error" role="alert">{error}</p>}
        {editing ? <fieldset className="participation-fields" disabled={busy}>
          <label>Onderwerp *<input autoFocus value={draft.title} maxLength={180} required onChange={event => change("title", event.target.value)} placeholder="Waar ging het gesprek over?" /></label>
          <div className="participation-field-pair">
            <label>Datum *<input type="date" value={draft.occurred_on} required onChange={event => change("occurred_on", event.target.value)} /></label>
            <label>Contactvorm<select value={draft.contact_type} onChange={event => change("contact_type", event.target.value as ContactType)}>{Object.entries(contactLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          </div>
          <div className="participation-field-pair">
            <Options label="Uitvoerders" options={meta.participants} previous={moment?.participants ?? []} selected={draft.participant_ids} onChange={ids => change("participant_ids", ids)} />
            <Options label="Projecten" options={meta.projects} previous={moment?.projects ?? []} selected={draft.project_ids} onChange={ids => change("project_ids", ids)} />
          </div>
          <label>Gesprekspartners<input value={draft.conversation_partners} maxLength={2000} onChange={event => change("conversation_partners", event.target.value)} placeholder="Met wie is er gesproken? Persoon, organisatie of groep" /></label>
          <label>Verslag *<textarea className="participation-report-input" value={draft.report} maxLength={30000} required onChange={event => change("report", event.target.value)} placeholder="Wat is besproken? Welke vragen, zorgen of ideeën kwamen naar voren?" /></label>
          <label>Afspraken en vervolg<textarea rows={3} value={draft.agreements} maxLength={10000} onChange={event => change("agreements", event.target.value)} placeholder="Wat is afgesproken, wie doet wat en wanneer?" /></label>
          <div className="participation-field-pair">
            <label>Locatie <span className="muted">(optioneel)</span><input value={draft.location} maxLength={240} onChange={event => change("location", event.target.value)} /></label>
            <label>Duur in minuten <span className="muted">(optioneel)</span><input type="number" min={1} max={1440} step={1} value={draft.duration_minutes ?? ""} onChange={event => change("duration_minutes", event.target.value ? Number(event.target.value) : null)} /></label>
          </div>
        </fieldset> : moment && <div className="participation-detail">
          <div className="participation-detail-meta"><span>{formatDate(moment.occurred_on)}</span><span>{contactLabels[moment.contact_type]}</span>{moment.duration_minutes && <span>{moment.duration_minutes} min.</span>}{moment.archived_at && <span>Gearchiveerd</span>}</div>
          <dl className="participation-detail-people"><div><dt>Uitgevoerd door</dt><dd>{moment.participants.map(person => person.name).join(", ")}</dd></div><div><dt>Projecten</dt><dd>{moment.projects.map(project => project.name).join(", ")}</dd></div>{moment.conversation_partners && <div><dt>Gesprekspartners</dt><dd>{moment.conversation_partners}</dd></div>}{moment.location && <div><dt>Locatie</dt><dd>{moment.location}</dd></div>}</dl>
          <section><h3>Verslag</h3><p className="participation-prose">{moment.report}</p></section>
          <section><h3>Afspraken en vervolg</h3><p className="participation-prose">{moment.agreements || "Geen afspraken vastgelegd."}</p></section>
          <p className="participation-record-meta">Vastgelegd door {moment.created_by_name} · Laatst gewijzigd {new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(moment.updated_at.endsWith("Z") || /[+-]\d\d:\d\d$/.test(moment.updated_at) ? moment.updated_at : `${moment.updated_at}Z`))}</p>
        </div>}
      </div>
      <footer className="participation-panel-footer">
        {confirmation ? <div className="participation-confirm" role="alert">
          <p>{confirmation === "discard" ? "Je hebt niet-opgeslagen wijzigingen. Wil je die weggooien?" : "Dit gesprek archiveren? Het blijft beschikbaar in het archief en kan worden hersteld."}</p>
          <MaterialButton variant="outlined" disabled={busy} onClick={() => setConfirmation(null)}>Terug</MaterialButton>
          <MaterialButton variant="danger" disabled={busy} onClick={confirmation === "discard" ? onClose : archive}>{confirmation === "discard" ? "Wijzigingen weggooien" : "Archiveren"}</MaterialButton>
        </div> : editing ? <>
          <span className="muted">* Verplicht</span><MaterialButton type="submit" disabled={busy}>{busy ? "Opslaan…" : "Verslag opslaan"}</MaterialButton>
        </> : <>
          {moment?.can_edit ? <MaterialButton variant="text" disabled={busy} onClick={() => moment.archived_at ? void archive() : setConfirmation("archive")}>{moment.archived_at ? "Herstellen" : "Archiveren"}</MaterialButton> : <span className="muted">Alleen-lezen</span>}
          {moment?.can_edit && !moment.archived_at && <MaterialButton onClick={() => setEditing(true)}>Verslag bewerken</MaterialButton>}
        </>}
      </footer>
    </form>
  </dialog>;
}
