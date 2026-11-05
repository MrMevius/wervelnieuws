import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import {
  archiveWorkExternalPerson,
  createWorkExternalPerson,
  listWorkHoursAdminHistory,
  listWorkHoursAdminMasterdata,
  listWorkHoursMeta,
  listWorkHoursAudit,
  mergeWorkExternalPerson,
  relinkWorkHistoricalIdentity,
  restoreWorkExternalPerson,
  updateWorkExternalPerson,
  type WorkHourExternalPerson
} from "../../../lib/api/client";
import { ResponsiveRow, ResponsiveTable } from "../../../design-system/ResponsiveTable";
import { formatAmsterdamDateTime } from "../../../lib/datetime";
import { AccessibleModal } from "./AccessibleModal";

const PAGE_SIZES = [25, 50, 100] as const;

const HISTORY_KIND_LABELS = { post: "Post", external_person: "Externe persoon", historical_identity: "Historische identiteit" } as const;

function externalPersonStatus(person: WorkHourExternalPerson) {
  if (person.deleted_at) return { label: "Gearchiveerd", tone: "muted" as const };
  if (person.is_active === false) return { label: "Inactief", tone: "muted" as const };
  return { label: "Actief", tone: "active" as const };
}

type DuplicateCandidate = { id: string; display_name: string; email?: string | null; status_label?: string; selectable?: boolean; guidance?: string | null };
type CreateConflict = { code?: string; message: string; candidates: DuplicateCandidate[] };

function parseCreateConflict(error: unknown): CreateConflict | null {
  if (!(error instanceof Error)) return null;
  try {
    const body = JSON.parse(error.message) as { detail?: { code?: string; message?: string; candidates?: DuplicateCandidate[] } };
    const detail = body.detail;
    if (!detail?.message) return null;
    return { code: detail.code, message: detail.message, candidates: detail.candidates ?? [] };
  } catch {
    return null;
  }
}

