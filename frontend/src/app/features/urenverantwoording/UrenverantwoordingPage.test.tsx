import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UrenverantwoordingPage } from "./UrenverantwoordingPage";
import { WorkHoursHistoryAdminTab } from "./WorkHoursAdminTabs";

const api = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), listWorkHoursMeta: vi.fn(), listWorkHourGroups: vi.fn(), listWorkHoursAudit: vi.fn(),
  createWorkHourGroup: vi.fn(), updateWorkHourGroup: vi.fn(), deleteWorkHourGroup: vi.fn(), restoreWorkHourGroup: vi.fn(),
  createWorkExternalPerson: vi.fn(), updateWorkExternalPerson: vi.fn(), archiveWorkExternalPerson: vi.fn(), restoreWorkExternalPerson: vi.fn(), mergeWorkExternalPerson: vi.fn(),
  downloadWorkHoursCsv: vi.fn(),
  listWorkHoursAdminHistory: vi.fn(), listWorkHoursAdminMasterdata: vi.fn(), relinkWorkHistoricalIdentity: vi.fn()
}));
vi.mock("../../../lib/api/client", () => api);

const emptyList = { items: [], total: 0, page: 1, page_size: 25, sort_key: "work_date", sort_direction: "desc", page_sizes: [25, 50, 100], totals: { total_groups: 0, total_people: 0, total_duration_hours: 0, total_person_hours: 0 }, project_totals: [] };
const group = {
  id: "g-existing", work_date: "2026-08-08", project_id: "p1", project_name: "Project A", post_id: "post1", post_name: "Post A",
  description: "Bestaand werk", duration_half_hours: 4, duration_hours: 2, person_count: 1, row_version: 7, deleted_at: null,
  participants: [{ id: "part1", participant_kind: "live_user", user_id: "u1", display_name_snapshot: "Admin", display_email_snapshot: "admin@example.com", display_type_snapshot: "WindWilly-gebruiker", sort_order: 0 }]
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><UrenverantwoordingPage /></MemoryRouter></QueryClientProvider>);
}

function renderHistoryTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { ...render(<QueryClientProvider client={queryClient}><WorkHoursHistoryAdminTab /></QueryClientProvider>), queryClient };
}

async function waitForSelectOption(select: HTMLElement, optionName: string) {
  await waitFor(() => expect(within(select).getByRole("option", { name: optionName })).toBeInTheDocument());
}

