import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MaterialButton } from "../../../design-system/MaterialButton";
import {
  exportParticipationMoments, getParticipationMeta, getParticipationMoment, listParticipationMoments, participationError,
  type ParticipationExportFormat, type ParticipationFilters, type ParticipationMoment,
} from "../../../lib/api/participation";
import { contactLabels, formatDate, ParticipationPanel } from "./ParticipationPanel";
import "./participation.css";

const emptyFilters: ParticipationFilters = { query: "", date_from: "", date_to: "", project_id: "", participant_id: "", archived: false };

export function ParticipationPage() {
  const client = useQueryClient();
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ParticipationExportFormat>("markdown");
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const meta = useQuery({ queryKey: ["participation-meta"], queryFn: getParticipationMeta });
  const invalidDates = Boolean(filters.date_from && filters.date_to && filters.date_from > filters.date_to);
  const list = useQuery({
    queryKey: ["participation-list", filters, page], queryFn: () => listParticipationMoments(filters, page), enabled: !invalidDates,
  });
  const detail = useQuery({ queryKey: ["participation-detail", selected], queryFn: () => getParticipationMoment(selected!), enabled: Boolean(selected && selected !== "new"), refetchOnWindowFocus: false, refetchOnReconnect: false });

  useEffect(() => {
    const timeout = window.setTimeout(() => { setFilters(current => ({ ...current, query: search })); setPage(1); }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  function filter<K extends keyof ParticipationFilters>(key: K, value: ParticipationFilters[K]) {
    setFilters(current => ({ ...current, [key]: value })); setPage(1);
  }

  function saved(row: ParticipationMoment) {
    setSelected(null);
    setFeedback(row.archived_at ? "Het gesprek is gearchiveerd." : "Het gespreksverslag is opgeslagen.");
    client.setQueryData(["participation-detail", row.id], row);
    void client.invalidateQueries({ queryKey: ["participation-list"] });
    void client.invalidateQueries({ queryKey: ["participation-meta"] });
  }

  async function exportSelection() {
    setExporting(true); setError("");
    try {
      const blob = await exportParticipationMoments(filters, exportFormat);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `participatiemomenten.${exportFormat === "markdown" ? "md" : exportFormat}`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback("De volledige gefilterde selectie is geëxporteerd.");
    } catch (error) { setError(participationError(error)); }
    finally { setExporting(false); }
  }

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));
  const hasFilters = Boolean(filters.query || filters.project_id || filters.participant_id || filters.date_from || filters.date_to);
  const canCreate = meta.data?.projects.some(project => project.selectable);

  return <section className="participation-page" aria-labelledby="participation-heading">
    <header className="participation-heading">
      <div><h1 id="participation-heading">Participatiemomenten</h1><p>Gesprekken, inzichten en afspraken voor de verslaglegging.</p></div>
      <div className="participation-actions">
        <div className="participation-export">
          <select aria-label="Exportformaat" value={exportFormat} onChange={event => setExportFormat(event.target.value as ParticipationExportFormat)}><option value="markdown">Markdown</option><option value="csv">CSV (Excel)</option><option value="json">JSON</option></select>
          <MaterialButton variant="outlined" disabled={exporting || invalidDates || !total || list.isFetching || list.isError || search !== filters.query} onClick={() => void exportSelection()}>{exporting ? "Exporteren…" : "Export selectie"}</MaterialButton>
        </div>
        <MaterialButton disabled={!canCreate} onClick={() => { setFeedback(""); setSelected("new"); }}>Nieuw moment</MaterialButton>
      </div>
    </header>
    <div className="participation-filters" aria-label="Gesprekken filteren">
      <label className="participation-search">Zoeken<input type="search" value={search} placeholder="Onderwerp, gesprekspartner of inhoud" onChange={event => setSearch(event.target.value)} /></label>
      <label>Vanaf<input type="date" value={filters.date_from} onChange={event => filter("date_from", event.target.value)} /></label>
      <label>Tot en met<input type="date" value={filters.date_to} min={filters.date_from || undefined} onChange={event => filter("date_to", event.target.value)} /></label>
      <label>Project<select value={filters.project_id} onChange={event => filter("project_id", event.target.value)}><option value="">Alle projecten</option>{meta.data?.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label>Uitvoerder<select value={filters.participant_id} onChange={event => filter("participant_id", event.target.value)}><option value="">Iedereen</option>{meta.data?.participants.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    </div>
    <div className="participation-list-toolbar">
      <div className="participation-tabs" aria-label="Actieve gesprekken of archief">
        <MaterialButton size="compact" variant={filters.archived ? "text" : "tonal"} aria-pressed={!filters.archived} onClick={() => filter("archived", false)}>Gesprekken</MaterialButton>
        <MaterialButton size="compact" variant={filters.archived ? "tonal" : "text"} aria-pressed={filters.archived} onClick={() => filter("archived", true)}>Archief</MaterialButton>
      </div>
      <div><span className="muted">{total} {total === 1 ? "gesprek" : "gesprekken"}</span>{hasFilters && <MaterialButton variant="text" size="compact" onClick={() => { setFilters({ ...emptyFilters, archived: filters.archived }); setSearch(""); setPage(1); }}>Filters wissen</MaterialButton>}</div>
    </div>
    {feedback && <p className="participation-notice" role="status">{feedback}</p>}
    {invalidDates && <p className="error" role="alert">De begindatum moet vóór of op de einddatum liggen.</p>}
    {(error || meta.isError || list.isError || detail.isError) && <div role="alert" className="participation-load-error"><p>{error || participationError(meta.error || list.error || detail.error)}</p><MaterialButton variant="outlined" onClick={() => { setError(""); void meta.refetch(); void list.refetch(); if (selected && selected !== "new") void detail.refetch(); }}>Opnieuw proberen</MaterialButton></div>}
    {meta.data && !canCreate && <p className="participation-notice">Je hebt nog geen actief project beschikbaar. Vraag een beheerder om projecttoegang.</p>}
    {(list.isLoading || meta.isLoading || (selected && selected !== "new" && detail.isLoading)) && <p role="status" className="participation-empty">Gesprekken laden…</p>}
    {!invalidDates && list.data && !list.isError && <>
      {list.data.items.length ? <div className="participation-list">
        {list.data.items.map(moment => <button type="button" key={moment.id} className="participation-row" aria-label={`Open gesprek: ${moment.title}`} onClick={() => { setError(""); setSelected(moment.id); }}>
          <time dateTime={moment.occurred_on}>{formatDate(moment.occurred_on)}</time>
          <div className="participation-row-content"><h2>{moment.title}</h2><p>{moment.projects.map(project => project.name).join(" · ")}</p>{moment.conversation_partners && <p className="participation-partners">Met {moment.conversation_partners}</p>}</div>
          <div className="participation-row-people"><span>{moment.participants.map(person => person.name).join(", ")}</span><small>{contactLabels[moment.contact_type]}{moment.duration_minutes ? ` · ${moment.duration_minutes} min.` : ""}</small></div>
          <span className="participation-row-arrow" aria-hidden="true">›</span>
        </button>)}
      </div> : <div className="participation-empty"><h2>{hasFilters ? "Geen gesprekken in deze selectie" : filters.archived ? "Het archief is leeg" : "Nog geen gesprekken vastgelegd"}</h2><p>{hasFilters ? "Pas de filters aan of kies een ruimere periode." : "Ook een kort gesprek telt. Leg vast wie erbij was, wat is besproken en wat is afgesproken."}</p></div>}
      <footer className="participation-pagination"><span className="muted">Pagina {page} van {pages}</span><div><MaterialButton variant="text" size="compact" disabled={page <= 1 || list.isFetching} onClick={() => setPage(value => value - 1)}>Vorige</MaterialButton><MaterialButton variant="text" size="compact" disabled={page >= pages || list.isFetching} onClick={() => setPage(value => value + 1)}>Volgende</MaterialButton></div></footer>
    </>}
    {selected && meta.data && (selected === "new" || (detail.data && !detail.isFetching)) && <ParticipationPanel key={selected} meta={meta.data} moment={selected === "new" ? undefined : detail.data} onClose={() => setSelected(null)} onSaved={saved} />}
  </section>;
}