export function WorkHoursHistoryAdminTab() {
  const queryClient = useQueryClient();
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<25 | 50 | 100>(25);
  const [historyKind, setHistoryKind] = useState<"" | "post" | "external_person" | "historical_identity">("");
  const [historyQueryText, setHistoryQueryText] = useState("");
  const [editingPerson, setEditingPerson] = useState<WorkHourExternalPerson | null>(null);
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [mergeSource, setMergeSource] = useState<WorkHourExternalPerson | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createConflict, setCreateConflict] = useState<CreateConflict | null>(null);
  const [createDraft, setCreateDraft] = useState({ display_name: "", email: "", note: "" });
  const historyParams = { page: historyPage, page_size: historyPageSize, kind: historyKind || undefined, query: historyQueryText.trim() || undefined, sort_key: "display_name" as const, sort_direction: "asc" as const };
  const historyQuery = useQuery({ queryKey: ["work-hours-admin-history", historyParams], queryFn: () => listWorkHoursAdminHistory(historyParams) });
  const masterdataQuery = useQuery({ queryKey: ["work-hours-admin-masterdata"], queryFn: listWorkHoursAdminMasterdata });
  const metaQuery = useQuery({ queryKey: ["work-hours-meta"], queryFn: listWorkHoursMeta });
  const people = masterdataQuery.data?.external_people ?? [];
  const eligibleUsers = metaQuery.data?.eligible_users ?? [];
  const historyItems = historyQuery.data?.items ?? [];
  const historyTotal = historyQuery.data?.total ?? 0;
  const historyPageCount = Math.max(1, Math.ceil(historyTotal / historyPageSize));
  const invalidatePeopleMeta = async () => {
    await queryClient.invalidateQueries({ queryKey: ["work-hours-meta"] });
    await queryClient.invalidateQueries({ queryKey: ["work-hours-admin-masterdata"] });
    await queryClient.invalidateQueries({ queryKey: ["work-hours-admin-history"] });
  };
  const updateMutation = useMutation({ mutationFn: ({ personId, payload }: { personId: string; payload: Parameters<typeof updateWorkExternalPerson>[1] }) => updateWorkExternalPerson(personId, payload), onSuccess: async () => { setEditingPerson(null); await invalidatePeopleMeta(); } });
  const createMutation = useMutation({ mutationFn: createWorkExternalPerson, onSuccess: async (person) => { setCreatingPerson(false); setStatusMessage(`Externe persoon ${person.display_name} is aangemaakt.`); setErrorMessage(null); setCreateErrors({}); setCreateConflict(null); await queryClient.invalidateQueries({ queryKey: ["work-hours-admin-masterdata"] }); await invalidatePeopleMeta(); }, onError: (error) => { const conflict = parseCreateConflict(error); setCreateConflict(conflict); setErrorMessage(conflict?.message ?? "Aanmaken mislukt. Controleer de ingevulde gegevens."); } });
  const archiveMutation = useMutation({ mutationFn: (person: WorkHourExternalPerson) => archiveWorkExternalPerson(person.id, person.row_version ?? 1), onSuccess: invalidatePeopleMeta });
  const restoreMutation = useMutation({ mutationFn: (person: WorkHourExternalPerson) => restoreWorkExternalPerson(person.id, person.row_version ?? 1), onSuccess: invalidatePeopleMeta });
  const mergeMutation = useMutation({ mutationFn: ({ personId, payload }: { personId: string; payload: Parameters<typeof mergeWorkExternalPerson>[1] }) => mergeWorkExternalPerson(personId, payload), onSuccess: async () => { setMergeSource(null); setStatusMessage("Externe personen zijn samengevoegd."); await invalidatePeopleMeta(); await queryClient.invalidateQueries({ queryKey: ["work-hours-groups"] }); }, onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Samenvoegen mislukt") });
  const relinkMutation = useMutation({ mutationFn: ({ identityId, userId, rowVersion }: { identityId: string; userId: string; rowVersion: number }) => relinkWorkHistoricalIdentity(identityId, userId, rowVersion), onSuccess: async () => { setStatusMessage("Historische identiteit gekoppeld; de snapshot blijft behouden."); await queryClient.invalidateQueries({ queryKey: ["work-hours-admin-history"] }); await queryClient.invalidateQueries({ queryKey: ["work-hours-audit"] }); }, onError: (error) => setErrorMessage(error instanceof Error ? error.message : "Koppelen mislukt") });

  function savePerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPerson) return;
    const data = new FormData(event.currentTarget);
    updateMutation.mutate({ personId: editingPerson.id, payload: { display_name: String(data.get("display_name") ?? editingPerson.display_name), email: String(data.get("email") ?? editingPerson.email ?? "") || null, note: String(data.get("note") ?? editingPerson.note), expected_row_version: editingPerson.row_version } });
  }

  function createPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (createDraft.display_name.trim().length < 2) errors.display_name = "Vul een naam van minimaal 2 tekens in.";
    if (createDraft.email && !/^\S+@\S+\.\S+$/.test(createDraft.email)) errors.email = "Vul een geldig e-mailadres in of laat dit veld leeg.";
    setCreateErrors(errors);
    setCreateConflict(null);
    if (Object.keys(errors).length) return;
    createMutation.mutate({ display_name: createDraft.display_name.trim(), email: createDraft.email.trim() || null, note: createDraft.note.trim(), force_create: false });
  }

  function forceCreatePerson() {
    createMutation.mutate({ display_name: createDraft.display_name.trim(), email: createDraft.email.trim() || null, note: createDraft.note.trim(), force_create: true });
  }

  return <section aria-labelledby="work-hours-history-heading">
    <header className="admin-users-header">
      <h2 id="work-hours-history-heading">Urenhistorie en identiteiten</h2>
      <p className="muted">Beheer externe personen voor de urenregistratie en herstel of koppel historische gegevens.</p>
    </header>
    {statusMessage && <p className="notice success" role="status">{statusMessage}</p>}
    {errorMessage && !mergeSource && <p className="notice error" role="alert">{errorMessage}</p>}
    <section className="admin-users-table-section" aria-labelledby="work-hours-people-heading">
      <div className="admin-section-heading-row">
        <div className="admin-users-table-heading-row">
          <h3 id="work-hours-people-heading">Externe personen</h3>
          <p className="muted">Personen zonder account die aan urenregistraties gekoppeld kunnen worden.</p>
        </div>
        <button type="button" className="button-primary" onClick={() => { setCreatingPerson(true); setErrorMessage(null); setCreateErrors({}); setCreateConflict(null); setCreateDraft({ display_name: "", email: "", note: "" }); }}>Externe persoon aanmaken</button>
      </div>
      {people.length ? <div className="table-wrap"><ResponsiveTable className="admin-people-table"><thead><ResponsiveRow><th>Naam</th><th>E-mail</th><th>Status</th><th>Acties</th></ResponsiveRow></thead><tbody>
        {people.map((person) => {
          const status = externalPersonStatus(person);
          const isRemoved = status.tone !== "active";
          return <ResponsiveRow key={person.id} className={isRemoved ? "is-inactive" : undefined}>
            <td><span className="admin-people-name">{person.display_name}</span>{person.note && <span className="admin-people-note muted">{person.note}</span>}</td>
            <td>{person.email || <span className="muted">-</span>}</td>
            <td><span className={`status-badge status-badge-${status.tone}`}>{status.label}</span></td>
            <td><div className="admin-user-actions" aria-label={`Acties voor ${person.display_name}`}>
              <button type="button" className="button-neutral admin-user-action-compact" onClick={() => setEditingPerson(person)}>Bewerk</button>
              {isRemoved
                ? <button type="button" className="button-neutral admin-user-action-compact" onClick={() => restoreMutation.mutate(person)} disabled={restoreMutation.isPending}>Herstel</button>
                : <>
                  <button type="button" className="button-neutral admin-user-action-compact" onClick={() => { setMergeSource(person); setMergeTargetId(""); }}>Samenvoegen</button>
                  <button type="button" className="button-danger admin-user-action-compact" onClick={() => archiveMutation.mutate(person)} disabled={archiveMutation.isPending}>Archiveer</button>
                </>}
            </div></td>
          </ResponsiveRow>;
        })}
      </tbody></ResponsiveTable></div> : <p className="admin-empty-state muted">{masterdataQuery.isLoading ? "Externe personen laden..." : "Er zijn nog geen externe personen."}</p>}
    </section>
    <section className="admin-users-table-section admin-history-section" aria-labelledby="work-hours-identities-heading">
      <div className="admin-users-table-heading-row">
        <h3 id="work-hours-identities-heading">Historie en identiteiten</h3>
        <p className="muted">Alleen beheerders zien verwijderde personen en historische koppelingen.</p>
      </div>
      <div className="admin-history-filters">
        <label className="admin-field"><span>Type historie</span><select value={historyKind} onChange={(event) => { setHistoryKind(event.target.value as typeof historyKind); setHistoryPage(1); }}><option value="">Alles</option><option value="post">Posten</option><option value="external_person">Externe personen</option><option value="historical_identity">Historische identiteiten</option></select></label>
        <label className="admin-field admin-history-search"><span>Zoek historie</span><input type="search" placeholder="Zoek op naam" value={historyQueryText} onChange={(event) => { setHistoryQueryText(event.target.value); setHistoryPage(1); }} /></label>
        <label className="admin-field"><span>Historie per pagina</span><select value={historyPageSize} onChange={(event) => { setHistoryPageSize(Number(event.target.value) as 25 | 50 | 100); setHistoryPage(1); }}>{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>
      {historyItems.length ? <div className="table-wrap"><ResponsiveTable className="admin-history-table"><thead><ResponsiveRow><th>Naam</th><th>Type</th><th>Actie</th></ResponsiveRow></thead><tbody>
        {historyItems.map((item) => <ResponsiveRow key={`${item.kind}-${item.id}`}>
          <td>{item.display_name || item.id}</td>
          <td><span className="status-badge status-badge-muted">{HISTORY_KIND_LABELS[item.kind]}</span></td>
          <td><div className="admin-user-actions">
            {item.kind === "external_person" && <button type="button" className="button-neutral admin-user-action-compact" onClick={() => restoreMutation.mutate({ id: item.id, display_name: item.display_name, row_version: item.row_version })}>Herstel persoon</button>}
            {item.kind === "historical_identity" && eligibleUsers[0] && <button type="button" className="button-neutral admin-user-action-compact" onClick={() => relinkMutation.mutate({ identityId: item.id, userId: eligibleUsers[0].id, rowVersion: item.row_version })}>Koppel aan {eligibleUsers[0].full_name || eligibleUsers[0].username}</button>}
          </div></td>
        </ResponsiveRow>)}
      </tbody></ResponsiveTable></div> : <p className="admin-empty-state muted">{historyQuery.isLoading ? "Historie laden..." : "Geen historie gevonden voor deze selectie."}</p>}
      <div className="admin-pagination">
        <button type="button" className="button-neutral admin-user-action-compact" disabled={historyPage <= 1} onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}>Vorige historiepagina</button>
        <span className="muted">Pagina {historyPage} van {historyPageCount}{historyTotal ? ` · ${historyTotal} resultaten` : ""}</span>
        <button type="button" className="button-neutral admin-user-action-compact" disabled={historyPage * historyPageSize >= historyTotal} onClick={() => setHistoryPage((current) => current + 1)}>Volgende historiepagina</button>
      </div>
    </section>
    {editingPerson && <AccessibleModal title="Externe persoon bewerken" onClose={() => setEditingPerson(null)} committing={updateMutation.isPending}><form onSubmit={savePerson} className="form-grid"><label><span>Naam</span><input name="display_name" defaultValue={editingPerson.display_name} /></label><label><span>E-mail</span><input name="email" defaultValue={editingPerson.email ?? ""} /></label><label className="span-2"><span>Notitie</span><textarea name="note" rows={3} defaultValue={editingPerson.note} /></label><div className="section-actions span-2"><button type="submit">Opslaan</button><button type="button" onClick={() => setEditingPerson(null)}>Annuleren</button></div></form></AccessibleModal>}
    {creatingPerson && <AccessibleModal title="Externe persoon aanmaken" onClose={() => setCreatingPerson(false)} committing={createMutation.isPending}>{errorMessage && <p className="notice error" role="alert">{errorMessage}</p>}<form onSubmit={createPerson} className="form-grid" noValidate><label><span>Naam</span><input name="display_name" value={createDraft.display_name} aria-invalid={Boolean(createErrors.display_name)} aria-describedby={createErrors.display_name ? "external-person-name-error" : undefined} onChange={(event) => { setCreateDraft((current) => ({ ...current, display_name: event.target.value })); setCreateErrors((current) => ({ ...current, display_name: "" })); }} />{createErrors.display_name && <span id="external-person-name-error" className="field-error">{createErrors.display_name}</span>}</label><label><span>E-mail (optioneel)</span><input name="email" value={createDraft.email} aria-invalid={Boolean(createErrors.email)} aria-describedby={createErrors.email ? "external-person-email-error" : undefined} onChange={(event) => { setCreateDraft((current) => ({ ...current, email: event.target.value })); setCreateErrors((current) => ({ ...current, email: "" })); }} />{createErrors.email && <span id="external-person-email-error" className="field-error">{createErrors.email}</span>}</label><label className="span-2"><span>Notitie (optioneel)</span><textarea name="note" rows={3} value={createDraft.note} onChange={(event) => setCreateDraft((current) => ({ ...current, note: event.target.value }))} /></label>{createConflict && <section className={`notice ${createConflict.code === "work_hours_external_person_hard_conflict" ? "error" : "warning"}`} aria-label="Mogelijke dubbele personen"><p>{createConflict.code === "work_hours_external_person_hard_conflict" ? "Deze persoon kan niet worden aangemaakt omdat het e-mailadres al bestaat." : "Controleer eerst deze mogelijke dubbele personen."}</p><ul>{createConflict.candidates.map((candidate) => <li key={candidate.id}>{candidate.display_name}{candidate.email ? ` · ${candidate.email}` : ""}{candidate.status_label ? ` · ${candidate.status_label}` : ""}{candidate.guidance ? ` · ${candidate.guidance}` : ""}</li>)}</ul>{createConflict.code === "work_hours_external_person_advisory_conflict" && <button type="button" onClick={forceCreatePerson} disabled={createMutation.isPending}>Bewust toch aanmaken</button>}</section>}<div className="section-actions span-2"><button type="submit" disabled={createMutation.isPending}>Opslaan</button><button type="button" onClick={() => setCreatingPerson(false)} disabled={createMutation.isPending}>Annuleren</button></div></form></AccessibleModal>}
    {mergeSource && <AccessibleModal title="Externe personen samenvoegen" onClose={() => setMergeSource(null)} committing={mergeMutation.isPending}>{errorMessage && <p className="notice error" role="alert">{errorMessage}</p>}<label><span>Doelpersoon</span><select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}><option value="">Kies een andere persoon</option>{people.filter((person) => person.id !== mergeSource.id && person.is_active).map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label><div className="section-actions"><button type="button" disabled={!mergeTargetId || mergeMutation.isPending} onClick={() => { const target = people.find((person) => person.id === mergeTargetId); if (target) mergeMutation.mutate({ personId: mergeSource.id, payload: { target_id: target.id, expected_source_row_version: mergeSource.row_version, expected_target_row_version: target.row_version } }); }}>Samenvoegen</button><button type="button" disabled={mergeMutation.isPending} onClick={() => setMergeSource(null)}>Annuleren</button></div></AccessibleModal>}
  </section>;
}

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  group: "Urenregistratie",
  post: "Post",
  project: "Project",
  external_person: "Externe persoon",
  historical_identity: "Historische identiteit",
  authorization: "Toegang"
};

