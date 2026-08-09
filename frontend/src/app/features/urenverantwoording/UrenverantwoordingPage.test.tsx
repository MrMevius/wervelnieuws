import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UrenverantwoordingPage } from "./UrenverantwoordingPage";

const api = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listWorkHoursMeta: vi.fn(),
  listWorkHourGroups: vi.fn(),
  listWorkHoursAudit: vi.fn(),
  createWorkHourGroup: vi.fn(),
  updateWorkHourGroup: vi.fn(),
  deleteWorkHourGroup: vi.fn(),
  restoreWorkHourGroup: vi.fn(),
  createWorkExternalPerson: vi.fn(),
  updateWorkExternalPerson: vi.fn(),
  archiveWorkExternalPerson: vi.fn(),
  restoreWorkExternalPerson: vi.fn(),
  mergeWorkExternalPerson: vi.fn(),
  createWorkProject: vi.fn(),
  updateWorkProject: vi.fn(),
  archiveWorkProject: vi.fn(),
  restoreWorkProject: vi.fn(),
  createWorkPost: vi.fn(),
  updateWorkPost: vi.fn(),
  archiveWorkPost: vi.fn(),
  restoreWorkPost: vi.fn(),
  downloadWorkHoursCsv: vi.fn(),
  downloadWorkHoursBackup: vi.fn(),
  previewWorkHoursImport: vi.fn(),
  commitWorkHoursImport: vi.fn()
  ,listWorkHoursAdminHistory: vi.fn()
  ,listWorkHoursAdminMasterdata: vi.fn()
  ,relinkWorkHistoricalIdentity: vi.fn()
}));

vi.mock("../../../lib/api/client", () => api);

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UrenverantwoordingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.URL.createObjectURL = vi.fn(() => "blob:mock");
  window.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  api.getCurrentUser.mockResolvedValue({ id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com", is_admin: true });
  api.listWorkHoursMeta.mockResolvedValue({
    projects: [{ id: "p1", name: "Project A", description: "", is_active: true, is_archived: false, archived_at: null }],
    posts: [{ id: "post1", project_id: "p1", name: "Post A", description: "", is_active: true, is_archived: false, archived_at: null }],
    external_people: [
      { id: "ep-active", display_name: "Actieve externe", email: "actief@example.com", note: "", is_active: true, deleted_at: null },
      { id: "ep-archived", display_name: "Gearchiveerde externe", email: "archief@example.com", note: "", is_active: false, deleted_at: "2026-07-30T08:00:00Z" }
    ],
    historical_identities: [],
    eligible_users: [
      { id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com" },
      { id: "u2", username: "collega", full_name: "Collega", email: "collega@example.com" }
    ],
    is_admin: true
  });
  api.listWorkHourGroups.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25, sort_key: "work_date", sort_direction: "desc", page_sizes: [25, 50, 100], totals: { total_groups: 0, total_people: 0, total_duration_hours: 0, total_person_hours: 0 } });
  api.listWorkHoursAudit.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25 });
  api.listWorkHoursAdminHistory.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25 });
  api.listWorkHoursAdminMasterdata.mockResolvedValue({ projects: [], posts: [], external_people: [] });
});