async function openParticipantDisclosure(selector: HTMLElement) {
  await userEvent.click(within(selector).getByRole("button", { name: /Deelnemer\(s\)|\d+ deelnemer\(s\)/ }));
  await within(selector).findByRole("group", { name: "WindWilly-personen" });
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
  it("keeps external-person edit and merge dialogs accessible after moving them to Admin", async () => {
    api.listWorkHoursAdminMasterdata.mockResolvedValue({ projects: [], posts: [], external_people: [
      { id: "ep1", display_name: "Externe Anna", email: "anna@example.com", note: "", is_active: true, deleted_at: null, row_version: 1 },
      { id: "ep2", display_name: "Externe Piet", email: "piet@example.com", note: "", is_active: true, deleted_at: null, row_version: 2 }
    ] });
    renderHistoryTab();
    const person = await screen.findByText("Externe Anna");
    const row = person.closest("li")!;
    const editTrigger = within(row).getByRole("button", { name: "Bewerk" });
    await userEvent.click(editTrigger);
    const editDialog = await screen.findByRole("dialog", { name: "Externe persoon bewerken" });
    expect(editDialog.parentElement?.parentElement?.dataset.hoursModalHost).toBeTruthy();
    expect(document.body.querySelector<HTMLElement>('[aria-hidden="true"]')?.inert).toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Externe persoon bewerken" })).not.toBeInTheDocument());
    expect(editTrigger).toHaveFocus();
    await userEvent.click(within(row).getByRole("button", { name: "Samenvoegen" }));
    const mergeDialog = await screen.findByRole("dialog", { name: "Externe personen samenvoegen" });
    await userEvent.keyboard("{Tab}");
    expect(mergeDialog.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Externe personen samenvoegen" })).not.toBeInTheDocument());
  });

  it("creates an external person only from the explicit Admin flow and refreshes its metadata", async () => {
    api.createWorkExternalPerson.mockResolvedValue({ id: "ep-new", display_name: "Nieuwe externe", email: "nieuw@example.com", note: "Bezoeker", is_active: true });
    const { queryClient } = renderHistoryTab();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    await userEvent.click(await screen.findByRole("button", { name: "Externe persoon aanmaken" }));
    const dialog = await screen.findByRole("dialog", { name: "Externe persoon aanmaken" });
    await userEvent.type(within(dialog).getByLabelText("Naam"), "Nieuwe externe");
    await userEvent.type(within(dialog).getByLabelText("E-mail (optioneel)"), "nieuw@example.com");
    await userEvent.type(within(dialog).getByLabelText("Notitie (optioneel)"), "Bezoeker");
    await userEvent.click(within(dialog).getByRole("button", { name: "Opslaan" }));
    await waitFor(() => expect(api.createWorkExternalPerson).toHaveBeenCalledWith(expect.objectContaining({ display_name: "Nieuwe externe", email: "nieuw@example.com", note: "Bezoeker", force_create: false }), expect.any(Object)));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Externe persoon aanmaken" })).not.toBeInTheDocument());
    expect(invalidateQueries.mock.calls.map(([filters]) => filters)).toEqual(expect.arrayContaining([
      { queryKey: ["work-hours-admin-masterdata"] },
      { queryKey: ["work-hours-meta"] }
    ]));
  });

  it("shows Dutch field errors before attempting to create an external person", async () => {
    renderHistoryTab();
    await userEvent.click(await screen.findByRole("button", { name: "Externe persoon aanmaken" }));
    const dialog = await screen.findByRole("dialog", { name: "Externe persoon aanmaken" });
    await userEvent.type(within(dialog).getByLabelText("E-mail (optioneel)"), "geen-e-mail");
    await userEvent.click(within(dialog).getByRole("button", { name: "Opslaan" }));
    expect(within(dialog).getByText("Vul een naam van minimaal 2 tekens in.")).toBeInTheDocument();
    expect(within(dialog).getByText("Vul een geldig e-mailadres in of laat dit veld leeg.")).toBeInTheDocument();
    expect(api.createWorkExternalPerson).not.toHaveBeenCalled();
  });

  it("distinguishes hard and advisory duplicate feedback and only offers force-create for advisory duplicates", async () => {
    api.createWorkExternalPerson.mockRejectedValueOnce(new Error(JSON.stringify({ detail: { code: "work_hours_external_person_hard_conflict", message: "Dit e-mailadres hoort al bij een externe persoon.", candidates: [{ id: "ep1", display_name: "Externe Anna", email: "anna@example.com" }] } })))
      .mockRejectedValueOnce(new Error(JSON.stringify({ detail: { code: "work_hours_external_person_advisory_conflict", message: "Mogelijke dubbele externe persoon", candidates: [{ id: "ep1", display_name: "Externe Anna", guidance: "Controleer de naam." }] } })))
      .mockResolvedValueOnce({ id: "ep2", display_name: "Andere Anna", is_active: true });
    renderHistoryTab();
    await userEvent.click(await screen.findByRole("button", { name: "Externe persoon aanmaken" }));
    const dialog = await screen.findByRole("dialog", { name: "Externe persoon aanmaken" });
    await userEvent.type(within(dialog).getByLabelText("Naam"), "Andere Anna");
    await userEvent.type(within(dialog).getByLabelText("E-mail (optioneel)"), "anna2@example.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Opslaan" }));
    expect(await within(dialog).findByText("Deze persoon kan niet worden aangemaakt omdat het e-mailadres al bestaat.")).toBeInTheDocument();
    expect(within(dialog).getByText("Externe Anna · anna@example.com")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Bewust toch aanmaken" })).not.toBeInTheDocument();
    await userEvent.clear(within(dialog).getByLabelText("E-mail (optioneel)"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Opslaan" }));
    expect(await within(dialog).findByText("Controleer eerst deze mogelijke dubbele personen.")).toBeInTheDocument();
    expect(within(dialog).getByText("Externe Anna · Controleer de naam.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Bewust toch aanmaken" }));
    await waitFor(() => expect(api.createWorkExternalPerson).toHaveBeenLastCalledWith(expect.objectContaining({ force_create: true }), expect.any(Object)));
  });

  it("keeps merge errors in the active modal and disables all closing controls while pending", async () => {
    let resolveMerge: ((value: { id: string }) => void) | undefined;
    api.listWorkHoursAdminMasterdata.mockResolvedValue({ projects: [], posts: [], external_people: [
      { id: "ep1", display_name: "Externe Anna", email: "anna@example.com", note: "", is_active: true, deleted_at: null, row_version: 1 },
      { id: "ep2", display_name: "Externe Piet", email: "piet@example.com", note: "", is_active: true, deleted_at: null, row_version: 2 }
    ] });
    const { queryClient } = renderHistoryTab();
    const row = (await screen.findByText("Externe Anna")).closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Samenvoegen" }));
    const dialog = await screen.findByRole("dialog", { name: "Externe personen samenvoegen" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Doelpersoon"), "ep2");
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    api.mergeWorkExternalPerson.mockImplementationOnce(() => new Promise((resolve) => { resolveMerge = resolve; }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Samenvoegen" }));
    expect(api.mergeWorkExternalPerson).toHaveBeenCalledWith("ep1", { target_id: "ep2", expected_source_row_version: 1, expected_target_row_version: 2 });
    expect(within(dialog).getByRole("button", { name: "Annuleren" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Samenvoegen" })).toBeDisabled();
    resolveMerge?.({ id: "ep1" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Externe personen samenvoegen" })).not.toBeInTheDocument());
    expect(invalidateQueries.mock.calls.map(([filters]) => filters)).toEqual([
      { queryKey: ["work-hours-meta"] },
      { queryKey: ["work-hours-groups"] }
    ]);

    api.mergeWorkExternalPerson.mockRejectedValueOnce(new Error("Samenvoegen geweigerd"));
    await userEvent.click(within(row).getByRole("button", { name: "Samenvoegen" }));
    const failedDialog = await screen.findByRole("dialog", { name: "Externe personen samenvoegen" });
    await userEvent.selectOptions(within(failedDialog).getByLabelText("Doelpersoon"), "ep2");
    await userEvent.click(within(failedDialog).getByRole("button", { name: "Samenvoegen" }));
    expect(await within(failedDialog).findByRole("alert")).toHaveTextContent("Samenvoegen geweigerd");
  });

  it("preserves the original query invalidation contract for each external-person mutation", async () => {
    api.listWorkHoursAdminMasterdata.mockResolvedValue({ projects: [], posts: [], external_people: [
      { id: "ep1", display_name: "Externe Anna", email: "anna@example.com", note: "", is_active: true, deleted_at: null, row_version: 1 }
    ] });
    const { queryClient } = renderHistoryTab();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const row = (await screen.findByText("Externe Anna")).closest("li")!;

    await userEvent.click(within(row).getByRole("button", { name: "Bewerk" }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Externe persoon bewerken" })).getByRole("button", { name: "Opslaan" }));
    await waitFor(() => expect(api.updateWorkExternalPerson).toHaveBeenCalledWith("ep1", expect.objectContaining({ expected_row_version: 1 })));
    expect(invalidateQueries.mock.calls.map(([filters]) => filters)).toEqual([{ queryKey: ["work-hours-meta"] }]);

    invalidateQueries.mockClear();
    await userEvent.click(within(row).getByRole("button", { name: "Archiveer" }));
    await waitFor(() => expect(api.archiveWorkExternalPerson).toHaveBeenCalledWith("ep1", 1));
    expect(invalidateQueries.mock.calls.map(([filters]) => filters)).toEqual([{ queryKey: ["work-hours-meta"] }]);

    invalidateQueries.mockClear();
    await userEvent.click(within(row).getByRole("button", { name: "Herstel" }));
    await waitFor(() => expect(api.restoreWorkExternalPerson).toHaveBeenCalledWith("ep1", 1));
    expect(invalidateQueries.mock.calls.map(([filters]) => filters)).toEqual([{ queryKey: ["work-hours-meta"] }]);
  });

  it("shows the permanent complete inline create row and no create modal trigger", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Urenregistratie" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project voor nieuwe registratie")).toBeInTheDocument();
    expect(screen.getByLabelText("Post voor nieuwe registratie")).toBeInTheDocument();
    expect(screen.getByLabelText("Beschrijving nieuwe registratie")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registratie opslaan" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nieuwe registratie" })).not.toBeInTheDocument();
  });

  it("shows only the renamed heading and server-provided project totals", async () => {
    api.listWorkHourGroups.mockResolvedValue({
      ...emptyList,
      project_totals: [{ project_id: "p1", project_name: "Project A", person_hours: 2.5 }]
    });
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Urenregistratie" })).toBeInTheDocument();
    expect(screen.queryByText("Urenverantwoording")).not.toBeInTheDocument();
    expect(screen.queryByText("Registreer groepen compact inline; projecten en globale posten beheer je centraal in Admin.")).not.toBeInTheDocument();
    const totals = screen.getByRole("region", { name: "Projecttotalen" });
    await within(totals).findByText("Project A");
    expect(totals).toHaveTextContent("Project A");
    expect(totals).toHaveTextContent("2.5 persoon-uren");
    expect(screen.queryByText("Groepsuren")).not.toBeInTheDocument();
    expect(screen.queryByText("Persoon-uren")).not.toBeInTheDocument();
  });

  it("keeps desktop content first for the full-width table column and marks totals as its sibling", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Urenregistratie" });

    const layout = document.querySelector(".work-hours-page-layout");
    const content = document.querySelector(".work-hours-page-content");
    const listPanel = document.querySelector<HTMLElement>(".work-hours-page-content .panel");

    expect(layout?.children).toHaveLength(2);
    expect(layout?.firstElementChild).toBe(content);
    expect(layout?.lastElementChild).toHaveClass("work-hours-project-totals");
    expect(content).toContainElement(listPanel);
  });

  it("keeps project totals structurally separate from the hours content for mobile-first responsive ordering", async () => {
    renderPage();
    const totals = await screen.findByRole("region", { name: "Projecttotalen" });
    const content = document.querySelector<HTMLElement>(".work-hours-page-content");
    const layout = document.querySelector<HTMLElement>(".work-hours-page-layout");

    expect(layout).toContainElement(content);
    expect(layout).toContainElement(totals);
    expect(content?.parentElement).toBe(layout);
    expect(totals.parentElement).toBe(layout);
    expect(content?.contains(totals)).toBe(false);
  });

  it("keeps the default date-descending request and one responsive pagination footer", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Urenregistratie" });

    await waitFor(() => expect(api.listWorkHourGroups).toHaveBeenCalledWith(expect.objectContaining({ sort_key: "work_date", sort_direction: "desc" })));
    expect(screen.queryByText("Sorteer")).not.toBeInTheDocument();
    expect(screen.queryByText("Volgorde")).not.toBeInTheDocument();

    const table = document.querySelector(".uren-module-page table")!;
    const mobileCards = document.querySelector(".work-hours-mobile-cards")!;
    const pagination = screen.getByRole("contentinfo", { name: "Paginering urenregistraties" });
    expect(screen.getByRole("region", { name: "Projecttotalen" }).parentElement).toHaveClass("work-hours-page-layout");
    expect(within(pagination).getByRole("button", { name: "CSV export" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "CSV export" })).toHaveLength(1);
    const paginationText = pagination.textContent ?? "";
    expect(paginationText.indexOf("CSV export")).toBeLessThan(paginationText.indexOf("Per pagina"));
    expect(table.compareDocumentPosition(pagination) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mobileCards.compareDocumentPosition(pagination) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("contentinfo", { name: "Paginering urenregistraties" })).toHaveLength(1);
    expect(within(pagination).getByLabelText("Per pagina")).toHaveValue("25");
    expect(within(pagination).getByRole("button", { name: "Vorige" })).toBeDisabled();
    expect(within(pagination).getByText("Pagina 1 van 1")).toBeInTheDocument();
    expect(within(pagination).getByRole("button", { name: "Volgende" })).toBeDisabled();
  });

  it("resets page on page-size changes and requests next and previous pages with accurate status and disabled states", async () => {
    api.listWorkHourGroups.mockImplementation(async ({ page, page_size }) => ({
      ...emptyList,
      page,
      page_size,
      total: 75
    }));
    renderPage();
    const pagination = await screen.findByRole("contentinfo", { name: "Paginering urenregistraties" });
    const pageSize = within(pagination).getByLabelText("Per pagina");
    const previous = within(pagination).getByRole("button", { name: "Vorige" });
    const next = within(pagination).getByRole("button", { name: "Volgende" });

    await waitFor(() => expect(api.listWorkHourGroups).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, page_size: 25 })));
    expect(within(pagination).getByText("Pagina 1 van 3")).toBeInTheDocument();
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();

    await userEvent.click(next);
    await waitFor(() => expect(api.listWorkHourGroups).toHaveBeenLastCalledWith({ page: 2, page_size: 25, sort_key: "work_date", sort_direction: "desc" }));
    expect(within(pagination).getByText("Pagina 2 van 3")).toBeInTheDocument();
    expect(previous).toBeEnabled();

    await userEvent.click(previous);
    await waitFor(() => expect(api.listWorkHourGroups).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, page_size: 25 })));
    expect(previous).toBeDisabled();

    await userEvent.selectOptions(pageSize, "50");
    await waitFor(() => expect(api.listWorkHourGroups).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, page_size: 50 })));
    expect(within(pagination).getByText("Pagina 1 van 2")).toBeInTheDocument();

    await userEvent.click(next);
    await waitFor(() => expect(api.listWorkHourGroups).toHaveBeenLastCalledWith({ page: 2, page_size: 50, sort_key: "work_date", sort_direction: "desc" }));
    expect(within(pagination).getByText("Pagina 2 van 2")).toBeInTheDocument();
    expect(next).toBeDisabled();
  });

  it("shows a loading state instead of the empty project-total state while the request is pending", () => {
    api.listWorkHourGroups.mockImplementationOnce(() => new Promise(() => undefined));
    renderPage();
    const totals = screen.getByRole("region", { name: "Projecttotalen" });
    expect(within(totals).getByRole("status")).toHaveTextContent("Projecttotalen laden…");
    expect(within(totals).queryByText("Geen projecttotalen.")).not.toBeInTheDocument();
  });

  it("shows an error state instead of the empty project-total state when the request fails", async () => {
    api.listWorkHourGroups.mockRejectedValueOnce(new Error("Netwerkfout"));
    renderPage();
    const totals = await screen.findByRole("region", { name: "Projecttotalen" });
    expect(await within(totals).findByRole("alert")).toHaveTextContent("Projecttotalen konden niet worden geladen.");
    expect(within(totals).queryByText("Geen projecttotalen.")).not.toBeInTheDocument();
  });

  it("shows an accessible empty project-total state after a successful empty response", async () => {
    renderPage();
    const totals = screen.getByRole("region", { name: "Projecttotalen" });
    expect(await within(totals).findByText("Geen projecttotalen.")).toBeInTheDocument();
  });

  it("treats missing optional project totals as empty after an otherwise successful response", async () => {
    api.listWorkHourGroups.mockResolvedValueOnce({ ...emptyList, project_totals: undefined });
    renderPage();
    const totals = screen.getByRole("region", { name: "Projecttotalen" });
    expect(await within(totals).findByText("Geen projecttotalen.")).toBeInTheDocument();
  });

  it("uses the registration project contract without rendering filter controls", async () => {
    api.listWorkHoursMeta.mockResolvedValueOnce({
      projects: [{ id: "p-visible", name: "Beschikbaar project", is_active: true, is_archived: false }],
      posts: [{ id: "post1", name: "Post A", is_active: true, is_archived: false }],
      external_people: [], historical_identities: [], eligible_users: [], is_admin: true
    });
    renderPage();

    const registrationProject = await screen.findByLabelText("Project voor nieuwe registratie");
    await waitForSelectOption(registrationProject, "Beschikbaar project");
    expect(within(registrationProject).queryByRole("option", { name: "Verborgen urenproject" })).not.toBeInTheDocument();

    expect(screen.queryByLabelText(/Filter /)).not.toBeInTheDocument();
  });

  it("creates a group with multiple participants without a create modal", async () => {
    renderPage();
    const desktopProject = await screen.findByLabelText("Project voor nieuwe registratie");
    await waitForSelectOption(desktopProject, "Project A");
    await userEvent.selectOptions(desktopProject, "p1");
    await userEvent.selectOptions(screen.getByLabelText("Post voor nieuwe registratie"), "post1");
    await userEvent.type(screen.getByLabelText("Beschrijving nieuwe registratie"), "Werkbezoek");
    const participantSelector = screen.getAllByRole("region", { name: "Deelnemers kiezen" })[0];
    await openParticipantDisclosure(participantSelector);
    await userEvent.click(within(participantSelector).getByRole("checkbox", { name: "Admin" }));
    await userEvent.click(within(participantSelector).getByRole("checkbox", { name: "Piet" }));
    await userEvent.click(screen.getByRole("button", { name: "Registratie opslaan" }));
    await waitFor(() => expect(api.createWorkHourGroup.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      project_id: "p1", post_id: "post1", description: "Werkbezoek",
      participants: [expect.objectContaining({ user_id: "u2" })]
    })));
    expect(screen.queryByRole("dialog", { name: /nieuwe registratie/i })).not.toBeInTheDocument();
  });

  it("makes the current-user default explicit, submits only canonical checks, and restores it on reset", async () => {
    renderPage();
    const mobile = within(await screen.findByRole("region", { name: "Nieuwe registratie" }));
    const selector = mobile.getByRole("region", { name: "Deelnemers kiezen" });
    await openParticipantDisclosure(selector);
    const admin = await within(selector).findByRole("checkbox", { name: "Admin" });
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

  it("shows only selectable WindWilly people and keeps the half-hour payload", async () => {
    renderPage();
    const desktopProject = await screen.findByLabelText("Project voor nieuwe registratie");
    await waitForSelectOption(desktopProject, "Project A");
    await userEvent.selectOptions(desktopProject, "p1");
    await userEvent.selectOptions(screen.getByLabelText("Post voor nieuwe registratie"), "post1");
    const participantSelector = screen.getAllByRole("region", { name: "Deelnemers kiezen" })[0];
    await openParticipantDisclosure(participantSelector);
    expect(within(participantSelector).getByRole("group", { name: "WindWilly-personen" })).toBeInTheDocument();
    expect(within(participantSelector).queryByRole("group", { name: "Externe personen" })).not.toBeInTheDocument();
    await userEvent.click(within(participantSelector).getByRole("checkbox", { name: "Admin" }));
    await userEvent.click(within(participantSelector).getByRole("checkbox", { name: "Piet" }));
    expect(within(participantSelector).getByRole("checkbox", { name: "Piet" })).toBeChecked();
    expect(within(participantSelector).queryByRole("checkbox", { name: /Externe Anna/i })).not.toBeInTheDocument();
    const duration = screen.getByLabelText("Duur in uren");
    expect(within(duration).getByRole("option", { name: "0.5 uur" })).toBeInTheDocument();
    expect(within(duration).getByRole("option", { name: "1 uur" })).toBeInTheDocument();
    expect(within(duration).getByRole("option", { name: "1.5 uur" })).toBeInTheDocument();
    await userEvent.selectOptions(duration, "3");
    await userEvent.click(screen.getByRole("button", { name: "Registratie opslaan" }));
    await waitFor(() => expect(api.createWorkHourGroup).toHaveBeenCalledWith(expect.objectContaining({ duration_half_hours: 3, participants: [expect.objectContaining({ user_id: "u2" })] }), expect.any(Object)));
    expect(api.createWorkHourGroup.mock.calls[0]?.[0].participants.every((participant: { participant_kind: string }) => participant.participant_kind === "live_user")).toBe(true);
  });

  it("filters explicitly non-selectable users and never exposes external people in create pickers", async () => {
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
    await openParticipantDisclosure(selector);
    await waitFor(() => expect(within(selector).getByRole("checkbox", { name: "Piet" })).toBeInTheDocument());
    expect(within(selector).queryByRole("checkbox", { name: "Admin" })).not.toBeInTheDocument();
    expect(within(selector).getByRole("checkbox", { name: "Piet" })).toBeInTheDocument();
    expect(within(selector).queryByRole("checkbox", { name: /Externe Anna|Historische externe/i })).not.toBeInTheDocument();
  });

  it("links the mobile participant error to its focusable region and clears it after checkbox selection", async () => {
    renderPage();
    const mobile = within(await screen.findByRole("region", { name: "Nieuwe registratie" }));
    const project = mobile.getByLabelText("Project voor nieuwe registratie mobiel");
    await waitForSelectOption(project, "Project A");
    await userEvent.selectOptions(project, "p1");
    await userEvent.selectOptions(mobile.getByLabelText("Post voor nieuwe registratie mobiel"), "post1");
    const selector = mobile.getByRole("region", { name: "Deelnemers kiezen" });
    await openParticipantDisclosure(selector);
    await userEvent.click(within(selector).getByRole("checkbox", { name: "Admin" }));
    await userEvent.click(mobile.getByRole("button", { name: "Registratie mobiel opslaan" }));
    await waitFor(() => expect(selector).toHaveFocus());
    expect(selector).toHaveAttribute("tabindex", "-1");
    expect(selector).toHaveAttribute("aria-invalid", "true");
    expect(selector).toHaveAttribute("aria-describedby", "hours-mobile-create-participants-error");
    expect(document.getElementById("hours-mobile-create-participants-error")).toHaveTextContent("Kies minimaal één deelnemer.");
    await userEvent.click(within(selector).getByRole("checkbox", { name: "Piet" }));
    expect(selector).not.toHaveAttribute("aria-invalid");
    expect(selector).not.toHaveAttribute("aria-describedby");
    expect(document.getElementById("hours-mobile-create-participants-error")).not.toBeInTheDocument();
  });

  it("uses one compact participant trigger and direct floating picker on both surfaces", async () => {
    renderPage();
    const [desktopSelector, mobileSelector] = await screen.findAllByRole("region", { name: "Deelnemers kiezen" });
    const desktopCell = desktopSelector.closest("td");
    const desktopRow = desktopCell?.closest("tr");
    expect(desktopRow).toHaveClass("work-hours-create-row");
    expect(desktopCell).toContainElement(desktopSelector);
    expect(document.querySelectorAll(".work-hours-create-participants-row")).toHaveLength(0);

    const mobile = within(screen.getByRole("region", { name: "Nieuwe registratie" }));
    expect(mobile.getByRole("button", { name: /Deelnemer\(s\)|deelnemer\(s\)/ })).toBe(within(mobileSelector).getByRole("button"));
    expect(screen.queryByText("Aantal personen")).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ deelnemer\(s\)$/)).not.toBeInTheDocument();

    for (const selector of [desktopSelector, mobileSelector]) {
      const trigger = within(selector).getByRole("button", { name: /Deelnemer\(s\)|\d+ deelnemer\(s\)/ });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(within(selector).queryByRole("dialog", { name: "Deelnemers kiezen" })).not.toBeInTheDocument();
      await openParticipantDisclosure(selector);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(within(selector).getByRole("dialog", { name: "Deelnemers kiezen" })).toBeInTheDocument();
      expect(within(selector).getByRole("group", { name: "WindWilly-personen" })).toBeInTheDocument();
      expect(within(selector).getByRole("checkbox", { name: "Piet" })).toBeInTheDocument();
      expect(within(selector).queryByRole("group", { name: "Externe personen" })).not.toBeInTheDocument();
      expect(within(selector).queryByRole("checkbox", { name: /Externe Anna/i })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /externe persoon.*aanmaken/i })).not.toBeInTheDocument();
  });

  it("retains the WindWilly heading while internal picker options are name-only", async () => {
    renderPage();
    const selector = (await screen.findAllByRole("region", { name: "Deelnemers kiezen" }))[0];
    await openParticipantDisclosure(selector);

    const internalGroup = within(selector).getByRole("group", { name: "WindWilly-personen" });
    expect(internalGroup).toBeInTheDocument();
    expect(within(internalGroup).getByRole("checkbox", { name: "Admin" })).toBeInTheDocument();
    expect(within(internalGroup).getByRole("checkbox", { name: "Piet" })).toBeInTheDocument();
    expect(within(internalGroup).queryByText("WindWilly-persoon")).not.toBeInTheDocument();
    expect(within(selector).queryByRole("checkbox", { name: /Externe Anna/i })).not.toBeInTheDocument();
  });

  it("uses exact compact trigger labels without detached counts on desktop and mobile", async () => {
    renderPage();
    const [desktop, mobile] = await screen.findAllByRole("region", { name: "Deelnemers kiezen" });
    await openParticipantDisclosure(desktop);
    await userEvent.click(within(desktop).getByRole("checkbox", { name: "Admin" }));
    const desktopTrigger = within(desktop).getByRole("button", { name: "Deelnemer(s) ▾" });
    expect(desktopTrigger).toHaveTextContent(/^Deelnemer\(s\) ▾$/);
    expect(desktopTrigger).not.toHaveTextContent("Admin");
    await userEvent.click(within(desktop).getByRole("checkbox", { name: "Piet" }));
    expect(desktopTrigger).toHaveTextContent(/^1 deelnemer\(s\) ▾$/);
    expect(desktopTrigger).not.toHaveTextContent("Piet");
    await userEvent.click(desktopTrigger);
    expect(within(desktop).queryByRole("dialog", { name: "Deelnemers kiezen" })).not.toBeInTheDocument();
    expect(within(desktop).queryByRole("list", { name: /gekozen deelnemers/i })).not.toBeInTheDocument();
    expect(within(desktop).queryByText("Piet")).not.toBeInTheDocument();
    expect(within(desktop).queryByText("WindWilly-gebruiker")).not.toBeInTheDocument();
    await openParticipantDisclosure(desktop);
    expect(within(desktop).getByRole("checkbox", { name: "Piet" })).toBeChecked();

    await openParticipantDisclosure(mobile);
    await userEvent.click(within(mobile).getByRole("checkbox", { name: "Piet" }));
    const mobileTrigger = within(mobile).getByRole("button", { name: "Deelnemer(s) ▾" });
    expect(mobileTrigger).toHaveTextContent(/^Deelnemer\(s\) ▾$/);
    expect(mobileTrigger).not.toHaveTextContent("Piet");
    await userEvent.click(within(mobile).getByRole("checkbox", { name: "Admin" }));
    expect(mobileTrigger).toHaveTextContent(/^1 deelnemer\(s\) ▾$/);
    expect(mobileTrigger).not.toHaveTextContent("Admin");
    await userEvent.click(mobileTrigger);
    expect(within(mobile).queryByRole("dialog", { name: "Deelnemers kiezen" })).not.toBeInTheDocument();
    expect(within(mobile).queryByRole("list", { name: /gekozen deelnemers/i })).not.toBeInTheDocument();
    expect(within(mobile).queryByText("Admin")).not.toBeInTheDocument();
    expect(within(mobile).queryByText("WindWilly-gebruiker")).not.toBeInTheDocument();
    await openParticipantDisclosure(mobile);
    expect(within(mobile).getByRole("checkbox", { name: "Admin" })).toBeChecked();
    expect(screen.queryByText("Aantal personen")).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ deelnemer\(s\)$/)).not.toBeInTheDocument();
  });

  it("shows trigger counts, preserves checked people after reopen, and submits once", async () => {
    renderPage();

    const desktop = screen.getAllByRole("region", { name: "Deelnemers kiezen" })[0];
    const desktopProject = await screen.findByLabelText("Project voor nieuwe registratie");
    await waitForSelectOption(desktopProject, "Project A");
    await userEvent.selectOptions(desktopProject, "p1");
    await userEvent.selectOptions(screen.getByLabelText("Post voor nieuwe registratie"), "post1");
    expect(within(desktop).getByRole("button", { name: "1 deelnemer(s) ▾" })).toBeInTheDocument();
    await openParticipantDisclosure(desktop);
    const desktopPiet = within(desktop).getByRole("checkbox", { name: "Piet" });
    await userEvent.click(desktopPiet);
    expect(within(desktop).getByRole("button", { name: "2 deelnemer(s) ▾" })).toBeInTheDocument();
    await userEvent.click(within(desktop).getByRole("button", { name: /Deelnemer\(s\)|\d+ deelnemer\(s\)/ }));
    expect(within(desktop).queryByRole("dialog", { name: "Deelnemers kiezen" })).not.toBeInTheDocument();
    await openParticipantDisclosure(desktop);
    expect(desktopPiet).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Registratie opslaan" }));
    await waitFor(() => expect(api.createWorkHourGroup).toHaveBeenCalledTimes(1));
    expect(api.createWorkHourGroup).toHaveBeenLastCalledWith(expect.objectContaining({
      participants: [
        expect.objectContaining({ participant_kind: "live_user", user_id: "u1" }),
        expect.objectContaining({ participant_kind: "live_user", user_id: "u2" })
      ]
    }), expect.any(Object));

    const mobile = within(screen.getByRole("region", { name: "Nieuwe registratie" }));
    const mobileSelector = mobile.getByRole("region", { name: "Deelnemers kiezen" });
    const mobileProject = mobile.getByLabelText("Project voor nieuwe registratie mobiel");
    await waitForSelectOption(mobileProject, "Project A");
    await userEvent.selectOptions(mobileProject, "p1");
    await userEvent.selectOptions(mobile.getByLabelText("Post voor nieuwe registratie mobiel"), "post1");
    expect(within(mobileSelector).getByRole("button", { name: "1 deelnemer(s) ▾" })).toBeInTheDocument();
    await openParticipantDisclosure(mobileSelector);
    const mobilePiet = within(mobileSelector).getByRole("checkbox", { name: "Piet" });
    await userEvent.click(mobilePiet);
    expect(within(mobileSelector).getByRole("button", { name: "2 deelnemer(s) ▾" })).toBeInTheDocument();
    await userEvent.click(within(mobileSelector).getByRole("button", { name: /Deelnemer\(s\)|\d+ deelnemer\(s\)/ }));
    expect(within(mobileSelector).queryByRole("dialog", { name: "Deelnemers kiezen" })).not.toBeInTheDocument();
    await openParticipantDisclosure(mobileSelector);
    expect(mobilePiet).toBeChecked();
    await userEvent.click(mobile.getByRole("button", { name: "Registratie mobiel opslaan" }));
    await waitFor(() => expect(api.createWorkHourGroup).toHaveBeenCalledTimes(2));
    expect(api.createWorkHourGroup).toHaveBeenLastCalledWith(expect.objectContaining({
      participants: [
        expect.objectContaining({ participant_kind: "live_user", user_id: "u1" }),
        expect.objectContaining({ participant_kind: "live_user", user_id: "u2" })
      ]
    }), expect.any(Object));
  });

  it("closes the floating picker with Escape or an outside tap and returns focus without changing checks", async () => {
    const user = userEvent.setup();
    renderPage();
    const selector = (await screen.findAllByRole("region", { name: "Deelnemers kiezen" }))[0];
    const trigger = within(selector).getByRole("button", { name: /Deelnemer\(s\)|\d+ deelnemer\(s\)/ });
    await waitFor(() => expect(trigger).toHaveTextContent("1"));

    await user.click(trigger);
    const piet = within(selector).getByRole("checkbox", { name: "Piet" });
    const lastCheckbox = within(selector).getByRole("checkbox", { name: "Piet" });
    await waitFor(() => expect(within(selector).getByRole("checkbox", { name: "Admin" })).toHaveFocus());
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(lastCheckbox).toHaveFocus();
    await user.tab();
    expect(within(selector).getByRole("checkbox", { name: "Admin" })).toHaveFocus();
    await user.tab();
    expect(piet).toHaveFocus();
    await user.keyboard(" ");
    expect(piet).toBeChecked();
    await user.keyboard("{Escape}");
    expect(within(selector).queryByRole("dialog", { name: "Deelnemers kiezen" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAccessibleName("2 deelnemer(s) ▾");

    await user.click(trigger);
    fireEvent.pointerDown(document.querySelector(".work-hours-participant-picker-backdrop")!);
    await waitFor(() => expect(within(selector).queryByRole("dialog", { name: "Deelnemers kiezen" })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(within(selector).getByRole("checkbox", { name: "Piet" })).toBeChecked();
  });

  it("anchors the desktop picker to its trigger and flips it within viewport edges", async () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    const bounds = vi.spyOn(HTMLButtonElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 780, y: 740, width: 80, height: 32, top: 740, right: 860, bottom: 772, left: 780, toJSON: () => ({}) });
    renderPage();
    const desktop = (await screen.findAllByRole("region", { name: "Deelnemers kiezen" }))[0];
    await userEvent.click(within(desktop).getByRole("button", { name: "Deelnemer(s) ▾" }));
    const picker = within(desktop).getByRole("dialog", { name: "Deelnemers kiezen" });
    await waitFor(() => expect(picker).toHaveAttribute("data-placement", "top"));
    expect(picker).toHaveStyle({ left: "168px" });
    expect(picker).toHaveStyle({ top: "372px" });
    bounds.mockRestore();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
  });

  it("uses grouped mobile checkbox controls with canonical selection, exact payload, and reset", async () => {
    renderPage();
    const mobile = within(await screen.findByRole("region", { name: "Nieuwe registratie" }));
    const selector = mobile.getByRole("region", { name: "Deelnemers kiezen" });
    await openParticipantDisclosure(selector);
    expect(within(selector).getByRole("group", { name: "WindWilly-personen" })).toBeInTheDocument();
    expect(within(selector).queryByRole("group", { name: "Externe personen" })).not.toBeInTheDocument();
    const admin = await within(selector).findByRole("checkbox", { name: "Admin" });
    expect(admin).toBeChecked();
    await userEvent.click(admin);
    const piet = within(selector).getByRole("checkbox", { name: "Piet" });
    await userEvent.click(piet);
    expect(piet).toBeChecked();
    expect(within(selector).queryByRole("checkbox", { name: /Externe Anna/i })).not.toBeInTheDocument();
    const project = mobile.getByLabelText("Project voor nieuwe registratie mobiel");
    await waitForSelectOption(project, "Project A");
    await userEvent.selectOptions(project, "p1");
    await userEvent.selectOptions(mobile.getByLabelText("Post voor nieuwe registratie mobiel"), "post1");
    await userEvent.selectOptions(mobile.getByLabelText("Duur"), "3");
    await userEvent.click(mobile.getByRole("button", { name: "Registratie mobiel opslaan" }));
    await waitFor(() => expect(api.createWorkHourGroup).toHaveBeenCalledWith(expect.objectContaining({ duration_half_hours: 3, participants: [expect.objectContaining({ user_id: "u2" })] }), expect.any(Object)));
    await userEvent.click(mobile.getByRole("button", { name: "Mobiele registratie resetten" }));
    expect(admin).toBeChecked();
    expect(piet).not.toBeChecked();
  });

  it("renders static table headers and never sends former filter parameters", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Urenregistratie" });
    await waitFor(() => expect(api.listWorkHourGroups).toHaveBeenLastCalledWith({ page: 1, page_size: 25, sort_key: "work_date", sort_direction: "desc" }));
    expect(screen.queryByLabelText(/Filter /)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alle filters wissen" })).not.toBeInTheDocument();
    expect(screen.queryByText("filter actief")).not.toBeInTheDocument();
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

  it("does not expose hours JSON backup or import controls", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Urenregistratie" })).toBeInTheDocument();
    expect(screen.queryByText(/JSON-back-up/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /import en backup/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /JSON backup/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /full restore/i })).not.toBeInTheDocument();
  });

  it("preserves edit and soft-delete group flows without deleted-registration UI", async () => {
    api.listWorkHourGroups.mockResolvedValue({ ...emptyList, items: [group], total: 1 });
    api.updateWorkHourGroup.mockResolvedValue({ ...group, description: "Aangepast" });
    api.deleteWorkHourGroup.mockResolvedValue({ ...group, deleted_at: "2026-08-09T12:00:00Z" });
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
    expect(screen.queryByRole("button", { name: /verwijderde items/i })).not.toBeInTheDocument();
  });

  it("shows a historical duration as unselected and never saves it without a deliberate valid choice", async () => {
    const historicalGroup = { ...group, duration_half_hours: 18, duration_hours: 9 };
    api.listWorkHourGroups.mockResolvedValue({ ...emptyList, items: [historicalGroup], total: 1 });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Bewerk registratie Project A" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Registratie bewerken" }));
    const duration = dialog.getByLabelText("Duur");
    expect(duration).toHaveValue("");
    expect(within(duration).getByRole("option", { name: "Historische duur: 9 uur — kies een nieuwe duur" })).toBeDisabled();
    expect(dialog.getByRole("button", { name: "Wijzigingen opslaan" })).toBeDisabled();
    await userEvent.selectOptions(duration, "16");
    await userEvent.click(dialog.getByRole("button", { name: "Wijzigingen opslaan" }));
    await waitFor(() => expect(api.updateWorkHourGroup).toHaveBeenCalledWith("g-existing", expect.objectContaining({ duration_half_hours: 16 })));
  });

  it("exports the complete date-descending set without former filter parameters", async () => {
    api.downloadWorkHoursCsv.mockResolvedValue(new Blob(["csv"]));
    renderPage();
    const pagination = await screen.findByRole("contentinfo", { name: "Paginering urenregistraties" });
    await userEvent.click(within(pagination).getByRole("button", { name: "CSV export" }));
    await waitFor(() => expect(api.downloadWorkHoursCsv).toHaveBeenCalledWith({ sort_key: "work_date", sort_direction: "desc" }));
  });

  it("contains no project or post masterdata controls on the hours page", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Urenregistratie" });
    expect(screen.queryByRole("button", { name: /project aanmaken/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /post aanmaken/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Projecten" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Posten" })).not.toBeInTheDocument();
  });
});
