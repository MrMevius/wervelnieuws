import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UrenverantwoordingPage } from "./UrenverantwoordingPage";
import { parseDuration } from "./workHoursFormat";
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

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
afterEach(() => {
  vi.restoreAllMocks();
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  api.updateWorkHourGroup.mockResolvedValue({ ...group, row_version: 8 });
  api.deleteWorkHourGroup.mockResolvedValue({ status: "ok" });
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


  it("separates the overview from creation and opens one responsive modal", async () => {
    renderPage();
    const trigger = await screen.findByRole("button", { name: /Uren registreren/ });
    await waitFor(() => expect(trigger).not.toHaveAttribute("disabled"));
    expect(document.querySelector(".work-hours-create-row")).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Uren registreren" });
    expect(within(dialog).getByRole("checkbox", { name: "Admin" })).toBeChecked();
    expect(within(dialog).getByLabelText("Post (optioneel)")).toHaveValue("");
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(within(dialog).getByRole("button", { name: "Registratie sluiten" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("stores seven minutes and a start time without requiring a post", async () => {
    const dialog = await openNewRegistration();
    fireEvent.change(within(dialog).getByLabelText("Project"), {target:{value:"p1"}});
    fireEvent.change(within(dialog).getByLabelText("Begintijd"), {target:{value:"09:07"}});
    fireEvent.change(within(dialog).getByLabelText("Duur"), {target:{value:"7"}});
    fireEvent.click(within(dialog).getByRole("button", {name:"Registratie opslaan"}));
    await waitFor(() => expect(api.createWorkHourGroup).toHaveBeenCalledTimes(1));
    expect(api.createWorkHourGroup).toHaveBeenCalledWith(expect.objectContaining({
      project_id:"p1",post_id:null,start_time:"09:07",duration_minutes:7,
      participants:[{participant_kind:"live_user", user_id:"u1", display_name_snapshot:"Admin", display_type_snapshot:"WindWilly-gebruiker", sort_order:0}]
    }));
    expect(api.createWorkHourGroup.mock.calls[0][0]).not.toHaveProperty("duration_half_hours");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Registratie opgeslagen.");
  });

  it("supports comma decimal hours, multiple people and an optional post", async () => {
    const dialog = await openNewRegistration();
    fireEvent.change(within(dialog).getByLabelText("Project"), {target:{value:"p1"}});
    fireEvent.change(within(dialog).getByLabelText("Post (optioneel)"), {target:{value:"post1"}});
    fireEvent.change(within(dialog).getByLabelText("Eenheid van de duur"), {target:{value:"hours"}});
    fireEvent.change(within(dialog).getByLabelText("Duur"), {target:{value:"1,5"}});
    fireEvent.click(within(dialog).getByRole("checkbox", {name:"Piet"}));
    expect(within(dialog).getByRole("status")).toHaveTextContent("1 uur 30 min × 2 personen");
    expect(within(dialog).getByRole("status")).toHaveTextContent("3 persoon-uren totaal");
    fireEvent.click(within(dialog).getByRole("button", {name:"Registratie opslaan"}));
    await waitFor(() => expect(api.createWorkHourGroup).toHaveBeenCalledWith(expect.objectContaining({duration_minutes:90,post_id:"post1"})));
    expect(api.createWorkHourGroup.mock.calls[0][0].participants.map((p: {user_id:string})=>p.user_id)).toEqual(["u1","u2"]);
  });

  it("switches duration units without changing the recorded duration", async () => {
    const dialog = await openNewRegistration();
    fireEvent.change(within(dialog).getByLabelText("Duur"), {target:{value:"7"}});
    fireEvent.change(within(dialog).getByLabelText("Eenheid van de duur"), {target:{value:"hours"}});
    expect(within(dialog).getByRole("status")).toHaveTextContent("7 min");
    fireEvent.change(within(dialog).getByLabelText("Eenheid van de duur"), {target:{value:"minutes"}});
    expect(within(dialog).getByLabelText("Duur")).toHaveValue("7");
    fireEvent.click(within(dialog).getByRole("button", {name:"2 uur"}));
    expect(within(dialog).getByLabelText("Duur")).toHaveValue("2");
    expect(within(dialog).getByLabelText("Eenheid van de duur")).toHaveValue("hours");
  });

  it("shows Dutch validation and focuses the first invalid field", async () => {
    const dialog = await openNewRegistration();
    fireEvent.change(within(dialog).getByLabelText("Datum"), {target:{value:"2099-01-01"}});
    fireEvent.change(within(dialog).getByLabelText("Duur"), {target:{value:"0"}});
    fireEvent.change(within(dialog).getByLabelText("Begintijd"), {target:{value:""}});
    fireEvent.click(within(dialog).getByRole("checkbox", {name:"Admin"}));
    fireEvent.click(within(dialog).getByRole("button", {name:"Registratie opslaan"}));
    expect(within(dialog).getByText("Kies een project.")).toBeInTheDocument();
    expect(within(dialog).getByText("Selecteer minimaal één persoon.")).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByLabelText("Datum")).toHaveFocus());
    expect(api.createWorkHourGroup).not.toHaveBeenCalled();
  });

  it("preserves entered text on a failed save and protects dirty closing", async () => {
    api.createWorkHourGroup.mockRejectedValueOnce(new Error(JSON.stringify({detail:"Opslaan tijdelijk niet mogelijk."})));
    const dialog = await openNewRegistration();
    fireEvent.change(within(dialog).getByLabelText("Project"), {target:{value:"p1"}});
    fireEvent.change(within(dialog).getByLabelText("Beschrijving"), {target:{value:"Niet kwijtraken"}});
    fireEvent.click(within(dialog).getByRole("button", {name:"Registratie opslaan"}));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Opslaan tijdelijk niet mogelijk.");
    expect(within(dialog).getByLabelText("Beschrijving")).toHaveValue("Niet kwijtraken");
    fireEvent(dialog, new Event("cancel", {cancelable:true}));
    expect(within(dialog).getByText(/niet-opgeslagen wijzigingen/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", {name:"Verder invullen"}));
    expect(within(dialog).getByLabelText("Beschrijving")).toHaveValue("Niet kwijtraken");
    fireEvent.click(within(dialog).getByRole("button", {name:"Registratie sluiten"}));
    fireEvent.click(within(dialog).getByRole("button", {name:"Wijzigingen weggooien"}));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("prevents duplicate submissions and closing while saving", async () => {
    let resolve!: (value: unknown) => void;
    api.createWorkHourGroup.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const dialog = await openNewRegistration();
    fireEvent.change(within(dialog).getByLabelText("Project"), {target:{value:"p1"}});
    fireEvent.click(within(dialog).getByRole("button", {name:"Registratie opslaan"}));
    fireEvent.submit(dialog.querySelector("form")!);
    fireEvent(dialog, new Event("cancel", {cancelable:true}));
    expect(within(dialog).getByRole("button", {name:"Registratie sluiten"})).toHaveAttribute("disabled");
    expect(api.createWorkHourGroup).toHaveBeenCalledTimes(1);
    resolve({id:"saved"});
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("preserves historical times, durations and participant IDs while editing", async () => {
    api.listWorkHourGroups.mockResolvedValue({...emptyList,items:[{...group,duration_half_hours:20,duration_minutes:600,duration_hours:10,participants:[{id:"historical",display_name_snapshot:"Oude deelnemer",display_type_snapshot:"Extern",sort_order:0}]}],total:1});
    renderPage();
    fireEvent.click(await screen.findByRole("button", {name:"Bewerk registratie Project A"}));
    const dialog = screen.getByRole("dialog", {name:"Registratie bewerken"});
    expect(within(dialog).getByLabelText("Duur")).toHaveValue("10");
    expect(within(dialog).getByLabelText("Begintijd")).toHaveValue("");
    fireEvent.click(within(dialog).getByRole("button", {name:"Wijzigingen opslaan"}));
    await waitFor(() => expect(api.updateWorkHourGroup).toHaveBeenCalledWith("g-existing",expect.objectContaining({
      duration_minutes:600,start_time:null,expected_row_version:7,participants:[{id:"historical",sort_order:0}]
    })));
  });

  it("can clear the post while preserving archived project and post references", async () => {
    api.listWorkHoursMeta.mockResolvedValue({projects:[],posts:[],eligible_users:[],historical_identities:[],external_people:[],is_admin:true});
    api.listWorkHourGroups.mockResolvedValue({...emptyList,items:[group],total:1});
    renderPage();
    fireEvent.click(await screen.findByRole("button", {name:"Bewerk registratie Project A"}));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Project")).toHaveValue("p1");
    expect(within(dialog).getByLabelText("Post (optioneel)")).toHaveValue("post1");
    fireEvent.change(within(dialog).getByLabelText("Post (optioneel)"), {target:{value:""}});
    fireEvent.click(within(dialog).getByRole("button", {name:"Wijzigingen opslaan"}));
    await waitFor(() => expect(api.updateWorkHourGroup).toHaveBeenCalledWith("g-existing",expect.objectContaining({post_id:null,project_id:"p1"})));
  });

  it("only offers selectable live users when creating new registrations", async () => {
    api.listWorkHoursMeta.mockResolvedValue({projects:[{id:"p1",name:"Project A"}],posts:[],eligible_users:[{id:"u1",display_name:"Admin",selectable:true},{id:"u2",display_name:"Verborgen",selectable:false}],external_people:[{id:"ep1",display_name:"Externe Anna"}],historical_identities:[],is_admin:true});
    const dialog = await openNewRegistration();
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(1);
    expect(within(dialog).queryByText("Externe Anna")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Verborgen")).not.toBeInTheDocument();
  });

  it("shows exact minute durations, names and start times in one shared list", async () => {
    api.listWorkHourGroups.mockResolvedValue({...emptyList,items:[{...group,duration_minutes:7,duration_half_hours:null,start_time:"09:07"}],total:1});
    renderPage();
    const list = await screen.findByRole("list", {name:"Urenregistraties"});
    expect(within(list).getByText("7 min")).toBeInTheDocument();
    expect(within(list).getByText("09:07 uur")).toBeInTheDocument();
    expect(within(list).getByText("Admin")).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  it("requires confirmation for recoverable deletion and reports failures in the dialog", async () => {
    api.listWorkHourGroups.mockResolvedValue({...emptyList,items:[group],total:1});
    api.deleteWorkHourGroup.mockRejectedValueOnce(new Error(JSON.stringify({detail:"Registratie is intussen gewijzigd."})));
    renderPage();
    fireEvent.click(await screen.findByRole("button", {name:"Verwijder registratie Project A"}));
    const dialog = screen.getByRole("dialog", {name:"Registratie verwijderen"});
    expect(api.deleteWorkHourGroup).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", {name:"Bevestig verwijderen"}));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("intussen gewijzigd");
    expect(api.deleteWorkHourGroup).toHaveBeenCalledWith("g-existing",7);
    fireEvent.click(within(dialog).getByRole("button", {name:"Annuleren"}));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filters on the server and exports the entire selection rather than a page", async () => {
    api.listWorkHourGroups.mockResolvedValue({...emptyList,items:[group],total:76});
    api.downloadWorkHoursCsv.mockResolvedValue(new Blob(["csv"]));
    renderPage();
    await screen.findByRole("list", {name:"Urenregistraties"});
    fireEvent.change(screen.getByLabelText("Project"), {target:{value:"p1"}});
    fireEvent.change(screen.getByLabelText("Werkdatum"), {target:{value:"2026-08-08"}});
    await waitFor(()=>expect(api.listWorkHourGroups).toHaveBeenLastCalledWith(expect.objectContaining({project_id:"p1",work_date:"2026-08-08",page:1,page_size:25})));
    await waitFor(()=>expect(screen.getByRole("button", {name:"CSV export"})).not.toHaveAttribute("disabled"));
    fireEvent.click(screen.getByRole("button", {name:"CSV export"}));
    await waitFor(()=>expect(api.downloadWorkHoursCsv).toHaveBeenCalledWith(expect.objectContaining({project_id:"p1",work_date:"2026-08-08",sort_key:"work_date",sort_direction:"desc"})));
    expect(api.downloadWorkHoursCsv.mock.calls[0][0]).not.toHaveProperty("page");
    await waitFor(()=>expect(window.URL.revokeObjectURL).toHaveBeenCalled(), {timeout:1500});
  });

  it("paginates and resets the page when changing the page size", async () => {
    api.listWorkHourGroups.mockImplementation(async ({page,page_size})=>({...emptyList,items:[group],page,page_size,total:76}));
    renderPage();
    await screen.findByRole("list", {name:"Urenregistraties"});
    await new Promise(resolve=>setTimeout(resolve,300));
    fireEvent.click(screen.getByRole("button",{name:"Volgende"}));
    await waitFor(()=>expect(api.listWorkHourGroups).toHaveBeenLastCalledWith(expect.objectContaining({page:2,page_size:25})));
    fireEvent.change(screen.getByLabelText("Per pagina"),{target:{value:"50"}});
    await waitFor(()=>expect(api.listWorkHourGroups).toHaveBeenLastCalledWith(expect.objectContaining({page:1,page_size:50})));
  });

  it("shows retryable errors and does not show a misleading empty list", async () => {
    api.listWorkHourGroups.mockRejectedValueOnce(new Error("Network"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("verbinding");
    expect(screen.queryByText("Nog geen uren geregistreerd")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Opnieuw proberen"}));
    expect(await screen.findByText("Nog geen uren geregistreerd")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:/JSON|Import|Project aanmaken|Post aanmaken/i})).not.toBeInTheDocument();
  });
});

async function openNewRegistration() {
  renderPage();
  const trigger = await screen.findByRole("button", {name:/Uren registreren/});
  await waitFor(()=>expect(trigger).not.toHaveAttribute("disabled"));
  fireEvent.click(trigger);
  return screen.getByRole("dialog",{name:"Uren registreren"});
}

describe("Exact duration conversion",()=>{
  it.each([
    ["7","minutes",7],["1,5","hours",90],["0,25","hours",15],["24","hours",1440],
    ["0","minutes",null],["1.5","minutes",null],["0,01","hours",null],["1441","minutes",null],
    ["-2","hours",null],["1e2","hours",null],["","minutes",null],
  ] as const)("converts %s %s to %s minutes without rounding",(value,unit,expected)=>{
    expect(parseDuration(value,unit)).toBe(expected);
  });
});
