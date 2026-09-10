import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipationPage } from "./ParticipationPage";
import { ParticipationPanel } from "./ParticipationPanel";
import type { ParticipationMoment } from "../../../lib/api/participation";

const api = vi.hoisted(() => ({
  getParticipationMeta: vi.fn(), listParticipationMoments: vi.fn(), getParticipationMoment: vi.fn(),
  createParticipationMoment: vi.fn(), updateParticipationMoment: vi.fn(), archiveParticipationMoment: vi.fn(),
  exportParticipationMoments: vi.fn(), participationError: (error: Error) => error.message,
}));
vi.mock("../../../lib/api/participation", () => api);

const meta = {
  current_user_id: "u1",
  participants: [{ id: "u1", name: "Bart Jan", selectable: true }, { id: "u2", name: "Mark", selectable: true }],
  projects: [{ id: "p1", name: "Wind rondom Daarle", selectable: true }, { id: "p2", name: "Energiek Daarle", selectable: true }],
};
const moment: ParticipationMoment = {
  id: "m1", title: "Gesprek met de buurt", occurred_on: "2026-09-09", contact_type: "in_person",
  conversation_partners: "Bewoners Dorpsstraat", location: "Dorpshuis", duration_minutes: null,
  report: "De planning is besproken.\nEr zijn vragen over geluid.", agreements: "Stuur de informatie na.",
  participants: meta.participants, projects: meta.projects, created_by_name: "Bart Jan",
  created_at: "2026-09-09T10:00:00Z", updated_at: "2026-09-09T10:00:00Z", archived_at: null,
  row_version: 3, can_edit: true,
};

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  api.getParticipationMeta.mockResolvedValue(meta);
  api.listParticipationMoments.mockResolvedValue({ items: [moment], total: 1, page: 1, page_size: 25 });
  api.getParticipationMoment.mockResolvedValue(moment);
  api.createParticipationMoment.mockResolvedValue(moment);
  api.updateParticipationMoment.mockResolvedValue({ ...moment, row_version: 4 });
  api.archiveParticipationMoment.mockResolvedValue({ ...moment, archived_at: "2026-09-09T11:00:00Z", row_version: 4 });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><ParticipationPage /></QueryClientProvider>);
}

async function openNew() {
  renderPage();
  await screen.findByRole("button", { name: "Open gesprek: Gesprek met de buurt" });
  fireEvent.click(screen.getByRole("button", { name: "Nieuw moment" }));
  return screen.getByRole("dialog", { name: "Nieuw participatiemoment" });
}

