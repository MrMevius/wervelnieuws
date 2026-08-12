import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import {
  archiveWorkExternalPerson,
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
import { formatAmsterdamDateTime } from "../../../lib/datetime";
import { AccessibleModal } from "./AccessibleModal";

const PAGE_SIZES = [25, 50, 100] as const;

export function WorkHoursHistoryAdminTab() {
  const queryClient = useQueryClient();
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<25 | 50 | 100>(25);
  const [historyKind, setHistoryKind] = useState<"" | "post" | "external_person" | "historical_identity">("");
  const [historyQueryText, setHistoryQueryText] = useState("");
  const [editingPerson, setEditingPerson] = useState<WorkHourExternalPerson | null>(null);
  const [mergeSource, setMergeSource] = useState<WorkHourExternalPerson | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const historyParams = { page: historyPage, page_size: historyPageSize, kind: historyKind || undefined, query: historyQueryText.trim() || undefined, sort_key: "display_name" as const, sort_direction: "asc" as const };
  const historyQuery = useQuery({ queryKey: ["work-hours-admin-history", historyParams], queryFn: () => listWorkHoursAdminHistory(historyParams) });
  const masterdataQuery = useQuery({ queryKey: ["work-hours-admin-masterdata"], queryFn: listWorkHoursAdminMasterdata });
  const metaQuery = useQuery({ queryKey: ["work-hours-meta"], queryFn: listWorkHoursMeta });
  const people = masterdataQuery.data?.external_people ?? [];
  const eligibleUsers = metaQuery.data?.eligible_users ?? [];
  const invalidatePeopleMeta = () => queryClient.invalidateQueries({ queryKey: ["work-hours-meta"] });
  const updateMutation = useMutation({ mutationFn: ({ personId, payload }: { personId: string; payload: Parameters<typeof updateWorkExternalPerson>[1] }) => updateWorkExternalPerson(personId, payload), onSuccess: async () => { setEditingPerson(null); await invalidatePeopleMeta(); } });
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

  return <section aria-labelledby="work-hours-history-heading">
    <h2 id="work-hours-history-heading">Urenhistorie en identiteiten</h2>
    {statusMessage && <p className="notice success" role="status">{statusMessage}</p>}
    {errorMessage && !mergeSource && <p className="notice error" role="alert">{errorMessage}</p>}
    <section className="panel"><h3>Externe personen</h3><ul>{people.map((person) => <li key={person.id}>{person.display_name} {person.deleted_at ? "· verwijderd" : ""}<button type="button" onClick={() => setEditingPerson(person)}>Bewerk</button><button type="button" onClick={() => { setMergeSource(person); setMergeTargetId(""); }}>Samenvoegen</button><button type="button" onClick={() => archiveMutation.mutate(person)}>Archiveer</button><button type="button" onClick={() => restoreMutation.mutate(person)}>Herstel</button></li>)}</ul></section>
    <section className="panel"><h3>Historie en identiteiten</h3><p className="muted">Alleen beheerders zien verwijderde personen en historische koppelingen.</p><div className="form-grid"><label><span>Type historie</span><select value={historyKind} onChange={(event) => { setHistoryKind(event.target.value as typeof historyKind); setHistoryPage(1); }}><option value="">Alles</option><option value="post">Posten</option><option value="external_person">Externe personen</option><option value="historical_identity">Historische identiteiten</option></select></label><label><span>Zoek historie</span><input value={historyQueryText} onChange={(event) => { setHistoryQueryText(event.target.value); setHistoryPage(1); }} /></label><label><span>Historie per pagina</span><select value={historyPageSize} onChange={(event) => { setHistoryPageSize(Number(event.target.value) as 25 | 50 | 100); setHistoryPage(1); }}>{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label></div><ul>{(historyQuery.data?.items ?? []).map((item) => <li key={`${item.kind}-${item.id}`}>{item.display_name || item.id} · {item.kind.replace("_", " ")}{item.kind === "external_person" && <button type="button" onClick={() => restoreMutation.mutate({ id: item.id, display_name: item.display_name, row_version: item.row_version })}>Herstel persoon</button>}{item.kind === "historical_identity" && eligibleUsers[0] && <button type="button" onClick={() => relinkMutation.mutate({ identityId: item.id, userId: eligibleUsers[0].id, rowVersion: item.row_version })}>Koppel aan {eligibleUsers[0].full_name || eligibleUsers[0].username}</button>}</li>)}</ul><div className="section-actions"><button type="button" disabled={historyPage <= 1} onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}>Vorige historiepagina</button><span>Historiepagina {historyPage}</span><button type="button" disabled={historyPage * historyPageSize >= (historyQuery.data?.total ?? 0)} onClick={() => setHistoryPage((current) => current + 1)}>Volgende historiepagina</button></div></section>
    {editingPerson && <AccessibleModal title="Externe persoon bewerken" onClose={() => setEditingPerson(null)} committing={updateMutation.isPending}><form onSubmit={savePerson} className="form-grid"><label><span>Naam</span><input name="display_name" defaultValue={editingPerson.display_name} /></label><label><span>E-mail</span><input name="email" defaultValue={editingPerson.email ?? ""} /></label><label className="span-2"><span>Notitie</span><textarea name="note" rows={3} defaultValue={editingPerson.note} /></label><div className="section-actions span-2"><button type="submit">Opslaan</button><button type="button" onClick={() => setEditingPerson(null)}>Annuleren</button></div></form></AccessibleModal>}
    {mergeSource && <AccessibleModal title="Externe personen samenvoegen" onClose={() => setMergeSource(null)} committing={mergeMutation.isPending}>{errorMessage && <p className="notice error" role="alert">{errorMessage}</p>}<label><span>Doelpersoon</span><select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}><option value="">Kies een andere persoon</option>{people.filter((person) => person.id !== mergeSource.id && person.is_active).map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label><div className="section-actions"><button type="button" disabled={!mergeTargetId || mergeMutation.isPending} onClick={() => { const target = people.find((person) => person.id === mergeTargetId); if (target) mergeMutation.mutate({ personId: mergeSource.id, payload: { target_id: target.id, expected_source_row_version: mergeSource.row_version, expected_target_row_version: target.row_version } }); }}>Samenvoegen</button><button type="button" disabled={mergeMutation.isPending} onClick={() => setMergeSource(null)}>Annuleren</button></div></AccessibleModal>}
  </section>;
}

export function WorkHoursAuditAdminTab() {
  const [filters, setFilters] = useState({ actor: "", action: "", result: "", method: "", path: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
  const auditQuery = useQuery({ queryKey: ["work-hours-audit", filters, page, pageSize], queryFn: () => listWorkHoursAudit({ ...filters, page, page_size: pageSize }) });
  const events = Array.isArray(auditQuery.data) ? auditQuery.data : (auditQuery.data?.items ?? []);
  const updateFilter = (field: keyof typeof filters, value: string) => { setFilters((current) => ({ ...current, [field]: value })); setPage(1); };
  return <section aria-labelledby="work-hours-audit-heading"><h2 id="work-hours-audit-heading">Uren-audit</h2><div className="form-grid" aria-label="Auditfilters"><label><span>Actor-ID</span><input value={filters.actor} onChange={(event) => updateFilter("actor", event.target.value)} /></label><label><span>Actie</span><input value={filters.action} onChange={(event) => updateFilter("action", event.target.value)} /></label><label><span>Resultaat</span><input value={filters.result} onChange={(event) => updateFilter("result", event.target.value)} /></label><label><span>HTTP-methode</span><input value={filters.method} onChange={(event) => updateFilter("method", event.target.value)} /></label><label><span>Requestpad</span><input value={filters.path} onChange={(event) => updateFilter("path", event.target.value)} /></label><label><span>Vanaf</span><input type="datetime-local" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} /></label><label><span>Tot en met</span><input type="datetime-local" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} /></label><label><span>Auditregels per pagina</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as typeof pageSize); setPage(1); }}>{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label></div><ul>{events.map((event) => <li key={event.id}>{event.actor_display_name} · {formatAmsterdamDateTime(event.created_at)} · {event.action}{event.project_name ? ` · ${event.project_name}` : ""}{event.post_name ? ` · ${event.post_name}` : ""} · {event.request_method} {event.request_path} · {event.result}</li>)}</ul><div className="section-actions"><button type="button" disabled={page <= 1 || (auditQuery.data?.total ?? 0) === 0} onClick={() => setPage((current) => Math.max(1, current - 1))}>Vorige auditpagina</button><span>Auditpagina {auditQuery.data?.page ?? page} van {Math.max(1, Math.ceil((auditQuery.data?.total ?? 0) / pageSize))} · totaal {auditQuery.data?.total ?? 0}</span><button type="button" disabled={page * pageSize >= (auditQuery.data?.total ?? 0)} onClick={() => setPage((current) => current + 1)}>Volgende auditpagina</button></div></section>;
}