const AUDIT_VERB_LABELS: Record<string, string> = {
  created: "aangemaakt",
  updated: "bijgewerkt",
  deleted: "verwijderd",
  restored: "hersteld",
  archived: "gearchiveerd",
  merged: "samengevoegd",
  relinked: "gekoppeld",
  denied: "geweigerd"
};

const AUDIT_ACTIONS = [
  "work_hours.group.created", "work_hours.group.updated", "work_hours.group.deleted", "work_hours.group.restored",
  "work_hours.post.created", "work_hours.post.updated", "work_hours.post.archived", "work_hours.post.deleted", "work_hours.post.restored",
  "work_hours.project.created", "work_hours.project.updated", "work_hours.project.archived", "work_hours.project.deleted", "work_hours.project.restored",
  "work_hours.external_person.created", "work_hours.external_person.updated", "work_hours.external_person.merged", "work_hours.external_person.archived", "work_hours.external_person.restored",
  "work_hours.historical_identity.relinked",
  "work_hours.authorization.denied"
] as const;

const AUDIT_RESULTS: Record<string, { label: string; tone: "active" | "inactive" }> = {
  success: { label: "Gelukt", tone: "active" },
  denied: { label: "Geweigerd", tone: "inactive" }
};

const EMPTY_AUDIT_FILTERS = { actor: "", action: "", result: "", method: "", path: "", from: "", to: "" };

