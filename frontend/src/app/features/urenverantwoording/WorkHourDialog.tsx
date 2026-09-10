import { useEffect, useRef, useState, type FormEvent } from "react";
import { MaterialButton } from "../../../design-system/MaterialButton";
import { createWorkHourGroup, updateWorkHourGroup, type WorkHourGroup, type WorkHourMeta, type WorkHourEligibleUser } from "../../../lib/api/client";
import { formatAmsterdamDateInput } from "../../../lib/datetime";
import { formatHours, formatMinutes, minutesForGroup, parseDuration, workHoursError } from "./workHoursFormat";

type PersonChoice = { key: string; name: string; existingId?: string; user?: WorkHourEligibleUser; historical?: boolean };
const userName = (user: WorkHourEligibleUser) => user.display_name || user.full_name || user.username || "Gebruiker";

function personChoices(meta: WorkHourMeta, group?: WorkHourGroup): PersonChoice[] {
  const previous = (group?.participants ?? []).map(person => ({
    key: person.user_id ? `user:${person.user_id}` : `existing:${person.id}`,
    name: person.display_name_snapshot, existingId: person.id,
    historical: person.participant_kind === "external_person" || person.participant_kind === "historical_identity",
  }));
  const users = meta.eligible_users.filter(user => user.selectable !== false && !previous.some(person => person.key === `user:${user.id}`))
    .map(user => ({ key: `user:${user.id}`, name: userName(user), user }));
  return [...previous, ...users];
}

