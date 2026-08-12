import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UrenverantwoordingPage } from "./UrenverantwoordingPage";

const api = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), listWorkHoursMeta: vi.fn(), listWorkHourGroups: vi.fn(), listWorkHoursAudit: vi.fn(),
  createWorkHourGroup: vi.fn(), updateWorkHourGroup: vi.fn(), deleteWorkHourGroup: vi.fn(), restoreWorkHourGroup: vi.fn(),
  createWorkExternalPerson: vi.fn(), updateWorkExternalPerson: vi.fn(), archiveWorkExternalPerson: vi.fn(), restoreWorkExternalPerson: vi.fn(), mergeWorkExternalPerson: vi.fn(),
  downloadWorkHoursCsv: vi.fn(),
  listWorkHoursAdminHistory: vi.fn(), listWorkHoursAdminMasterdata: vi.fn(), relinkWorkHistoricalIdentity: vi.fn()
}));
vi.mock("../../../lib/api/client", () => api);

const emptyList = { items: [], total: 0, page: 1, page_size: 25, sort_key: "work_date", sort_direction: "desc", page_sizes: [25, 50, 100], totals: { total_groups: 0, total_people: 0, total_duration_hours: 0, total_person_hours: 0 } };
const group = {
  id: "g-existing", work_date: "2026-08-08", project_id: "p1", project_name: "Project A", post_id: "post1", post_name: "Post A",
  description: "Bestaand werk", duration_half_hours: 4, duration_hours: 2, person_count: 1, row_version: 7, deleted_at: null,
  participants: [{ id: "part1", participant_kind: "live_user", user_id: "u1", display_name_snapshot: "Admin", display_email_snapshot: "admin@example.com", display_type_snapshot: "WindWilly-gebruiker", sort_order: 0 }]
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><UrenverantwoordingPage /></MemoryRouter></QueryClientProvider>);
}

async function waitForSelectOption(select: HTMLElement, optionName: string) {
  await waitFor(() => expect(within(select).getByRole("option", { name: optionName })).toBeInTheDocument());
}

function closestHTMLElement(element: HTMLElement, selector: string): HTMLElement {
  const match = element.closest(selector);
  if (!(match instanceof HTMLElement)) throw new Error(`Expected ${selector} to resolve to an HTMLElement`);
  return match;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.URL.createObjectURL = vi.fn(() => "blob:mock");
  window.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  api.getCurrentUser.mockResolvedValue({ id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com", is_admin: true });
  api.listWorkHoursMeta.mockResolvedValue({
    projects: [{ id: "p1", name: "Project A", is_active: true, is_archived: false }],
    posts: [{ id: "post1", name: "Post A", is_active: true, is_archived: false }],
    external_people: [{ id: "ep1", display_name: "Externe Anna", email: "anna@example.com", is_active: true, deleted_at: null }],
    historical_identities: [],
    eligible_users: [{ id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com" }, { id: "u2", username: "piet", full_name: "Piet", email: "piet@example.com" }],
    is_admin: true
  });
  api.listWorkHourGroups.mockResolvedValue(emptyList);
  api.listWorkHoursAudit.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25 });
  api.listWorkHoursAdminHistory.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25 });
  api.listWorkHoursAdminMasterdata.mockResolvedValue({ projects: [], posts: [], external_people: [] });
  api.createWorkHourGroup.mockResolvedValue({ id: "g1" });
});

