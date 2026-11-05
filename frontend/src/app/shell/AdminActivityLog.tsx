import { useState } from "react";
import { ResponsiveRow, ResponsiveTable } from "../../design-system/ResponsiveTable";
import type { AdminActivity } from "../../lib/api/client";
import { formatAmsterdamDateInput, formatAmsterdamDayLabel, formatAmsterdamTime } from "../../lib/datetime";
import { auditActionLabel } from "../features/urenverantwoording/WorkHoursAdminTabs";

const EVENT_LABELS: Record<string, string> = {
  "board.card.created": "Kaart aangemaakt",
  "board.card.updated": "Kaart bijgewerkt",
  "board.card.moved": "Kaart verplaatst",
  "board.card.title_updated": "Kaarttitel gewijzigd",
  "board.card.urgency_updated": "Urgentie gewijzigd",
  "board.card.assignments_updated": "Toewijzing gewijzigd",
  "board.card.archived": "Kaart gearchiveerd",
  "board.card.restored": "Kaart hersteld",
  "board.card.deleted": "Kaart verwijderd",
  "board.card.deleted_restored": "Verwijderde kaart hersteld",
  "board.card.attachment_created": "Bijlage toegevoegd",
  "board.card.attachment_deleted": "Bijlage verwijderd",
  "board.card.update_edited": "Kaartupdate bewerkt",
  "board.card.update_deleted": "Kaartupdate verwijderd",
  "board.card.update_attachment_added": "Bijlage aan update toegevoegd",
  "board.card.update_attachment_removed": "Bijlage van update verwijderd",
  "board.project.created": "Bord aangemaakt",
  "board.project.archived": "Bord gearchiveerd",
  "board.project.cards_cleared": "Bord leeggemaakt",
  "board.project.rights_updated": "Bordrechten gewijzigd",
  "board.recording.created": "Opname toegevoegd",
  "board.recording.transcribed": "Opname uitgeschreven",
  "board.recording.summarized": "Opname samengevat",
  "board.trello_imported": "Trello-import",
  "board.trello_import.rejected": "Trello-import geweigerd",
  "database.document.uploaded": "Document geüpload",
  "database.document.deleted": "Document verwijderd",
  "database.document.bulk_deleted": "Documenten verwijderd",
  "database.document.bulk_moved": "Documenten verplaatst",
  "database.document.bulk_copied": "Documenten gekopieerd",
  "topic.created": "Topic aangemaakt",
  "topic.created.from_csv": "Topic geïmporteerd uit CSV",
  "topic.updated": "Topic bijgewerkt",
  "topic.deleted": "Topic verwijderd",
  "topic.note.added": "Notitie toegevoegd",
  "topic.document.uploaded": "Document aan topic toegevoegd",
  "topic.document.transcription.retry": "Transcriptie opnieuw gestart",
  "content.generated": "Content gegenereerd",
  "content.generation": "Content gegenereerd",
  "content.regenerated": "Content opnieuw gegenereerd",
  "content.manual_edited": "Content handmatig bewerkt",
  "content.approved": "Content goedgekeurd",
  "content.rejected": "Content afgewezen",
  "content.scheduled": "Publicatie ingepland",
  "content.publication": "Content gepubliceerd",
  "content.variant.approved": "Variant goedgekeurd",
  "content.variant.rejected": "Variant afgewezen",
  "content.variant.updated": "Variant bijgewerkt",
  "participation.created": "Participatiemoment aangemaakt",
  "participation.updated": "Participatiemoment bijgewerkt",
  "participation.archived": "Participatiemoment gearchiveerd",
  "participation.restored": "Participatiemoment hersteld"
};

const AREAS = [
  { key: "board", label: "Vergaderborden", prefixes: ["board."] },
  { key: "hours", label: "Uren", prefixes: ["work_hours."] },
  { key: "news", label: "Wervelnieuws", prefixes: ["topic.", "content."] },
  { key: "database", label: "Database", prefixes: ["database."] },
  { key: "participation", label: "Participatie", prefixes: ["participation."] },
  { key: "other", label: "Overig", prefixes: [] }
] as const;

type AreaKey = (typeof AREAS)[number]["key"];

function activityArea(eventType: string) {
  return AREAS.find((area) => area.prefixes.some((prefix) => eventType.startsWith(prefix))) ?? AREAS[AREAS.length - 1];
}

export function activityLabel(eventType: string) {
  if (EVENT_LABELS[eventType]) return EVENT_LABELS[eventType];
  if (eventType.startsWith("work_hours.")) return auditActionLabel(eventType);
  return eventType;
}

type ActivityEntry = { item: AdminActivity; count: number; oldest: AdminActivity };
type ActivityDay = { day: string; label: string; entries: ActivityEntry[] };

/** Group by Amsterdam day and fold consecutive identical actions (same person, action and topic) into one row. */
function groupActivity(items: AdminActivity[]): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const item of items) {
    const day = formatAmsterdamDateInput(item.created_at);
    let group = days[days.length - 1];
    if (!group || group.day !== day) {
      group = { day, label: formatAmsterdamDayLabel(item.created_at), entries: [] };
      days.push(group);
    }
    const previous = group.entries[group.entries.length - 1];
    if (previous && previous.item.event_type === item.event_type && previous.item.actor_username === item.actor_username && previous.item.topic_id === item.topic_id) {
      previous.count += 1;
      previous.oldest = item;
    } else {
      group.entries.push({ item, count: 1, oldest: item });
    }
  }
  return days;
}

export function AdminActivityLog({ items }: { items: AdminActivity[] }) {
  const [area, setArea] = useState<AreaKey | "">("");
  const visible = area ? items.filter((item) => activityArea(item.event_type).key === area) : items;
  const days = groupActivity(visible);
  return <>
    <div className="admin-log-toolbar">
      <label className="admin-log-filter"><span className="muted">Onderdeel</span><select value={area} onChange={(event) => setArea(event.target.value as AreaKey | "")}><option value="">Alles</option>{AREAS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
      <span className="muted">{visible.length} {visible.length === 1 ? "gebeurtenis" : "gebeurtenissen"}</span>
    </div>
    {days.length ? <div className="table-wrap"><ResponsiveTable className="admin-log-table"><thead><ResponsiveRow><th>Tijd</th><th>Onderdeel</th><th>Actie</th><th>Door</th></ResponsiveRow></thead>
      {days.map((day) => <tbody key={day.day}>
        <tr className="admin-log-day"><th colSpan={4} scope="colgroup">{day.label}</th></tr>
        {day.entries.map(({ item, count, oldest }) => {
          const topic = item.topic_subject?.trim() ?? "";
          const newest = formatAmsterdamTime(item.created_at);
          const first = formatAmsterdamTime(oldest.created_at);
          const itemArea = activityArea(item.event_type);
          return <ResponsiveRow key={item.id}>
            <td className="admin-log-time">{count > 1 && first !== newest ? `${first}–${newest}` : newest}</td>
            <td><span className={`admin-log-area admin-log-area-${itemArea.key}`}>{itemArea.label}</span></td>
            <td><span className="admin-log-action" title={item.event_type}>{activityLabel(item.event_type)}</span>{count > 1 && <span className="admin-log-count" aria-label={`${count} keer`}>×{count}</span>}{topic && <span className="admin-log-topic muted" title={topic}>{topic}</span>}</td>
            <td>{item.actor_username}</td>
          </ResponsiveRow>;
        })}
      </tbody>)}
    </ResponsiveTable></div> : <p className="admin-empty-state muted">Geen gebeurtenissen gevonden.</p>}
  </>;
}