describe("Participatiemomenten", () => {
  it("shows a compact list and opens the complete report", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Open gesprek: Gesprek met de buurt" }));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText(/De planning is besproken/)).toBeInTheDocument();
    expect(within(panel).getByText("Stuur de informatie na.")).toBeInTheDocument();
    expect(within(panel).getByText("Bart Jan, Mark")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("creates a conversation with multiple people/projects and no mandatory duration", async () => {
    const panel = await openNew();
    fireEvent.change(within(panel).getByLabelText("Onderwerp *"), { target: { value: "Overleg buiten" } });
    fireEvent.change(within(panel).getByLabelText("Verslag *"), { target: { value: "Bewoners vroegen naar de planning." } });
    for (const name of ["Mark", "Wind rondom Daarle", "Energiek Daarle"]) fireEvent.click(within(panel).getByRole("checkbox", { name }));
    fireEvent.click(within(panel).getByRole("button", { name: "Verslag opslaan" }));
    await waitFor(() => expect(api.createParticipationMoment).toHaveBeenCalledWith(expect.objectContaining({
      title: "Overleg buiten", report: "Bewoners vroegen naar de planning.", participant_ids: ["u1", "u2"], project_ids: ["p1", "p2"], duration_minutes: null,
    })));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("requires at least one participant and project", async () => {
    const panel = await openNew();
    fireEvent.change(within(panel).getByLabelText("Onderwerp *"), { target: { value: "Overleg" } });
    fireEvent.change(within(panel).getByLabelText("Verslag *"), { target: { value: "Verslag" } });
    fireEvent.click(within(panel).getByRole("checkbox", { name: "Bart Jan" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Verslag opslaan" }));
    expect(within(panel).getByRole("alert")).toHaveTextContent("Selecteer minimaal één uitvoerder en één project.");
    expect(api.createParticipationMoment).not.toHaveBeenCalled();
  });

  it("protects unsaved input when closing or pressing Escape", async () => {
    const panel = await openNew();
    fireEvent.change(within(panel).getByLabelText("Onderwerp *"), { target: { value: "Nog niet klaar" } });
    fireEvent(panel, new Event("cancel", { cancelable: true }));
    expect(within(panel).getByRole("alert")).toHaveTextContent("niet-opgeslagen wijzigingen");
    fireEvent.click(within(panel).getByRole("button", { name: "Terug" }));
    expect(within(panel).getByLabelText("Onderwerp *")).toHaveValue("Nog niet klaar");
    fireEvent.click(within(panel).getByRole("button", { name: "Paneel sluiten" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Wijzigingen weggooien" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("requires confirmation before archiving and uses the current version", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Open gesprek: Gesprek met de buurt" }));
    const panel = await screen.findByRole("dialog");
    fireEvent.click(within(panel).getByRole("button", { name: "Archiveren" }));
    expect(api.archiveParticipationMoment).not.toHaveBeenCalled();
    fireEvent.click(within(within(panel).getByRole("alert")).getByRole("button", { name: "Archiveren" }));
    await waitFor(() => expect(api.archiveParticipationMoment).toHaveBeenCalledWith("m1", true, 3));
  });

  it("sends the same filters to list and export, without limiting exports to one page", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    const revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => "blob:test" });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
    try {
      api.exportParticipationMoments.mockResolvedValue(new Blob(["Verslag"]));
      renderPage();
      await screen.findByRole("button", { name: "Open gesprek: Gesprek met de buurt" });
      fireEvent.change(screen.getByLabelText("Project"), { target: { value: "p1" } });
      fireEvent.change(screen.getByLabelText("Uitvoerder"), { target: { value: "u2" } });
      fireEvent.change(screen.getByLabelText("Vanaf"), { target: { value: "2026-09-01" } });
      await waitFor(() => expect(api.listParticipationMoments).toHaveBeenLastCalledWith(expect.objectContaining({ project_id: "p1", participant_id: "u2", date_from: "2026-09-01" }), 1));
      fireEvent.change(screen.getByLabelText("Exportformaat"), { target: { value: "csv" } });
      fireEvent.click(screen.getByRole("button", { name: "Export selectie" }));
      await waitFor(() => expect(api.exportParticipationMoments).toHaveBeenCalledWith(expect.objectContaining({ project_id: "p1", participant_id: "u2", date_from: "2026-09-01" }), "csv"));
      await waitFor(() => expect(click).toHaveBeenCalled());
      await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:test"), { timeout: 1500 });
    } finally {
      if (createUrl) Object.defineProperty(URL, "createObjectURL", createUrl);
      else Reflect.deleteProperty(URL, "createObjectURL");
      if (revokeUrl) Object.defineProperty(URL, "revokeObjectURL", revokeUrl);
      else Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });

  it("keeps the edit baseline when background data changes and preserves input on conflict", async () => {
    api.updateParticipationMoment.mockRejectedValueOnce(new Error("Dit verslag is intussen gewijzigd."));
    const saved = vi.fn();
    const { rerender } = render(<ParticipationPanel meta={meta} moment={moment} onClose={vi.fn()} onSaved={saved} />);
    fireEvent.click(screen.getByRole("button", { name: "Verslag bewerken" }));
    fireEvent.change(screen.getByLabelText("Onderwerp *"), { target: { value: "Mijn correctie" } });
    rerender(<ParticipationPanel meta={meta} moment={{ ...moment, row_version: 4 }} onClose={vi.fn()} onSaved={saved} />);
    fireEvent.click(screen.getByRole("button", { name: "Verslag opslaan" }));
    await waitFor(() => expect(api.updateParticipationMoment).toHaveBeenCalledWith("m1", expect.objectContaining({ title: "Mijn correctie" }), 3));
    expect(await screen.findByRole("alert")).toHaveTextContent("intussen gewijzigd");
    expect(screen.getByLabelText("Onderwerp *")).toHaveValue("Mijn correctie");
    expect(saved).not.toHaveBeenCalled();
  });
});