describe("UrenverantwoordingPage compact central management", () => {
  it("shows the permanent complete inline create row and no create modal trigger", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Urenregistratie" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project voor nieuwe registratie")).toBeInTheDocument();
    expect(screen.getByLabelText("Post voor nieuwe registratie")).toBeInTheDocument();
    expect(screen.getByLabelText("Beschrijving nieuwe registratie")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registratie opslaan" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nieuwe registratie" })).not.toBeInTheDocument();
  });

  it("uses the visibility-filtered project contracts for registration and project filters", async () => {
    api.listWorkHoursMeta.mockResolvedValueOnce({
      projects: [{ id: "p-visible", name: "Beschikbaar project", is_active: true, is_archived: false }],
      filter_projects: [{ id: "p-visible", name: "Beschikbaar project", selectable: true }],
      posts: [{ id: "post1", name: "Post A", is_active: true, is_archived: false }],
      external_people: [], historical_identities: [], eligible_users: [], is_admin: true
    });
    renderPage();

    const registrationProject = await screen.findByLabelText("Project voor nieuwe registratie");
    await waitForSelectOption(registrationProject, "Beschikbaar project");
    expect(within(registrationProject).queryByRole("option", { name: "Verborgen urenproject" })).not.toBeInTheDocument();

    const projectFilter = (await screen.findByLabelText("Filter Project")).closest("details")!;
    await userEvent.click(within(projectFilter).getByLabelText("Filter Project"));
    expect(within(projectFilter).getByRole("button", { name: "Beschikbaar project" })).toBeInTheDocument();
    expect(within(projectFilter).queryByRole("button", { name: /Verborgen urenproject/ })).not.toBeInTheDocument();
  });

  it("creates a group with multiple participants without a create modal", async () => {
    renderPage();
    const desktopProject = await screen.findByLabelText("Project voor nieuwe registratie");
    await waitForSelectOption(desktopProject, "Project A");
    await userEvent.selectOptions(desktopProject, "p1");
    await userEvent.selectOptions(screen.getByLabelText("Post voor nieuwe registratie"), "post1");
    await userEvent.type(screen.getByLabelText("Beschrijving nieuwe registratie"), "Werkbezoek");
    const participantSelector = screen.getAllByRole("region", { name: "Deelnemers kiezen" })[0];
    await userEvent.click(within(participantSelector).getByText("WindWilly-personen"));
    await userEvent.click(within(participantSelector).getByRole("checkbox", { name: /Admin WindWilly-persoon/i }));
    await userEvent.click(within(participantSelector).getByRole("checkbox", { name: /Piet WindWilly-persoon/i }));
    await userEvent.click(within(participantSelector).getByText("Externe personen"));
    await userEvent.click(within(participantSelector).getByRole("checkbox", { name: /Externe Anna Externe persoon/i }));
    await userEvent.click(screen.getByRole("button", { name: "Registratie opslaan" }));
    await waitFor(() => expect(api.createWorkHourGroup.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      project_id: "p1", post_id: "post1", description: "Werkbezoek",
      participants: [expect.objectContaining({ user_id: "u2" }), expect.objectContaining({ external_person_id: "ep1" })]
    })));
    expect(screen.queryByRole("dialog", { name: /nieuwe registratie/i })).not.toBeInTheDocument();
  });

  it("makes the current-user default explicit, submits only canonical checks, and restores it on reset", async () => {
    renderPage();
    const mobile = within(await screen.findByRole("region", { name: "Nieuwe registratie" }));
    const selector = mobile.getByRole("region", { name: "Deelnemers kiezen" });
    await userEvent.click(within(selector).getByText("WindWilly-personen"));
    const admin = within(selector).getByRole("checkbox", { name: /Admin WindWilly-persoon/i });
    expect(admin).toBeChecked();
    const project = mobile.getByLabelText("Project voor nieuwe registratie mobiel");
    await waitForSelectOption(project, "Project A");
    await userEvent.selectOptions(project, "p1");
    await userEvent.selectOptions(mobile.getByLabelText("Post voor nieuwe registratie mobiel"), "post1");
    await userEvent.click(mobile.getByRole("button", { name: "Registratie mobiel opslaan" }));
    await waitFor(() => expect(api.createWorkHourGroup.mock.calls[0]?.[0].participants).toEqual([
      expect.objectContaining({ participant_kind: "live_user", user_id: "u1" })
    ]));
    expect(admin).toBeChecked();

    await userEvent.click(admin);
    await userEvent.click(mobile.getByRole("button", { name: "Registratie mobiel opslaan" }));
    expect(api.createWorkHourGroup).toHaveBeenCalledTimes(1);
    expect(mobile.getByText("Kies minimaal één deelnemer.")).toBeInTheDocument();
    await userEvent.click(mobile.getByRole("button", { name: "Mobiele registratie resetten" }));
    expect(admin).toBeChecked();
  });

  it("separates selectable participant groups, toggles selections, and keeps the half-hour payload", async () => {
    renderPage();
    const desktopProject = await screen.findByLabelText("Project voor nieuwe registratie");
    await waitForSelectOption(desktopProject, "Project A");
    await userEvent.selectOptions(desktopProject, "p1");
    await userEvent.selectOptions(screen.getByLabelText("Post voor nieuwe registratie"), "post1");
    await userEvent.click(screen.getByRole("button", { name: /deelnemer\(s\)/i }));
    const participantSelector = screen.getAllByRole("region", { name: "Deelnemers kiezen" })[0];
    expect(within(participantSelector).getByText("WindWilly-personen")).toBeInTheDocument();
    expect(within(participantSelector).getByText("Externe personen")).toBeInTheDocument();
    await userEvent.click(within(participantSelector).getByText("WindWilly-personen"));
    await userEvent.click(within(participantSelector).getByRole("checkbox", { name: /Admin WindWilly-persoon/i }));
    await userEvent.click(within(participantSelector).getByRole("checkbox", { name: /Piet WindWilly-persoon/i }));
    await userEvent.click(within(participantSelector).getByText("Externe personen"));
    const external = within(participantSelector).getByRole("checkbox", { name: /Externe Anna Externe persoon/i });
    await userEvent.click(external);
    expect(screen.getByRole("list", { name: "Gekozen deelnemers" })).toHaveTextContent("Piet");
    await userEvent.click(external);
    expect(screen.getByRole("list", { name: "Gekozen deelnemers" })).not.toHaveTextContent("Externe Anna");
    const duration = screen.getByLabelText("Duur in uren");
    expect(within(duration).getByRole("option", { name: "0.5 uur" })).toBeInTheDocument();
    expect(within(duration).getByRole("option", { name: "1 uur" })).toBeInTheDocument();
    expect(within(duration).getByRole("option", { name: "1.5 uur" })).toBeInTheDocument();
    await userEvent.selectOptions(duration, "3");
    await userEvent.click(screen.getByRole("button", { name: "Registratie opslaan" }));
    await waitFor(() => expect(api.createWorkHourGroup).toHaveBeenCalledWith(expect.objectContaining({ duration_half_hours: 3, participants: [expect.objectContaining({ user_id: "u2" })] }), expect.any(Object)));
  });

  it("filters explicitly non-selectable users and external people while retaining selected display", async () => {
    api.listWorkHoursMeta.mockResolvedValueOnce({
      projects: [{ id: "p1", name: "Project A", is_active: true, is_archived: false }],
      posts: [{ id: "post1", name: "Post A", is_active: true, is_archived: false }],
      external_people: [
        { id: "ep1", display_name: "Externe Anna", email: "anna@example.com", is_active: true, deleted_at: null, selectable: true },
        { id: "ep-old", display_name: "Historische externe", email: null, is_active: true, deleted_at: null, selectable: false }
      ],
      historical_identities: [],
      eligible_users: [
        { id: "u1", username: "admin", full_name: "Admin", email: "admin@example.com", selectable: false },
        { id: "u2", username: "piet", full_name: "Piet", email: "piet@example.com", selectable: true }
      ],
      is_admin: true
    });
    renderPage();
    const mobile = within(await screen.findByRole("region", { name: "Nieuwe registratie" }));
    const selector = mobile.getByRole("region", { name: "Deelnemers kiezen" });
    await waitFor(() => expect(mobile.getByRole("list", { name: "Gekozen deelnemers mobiel" })).toHaveTextContent("Admin"));
    await userEvent.click(within(selector).getByText("WindWilly-personen"));
    expect(within(selector).queryByRole("checkbox", { name: /Admin WindWilly-persoon/i })).not.toBeInTheDocument();
    expect(within(selector).getByRole("checkbox", { name: /Piet WindWilly-persoon/i })).toBeInTheDocument();
    await userEvent.click(within(selector).getByText("Externe personen"));
    expect(within(selector).getByRole("checkbox", { name: /Externe Anna Externe persoon/i })).toBeInTheDocument();
    expect(within(selector).queryByRole("checkbox", { name: /Historische externe/i })).not.toBeInTheDocument();
  });

  it("links the mobile participant error to its focusable region and clears it after checkbox selection", async () => {
    renderPage();
    const mobile = within(await screen.findByRole("region", { name: "Nieuwe registratie" }));
    const project = mobile.getByLabelText("Project voor nieuwe registratie mobiel");
    await waitForSelectOption(project, "Project A");
    await userEvent.selectOptions(project, "p1");
    await userEvent.selectOptions(mobile.getByLabelText("Post voor nieuwe registratie mobiel"), "post1");
    const selector = mobile.getByRole("region", { name: "Deelnemers kiezen" });
    await userEvent.click(within(selector).getByText("WindWilly-personen"));
    await userEvent.click(within(selector).getByRole("checkbox", { name: /Admin WindWilly-persoon/i }));
    await userEvent.click(mobile.getByRole("button", { name: "Registratie mobiel opslaan" }));
    await waitFor(() => expect(selector).toHaveFocus());
    expect(selector).toHaveAttribute("tabindex", "-1");
    expect(selector).toHaveAttribute("aria-invalid", "true");
    expect(selector).toHaveAttribute("aria-describedby", "hours-mobile-create-participants-error");
    expect(document.getElementById("hours-mobile-create-participants-error")).toHaveTextContent("Kies minimaal één deelnemer.");
    await userEvent.click(within(selector).getByRole("checkbox", { name: /Piet WindWilly-persoon/i }));
    expect(selector).not.toHaveAttribute("aria-invalid");
    expect(selector).not.toHaveAttribute("aria-describedby");
    expect(document.getElementById("hours-mobile-create-participants-error")).not.toBeInTheDocument();
  });

  it("clears stale participant validation after quick-add and duplicate candidate resolution", async () => {
    renderPage();
    const mobile = within(await screen.findByRole("region", { name: "Nieuwe registratie" }));
    const project = mobile.getByLabelText("Project voor nieuwe registratie mobiel");
    await waitForSelectOption(project, "Project A");
    await userEvent.selectOptions(project, "p1");
    await userEvent.selectOptions(mobile.getByLabelText("Post voor nieuwe registratie mobiel"), "post1");
    const selector = mobile.getByRole("region", { name: "Deelnemers kiezen" });
    await userEvent.click(within(selector).getByText("WindWilly-personen"));
    await userEvent.click(within(selector).getByRole("checkbox", { name: /Admin WindWilly-persoon/i }));
    await userEvent.click(mobile.getByRole("button", { name: "Registratie mobiel opslaan" }));
    expect(await mobile.findByText("Kies minimaal één deelnemer.")).toBeInTheDocument();

    api.createWorkExternalPerson.mockResolvedValueOnce({ id: "ep-new", display_name: "Nieuwe externe", email: null, is_active: true });
    await userEvent.type(mobile.getByLabelText("Naam externe persoon mobiel"), "Nieuwe externe");
    await userEvent.click(mobile.getByRole("button", { name: "Externe persoon mobiel aanmaken en toevoegen" }));
    await waitFor(() => expect(selector).not.toHaveAttribute("aria-invalid"));

    await userEvent.click(mobile.getByRole("button", { name: "Mobiele registratie resetten" }));
    await userEvent.click(within(selector).getByRole("checkbox", { name: /Admin WindWilly-persoon/i }));
    await userEvent.click(mobile.getByRole("button", { name: "Registratie mobiel opslaan" }));
    expect(await mobile.findByText("Kies minimaal één deelnemer.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /deelnemer\(s\)/i }));
    api.createWorkExternalPerson.mockRejectedValueOnce(new Error(JSON.stringify({ detail: { code: "external_person_exact_duplicate", message: "Mogelijke dubbele externe persoon", candidates: [{ id: "ep1", display_name: "Externe Anna", email: "anna@example.com", is_active: true, deleted_at: null, selectable: true }] } })));
    await userEvent.clear(mobile.getByLabelText("Naam externe persoon mobiel"));
    await userEvent.type(mobile.getByLabelText("Naam externe persoon mobiel"), "Externe Anna");
    await userEvent.click(mobile.getByRole("button", { name: "Externe persoon mobiel aanmaken en toevoegen" }));
    const candidateButton = await screen.findByRole("button", { name: /Gebruik Externe Anna/ });
    await userEvent.click(candidateButton);
    expect(selector).not.toHaveAttribute("aria-invalid");
    expect(mobile.queryByText("Kies minimaal één deelnemer.")).not.toBeInTheDocument();
  });

  it("quick-adds an external person from the expanded inline participant editor", async () => {
    api.createWorkExternalPerson.mockResolvedValue({ id: "ep2", display_name: "Nieuwe externe", email: "nieuw@example.com", is_active: true });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /deelnemer\(s\)/i }));
    const desktopSelector = screen.getAllByRole("region", { name: "Deelnemers kiezen" })[0];
    const expandedRow = closestHTMLElement(desktopSelector, ".work-hours-create-participants-row");
    expect(within(expandedRow).queryByLabelText("WindWilly-persoon")).not.toBeInTheDocument();
    expect(within(expandedRow).queryByLabelText("Externe persoon")).not.toBeInTheDocument();
    await userEvent.type(within(expandedRow).getByLabelText("Naam externe persoon"), "Nieuwe externe");
    await userEvent.type(within(expandedRow).getByLabelText("E-mail externe persoon"), "nieuw@example.com");
    await userEvent.click(within(expandedRow).getByRole("button", { name: "Aanmaken en toevoegen" }));
    await waitFor(() => expect(api.createWorkExternalPerson.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ display_name: "Nieuwe externe" })));
    expect(await within(screen.getByRole("list", { name: "Gekozen deelnemers mobiel" })).findByText("Nieuwe externe")).toBeInTheDocument();
  });

  it("uses grouped mobile checkbox controls with canonical selection, exact payload, and reset", async () => {
    renderPage();
    const mobile = within(await screen.findByRole("region", { name: "Nieuwe registratie" }));
    const selectedParticipants = mobile.getByRole("list", { name: "Gekozen deelnemers mobiel" });
    const selector = mobile.getByRole("region", { name: "Deelnemers kiezen" });
    expect(within(selector).getByText("WindWilly-personen")).toBeInTheDocument();
    expect(within(selector).getByText("Externe personen")).toBeInTheDocument();
    await userEvent.click(within(selector).getByText("WindWilly-personen"));
    const admin = within(selector).getByRole("checkbox", { name: /Admin WindWilly-persoon/i });
    expect(admin).toBeChecked();
    await userEvent.click(admin);
    const piet = within(selector).getByRole("checkbox", { name: /Piet WindWilly-persoon/i });
    await userEvent.click(piet);
    expect(piet).toBeChecked();
    await userEvent.click(within(selector).getByText("Externe personen"));
    const anna = within(selector).getByRole("checkbox", { name: /Externe Anna Externe persoon/i });
    await userEvent.click(anna);
    expect(selectedParticipants).toHaveTextContent("Piet");
    expect(within(selectedParticipants).getByText("Externe Anna")).toBeInTheDocument();
    await userEvent.click(anna);
    expect(selectedParticipants).not.toHaveTextContent("Externe Anna");
    const project = mobile.getByLabelText("Project voor nieuwe registratie mobiel");
    await waitForSelectOption(project, "Project A");
    await userEvent.selectOptions(project, "p1");
    await userEvent.selectOptions(mobile.getByLabelText("Post voor nieuwe registratie mobiel"), "post1");
    await userEvent.selectOptions(mobile.getByLabelText("Duur"), "3");
    await userEvent.click(mobile.getByRole("button", { name: "Registratie mobiel opslaan" }));
    await waitFor(() => expect(api.createWorkHourGroup).toHaveBeenCalledWith(expect.objectContaining({ duration_half_hours: 3, participants: [expect.objectContaining({ user_id: "u2" })] }), expect.any(Object)));
    await userEvent.click(mobile.getByRole("button", { name: "Mobiele registratie resetten" }));
    expect(within(selectedParticipants).getAllByRole("listitem")).toHaveLength(1);
    expect(selectedParticipants).toHaveTextContent("Admin");
    expect(admin).toBeChecked();
    expect(piet).not.toBeChecked();
    expect(anna).not.toBeChecked();
  });

  it("searches/selects/resets header filters and resets paging to one", async () => {
    renderPage();
    const projectFilter = (await screen.findByLabelText("Filter Project")).closest("details")!;
    await userEvent.click(within(projectFilter).getByLabelText("Filter Project"));
    await userEvent.type(within(projectFilter).getByLabelText("Zoek project"), "Project");
    await userEvent.click(within(projectFilter).getByRole("button", { name: "Project A" }));
    await waitFor(() => expect(api.listWorkHourGroups).toHaveBeenLastCalledWith(expect.objectContaining({ project_id: "p1", page: 1 })));
    await userEvent.click(within(projectFilter).getByRole("button", { name: "Filter project wissen" }));
    await waitFor(() => expect(api.listWorkHourGroups).toHaveBeenLastCalledWith(expect.not.objectContaining({ project_id: "p1" })));
    expect(screen.getByRole("button", { name: "Alle filters wissen" })).toBeInTheDocument();
  });

  it("keeps valid inline values and links Dutch feedback to invalid fields", async () => {
    renderPage();
    const desktopProject = await screen.findByLabelText("Project voor nieuwe registratie");
    await waitForSelectOption(desktopProject, "Project A");
    await userEvent.selectOptions(desktopProject, "p1");
    await userEvent.type(screen.getByLabelText("Beschrijving nieuwe registratie"), "Blijft staan");
    await userEvent.click(screen.getByRole("button", { name: "Registratie opslaan" }));
    await waitFor(() => expect(screen.getByLabelText("Post voor nieuwe registratie")).toHaveAttribute("aria-describedby", "hours-create-post-error"));
    expect(document.getElementById("hours-create-post-error")).toHaveTextContent("Kies een post.");
    expect(screen.getByLabelText("Project voor nieuwe registratie")).toHaveValue("p1");
    expect(screen.getByLabelText("Beschrijving nieuwe registratie")).toHaveValue("Blijft staan");
    expect(screen.getByLabelText("Post voor nieuwe registratie")).toHaveAttribute("aria-invalid", "true");
  });

  it("creates and fully resets from the accessible mobile create surface", async () => {
    api.createWorkExternalPerson.mockResolvedValue({ id: "ep2", display_name: "Mobiele externe", email: "mobiel@example.com", is_active: true });
    renderPage();
    const mobile = within(await screen.findByRole("region", { name: "Nieuwe registratie" }));
    const mobileProject = mobile.getByLabelText("Project voor nieuwe registratie mobiel");
    await waitForSelectOption(mobileProject, "Project A");
    await userEvent.selectOptions(mobileProject, "p1");
    await userEvent.selectOptions(mobile.getByLabelText("Post voor nieuwe registratie mobiel"), "post1");
    await userEvent.selectOptions(mobile.getByLabelText("Duur"), "6");
    await userEvent.type(mobile.getByLabelText("Beschrijving nieuwe registratie mobiel"), "Mobiel werk");
    const mobileSelector = mobile.getByRole("region", { name: "Deelnemers kiezen" });
    await userEvent.click(within(mobileSelector).getByText("WindWilly-personen"));
    await userEvent.click(within(mobileSelector).getByRole("checkbox", { name: /Admin WindWilly-persoon/i }));
    await userEvent.click(within(mobileSelector).getByRole("checkbox", { name: /Piet WindWilly-persoon/i }));
    await userEvent.type(mobile.getByLabelText("Naam externe persoon mobiel"), "Mobiele externe");
    await userEvent.type(mobile.getByLabelText("E-mail externe persoon mobiel"), "mobiel@example.com");
    await userEvent.click(mobile.getByRole("button", { name: "Externe persoon mobiel aanmaken en toevoegen" }));
    await waitFor(() => expect(api.createWorkExternalPerson).toHaveBeenCalled());
    await userEvent.type(mobile.getByLabelText("Naam externe persoon mobiel"), "Mobiel onopgeslagen");
    await userEvent.type(mobile.getByLabelText("Notitie externe persoon mobiel"), "Nog wissen");
    const participantToggle = screen.getByRole("button", { name: /deelnemer\(s\)/i });
    await userEvent.click(participantToggle);
    const desktopParticipantEditor = closestHTMLElement(screen.getAllByRole("region", { name: "Deelnemers kiezen" })[0], ".work-hours-create-participants-row");
    await userEvent.type(within(desktopParticipantEditor).getByLabelText("Naam externe persoon"), "Desktop onopgeslagen");
    await userEvent.type(within(desktopParticipantEditor).getByLabelText("E-mail externe persoon"), "wissen@example.com");
    await userEvent.click(mobile.getByRole("button", { name: "Registratie mobiel opslaan" }));
    await waitFor(() => expect(api.createWorkHourGroup).toHaveBeenCalledWith(expect.objectContaining({
      project_id: "p1", post_id: "post1", duration_half_hours: 6, description: "Mobiel werk",
      participants: [expect.objectContaining({ user_id: "u2" }), expect.objectContaining({ external_person_id: "ep2" })]
    }), expect.any(Object)));
    await waitFor(() => {
      expect(mobile.getByLabelText("Project voor nieuwe registratie mobiel")).toHaveValue("");
      expect(mobile.getByLabelText("Post voor nieuwe registratie mobiel")).toHaveValue("");
      expect(mobile.getByLabelText("Beschrijving nieuwe registratie mobiel")).toHaveValue("");
      expect(mobile.getByLabelText("Duur")).toHaveValue("2");
      expect(mobile.getByLabelText("Naam externe persoon mobiel")).toHaveValue("");
      expect(mobile.getByLabelText("Notitie externe persoon mobiel")).toHaveValue("");
      expect(within(mobile.getByRole("list", { name: "Gekozen deelnemers mobiel" })).getAllByRole("listitem")).toHaveLength(1);
      expect(mobile.getByRole("list", { name: "Gekozen deelnemers mobiel" })).toHaveTextContent("Admin");
      expect(participantToggle).toHaveAttribute("aria-expanded", "false");
    });
    await userEvent.click(participantToggle);
    const resetDesktopEditor = closestHTMLElement(screen.getAllByRole("region", { name: "Deelnemers kiezen" })[0], ".work-hours-create-participants-row");
    expect(within(resetDesktopEditor).getByLabelText("Naam externe persoon")).toHaveValue("");
    expect(within(resetDesktopEditor).getByLabelText("E-mail externe persoon")).toHaveValue("");
  });

  it("manually resets native and controlled create state on both surfaces", async () => {
    renderPage();
    const desktopProject = await screen.findByLabelText("Project voor nieuwe registratie");
    const mobile = within(screen.getByRole("region", { name: "Nieuwe registratie" }));
    await waitForSelectOption(desktopProject, "Project A");
    await userEvent.selectOptions(desktopProject, "p1");
    await userEvent.selectOptions(screen.getByLabelText("Post voor nieuwe registratie"), "post1");
    await userEvent.type(screen.getByLabelText("Beschrijving nieuwe registratie"), "Desktop tekst");
    await userEvent.type(mobile.getByLabelText("Beschrijving nieuwe registratie mobiel"), "Mobiele tekst");
    const participantToggle = screen.getByRole("button", { name: /deelnemer\(s\)/i });
    await userEvent.click(participantToggle);
    const desktopParticipantEditor = closestHTMLElement(screen.getAllByRole("region", { name: "Deelnemers kiezen" })[0], ".work-hours-create-participants-row");
    await userEvent.click(within(desktopParticipantEditor).getByText("WindWilly-personen"));
    await userEvent.click(within(desktopParticipantEditor).getByRole("checkbox", { name: /Piet WindWilly-persoon/i }));
    await userEvent.type(within(desktopParticipantEditor).getByLabelText("Naam externe persoon"), "Desktop concept");
    await userEvent.type(within(desktopParticipantEditor).getByLabelText("Notitie externe persoon"), "Wissen");
    await userEvent.type(mobile.getByLabelText("Naam externe persoon mobiel"), "Mobiel concept");
    await userEvent.type(mobile.getByLabelText("E-mail externe persoon mobiel"), "mobiel-concept@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Nieuwe registratie resetten" }));
    expect(desktopProject).toHaveValue("");
    expect(screen.getByLabelText("Post voor nieuwe registratie")).toHaveValue("");
    expect(screen.getByLabelText("Beschrijving nieuwe registratie")).toHaveValue("");
    expect(mobile.getByLabelText("Beschrijving nieuwe registratie mobiel")).toHaveValue("");
    expect(mobile.getByLabelText("Naam externe persoon mobiel")).toHaveValue("");
    expect(mobile.getByLabelText("E-mail externe persoon mobiel")).toHaveValue("");
    expect(participantToggle).toHaveAttribute("aria-expanded", "false");
    expect(within(mobile.getByRole("list", { name: "Gekozen deelnemers mobiel" })).getAllByRole("listitem")).toHaveLength(1);
    expect(mobile.getByRole("list", { name: "Gekozen deelnemers mobiel" })).toHaveTextContent("Admin");
    await userEvent.click(participantToggle);
    const resetDesktopEditor = closestHTMLElement(screen.getAllByRole("region", { name: "Deelnemers kiezen" })[0], ".work-hours-create-participants-row");
    expect(within(resetDesktopEditor).getByLabelText("Naam externe persoon")).toHaveValue("");
    expect(within(resetDesktopEditor).getByLabelText("Notitie externe persoon")).toHaveValue("");
  });

  it("links each create error, focuses the first invalid field, and clears errors independently", async () => {
    renderPage();
    const project = await screen.findByLabelText("Project voor nieuwe registratie");
    const post = screen.getByLabelText("Post voor nieuwe registratie");
    await userEvent.click(screen.getByRole("button", { name: "Registratie opslaan" }));
    await waitFor(() => expect(project).toHaveFocus());
    expect(project).toHaveAttribute("aria-describedby", "hours-create-project-error");
    expect(post).toHaveAttribute("aria-describedby", "hours-create-post-error");
    expect(document.getElementById("hours-create-project-error")).toHaveTextContent("Kies een project.");
    expect(document.getElementById("hours-create-post-error")).toHaveTextContent("Kies een post.");
    await userEvent.selectOptions(project, "p1");
    expect(project).not.toHaveAttribute("aria-describedby");
    expect(post).toHaveAttribute("aria-describedby", "hours-create-post-error");
    await userEvent.selectOptions(post, "post1");
    expect(post).not.toHaveAttribute("aria-describedby");
  });

  it("offers historical filter facets and displays stable audit snapshot names", async () => {
    api.listWorkHoursMeta.mockResolvedValue({
      projects: [{ id: "p1", name: "Project A", is_active: true, is_archived: false }],
      posts: [{ id: "post1", name: "Post A", is_active: true, is_archived: false }], external_people: [], historical_identities: [], eligible_users: [], is_admin: true,
      filter_projects: [{ id: "p-old", name: "Historisch project", selectable: false }],
      filter_posts: [{ id: "post-old", name: "Historische post", selectable: false }], filter_participants: ["Oude deelnemer"], filter_dates: ["2025-12-31"]
    });
    api.listWorkHoursAudit.mockResolvedValue({ items: [{ id: "audit1", actor_display_name: "Admin", created_at: "2026-08-09T10:00:00Z", action: "work_hours_group_updated", project_name: "Historisch project", post_name: "Historische post", request_method: "PUT", request_path: "/api/urenverantwoording/groepen/g1", result: "success" }], total: 1, page: 1, page_size: 25 });
    renderPage();
    const projectFilter = (await screen.findByLabelText("Filter Project")).closest("details")!;
    await userEvent.click(within(projectFilter).getByLabelText("Filter Project"));
    await userEvent.click(within(projectFilter).getByRole("button", { name: "Historisch project · historisch" }));
    const postFilter = screen.getByLabelText("Filter Post").closest("details")!;
    await userEvent.click(within(postFilter).getByLabelText("Filter Post"));
    await userEvent.click(within(postFilter).getByRole("button", { name: "Historische post · historisch" }));
    const personFilter = screen.getByLabelText("Filter Persoon").closest("details")!;
    await userEvent.click(within(personFilter).getByLabelText("Filter Persoon"));
    await userEvent.click(within(personFilter).getByRole("button", { name: "Oude deelnemer" }));
    const dateFilter = screen.getByLabelText("Filter Datum").closest("details")!;
    await userEvent.click(within(dateFilter).getByLabelText("Filter Datum"));
    await userEvent.click(within(dateFilter).getByRole("button", { name: "31-12-2025" }));
    await waitFor(() => expect(api.listWorkHourGroups).toHaveBeenLastCalledWith(expect.objectContaining({ project_id: "p-old", post_id: "post-old", participant_query: "Oude deelnemer", work_date: "2025-12-31" })));
    expect(await screen.findByText(/work_hours_group_updated · Historisch project · Historische post/)).toBeInTheDocument();
  });

  it("does not expose hours JSON backup or import controls", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Urenbeheer" })).toBeInTheDocument();
    expect(screen.queryByText(/JSON-back-up/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /import en backup/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /JSON backup/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /full restore/i })).not.toBeInTheDocument();
  });

  it("preserves edit, soft-delete, and restore group flows", async () => {
    const deletedGroup = { ...group, id: "g-deleted", deleted_at: "2026-08-09T12:00:00Z", row_version: 8 };
    api.listWorkHourGroups.mockImplementation((params) => Promise.resolve(params?.deleted_only ? { ...emptyList, items: [deletedGroup], total: 1 } : { ...emptyList, items: [group], total: 1 }));
    api.updateWorkHourGroup.mockResolvedValue({ ...group, description: "Aangepast" });
    api.deleteWorkHourGroup.mockResolvedValue({ ...group, deleted_at: "2026-08-09T12:00:00Z" });
    api.restoreWorkHourGroup.mockResolvedValue({ ...deletedGroup, deleted_at: null });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Bewerk registratie Project A" }));
    let dialog = within(await screen.findByRole("dialog", { name: "Registratie bewerken" }));
    await userEvent.clear(dialog.getByLabelText("Beschrijving"));
    await userEvent.type(dialog.getByLabelText("Beschrijving"), "Aangepast");
    await userEvent.click(dialog.getByRole("button", { name: "Wijzigingen opslaan" }));
    await waitFor(() => expect(api.updateWorkHourGroup).toHaveBeenCalledWith("g-existing", expect.objectContaining({ description: "Aangepast", expected_row_version: 7 })));
    await userEvent.click(screen.getByRole("button", { name: "Verwijder registratie Project A" }));
    dialog = within(await screen.findByRole("dialog", { name: "Registratie verwijderen" }));
    await userEvent.click(dialog.getByRole("button", { name: "Bevestig verwijderen" }));
    await waitFor(() => expect(api.deleteWorkHourGroup).toHaveBeenCalledWith("g-existing", 7));
    await userEvent.click(screen.getByRole("button", { name: "Toon verwijderde items" }));
    await userEvent.click(await screen.findByRole("button", { name: "Herstel groep" }));
    dialog = within(await screen.findByRole("dialog", { name: "Registratie herstellen" }));
    await userEvent.click(dialog.getByRole("button", { name: "Bevestig herstellen" }));
    await waitFor(() => expect(api.restoreWorkHourGroup).toHaveBeenCalledWith("g-deleted", 8));
  });

  it("exposes and invokes individual external-person restore with its row version", async () => {
    const archivedPerson = {
      id: "ep-archived",
      display_name: "Gearchiveerde externe",
      email: "archived@example.com",
      note: "Historisch",
      is_active: false,
      deleted_at: "2026-08-09T12:00:00Z",
      row_version: 12
    };
    api.listWorkHoursAdminMasterdata.mockResolvedValue({ projects: [], posts: [], external_people: [archivedPerson] });
    api.restoreWorkExternalPerson.mockResolvedValue({ ...archivedPerson, is_active: true, deleted_at: null, row_version: 13 });

    renderPage();

    const personRow = closestHTMLElement(await screen.findByText(/Gearchiveerde externe/), "li");
    await userEvent.click(within(personRow).getByRole("button", { name: "Herstel" }));
    await waitFor(() => expect(api.restoreWorkExternalPerson).toHaveBeenCalledWith("ep-archived", 12));
  });

  it("keeps list and CSV on the identical canonical filter contract", async () => {
    api.downloadWorkHoursCsv.mockResolvedValue(new Blob(["csv"]));
    renderPage();
    const typeFilter = (await screen.findByLabelText("Filter Type")).closest("details")!;
    await userEvent.click(within(typeFilter).getByLabelText("Filter Type"));
    await userEvent.click(within(typeFilter).getByRole("button", { name: "Extern" }));
    await userEvent.click(screen.getByRole("button", { name: "CSV export" }));
    await waitFor(() => expect(api.downloadWorkHoursCsv).toHaveBeenCalledWith(expect.objectContaining({ participant_kind: "external_person", sort_key: "work_date", sort_direction: "desc" })));
    expect(api.listWorkHourGroups).toHaveBeenLastCalledWith(expect.objectContaining({ participant_kind: "external_person" }));
  });

  it("contains no project or post masterdata controls on the hours page", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Urenbeheer" });
    expect(screen.queryByRole("button", { name: /project aanmaken/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /post aanmaken/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Projecten" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Posten" })).not.toBeInTheDocument();
  });
});
