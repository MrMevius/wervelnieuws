import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MaterialButton } from "../../../design-system/MaterialButton";
import {
  getCurrentUser, listWorkHoursMeta, listWorkHourGroups, deleteWorkHourGroup, downloadWorkHoursCsv,
  type WorkHourGroup, type WorkHourQueryParams,
} from "../../../lib/api/client";
import { formatAmsterdamDisplayDate } from "../../../lib/datetime";
import { AccessibleModal } from "./AccessibleModal";
import { WorkHourDialog } from "./WorkHourDialog";
import { formatHours, formatMinutes, minutesForGroup, workHoursError } from "./workHoursFormat";
import "./work-hours.css";

const PAGE_SIZES = [25, 50, 100];

export function UrenverantwoordingPage() {
  const client = useQueryClient();
  const currentUser = useQuery({ queryKey: ["work-hours-current-user"], queryFn: getCurrentUser });
  const meta = useQuery({ queryKey: ["work-hours-meta"], queryFn: listWorkHoursMeta });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<WorkHourQueryParams>({});
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<WorkHourGroup | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkHourGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const query: WorkHourQueryParams = { ...filters, sort_key: "work_date", sort_direction: "desc", page, page_size: pageSize };
  const groups = useQuery({ queryKey: ["work-hours-groups", query], queryFn: () => listWorkHourGroups(query), placeholderData: keepPreviousData });
  const total = groups.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(filters.project_id || filters.work_date || filters.query);
  const canCreate = meta.data?.projects.some(project => project.selectable !== false) && currentUser.data;

  useEffect(() => {
    const timeout = window.setTimeout(() => { setFilters(previous => ({ ...previous, query: search || undefined })); setPage(1); }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (groups.data && !groups.isPlaceholderData && page > pages) setPage(pages);
  }, [groups.data, groups.isPlaceholderData, page, pages]);

  function filter(key: "project_id" | "work_date", value: string) {
    setFilters(previous => ({ ...previous, [key]: value || undefined })); setPage(1);
  }

  function saved() {
    setEditor(null); setFeedback("Registratie opgeslagen.");
    void client.invalidateQueries({ queryKey: ["work-hours-groups"] });
    void client.invalidateQueries({ queryKey: ["work-hours-meta"] });
  }

  async function remove() {
    if (!deleteTarget || deleting) return;
    setDeleting(true); setDeleteError("");
    try {
      await deleteWorkHourGroup(deleteTarget.id, deleteTarget.row_version);
      setDeleteTarget(null); setFeedback("Registratie verwijderd. Een beheerder kan deze herstellen.");
      void client.invalidateQueries({ queryKey: ["work-hours-groups"] });
      void client.invalidateQueries({ queryKey: ["work-hours-deleted-groups"] });
    } catch (error) { setDeleteError(workHoursError(error)); }
    finally { setDeleting(false); }
  }

  async function exportCsv() {
    setExporting(true); setError("");
    try {
      const blob = await downloadWorkHoursCsv({ ...filters, sort_key: "work_date", sort_direction: "desc" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "urenregistratie.csv";
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback("De volledige selectie is geëxporteerd naar CSV.");
    } catch (error) { setError(workHoursError(error)); }
    finally { setExporting(false); }
  }

  return <section className="hours-workspace" aria-labelledby="hours-page-heading">
    <header className="hours-page-heading"><div><h1 id="hours-page-heading">Urenregistratie</h1><p>Van een paar minuten tot een hele werkdag.</p></div><div className="hours-page-actions"><MaterialButton variant="outlined" disabled={exporting || groups.isFetching || groups.isError || !total || search !== (filters.query || "")} onClick={() => void exportCsv()}>{exporting ? "Exporteren…" : "CSV export"}</MaterialButton><MaterialButton disabled={!canCreate} onClick={() => { setFeedback(""); setEditor("new"); }}>＋ Uren registreren</MaterialButton></div></header>
    <div className="hours-overview-summary">
      <p><strong>{total}</strong> registraties <span aria-hidden="true">·</span> <strong>{formatHours(groups.data?.totals.total_person_hours ?? 0)}</strong> persoon-uren <span className="hours-summary-scope">{filtered ? "in deze selectie" : "in totaal"}</span></p>
      <details className="hours-project-totals"><summary>Per project <span aria-hidden="true">⌄</span></summary><section aria-label="Projecttotalen"><p>Persoon-uren in de selectie, over alle pagina’s.</p>{groups.data?.project_totals?.length ? <dl>{groups.data.project_totals.map(project => <div key={project.project_id}><dt>{project.project_name}</dt><dd>{formatHours(project.person_hours)} uur</dd></div>)}</dl> : <p>Geen projecttotalen.</p>}</section></details>
    </div>
    <div className="hours-list-filters" aria-label="Urenregistraties filteren"><label className="hours-list-search">Zoeken<input type="search" placeholder="Werk, project of post zoeken" value={search} onChange={event => setSearch(event.target.value)} /></label><label>Project<select value={filters.project_id || ""} onChange={event => filter("project_id", event.target.value)}><option value="">Alle projecten</option>{(meta.data?.filter_projects?.length ? meta.data.filter_projects : meta.data?.projects ?? []).map(project => <option key={project.id} value={project.id}>{project.display_name || project.name}</option>)}</select></label><label>Werkdatum<input type="date" value={filters.work_date || ""} onChange={event => filter("work_date", event.target.value)} /></label>{filtered && <MaterialButton variant="text" size="compact" onClick={() => { setFilters({}); setSearch(""); setPage(1); }}>Filters wissen</MaterialButton>}</div>
    {feedback && <p className="hours-feedback" role="status">{feedback}</p>}
    {(error || groups.isError || meta.isError || currentUser.isError) && <div className="hours-feedback hours-field-error" role="alert"><p>{error || workHoursError(groups.error || meta.error || currentUser.error)}</p><MaterialButton variant="outlined" onClick={() => { setError(""); void groups.refetch(); void meta.refetch(); void currentUser.refetch(); }}>Opnieuw proberen</MaterialButton></div>}
    {meta.data && !canCreate && <p className="hours-feedback">Geen actief urenproject beschikbaar. Vraag een beheerder om een project beschikbaar te maken.</p>}
    {(groups.isLoading || meta.isLoading) && <p className="hours-list-empty" role="status">Urenregistraties laden…</p>}
    {groups.data && !groups.isError && <>
      {groups.data.items.length ? <div className="hours-register" role="list" aria-label="Urenregistraties">
        <div className="hours-register-head" aria-hidden="true"><span>Datum & tijd</span><span>Werk & project</span><span>Personen</span><span>Duur per persoon</span><span /></div>
        {groups.data.items.map(group => <article className="hours-register-row" role="listitem" key={group.id}>
          <div className="hours-record-date"><time dateTime={group.work_date}>{formatAmsterdamDisplayDate(group.work_date)}</time><span>{group.start_time ? group.start_time + " uur" : "Tijd niet vastgelegd"}</span></div>
          <div className="hours-record-work"><h2>{group.description || group.project_name}</h2><p>{group.description ? group.project_name : ""}{group.post_name && <><span aria-hidden="true">{group.description ? " · " : ""}</span>{group.post_name}</>}</p></div>
          <div className="hours-record-people"><div className="hours-avatar-stack" aria-hidden="true">{group.participants.slice(0, 3).map(person => <span key={person.id}>{person.display_name_snapshot.split(/\s+/).map(part => part[0]).slice(0, 2).join("")}</span>)}{group.person_count > 3 && <span>+{group.person_count - 3}</span>}</div><span title={group.participants.map(person => person.display_name_snapshot).join(", ")}>{group.participants.slice(0, 2).map(person => person.display_name_snapshot).join(", ")}{group.person_count > 2 ? " +" + (group.person_count - 2) : ""}</span></div>
          <div className="hours-record-duration"><strong>{formatMinutes(minutesForGroup(group))}</strong><span>{group.person_count > 1 ? formatHours(minutesForGroup(group) * group.person_count / 60) + " persoon-uren" : "1 persoon"}</span></div>
          <div className="hours-record-actions"><MaterialButton variant="text" size="compact" aria-label={"Bewerk registratie " + group.project_name} disabled={!meta.data || !currentUser.data} onClick={() => setEditor(group)}>Bewerken</MaterialButton><MaterialButton variant="icon" aria-label={"Verwijder registratie " + group.project_name} title="Verwijderen" onClick={() => { setDeleteError(""); setDeleteTarget(group); }}><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" /></svg></MaterialButton></div>
        </article>)}
      </div> : <div className="hours-list-empty"><h2>{filtered ? "Geen registraties gevonden" : "Nog geen uren geregistreerd"}</h2><p>{filtered ? "Pas de filters aan om meer registraties te zien." : "Ook vijf minuten telt. Voeg je eerste registratie toe met de knop bovenaan."}</p></div>}
      <footer className="hours-list-pagination" aria-label="Paginering urenregistraties"><label>Per pagina<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{PAGE_SIZES.map(value => <option key={value} value={value}>{value}</option>)}</select></label><div><span aria-live="polite">Pagina {page} van {pages}</span><MaterialButton variant="text" size="compact" disabled={page <= 1 || groups.isFetching} onClick={() => setPage(value => value - 1)}>Vorige</MaterialButton><MaterialButton variant="text" size="compact" disabled={page >= pages || groups.isFetching} onClick={() => setPage(value => value + 1)}>Volgende</MaterialButton></div></footer>
    </>}
    {editor && meta.data && currentUser.data && <WorkHourDialog key={editor === "new" ? "new" : editor.id} group={editor === "new" ? undefined : editor} meta={meta.data} currentUserId={currentUser.data.id} onClose={() => setEditor(null)} onSaved={saved} />}
    {deleteTarget && <AccessibleModal title="Registratie verwijderen" committing={deleting} onClose={() => { if (!deleting) setDeleteTarget(null); }}><div className="hours-delete-confirm"><p>{formatMinutes(minutesForGroup(deleteTarget))} voor {deleteTarget.project_name} op {formatAmsterdamDisplayDate(deleteTarget.work_date)} verwijderen?</p><p>Een beheerder kan de registratie later herstellen.</p>{deleteError && <p role="alert" className="hours-field-error">{deleteError}</p>}<div><MaterialButton variant="outlined" disabled={deleting} onClick={() => setDeleteTarget(null)}>Annuleren</MaterialButton><MaterialButton variant="danger" disabled={deleting} onClick={() => void remove()}>{deleting ? "Verwijderen…" : "Bevestig verwijderen"}</MaterialButton></div></div></AccessibleModal>}
  </section>;
}
