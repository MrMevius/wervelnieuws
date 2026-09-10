import csv
import html
import json
from datetime import UTC, datetime
from io import StringIO

from app.schemas.participation import ParticipationFilters, ParticipationResponse

CONTACT_LABELS = {"in_person": "Op locatie", "phone": "Telefonisch", "video": "Videogesprek", "other": "Anders"}


def _csv_safe(value) -> str:
    text = str(value) if value is not None else ""
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) or text.startswith(("\t", "\r", "\n")) else text


def export_participation(rows: list[ParticipationResponse], filters: ParticipationFilters, format: str) -> tuple[bytes, str, str]:
    if format == "json":
        content = json.dumps({
            "schema_version": 1, "exported_at": datetime.now(UTC).isoformat(),
            "filters": filters.model_dump(mode="json", exclude={"page", "page_size", "format"}), "total": len(rows),
            "moments": [row.model_dump(mode="json") for row in rows],
        }, ensure_ascii=False, indent=2)
        return content.encode("utf-8"), "application/json", "json"
    if format == "csv":
        output = StringIO(newline="")
        writer = csv.writer(output, delimiter=";")
        writer.writerow(["ID", "Datum", "Onderwerp", "Uitvoerders", "Projecten", "Gesprekspartners", "Contactvorm", "Locatie", "Duur (minuten)", "Verslag", "Afspraken", "Vastgelegd door", "Gewijzigd op", "Gearchiveerd"])
        for row in rows:
            writer.writerow([_csv_safe(value) for value in (
                row.id, row.occurred_on.isoformat(), row.title,
                "; ".join(person.name for person in row.participants), "; ".join(project.name for project in row.projects),
                row.conversation_partners, CONTACT_LABELS[row.contact_type], row.location,
                row.duration_minutes, row.report, row.agreements, row.created_by_name,
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
            f"- Uitvoerders: {safe(', '.join(person.name for person in row.participants))}",
            f"- Projecten: {safe(', '.join(project.name for project in row.projects))}",
            f"- Gesprekspartners: {safe(row.conversation_partners) or 'Niet ingevuld'}",
            f"- Contactvorm: {CONTACT_LABELS[row.contact_type]}",
            f"- Locatie: {safe(row.location) or 'Niet ingevuld'}",
            f"- Duur: {str(row.duration_minutes) + ' minuten' if row.duration_minutes else 'Niet ingevuld'}",
            f"- Vastgelegd door: {safe(row.created_by_name)}",
            f"- Status: {'Gearchiveerd' if row.archived_at else 'Actief'}",
            f"- Referentie: {row.id}", "", "### Verslag", "", safe(row.report), "",
            "### Afspraken en vervolg", "", safe(row.agreements) or "Geen afspraken vastgelegd.", "", "---", "",
        ]
    return "\n".join(lines).encode("utf-8"), "text/markdown; charset=utf-8", "md"
