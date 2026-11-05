import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { AdminActivity } from "../../lib/api/client";
import { AdminActivityLog } from "./AdminActivityLog";

function event(id: string, event_type: string, created_at: string, actor_username = "mevius", topic_subject: string | null = null): AdminActivity {
  return { id, event_type, created_at, actor_username, actor_user_id: "u1", topic_id: topic_subject ? `t-${topic_subject}` : null, topic_subject };
}

const items = [
  event("e1", "board.card.deleted", "2026-11-03T17:35:00"),
  event("e2", "board.card.deleted", "2026-11-03T17:35:00"),
  event("e3", "board.card.deleted", "2026-11-03T17:34:00"),
  event("e4", "work_hours.group.created", "2026-11-03T17:20:00", "herman"),
  event("e5", "topic.updated", "2026-10-27T18:00:00", "dirkjan", "Informatieavond"),
  event("e6", "custom.unknown", "2026-10-27T17:00:00", "Systeem")
];

describe("AdminActivityLog", () => {
  it("groups by day and folds repeated actions into one row", () => {
    render(<AdminActivityLog items={items} />);
    const deleted = screen.getByText("Kaart verwijderd").closest("tr")!;
    expect(within(deleted).getByText("×3")).toBeInTheDocument();
    expect(within(deleted).getByText("18:34–18:35")).toBeInTheDocument();
    expect(within(deleted).getByText("Vergaderborden")).toBeInTheDocument();
    expect(screen.getByText("Urenregistratie aangemaakt").closest("tr")).toHaveTextContent("herman");
    expect(screen.getByText("Topic bijgewerkt").closest("tr")).toHaveTextContent("Informatieavond");
    expect(screen.getByText("custom.unknown")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: /november|oktober|Vandaag|Gisteren/i })).toHaveLength(2);
    expect(screen.getByText("6 gebeurtenissen")).toBeInTheDocument();
  });

  it("filters by area", async () => {
    render(<AdminActivityLog items={items} />);
    await userEvent.selectOptions(screen.getByLabelText("Onderdeel"), "hours");
    expect(screen.getByText("Urenregistratie aangemaakt")).toBeInTheDocument();
    expect(screen.queryByText("Kaart verwijderd")).not.toBeInTheDocument();
    expect(screen.getByText("1 gebeurtenis")).toBeInTheDocument();
  });
});