function auditActionLabel(action: string) {
  const [, entity, verb] = action.split(".");
  const entityLabel = entity ? AUDIT_ENTITY_LABELS[entity] : undefined;
  const verbLabel = verb ? AUDIT_VERB_LABELS[verb] : undefined;
  return entityLabel && verbLabel ? `${entityLabel} ${verbLabel}` : action;
}

export function WorkHoursAuditAdminTab() {
  const [filters, setFilters] = useState(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
  const auditQuery = useQuery({ queryKey: ["work-hours-audit", filters, page, pageSize], queryFn: () => listWorkHoursAudit({ ...filters, page, page_size: pageSize }) });
  const metaQuery = useQuery({ queryKey: ["work-hours-meta"], queryFn: listWorkHoursMeta });
  const events = Array.isArray(auditQuery.data) ? auditQuery.data : (auditQuery.data?.items ?? []);
  const total = auditQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Object.values(filters).some(Boolean);
  const actors = new Map<string, string>();
  (metaQuery.data?.eligible_users ?? []).forEach((user) => actors.set(user.id, user.full_name || user.display_name || user.username || user.id));
  events.forEach((event) => { if (event.actor_user_id && !actors.has(event.actor_user_id)) actors.set(event.actor_user_id, event.actor_display_name); });
  const actorOptions = [...actors].sort((left, right) => left[1].localeCompare(right[1], "nl"));
  const updateFilter = (field: keyof typeof filters, value: string) => { setFilters((current) => ({ ...current, [field]: value })); setPage(1); };
  return <section aria-labelledby="work-hours-audit-heading">
    <header className="admin-users-header">
      <h2 id="work-hours-audit-heading">Uren-audit</h2>
      <p className="muted">Wie wat heeft gewijzigd in de urenregistratie, nieuwste eerst.</p>
    </header>
    <section className="admin-users-table-section" aria-label="Auditregels">
      <div className="admin-audit-filters" aria-label="Auditfilters">
        <label className="admin-field"><span>Uitgevoerd door</span><select value={filters.actor} onChange={(event) => updateFilter("actor", event.target.value)}><option value="">Iedereen</option>{actorOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="admin-field"><span>Actie</span><select value={filters.action} onChange={(event) => updateFilter("action", event.target.value)}><option value="">Alle acties</option>{AUDIT_ACTIONS.map((action) => <option key={action} value={action}>{auditActionLabel(action)}</option>)}</select></label>
        <label className="admin-field"><span>Resultaat</span><select value={filters.result} onChange={(event) => updateFilter("result", event.target.value)}><option value="">Alle resultaten</option>{Object.entries(AUDIT_RESULTS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="admin-field"><span>HTTP-methode</span><select value={filters.method} onChange={(event) => updateFilter("method", event.target.value)}><option value="">Alle methodes</option>{["POST", "PUT", "PATCH", "DELETE"].map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
        <label className="admin-field admin-audit-path"><span>Requestpad</span><input type="search" placeholder="Bijv. groepen" value={filters.path} onChange={(event) => updateFilter("path", event.target.value)} /></label>
        <label className="admin-field"><span>Vanaf</span><input type="datetime-local" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} /></label>
        <label className="admin-field"><span>Tot en met</span><input type="datetime-local" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} /></label>
        <div className="admin-audit-filter-actions"><button type="button" className="button-neutral admin-user-action-compact" disabled={!hasFilters} onClick={() => { setFilters(EMPTY_AUDIT_FILTERS); setPage(1); }}>Filters wissen</button></div>
      </div>
      {events.length ? <div className="table-wrap"><ResponsiveTable className="admin-audit-table"><thead><ResponsiveRow><th>Tijdstip</th><th>Door</th><th>Actie</th><th>Onderwerp</th><th>Request</th><th>Resultaat</th></ResponsiveRow></thead><tbody>
        {events.map((event) => {
          const result = AUDIT_RESULTS[event.result];
          const subject = [event.project_name, event.post_name].filter(Boolean).join(" · ");
          return <ResponsiveRow key={event.id}>
            <td className="admin-audit-time">{formatAmsterdamDateTime(event.created_at)}</td>
            <td>{event.actor_display_name}</td>
            <td><span className="admin-audit-action" title={event.action}>{auditActionLabel(event.action)}</span></td>
            <td>{subject || <span className="muted">-</span>}</td>
            <td><span className="admin-audit-request"><span className="admin-audit-method">{event.request_method || "-"}</span><code title={event.request_path}>{event.request_path}</code></span></td>
            <td><span className={`status-badge status-badge-${result?.tone ?? "muted"}`}>{result?.label ?? (event.result || "Onbekend")}</span></td>
          </ResponsiveRow>;
        })}
      </tbody></ResponsiveTable></div> : <p className="admin-empty-state muted">{auditQuery.isLoading ? "Auditregels laden..." : hasFilters ? "Geen auditregels gevonden voor deze filters." : "Er zijn nog geen auditregels."}</p>}
      <div className="admin-pagination admin-audit-pagination">
        <label className="admin-audit-page-size"><span className="muted">Auditregels per pagina</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as typeof pageSize); setPage(1); }}>{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        <button type="button" className="button-neutral admin-user-action-compact" disabled={page <= 1 || total === 0} onClick={() => setPage((current) => Math.max(1, current - 1))}>Vorige auditpagina</button>
        <span className="muted">Pagina {auditQuery.data?.page ?? page} van {pageCount} · {total} {total === 1 ? "regel" : "regels"}</span>
        <button type="button" className="button-neutral admin-user-action-compact" disabled={page * pageSize >= total} onClick={() => setPage((current) => current + 1)}>Volgende auditpagina</button>
      </div>
    </section>
  </section>;
}