describe("UrenverantwoordingPage", () => {
  it("toont de urenmodule in plaats van de placeholder", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Urenregistratie" })).toBeInTheDocument();
    expect(screen.queryByText("Deze module wordt in een volgende iteratie uitgewerkt.")).not.toBeInTheDocument();
  });

  it("bewerkt een groep met deelnemers en bewaart de wijziging", async () => {
    api.listWorkHourGroups.mockResolvedValueOnce({
      items: [
        {
          id: "g1",
          work_date: "2026-07-30",
          project_id: "p1",
          project_name: "Project A",
          post_id: "post1",
          post_name: "Post A",
          description: "Oude beschrijving",
          duration_half_hours: 2,
          duration_hours: 1,
          person_count: 1,
          person_hours: 1,
          row_version: 1,
          deleted_at: null,
          participants: [
            { id: "gp1", participant_kind: "live_user", user_id: "u1", external_person_id: null, historical_identity_id: null, display_name_snapshot: "Admin", display_email_snapshot: "admin@example.com", display_type_snapshot: "WindWilly-gebruiker", sort_order: 0 }
          ]
        }
      ],
      total: 1,
      page: 1,
      page_size: 25,
      sort_key: "work_date",
      sort_direction: "desc",
      page_sizes: [25, 50, 100],
      totals: { total_groups: 1, total_people: 1, total_duration_hours: 1, total_person_hours: 1 }
    });

    renderPage();

    expect(await screen.findAllByText("Oude beschrijving")).toHaveLength(2);
    const editButton = screen.getAllByRole("button", { name: "Bewerk" })[0];
    await userEvent.click(editButton);

    const textarea = await screen.findByDisplayValue("Oude beschrijving");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Nieuwe beschrijving");
    await userEvent.click(screen.getByRole("button", { name: "Wijzigingen opslaan" }));

    expect(api.updateWorkHourGroup).toHaveBeenCalledWith("g1", expect.objectContaining({ description: "Nieuwe beschrijving" }));
  });

  it("toont verwijderde registraties en kan deze herstellen", async () => {
    api.listWorkHourGroups
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 25, sort_key: "work_date", sort_direction: "desc", page_sizes: [25, 50, 100], totals: { total_groups: 0, total_people: 0, total_duration_hours: 0, total_person_hours: 0 } })
      .mockResolvedValueOnce({
        items: [
          {
            id: "g2",
            work_date: "2026-07-29",
            project_id: "p1",
            project_name: "Project A",
            post_id: "post1",
            post_name: "Post A",
            description: "Verwijderd",
            duration_half_hours: 2,
            duration_hours: 1,
            person_count: 1,
            person_hours: 1,
            row_version: 1,
            deleted_at: "2026-07-30T08:00:00Z",
            participants: []
          }
        ],
        total: 1,
        page: 1,
        page_size: 25,
        sort_key: "updated_at",
        sort_direction: "desc",
        page_sizes: [25, 50, 100],
        totals: { total_groups: 1, total_people: 0, total_duration_hours: 1, total_person_hours: 0 }
      });

    renderPage();

    await screen.findByRole("heading", { name: "Beheer" });
    await userEvent.click(screen.getByRole("checkbox", { name: "Gearchiveerd/verwijderd tonen" }));
    await userEvent.click(await screen.findByRole("button", { name: "Herstel groep" }));
    await userEvent.click(await screen.findByRole("button", { name: "Bevestig herstellen" }));

    expect(api.restoreWorkHourGroup).toHaveBeenCalledWith("g2", 1);
  });

  it("ververst de deleted-items lijst na herstellen", async () => {
    api.listWorkHourGroups
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 25, sort_key: "work_date", sort_direction: "desc", page_sizes: [25, 50, 100], totals: { total_groups: 0, total_people: 0, total_duration_hours: 0, total_person_hours: 0 } })
      .mockResolvedValueOnce({
        items: [
          {
            id: "g3",
            work_date: "2026-07-28",
            project_id: "p1",
            project_name: "Project A",
            post_id: "post1",
            post_name: "Post A",
            description: "Verwijderd item",
            duration_half_hours: 2,
            duration_hours: 1,
            person_count: 1,
            person_hours: 1,
            row_version: 1,
            deleted_at: "2026-07-30T08:00:00Z",
            participants: []
          }
        ],
        total: 1,
        page: 1,
        page_size: 25,
        sort_key: "updated_at",
        sort_direction: "desc",
        page_sizes: [25, 50, 100],
        totals: { total_groups: 1, total_people: 0, total_duration_hours: 1, total_person_hours: 0 }
      })
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 25, sort_key: "work_date", sort_direction: "desc", page_sizes: [25, 50, 100], totals: { total_groups: 0, total_people: 0, total_duration_hours: 0, total_person_hours: 0 } })
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 25, sort_key: "updated_at", sort_direction: "desc", page_sizes: [25, 50, 100], totals: { total_groups: 0, total_people: 0, total_duration_hours: 0, total_person_hours: 0 } });
    api.restoreWorkHourGroup.mockResolvedValue({
      id: "g3",
      work_date: "2026-07-28",
      project_id: "p1",
      project_name: "Project A",
      post_id: "post1",
      post_name: "Post A",
      description: "Verwijderd item",
      duration_half_hours: 2,
      duration_hours: 1,
      person_count: 1,
      person_hours: 1,
      row_version: 2,
      deleted_at: null,
      participants: []
    });

    renderPage();

    await screen.findByRole("heading", { name: "Beheer" });
    await userEvent.click(screen.getByRole("checkbox", { name: "Gearchiveerd/verwijderd tonen" }));
    await screen.findByRole("button", { name: "Herstel groep" });
    await userEvent.click(screen.getByRole("button", { name: "Herstel groep" }));
    await userEvent.click(await screen.findByRole("button", { name: "Bevestig herstellen" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Herstel groep" })).not.toBeInTheDocument();
    });
  });

  it("verbergt restore-acties voor niet-admins", async () => {
    api.getCurrentUser.mockResolvedValue({ id: "u2", username: "editor", full_name: "Editor", email: "editor@example.com", is_admin: false });
    api.listWorkHourGroups.mockResolvedValue({
      items: [
        {
          id: "g4",
          work_date: "2026-07-30",
          project_id: "p1",
          project_name: "Project A",
          post_id: "post1",
          post_name: "Post A",
          description: "Zichtbare rij",
          duration_half_hours: 2,
          duration_hours: 1,
          person_count: 1,
          person_hours: 1,
          row_version: 1,
          deleted_at: null,
          participants: []
        }
      ],
      total: 1,
      page: 1,
      page_size: 25,
      sort_key: "work_date",
      sort_direction: "desc",
      page_sizes: [25, 50, 100],
      totals: { total_groups: 1, total_people: 1, total_duration_hours: 1, total_person_hours: 1 }
    });

    renderPage();

    expect(await screen.findAllByText("Zichtbare rij")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Herstel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Herstel groep" })).not.toBeInTheDocument();
  });

  it("maakt de externe personen quick-add zichtbaar voor niet-admins zonder beheerpanelen", async () => {
    api.getCurrentUser.mockResolvedValue({ id: "u2", username: "editor", full_name: "Editor", email: "editor@example.com", is_admin: false });
    api.createWorkExternalPerson.mockResolvedValue({ id: "ep1", display_name: "Nieuwe externe", email: "extern@example.com", note: "", is_active: true, deleted_at: null });

    renderPage();

    const quickAddHeading = await screen.findByRole("heading", { name: "Externe personen quick-add" });
    const quickAddSection = quickAddHeading.closest("section");
    expect(quickAddSection).not.toBeNull();
    const quickAdd = within(quickAddSection as HTMLElement);

    await userEvent.type(quickAdd.getByLabelText("Naam"), "Nieuwe externe");
    await userEvent.type(quickAdd.getByLabelText("E-mail"), "extern@example.com");
    await userEvent.type(quickAdd.getByLabelText("Notitie"), "Vrije notitie");
    await userEvent.click(quickAdd.getByRole("button", { name: "Opslaan" }));

    expect(api.createWorkExternalPerson.mock.calls[0][0]).toEqual({ display_name: "Nieuwe externe", email: "extern@example.com", note: "Vrije notitie", force_create: false });
    expect(screen.queryByRole("heading", { name: "Beheer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Externe personen" })).not.toBeInTheDocument();
  });

  it("clears invalid post selections when the project changes in create and edit forms", async () => {
    api.listWorkHoursMeta.mockResolvedValue({
      projects: [
        { id: "p1", name: "Project A", description: "", is_active: true, is_archived: false, archived_at: null },
        { id: "p2", name: "Project B", description: "", is_active: true, is_archived: false, archived_at: null }
      ],
      posts: [
        { id: "post1", project_id: "p1", name: "Post A", description: "", is_active: true, is_archived: false, archived_at: null },
        { id: "post2", project_id: "p2", name: "Post B", description: "", is_active: true, is_archived: false, archived_at: null }
      ],
      external_people: [
        { id: "ep-active", display_name: "Actieve externe", email: "actief@example.com", note: "", is_active: true, deleted_at: null }
      ],
      historical_identities: [],
      is_admin: true
    });
    api.listWorkHourGroups.mockResolvedValue({
      items: [
        {
          id: "g1",
          work_date: "2026-07-30",
          project_id: "p1",
          project_name: "Project A",
          post_id: "post1",
          post_name: "Post A",
          description: "Oude beschrijving",
          duration_half_hours: 2,
          duration_hours: 1,
          person_count: 1,
          person_hours: 1,
          row_version: 1,
          deleted_at: null,
          participants: [
            { id: "gp1", participant_kind: "live_user", user_id: "u1", external_person_id: null, historical_identity_id: null, display_name_snapshot: "Admin", display_email_snapshot: "admin@example.com", display_type_snapshot: "WindWilly-gebruiker", sort_order: 0 }
          ]
        }
      ],
      total: 1,
      page: 1,
      page_size: 25,
      sort_key: "work_date",
      sort_direction: "desc",
      page_sizes: [25, 50, 100],
      totals: { total_groups: 1, total_people: 1, total_duration_hours: 1, total_person_hours: 1 }
    });
    api.createWorkHourGroup.mockResolvedValue({});
    api.updateWorkHourGroup.mockResolvedValue({});

    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Nieuwe registratie" }));
    const createSectionEl = (await screen.findByRole("heading", { name: "Nieuwe registratie" })).closest("section") as HTMLElement;
    const createSection = within(createSectionEl);
    const createProject = createSection.getByLabelText("Project") as HTMLSelectElement;
    const createPost = createSection.getByLabelText("Post") as HTMLSelectElement;

    await waitFor(() => expect(createProject.value).toBe("p1"));
    await userEvent.selectOptions(createProject, "p2");

    await waitFor(() => expect(createPost.value).toBe(""));
    await userEvent.click(createSection.getByRole("button", { name: "Opslaan" }));
    expect(api.createWorkHourGroup).not.toHaveBeenCalled();
    expect(screen.getByText("Kies een post binnen het geselecteerde project.")).toBeInTheDocument();

    await userEvent.click(createSection.getByRole("button", { name: "Annuleren" }));

    await userEvent.click(screen.getAllByRole("button", { name: "Bewerk" })[0]);
    const editSectionEl = (await screen.findByRole("heading", { name: "Registratie bewerken" })).closest("section") as HTMLElement;
    const editSection = within(editSectionEl);
    const editProject = editSection.getByLabelText("Project") as HTMLSelectElement;
    const editPost = editSection.getByLabelText("Post") as HTMLSelectElement;

    await userEvent.selectOptions(editProject, "p2");
    await waitFor(() => expect(editPost.value).toBe(""));
    await userEvent.selectOptions(editPost, "post2");
    await userEvent.click(editSection.getByRole("button", { name: "Wijzigingen opslaan" }));

    expect(api.updateWorkHourGroup).toHaveBeenCalledWith("g1", expect.objectContaining({ project_id: "p2", post_id: "post2" }));
  });

  it("toont duplicate kandidaten privacy-safe en laat kiezen bestaande of force-create toe", async () => {
    api.getCurrentUser.mockResolvedValue({ id: "u2", username: "editor", full_name: "Editor", email: "editor@example.com", is_admin: false });
    api.createWorkExternalPerson
      .mockRejectedValueOnce(new Error(JSON.stringify({ detail: { code: "work_hours_external_person_advisory_conflict", message: "Mogelijke dubbele externe persoon", candidates: [
        { id: "ep-active", display_name: "Bestaande kandidaat", is_active: true, deleted_at: null, status_label: "beschikbaar", selectable: true, guidance: null },
        { id: "ep-archived", display_name: "Gearchiveerde kandidaat", is_active: false, deleted_at: "2026-07-30T08:00:00Z", status_label: "historisch", selectable: false, guidance: "Herstel of koppel deze historische persoon eerst." }
      ] } })))
      .mockResolvedValueOnce({ id: "ep-forced", display_name: "Nieuwe kandidaat", email: "nieuw@example.com", note: "", is_active: true, deleted_at: null });

    renderPage();

    const quickAddHeading = await screen.findByRole("heading", { name: "Externe personen quick-add" });
    const quickAddSection = quickAddHeading.closest("section");
    expect(quickAddSection).not.toBeNull();
    const quickAdd = within(quickAddSection as HTMLElement);

    await userEvent.type(quickAdd.getByLabelText("Naam"), "Bestaande kandidaat");
    await userEvent.type(quickAdd.getByLabelText("E-mail"), "bestaand@example.com");
    await userEvent.type(quickAdd.getByLabelText("Notitie"), "Verborgen notitie");
    await userEvent.click(quickAdd.getByRole("button", { name: "Opslaan" }));

    expect(await screen.findByText("Bestaande kandidaat")).toBeInTheDocument();
    expect(screen.queryByText(/bestaand@example.com/)).not.toBeInTheDocument();
    expect(screen.queryByText("Verborgen notitie")).not.toBeInTheDocument();
    const candidateItems = screen.getAllByRole("listitem");
    const archivedCandidateItem = candidateItems.find((item) => item.textContent?.includes("Gearchiveerde kandidaat"));
    expect(archivedCandidateItem?.textContent ?? "").toContain("historisch");
    expect(archivedCandidateItem?.textContent ?? "").toContain("Herstel of koppel deze historische persoon eerst.");

    await userEvent.click(screen.getByRole("button", { name: "Kies bestaande" }));
    await userEvent.click(screen.getByRole("button", { name: "Toch aanmaken" }));
    await userEvent.click(await screen.findByRole("button", { name: "Bewust nieuw aanmaken" }));
    expect(api.createWorkExternalPerson).toHaveBeenNthCalledWith(2, { display_name: "Bestaande kandidaat", email: "bestaand@example.com", note: "Verborgen notitie", force_create: true }, expect.any(Object));
  });

  it("laat actieve externe personen toevoegen in de bewerkflow en toont historische opties als display-only", async () => {
    api.listWorkHoursMeta.mockResolvedValue({
      projects: [{ id: "p1", name: "Project A", description: "", is_active: true, is_archived: false, archived_at: null }],
      posts: [{ id: "post1", project_id: "p1", name: "Post A", description: "", is_active: true, is_archived: false, archived_at: null }],
      external_people: [
        { id: "ep-active", display_name: "Actieve externe", email: "actief@example.com", note: "", is_active: true, deleted_at: null },
        { id: "ep-archived", display_name: "Gearchiveerde externe", email: "archief@example.com", note: "", is_active: false, deleted_at: "2026-07-30T08:00:00Z" }
      ],
      historical_identities: [
        { id: "hist-1", source_key: "legacy-1", snapshot_name: "Oude persoon", snapshot_email: "oud@example.com", snapshot_display_label: "WindWilly-gebruiker", linked_user_id: null, linked_at: null, is_active: true }
      ],
      eligible_users: [
        { id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com" },
        { id: "u2", username: "collega", full_name: "Collega", email: "collega@example.com" }
      ],
      is_admin: true
    });
    api.listWorkHourGroups.mockResolvedValue({
      items: [
        {
          id: "g5",
          work_date: "2026-07-30",
          project_id: "p1",
          project_name: "Project A",
          post_id: "post1",
          post_name: "Post A",
          description: "Bewerk mij",
          duration_half_hours: 2,
          duration_hours: 1,
          person_count: 1,
          person_hours: 1,
          row_version: 1,
          deleted_at: null,
          participants: [
            { id: "gp1", participant_kind: "live_user", user_id: "u1", external_person_id: null, historical_identity_id: null, display_name_snapshot: "Admin", display_email_snapshot: "admin@example.com", display_type_snapshot: "WindWilly-gebruiker", sort_order: 0 }
          ]
        }
      ],
      total: 1,
      page: 1,
      page_size: 25,
      sort_key: "work_date",
      sort_direction: "desc",
      page_sizes: [25, 50, 100],
      totals: { total_groups: 1, total_people: 1, total_duration_hours: 1, total_person_hours: 1 }
    });

    renderPage();

    expect(await screen.findAllByText("Bewerk mij")).toHaveLength(2);
    await userEvent.click(screen.getAllByRole("button", { name: "Bewerk" })[0]);

    const editSection = within((await screen.findByRole("heading", { name: "Registratie bewerken" })).closest("section") as HTMLElement);
    expect(editSection.getByText("Gearchiveerde externe · historisch · niet selecteerbaar")).toBeInTheDocument();
    expect(editSection.getByText("WindWilly-gebruiker · Oude persoon · niet selecteerbaar")).toBeInTheDocument();
    const externalPicker = editSection.getByLabelText("Externe persoon toevoegen") as HTMLSelectElement;
    expect(within(externalPicker).getByRole("option", { name: "Actieve externe" })).toBeInTheDocument();
    expect(within(externalPicker).queryByRole("option", { name: "Gearchiveerde externe" })).not.toBeInTheDocument();

    await userEvent.click(editSection.getByRole("button", { name: "Actieve externe toevoegen" }));
    await waitFor(() => {
      const editParticipantItems = editSection.getAllByRole("listitem");
      const addedParticipant = editParticipantItems.find((item) => item.textContent?.includes("Actieve externe") && item.textContent?.includes("Extern"));
      expect(addedParticipant?.textContent ?? "").toContain("Actieve externe");
      expect(addedParticipant?.textContent ?? "").toContain("Extern");
    });
  });

  it("ververst de deleted-items lijst na verwijderen", async () => {
    api.listWorkHourGroups.mockResolvedValue({
      items: [
        {
          id: "g4",
          work_date: "2026-07-30",
          project_id: "p1",
          project_name: "Project A",
          post_id: "post1",
          post_name: "Post A",
          description: "Te verwijderen",
          duration_half_hours: 2,
          duration_hours: 1,
          person_count: 1,
          person_hours: 1,
          row_version: 1,
          deleted_at: null,
          participants: []
        }
      ],
      total: 1,
      page: 1,
      page_size: 25,
      sort_key: "work_date",
      sort_direction: "desc",
      page_sizes: [25, 50, 100],
      totals: { total_groups: 1, total_people: 1, total_duration_hours: 1, total_person_hours: 1 }
    });
    api.deleteWorkHourGroup.mockResolvedValue({ status: "deleted" });

    renderPage();

    expect(await screen.findAllByText("Te verwijderen")).toHaveLength(2);
    await userEvent.click(screen.getByRole("checkbox", { name: "Gearchiveerd/verwijderd tonen" }));

    const deletedCalls = () => api.listWorkHourGroups.mock.calls.filter(([params]) => Boolean((params as { deleted_only?: boolean } | undefined)?.deleted_only)).length;
    await waitFor(() => expect(deletedCalls()).toBe(1));

    await userEvent.click(screen.getAllByRole("button", { name: "Verwijder" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Bevestig verwijderen" }));

    await waitFor(() => expect(deletedCalls()).toBeGreaterThan(1));
  });

  it("ververst de deleted-items lijst na import full restore", async () => {
    api.previewWorkHoursImport.mockResolvedValue({
      batch_id: "batch-1",
      status: "previewed",
      counts: { projects: 0, posts: 0, external_people: 0, historical_identities: 0, groups: 0 },
      warnings: [],
      errors: [],
      backup_download_url: "/api/urenverantwoording/import/batches/batch-1/backup"
    });
    api.commitWorkHoursImport.mockResolvedValue({
      batch_id: "batch-1",
      status: "completed",
      backup_download_url: "/api/urenverantwoording/import/batches/batch-1/backup"
    });

    renderPage();

    await screen.findByRole("heading", { name: "Beheer" });
    await userEvent.click(screen.getByRole("checkbox", { name: "Gearchiveerd/verwijderd tonen" }));

    const deletedCalls = () => api.listWorkHourGroups.mock.calls.filter(([params]) => Boolean((params as { deleted_only?: boolean } | undefined)?.deleted_only)).length;
    await waitFor(() => expect(deletedCalls()).toBe(1));

    await userEvent.click(screen.getByRole("button", { name: "Open import en backup" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Modus" }), "full_restore");
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    await screen.findByText(/Preview batch batch-1/);
    await userEvent.click(screen.getByRole("button", { name: "Commit" }));

    await waitFor(() => expect(deletedCalls()).toBeGreaterThan(1));
  });

  it("ververst de deleted-items query bij filterwijziging", async () => {
    api.listWorkHourGroups.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 25,
      sort_key: "work_date",
      sort_direction: "desc",
      page_sizes: [25, 50, 100],
      totals: { total_groups: 0, total_people: 0, total_duration_hours: 0, total_person_hours: 0 }
    });

    renderPage();

    await screen.findByRole("heading", { name: "Beheer" });
    await userEvent.click(screen.getByRole("checkbox", { name: "Gearchiveerd/verwijderd tonen" }));
    await waitFor(() => {
      expect(api.listWorkHourGroups).toHaveBeenCalledWith(expect.objectContaining({ include_deleted: true, deleted_only: true, page: 1, page_size: 25, sort_key: "work_date", sort_direction: "desc" }));
    });

    api.listWorkHourGroups.mockClear();
    await userEvent.selectOptions(screen.getAllByRole("combobox", { name: "Project" })[0], "p1");

    await waitFor(() => {
      expect(api.listWorkHourGroups).toHaveBeenCalledWith(expect.objectContaining({ include_deleted: true, deleted_only: true, project_id: "p1", page: 1, page_size: 25, sort_key: "work_date", sort_direction: "desc" }));
    });
  });

  it("navigeert via vorige en volgende naar de serverpagina", async () => {
    api.listWorkHourGroups
      .mockResolvedValueOnce({
        items: [
          {
            id: "g1",
            work_date: "2026-07-30",
            project_id: "p1",
            project_name: "Project A",
            post_id: "post1",
            post_name: "Post A",
            description: "Pagina 1",
            duration_half_hours: 2,
            duration_hours: 1,
            person_count: 1,
            person_hours: 1,
            row_version: 1,
            deleted_at: null,
            participants: []
          }
        ],
        total: 26,
        page: 1,
        page_size: 25,
        sort_key: "work_date",
        sort_direction: "desc",
        page_sizes: [25, 50, 100],
        totals: { total_groups: 26, total_people: 26, total_duration_hours: 26, total_person_hours: 26 }
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "g2",
            work_date: "2026-07-29",
            project_id: "p1",
            project_name: "Project A",
            post_id: "post1",
            post_name: "Post A",
            description: "Pagina 2",
            duration_half_hours: 2,
            duration_hours: 1,
            person_count: 1,
            person_hours: 1,
            row_version: 1,
            deleted_at: null,
            participants: []
          }
        ],
        total: 26,
        page: 2,
        page_size: 25,
        sort_key: "work_date",
        sort_direction: "desc",
        page_sizes: [25, 50, 100],
        totals: { total_groups: 26, total_people: 26, total_duration_hours: 26, total_person_hours: 26 }
      });

    renderPage();

    expect(await screen.findByText("Pagina 1 van 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Volgende" }));

    expect(await screen.findByText("Pagina 2 van 2")).toBeInTheDocument();
    expect(api.listWorkHourGroups).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, page_size: 25, sort_key: "work_date", sort_direction: "desc" }));
  });

  it("exporteert met dezelfde filter- en sorteercontracten", async () => {
    api.listWorkHourGroups.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 25,
      sort_key: "work_date",
      sort_direction: "desc",
      page_sizes: [25, 50, 100],
      totals: { total_groups: 0, total_people: 0, total_duration_hours: 0, total_person_hours: 0 }
    });

    api.downloadWorkHoursCsv.mockResolvedValue(new Blob(["csv"]));

    renderPage();

    await screen.findAllByRole("option", { name: "Project A" });
    await userEvent.selectOptions(screen.getAllByRole("combobox", { name: "Project" })[0], "p1");
    await userEvent.type(screen.getByPlaceholderText("Zoek in beschrijving, project of post"), "wind");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sorteer op" }), "project");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Volgorde" }), "asc");
    await userEvent.click(screen.getByRole("button", { name: "CSV export" }));

    expect(api.downloadWorkHoursCsv).toHaveBeenCalledWith(expect.objectContaining({ project_id: "p1", query: "wind", sort_key: "project", sort_direction: "asc" }));
    expect(api.downloadWorkHoursCsv.mock.calls[0][0]).not.toHaveProperty("include_deleted");
  });

  it("shows all eligible active users and external people in create and edit pickers", async () => {
    api.listWorkHoursMeta.mockReset();
    api.listWorkHoursMeta.mockResolvedValue({
      projects: [{ id: "p1", name: "Project A", description: "", is_active: true, is_archived: false, archived_at: null }],
      posts: [{ id: "post1", project_id: "p1", name: "Post A", description: "", is_active: true, is_archived: false, archived_at: null }],
      external_people: [{ id: "ep-active", display_name: "Actieve externe", email: "actief@example.com", note: "", is_active: true, deleted_at: null }],
      historical_identities: [],
      eligible_users: [{ id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com" }, { id: "u2", username: "collega", full_name: "Collega", email: "collega@example.com" }],
      is_admin: true
    });
    api.listWorkHourGroups.mockResolvedValue({
      items: [{ id: "g-picker", work_date: "2026-08-04", project_id: "p1", project_name: "Project A", post_id: "post1", post_name: "Post A", description: "Picker", duration_half_hours: 2, duration_hours: 1, person_count: 1, person_hours: 1, row_version: 1, deleted_at: null, participants: [{ id: "gp-picker", participant_kind: "live_user", user_id: "u1", external_person_id: null, historical_identity_id: null, display_name_snapshot: "Admin", display_email_snapshot: "admin@example.com", display_type_snapshot: "WindWilly-gebruiker", sort_order: 0 }] }],
      total: 1, page: 1, page_size: 25, sort_key: "work_date", sort_direction: "desc", page_sizes: [25, 50, 100], totals: { total_groups: 1, total_people: 1, total_duration_hours: 1, total_person_hours: 1 }
    });
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Nieuwe registratie" }));
    const create = within((await screen.findByRole("heading", { name: "Nieuwe registratie" })).closest("section") as HTMLElement);
    const createUsers = create.getByLabelText("WindWilly-persoon");
    expect(await within(createUsers).findByRole("option", { name: "Admin" })).toBeInTheDocument();
    expect(within(createUsers).getByRole("option", { name: "Collega" })).toBeInTheDocument();
    expect(within(create.getByLabelText("Externe persoon")).getByRole("option", { name: "Actieve externe" })).toBeInTheDocument();
    await userEvent.selectOptions(createUsers, "u2");
    await userEvent.click(create.getByRole("button", { name: "Voeg WindWilly-persoon toe" }));
    expect(create.getByText("Collega · WindWilly-gebruiker")).toBeInTheDocument();

    await userEvent.click(create.getByRole("button", { name: "Annuleren" }));

    await userEvent.click(screen.getAllByRole("button", { name: "Bewerk" })[0]);
    const edit = within((await screen.findByRole("heading", { name: "Registratie bewerken" })).closest("section") as HTMLElement);
    expect(within(edit.getByLabelText("WindWilly-persoon toevoegen")).getByRole("option", { name: "Collega" })).toBeInTheDocument();
    await userEvent.click(edit.getByRole("button", { name: "Actieve WindWilly-persoon toevoegen" }));
    expect(edit.getByText("Collega · WindWilly-gebruiker")).toBeInTheDocument();
  });

  it("filters audit by actor action result method path and inclusive time range and renders details", async () => {
    api.listWorkHoursAudit.mockResolvedValue({ items: [{ id: "audit-1", event_type: "work_hours.group.updated", actor_user_id: "u1", actor_display_name: "Admin", action: "work_hours.group.updated", result: "success", request_method: "PATCH", request_path: "/api/urenverantwoording/groepen/g1", details_json: "{}", created_at: "2026-08-04T10:00:00Z" }], total: 1, page: 1, page_size: 25 });
    renderPage();
    const audit = within((await screen.findByRole("heading", { name: "Audit" })).closest("section") as HTMLElement);
    await userEvent.type(audit.getByLabelText("Actor-ID"), "u1");
    await userEvent.type(audit.getByLabelText("Actie"), "work_hours.group.updated");
    await userEvent.type(audit.getByLabelText("Resultaat"), "success");
    await userEvent.type(audit.getByLabelText("HTTP-methode"), "PATCH");
    await userEvent.type(audit.getByLabelText("Requestpad"), "/groepen/g1");
    await userEvent.type(audit.getByLabelText("Vanaf"), "2026-08-04T09:00");
    await userEvent.type(audit.getByLabelText("Tot en met"), "2026-08-04T11:00");

    await waitFor(() => expect(api.listWorkHoursAudit).toHaveBeenLastCalledWith({ actor: "u1", action: "work_hours.group.updated", result: "success", method: "PATCH", path: "/groepen/g1", from: "2026-08-04T09:00", to: "2026-08-04T11:00", page: 1, page_size: 25 }));
    expect(audit.getByText(/Admin .* work_hours\.group\.updated .* PATCH \/api\/urenverantwoording\/groepen\/g1 .* success/)).toBeInTheDocument();
  });

  it("does not expose hours audit controls or rows to non-admin users", async () => {
    api.getCurrentUser.mockResolvedValue({ id: "u2", username: "editor", full_name: "Editor", email: "editor@example.com", is_admin: false });
    renderPage();
    await screen.findByRole("heading", { name: "Urenregistratie" });
    await waitFor(() => expect(api.getCurrentUser).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Audit" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Auditfilters")).not.toBeInTheDocument();
    expect(api.listWorkHoursAudit).not.toHaveBeenCalled();
  });

  it("exposes chart titles categories and exact values and hides decorative bars", async () => {
    api.listWorkHourGroups.mockReset();
    api.listWorkHourGroups.mockResolvedValue({ items: [], total: 2, page: 1, page_size: 25, sort_key: "work_date", sort_direction: "desc", page_sizes: [25, 50, 100], totals: { total_groups: 2, total_people: 3, total_duration_hours: 4, total_person_hours: 7 } });
    renderPage();
    await screen.findByText("Totaal: 2 groepen, 7 persoon-uren.");
    const chartElement = (await screen.findByRole("heading", { name: "Urenoverzicht" })).closest("section") as HTMLElement;
    const chart = within(chartElement);
    expect(chart.getByText("Groepsuren")).toBeInTheDocument();
    expect(chart.getByText("Persoon-uren")).toBeInTheDocument();
    expect(chart.getByText("4")).toBeInTheDocument();
    expect(chart.getByText("7")).toBeInTheDocument();
    expect(chartElement.querySelector(".work-hours-chart-bars")).toHaveAttribute("aria-hidden", "true");
  });

  it("supports modal initial focus trap escape and focus return", async () => {
    api.listWorkHourGroups.mockResolvedValue({ items: [{ id: "g-a11y", work_date: "2026-08-04", project_id: "p1", project_name: "Project A", post_id: "post1", post_name: "Post A", description: "Toegankelijk", duration_half_hours: 2, duration_hours: 1, person_count: 1, person_hours: 1, row_version: 3, deleted_at: null, participants: [{ id: "gp-a11y", participant_kind: "live_user", user_id: "u1", external_person_id: null, historical_identity_id: null, display_name_snapshot: "Admin", display_email_snapshot: "admin@example.com", display_type_snapshot: "WindWilly-gebruiker", sort_order: 0 }] }], total: 1, page: 1, page_size: 25, sort_key: "work_date", sort_direction: "desc", page_sizes: [25, 50, 100], totals: { total_groups: 1, total_people: 1, total_duration_hours: 1, total_person_hours: 1 } });
    renderPage();
    await screen.findAllByText("Toegankelijk");
    const trigger = screen.getAllByRole("button", { name: "Bewerk" })[0];
    trigger.focus();
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Registratie bewerken" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Registratie bewerken" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("traps focus and makes background inert in every hours modal", async () => {
    renderPage();
    const trigger = await screen.findByRole("button", { name: "Nieuwe registratie" });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Nieuwe registratie" });
    const backgroundRoot = Array.from(document.body.children).find((element) => !element.hasAttribute("data-hours-modal-host")) as HTMLElement;
    expect(backgroundRoot.inert).toBe(true);
    expect(backgroundRoot).toHaveAttribute("aria-hidden", "true");
    const buttons = within(dialog).getAllByRole("button");
    buttons.at(-1)?.focus();
    await userEvent.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(backgroundRoot.inert).not.toBe(true);
  });

  it("associates_each_field_error_and_moves_focus_to_first_invalid_field", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Nieuwe registratie" }));
    const dialog = await screen.findByRole("dialog", { name: "Nieuwe registratie" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Opslaan" }));
    const invalid = document.getElementById("hours-create-post") as HTMLElement;
    expect(invalid).toHaveAttribute("aria-invalid", "true");
    expect(invalid).toHaveAttribute("aria-describedby", "hours-create-post-error");
    expect(document.getElementById("hours-create-post-error")).toHaveTextContent("Kies een post binnen het geselecteerde project.");
    await waitFor(() => expect(invalid).toHaveFocus());
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Controleer de gemarkeerde velden.");
  });

  it("retains_field_errors_until_that_field_is_validly_revalidated", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Nieuwe registratie" }));
    const dialog = await screen.findByRole("dialog", { name: "Nieuwe registratie" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Opslaan" }));
    const post = document.getElementById("hours-create-post") as HTMLSelectElement;
    expect(post).toHaveAttribute("aria-invalid", "true");
    await userEvent.selectOptions(post, "post1");
    expect(post).toHaveAttribute("aria-invalid", "false");
    expect(document.getElementById("hours-create-post-error")).not.toBeInTheDocument();
  });

  it.each([
    ["hard email", "work_hours_external_person_hard_conflict"],
    ["hard identity", "work_hours_external_person_hard_conflict"],
    ["mixed conflict", "work_hours_external_person_hard_conflict"]
  ])("force create is rendered only for advisory name conflict and never for %s", async (_label, code) => {
    api.getCurrentUser.mockResolvedValue({ id: "u2", username: "editor", full_name: "Editor", is_admin: false });
    api.createWorkExternalPerson.mockRejectedValue(new Error(JSON.stringify({ detail: { code, message: "Hard conflict", candidates: [{ id: "hard", display_name: "Hard kandidaat", selectable: true, is_active: true }] } })));
    renderPage();
    const section = within((await screen.findByRole("heading", { name: "Externe personen quick-add" })).closest("section") as HTMLElement);
    await userEvent.type(section.getByLabelText("Naam"), "Hard kandidaat");
    await userEvent.type(section.getByLabelText("E-mail"), "hard@example.com");
    await userEvent.click(section.getByRole("button", { name: "Opslaan" }));
    await screen.findByText("Hard kandidaat");
    expect(screen.queryByRole("button", { name: "Toch aanmaken" })).not.toBeInTheDocument();
    expect(api.createWorkExternalPerson).toHaveBeenCalledTimes(1);
    expect(api.createWorkExternalPerson.mock.calls[0][0]).toEqual(expect.objectContaining({ force_create: false }));
  });

  it("csv export is independent of deleted management filters page and visibility state", async () => {
    api.downloadWorkHoursCsv.mockResolvedValue(new Blob(["csv"]));
    renderPage();
    await screen.findByRole("heading", { name: "Beheer" });
    await userEvent.click(screen.getByLabelText("Gearchiveerd/verwijderd tonen"));
    await userEvent.click(screen.getByRole("button", { name: "CSV export" }));
    const request = api.downloadWorkHoursCsv.mock.calls[0][0];
    expect(request).not.toHaveProperty("include_deleted");
    expect(request).not.toHaveProperty("deleted_only");
    expect(request).not.toHaveProperty("page");
    expect(request).not.toHaveProperty("page_size");
  });

  it("audit UI requests and renders server pages at page sizes 25 50 and 100", async () => {
    api.listWorkHoursAudit.mockImplementation(async (params: { page?: number; page_size?: number }) => ({ items: [], total: 126, page: params.page ?? 1, page_size: params.page_size ?? 25 }));
    renderPage();
    const audit = within((await screen.findByRole("heading", { name: "Audit" })).closest("section") as HTMLElement);
    await userEvent.click(audit.getByRole("button", { name: "Volgende auditpagina" }));
    await waitFor(() => expect(api.listWorkHoursAudit).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, page_size: 25 })));
    await userEvent.selectOptions(audit.getByLabelText("Auditregels per pagina"), "50");
    await waitFor(() => expect(api.listWorkHoursAudit).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, page_size: 50 })));
    await userEvent.selectOptions(audit.getByLabelText("Auditregels per pagina"), "100");
    await waitFor(() => expect(api.listWorkHoursAudit).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, page_size: 100 })));
    expect(audit.getByRole("button", { name: "Vorige auditpagina" })).toBeDisabled();
  });

  it("renders every overview expanded and card date as dd-mm-jjjj", async () => {
    api.listWorkHourGroups.mockResolvedValue({ items: [{ id: "date-group", work_date: "2026-01-02", project_id: "p1", project_name: "Project A", post_id: "post1", post_name: "Post A", description: "Datum", duration_half_hours: 2, duration_hours: 1, person_count: 1, person_hours: 1, row_version: 1, participants: [{ id: "date-p", display_name_snapshot: "Admin", display_type_snapshot: "WindWilly-gebruiker", sort_order: 0 }] }], total: 1, page: 1, page_size: 25, sort_key: "work_date", sort_direction: "desc", page_sizes: [25, 50, 100], totals: { total_groups: 1, total_people: 1, total_duration_hours: 1, total_person_hours: 1 } });
    renderPage();
    expect((await screen.findAllByText(/02-01-2026/)).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/2026-01-02/)).not.toBeInTheDocument();
  });
});