export function WorkHourDialog({ meta, currentUserId, group: initialGroup, onClose, onSaved }: {
  meta: WorkHourMeta; currentUserId: string; group?: WorkHourGroup; onClose: () => void; onSaved: () => void;
}) {
  const [group] = useState(initialGroup);
  const [choices] = useState(() => personChoices(meta, group));
  const [baseline] = useState(() => {
    const minutes = group ? minutesForGroup(group) : 30;
    return {
      date: group?.work_date ?? formatAmsterdamDateInput(),
      time: group ? group.start_time ?? "" : new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()),
      project: group?.project_id ?? "", post: group?.post_id ?? "", description: group?.description ?? "",
      duration: String(minutes >= 60 && minutes % 60 === 0 ? minutes / 60 : minutes), unit: minutes >= 60 && minutes % 60 === 0 ? "hours" as const : "minutes" as const,
      people: group ? choices.filter(person => person.existingId).map(person => person.key) : choices.filter(person => person.user?.id === currentUserId).map(person => person.key),
    };
  });
  const [draft, setDraft] = useState(baseline);
  const [personSearch, setPersonSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const minutes = parseDuration(draft.duration, draft.unit);
  const projects = meta.projects.filter(item => item.selectable !== false);
  const posts = meta.posts.filter(item => item.selectable !== false);
  const historicalProject = group && !projects.some(item => item.id === group.project_id);
  const historicalPost = group?.post_id && !posts.some(item => item.id === group.post_id);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = overflow; returnFocus.current?.focus(); };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: "" }));
  }
  function close() { if (!busy) { if (dirty) setConfirmClose(true); else onClose(); } }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (!draft.date || draft.date > formatAmsterdamDateInput()) nextErrors.date = "Kies een datum die niet in de toekomst ligt.";
    if ((!group && !draft.time) || (draft.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))) nextErrors.time = "Vul een geldige begintijd in.";
    if (!minutes) nextErrors.duration = "Vul een duur van 1 minuut tot 24 uur in, met hele minuten (bijvoorbeeld 1,5 uur).";
    if (!draft.project) nextErrors.project = "Kies een project.";
    if (!draft.people.length) nextErrors.people = "Selecteer minimaal één persoon.";
    setErrors(nextErrors); setServerError("");
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const selected = draft.people.map(key => choices.find(person => person.key === key)!);
    const payload = { work_date: draft.date, start_time: draft.time || null, project_id: draft.project, post_id: draft.post || null, description: draft.description.trim(), duration_minutes: minutes! };
    const newPerson = (person: PersonChoice, index: number) => ({
      participant_kind: "live_user" as const, user_id: person.user!.id,
      display_name_snapshot: person.name, display_type_snapshot: "WindWilly-gebruiker", sort_order: index,
    });
    setBusy(true);
    try {
      if (group) await updateWorkHourGroup(group.id, { ...payload, expected_row_version: group.row_version,
        // Preserve existing participant IDs without resubmitting historical
        // identity fields that are intentionally absent from public responses.
        participants: selected.map((person, index) => person.existingId ? { id: person.existingId, sort_order: index } : newPerson(person, index)),
      });
      else await createWorkHourGroup({ ...payload, participants: selected.map(newPerson) });
      onSaved();
    } catch (error) { setServerError(workHoursError(error)); }
    finally { setBusy(false); }
  }

  const fieldError = (key: string) => errors[key] ? <small className="hours-field-error" id={`hours-${key}-error`}>{errors[key]}</small> : null;
  const invalid = (key: string) => ({ "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `hours-${key}-error` : undefined });
  return <dialog ref={dialog} className="hours-entry-dialog" aria-labelledby="hours-entry-title" onCancel={event => { event.preventDefault(); close(); }}>
    <form noValidate onSubmit={save}>
      <header className="hours-entry-header"><div><p>URENREGISTRATIE</p><h2 id="hours-entry-title">{group ? "Registratie bewerken" : "Uren registreren"}</h2></div><MaterialButton variant="icon" disabled={busy} aria-label="Registratie sluiten" onClick={close}><span className="hours-close" aria-hidden="true">×</span></MaterialButton></header>
      <div className="hours-entry-body">
        {serverError && <p role="alert" className="hours-field-error">{serverError}</p>}
        <fieldset disabled={busy} className="hours-entry-fields">
          <div className="hours-field-row"><label>Datum<input autoFocus aria-label="Datum" type="date" required max={formatAmsterdamDateInput()} value={draft.date} {...invalid("date")} onChange={event => change("date", event.target.value)} />{fieldError("date")}</label><label>Begintijd<input aria-label="Begintijd" type="time" step={60} required={!group} value={draft.time} {...invalid("time")} onChange={event => change("time", event.target.value)} />{fieldError("time")}</label></div>
          <p className="hours-field-hint">Tijden in Nederland (Europe/Amsterdam).{group && !group.start_time && " Deze oudere registratie heeft nog geen begintijd."}</p>
          <section className="hours-duration-block" aria-labelledby="hours-duration-heading">
            <h3 id="hours-duration-heading">Hoe lang heb je gewerkt?</h3>
            <div className="hours-duration-control"><label className="hours-duration-value"><span className="sr-only">Duur</span><input type="text" inputMode="decimal" value={draft.duration} {...invalid("duration")} onChange={event => change("duration", event.target.value)} /></label><select aria-label="Eenheid van de duur" value={draft.unit} onChange={event => {
              const unit = event.target.value as "minutes" | "hours";
              setDraft(current => ({ ...current, unit, duration: minutes ? String(unit === "hours" ? minutes / 60 : minutes).replace(".", ",") : current.duration }));
            }}><option value="minutes">minuten</option><option value="hours">uren</option></select><span className="hours-per-person">per persoon</span></div>
            {fieldError("duration")}
            <div className="hours-duration-shortcuts" aria-label="Veelgebruikte duur">{[15, 30, 60, 120, 240].map(value => <MaterialButton key={value} variant={minutes === value ? "tonal" : "outlined"} size="compact" aria-pressed={minutes === value} disabled={busy} onClick={() => { setDraft(current => ({ ...current, duration: String(value >= 60 ? value / 60 : value), unit: value >= 60 ? "hours" : "minutes" })); setErrors(current => ({ ...current, duration: "" })); }}>{formatMinutes(value)}</MaterialButton>)}</div>
          </section>
          <div className="hours-field-row"><label>Project<select required value={draft.project} {...invalid("project")} onChange={event => change("project", event.target.value)}><option value="">Kies een project</option>{historicalProject && <option value={group.project_id}>{group.project_name} (historisch)</option>}{projects.map(project => <option key={project.id} value={project.id}>{project.display_name || project.name}</option>)}</select>{fieldError("project")}</label><label>Post <span className="hours-optional">optioneel</span><select aria-label="Post (optioneel)" value={draft.post} onChange={event => change("post", event.target.value)}><option value="">Geen post</option>{historicalPost && <option value={group.post_id!}>{group.post_name} (historisch)</option>}{posts.map(post => <option key={post.id} value={post.id}>{post.display_name || post.name}</option>)}</select></label></div>
          <fieldset className="hours-people" tabIndex={-1} {...invalid("people")}><legend>Wie hebben er gewerkt? <span>{draft.people.length} geselecteerd</span></legend>
            {choices.length > 6 && <input type="search" aria-label="Zoek personen" placeholder="Zoek een persoon…" value={personSearch} onChange={event => setPersonSearch(event.target.value)} />}
            <div className="hours-person-options">{choices.filter(person => person.name.toLocaleLowerCase().includes(personSearch.toLocaleLowerCase())).map(person => <label key={person.key} className={draft.people.includes(person.key) ? "is-selected" : ""}><input type="checkbox" checked={draft.people.includes(person.key)} onChange={event => change("people", event.target.checked ? [...draft.people, person.key] : draft.people.filter(key => key !== person.key))} /><span className="hours-person-avatar" aria-hidden="true">{person.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("")}</span><span>{person.name}{person.historical && <small>Historische deelnemer</small>}</span></label>)}</div>
            {fieldError("people")}
          </fieldset>
          <label>Wat heb je gedaan? <span className="hours-optional">optioneel</span><textarea aria-label="Beschrijving" rows={3} value={draft.description} placeholder="Bijvoorbeeld: overleg met omwonenden, voorbereiding of administratie" onChange={event => change("description", event.target.value)} /></label>
        </fieldset>
      </div>
      <footer className="hours-entry-footer">
        {confirmClose ? <div className="hours-discard" role="alert"><p>Je hebt niet-opgeslagen wijzigingen. Wil je die weggooien?</p><MaterialButton variant="outlined" onClick={() => setConfirmClose(false)}>Verder invullen</MaterialButton><MaterialButton variant="danger" onClick={onClose}>Wijzigingen weggooien</MaterialButton></div> : <>
          <div className="hours-save-summary" role="status">{minutes && draft.people.length ? <><strong>{formatMinutes(minutes)} × {draft.people.length} {draft.people.length === 1 ? "persoon" : "personen"}</strong><span>{formatHours(minutes * draft.people.length / 60)} persoon-uren totaal</span></> : <span>Vul de duur in en kies personen.</span>}</div>
          <MaterialButton type="submit" disabled={busy}>{busy ? "Opslaan…" : group ? "Wijzigingen opslaan" : "Registratie opslaan"}</MaterialButton>
        </>}
      </footer>
    </form>
  </dialog>;
}
