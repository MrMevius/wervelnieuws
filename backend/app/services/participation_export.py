import csv
import html
import json
from datetime import UTC, datetime
from io import StringIO

from app.schemas.participation import ParticipationFilters, ParticipationResponse

CONTACT_LABELS = {
    "in_person": "Persoonlijk", "phone": "Telefoon", "email": "E-mail", "video": "Videogesprek",
    "meeting": "Bijeenkomst", "letter": "Brief", "newspaper": "Krant", "online": "Online / sociale media", "other": "Anders",
}
TYPE_LABELS = {"conversation": "Gesprek", "meeting": "Bijeenkomst", "communication": "Communicatie-uiting"}
LEVEL_LABELS = {"inform": "Informeren", "consult": "Raadplegen", "advise": "Adviseren", "coproduce": "Coproduceren", "codecide": "Meebeslissen"}
STATUS_LABELS = {"": "", "yes": "Ja", "no": "Nee", "na": "N.v.t.", "partial": "Deels", "pending": "Nog niet"}


def _status(status: str, note: str) -> str:
    return ", ".join(part for part in (STATUS_LABELS[status], note) if part)


def _levels(row: ParticipationResponse) -> str:
    return ", ".join(LEVEL_LABELS[level] for level in row.participation_levels)


def _csv_safe(value) -> str:
    text = str(value) if value is not None else ""
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) or text.startswith(("\t", "\r", "\n")) else text


def export_participation(rows: list[ParticipationResponse], filters: ParticipationFilters, format: str) -> tuple[bytes, str, str]:
    if format == "json":
        content = json.dumps({
            "schema_version": 2, "exported_at": datetime.now(UTC).isoformat(),
            "filters": filters.model_dump(mode="json", exclude={"page", "page_size", "format"}), "total": len(rows),
            "moments": [row.model_dump(mode="json") for row in rows],
        }, ensure_ascii=False, indent=2)
        return content.encode("utf-8"), "application/json", "json"
    if format == "csv":
        output = StringIO(newline="")
        writer = csv.writer(output, delimiter=";")
        writer.writerow([
            "ID", "Datum", "Soort", "Onderwerp", "Doel", "Participatieniveau", "Uitvoerders", "Projecten", "Belanghebbenden",
            "Kanaal", "Locatie", "Duur (minuten)", "Verslag", "Opgehaalde informatie", "Acties en vervolg",
            "Uitnodiging", "Voldoende geïnformeerd", "Terugkoppeling", "Doelstelling bereikt", "Opmerkingen",
            "Historisch", "Vastgelegd door", "Gewijzigd op", "Gearchiveerd",
        ])
        for row in rows:
            writer.writerow([_csv_safe(value) for value in (
                row.id, row.occurred_on.isoformat(), TYPE_LABELS[row.moment_type], row.title, row.goal, _levels(row),
                "; ".join(person.name for person in row.participants), "; ".join(project.name for project in row.projects),
                row.conversation_partners, CONTACT_LABELS[row.contact_type], row.location,
                row.duration_minutes, row.report, row.collected_information, row.agreements,
                _status(row.invitation_status, row.invitation_note), _status(row.informed_status, row.informed_note),
                _status(row.feedback_status, row.feedback_note), STATUS_LABELS[row.goal_status], row.notes,
                "Ja" if row.is_historical else "Nee", row.created_by_name,
                row.updated_at.isoformat(), "Ja" if row.archived_at else "Nee",
            )])
        return output.getvalue().encode("utf-8-sig"), "text/csv; charset=utf-8", "csv"
    lines = ["# Participatieverslag", "", f"Aantal gesprekken: {len(rows)}", ""]
    if filters.date_from or filters.date_to:
        lines += [f"Periode: {filters.date_from or 'begin'} t/m {filters.date_to or 'heden'}", ""]
    for row in rows:
        safe = lambda value: html.escape(str(value), quote=False)
        lines += [
            f"## {safe(row.title)}", "",
            f"- Datum: {row.occurred_on.strftime('%d-%m-%Y')}",
            f"- Soort: {TYPE_LABELS[row.moment_type]}",
            f"- Doel: {safe(row.goal) or safe(row.title)}",
            f"- Participatieniveau: {_levels(row) or 'Niet ingevuld'}",
            f"- Uitvoerders: {safe(', '.join(person.name for person in row.participants)) or ('Onbekend (historisch)' if row.is_historical else 'Niet ingevuld')}",
            f"- Projecten: {safe(', '.join(project.name for project in row.projects))}",
            f"- Belanghebbenden: {safe(row.conversation_partners) or 'Niet ingevuld'}",
            f"- Kanaal: {CONTACT_LABELS[row.contact_type]}",
            f"- Locatie: {safe(row.location) or 'Niet ingevuld'}",
            f"- Duur: {str(row.duration_minutes) + ' minuten' if row.duration_minutes else 'Niet ingevuld'}",
            f"- Uitnodiging: {safe(_status(row.invitation_status, row.invitation_note)) or 'Niet ingevuld'}",
            f"- Voldoende geïnformeerd: {safe(_status(row.informed_status, row.informed_note)) or 'Niet ingevuld'}",
            f"- Terugkoppeling: {safe(_status(row.feedback_status, row.feedback_note)) or 'Niet ingevuld'}",
            f"- Doelstelling bereikt: {STATUS_LABELS[row.goal_status] or 'Niet ingevuld'}",
            f"- Vastgelegd door: {safe(row.created_by_name)}",
            f"- Status: {'Gearchiveerd' if row.archived_at else 'Actief'}",
            f"- Referentie: {row.id}", "", "### Verslag", "", safe(row.report), "",
            "### Opgehaalde informatie", "", safe(row.collected_information) or "Niet ingevuld.", "",
            "### Acties en vervolg", "", safe(row.agreements) or "Geen acties vastgelegd.", "",
            *(["### Opmerkingen", "", safe(row.notes), ""] if row.notes else []), "---", "",
        ]
    return "\n".join(lines).encode("utf-8"), "text/markdown; charset=utf-8", "md"
