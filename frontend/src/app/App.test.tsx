import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const mockApi = vi.hoisted(() => ({
  login: vi.fn().mockResolvedValue(undefined),
  setToken: vi.fn(),
  getCurrentUser: vi.fn().mockResolvedValue({
    id: "u1",
    username: "admin",
    full_name: null,
    email: null,
    is_admin: true,
    theme_preference: "system",
    has_avatar: false
  }),
  updateCurrentUser: vi.fn().mockResolvedValue({
    id: "u1",
    username: "admin",
    full_name: "Admin Naam",
    email: "admin@example.com",
    is_admin: true,
    theme_preference: "dark",
    has_avatar: false
  }),
  listAdminUsers: vi.fn().mockResolvedValue([
    {
      id: "u1",
      username: "admin",
      full_name: "Admin",
      email: "admin@example.com",
      is_admin: true,
      is_active: true
    },
    {
      id: "u2",
      username: "editor",
      full_name: "Editor",
      email: "editor@example.com",
      is_admin: false,
      is_active: true
    }
  ]),
  createAdminUser: vi.fn().mockResolvedValue({
    id: "u3",
    username: "redacteur",
    full_name: null,
    email: null,
    is_admin: false,
    is_active: true
  }),
  updateAdminUser: vi.fn().mockResolvedValue({
    id: "u2",
    username: "editor",
    full_name: "Editor",
    email: "editor@example.com",
    is_admin: true,
    is_active: true
  }),
  updateAdminUserActive: vi.fn().mockResolvedValue({
    id: "u2",
    username: "editor",
    full_name: "Editor",
    email: "editor@example.com",
    is_admin: false,
    is_active: false
  }),
  deleteAdminUser: vi.fn().mockResolvedValue({ status: "ok" }),
  changeAdminUserPassword: vi.fn().mockResolvedValue({ status: "ok" }),
  listAdminProjects: vi.fn().mockResolvedValue([
    {
      id: "p1",
      name: "Windpark de Boldijk",
      is_active: true
    }
  ]),
  createAdminProject: vi.fn().mockResolvedValue({
    id: "p2",
    name: "Project Noord",
    is_active: true
  }),
  updateAdminProject: vi.fn().mockResolvedValue({
    id: "p1",
    name: "Windpark de Boldijk Updated",
    is_active: false
  }),
  listDatabaseProjects: vi.fn().mockResolvedValue([
    {
      id: "p1",
      name: "Windpark de Boldijk",
      is_active: true
    }
  ]),
  listDatabaseDocuments: vi.fn().mockResolvedValue([
    {
      id: "d1",
      filename: "wijkbericht.txt",
      doc_type: "txt",
      status: "uploaded",
      extraction_error: "",
      size_bytes: 128,
      project_id: "p1",
      project_name: "Windpark de Boldijk",
      uploaded_by_user_id: "u1",
      uploaded_by_username: "admin",
      created_at: "2026-03-12T10:00:00Z"
    }
  ]),
  uploadDatabaseDocument: vi.fn().mockResolvedValue({
    id: "d2",
    filename: "nieuw.txt",
    doc_type: "txt",
    status: "uploaded",
    extraction_error: "",
    size_bytes: 99,
    project_id: "p1",
    project_name: "Windpark de Boldijk",
    uploaded_by_user_id: "u1",
    uploaded_by_username: "admin",
    created_at: "2026-03-12T11:00:00Z"
  }),
  uploadDatabaseDocumentWithProgress: vi.fn().mockImplementation(async (_projectId, _file, onProgress) => {
    onProgress(45);
    onProgress(100);
    return {
      id: "d2",
      filename: "nieuw.txt",
      doc_type: "txt",
      status: "uploaded",
      extraction_error: "",
      size_bytes: 99,
      project_id: "p1",
      project_name: "Windpark de Boldijk",
      uploaded_by_user_id: "u1",
      uploaded_by_username: "admin",
      created_at: "2026-03-12T11:00:00Z"
    };
  }),
  deleteDatabaseDocument: vi.fn().mockResolvedValue({ status: "ok" }),
  bulkDeleteDatabaseDocuments: vi.fn().mockResolvedValue({ status: "ok", affected: 1 }),
  bulkMoveDatabaseDocuments: vi.fn().mockResolvedValue({ status: "ok", affected: 1 }),
  bulkCopyDatabaseDocuments: vi.fn().mockResolvedValue({ status: "ok", affected: 1 }),
  changeCurrentUserPassword: vi.fn().mockResolvedValue({ status: "ok" }),
  uploadCurrentUserAvatar: vi.fn(),
  getCurrentUserAvatarBlob: vi.fn(),
  listTopics: vi.fn().mockResolvedValue([
    {
      id: "abc12345-1111",
      title: "Titel",
      subject: "Onderwerp test",
      theme: "Thema test",
      editorial_notes: "Notitie",
      planning_at: null,
      workflow_state: "draft",
      is_archived: false
    }
  ]),
  listVersions: vi.fn().mockResolvedValue([
    {
      id: "v1",
      topic_id: "abc12345-1111",
      version_number: 1,
      title: "Onderhoudsupdate",
      slug: "onderhoudsupdate",
      article_body: "Volledige tekst",
      summary: "Korte samenvatting",
      source_trace_json: "[]",
      source_trace: [
        {
          source: "topic",
          source_type: "topic",
          chunk_id: "c1",
          chunk_index: "0",
          text: "Topic bronpassage over onderhoud.",
          document_id: "doc-topic-1",
          document_name: "topic-bron.txt",
          topic_id: "abc12345-1111",
          project_id: "",
          project_name: ""
        },
        {
          source: "database",
          source_type: "database",
          chunk_id: "c2",
          chunk_index: "1",
          text: "Database bronpassage over veiligheidsinspectie.",
          document_id: "doc-db-1",
          document_name: "database-bron.txt",
          topic_id: "abc12345-1111",
          project_id: "p1",
          project_name: "Windpark de Boldijk"
        }
      ],
      generated_image_id: null,
      is_current: true,
      is_published: false,
      created_at: "2026-03-12T11:00:00Z"
    }
  ]),
  getAboutContent: vi.fn().mockResolvedValue({
    description: "Wervelnieuws helpt het communicatieteam.",
    disclaimer: "Controleer inhoud altijd voor publicatie.",
    developed_by: "Energiek Daarle",
    changelog: [
      {
        iteration: "02",
        date: "2026-03-12",
        title: "Nieuwe shell",
        highlights: ["Tabnavigatie", "About API"]
      }
    ]
  })
}));

vi.mock("../lib/api/client", () => mockApi);

function renderApp(initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function loginIntoApp() {
  fireEvent.click(screen.getByRole("button", { name: "Inloggen" }));
  await waitFor(() => {
    expect(screen.getByRole("link", { name: "Main" })).toBeInTheDocument();
  });
}

describe("App", () => {
  it("shows login form first", () => {
    renderApp();
    expect(screen.getByRole("button", { name: "Inloggen" })).toBeInTheDocument();
  });

  it("shows login error when credentials are invalid", async () => {
    mockApi.login.mockRejectedValueOnce(new Error("Invalid credentials"));
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Inloggen" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Ongeldige gebruikersnaam of wachtwoord.");
    });
  });

  it("opens user menu and navigates to settings", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
      expect(screen.getByLabelText("Volledige naam")).toBeInTheDocument();
    });
  });

  it("shows admin option in user menu for admins", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));

    expect(screen.getByRole("menuitem", { name: "Admin" })).toBeInTheDocument();
  });

  it("hides admin option in user menu for non-admins", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u3",
      username: "editor",
      full_name: null,
      email: "editor@example.com",
      is_admin: false,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "editor" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "editor" }));

    expect(screen.queryByRole("menuitem", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("opens admin page and toggles admin rights", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
      expect(screen.getByText("editor")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Maak admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Maak admin" }));

    await waitFor(() => {
      expect(mockApi.updateAdminUser).toHaveBeenCalledWith("u2", true);
      expect(screen.getByText("Adminrechten bijgewerkt.")).toBeInTheDocument();
    });
  });

  it("allows admin to create a new user", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Nieuwe gebruikersnaam")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Nieuwe gebruikersnaam"), {
      target: { value: "redacteur" }
    });
    fireEvent.change(screen.getByLabelText("Tijdelijk wachtwoord"), {
      target: { value: "redacteur123" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Gebruiker toevoegen" }));

    await waitFor(() => {
      expect(mockApi.createAdminUser).toHaveBeenCalledWith("redacteur", "redacteur123");
      expect(screen.getByText("Nieuwe gebruiker toegevoegd.")).toBeInTheDocument();
      expect(screen.getByText("redacteur")).toBeInTheDocument();
    });
  });

  it("allows admin to change another user password", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
      expect(screen.getByText("editor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset wachtwoord voor editor" }));

    fireEvent.change(screen.getByLabelText("Nieuw wachtwoord voor editor"), {
      target: { value: "nieuw5678" }
    });
    fireEvent.change(screen.getByLabelText("Bevestig wachtwoord voor editor"), {
      target: { value: "nieuw5678" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Wijzig wachtwoord voor editor" }));

    await waitFor(() => {
      expect(mockApi.changeAdminUserPassword).toHaveBeenCalledWith("u2", "nieuw5678");
      expect(screen.getByText("Wachtwoord bijgewerkt.")).toBeInTheDocument();
    });
  });

  it("allows admin to disable a user", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Disable gebruiker editor" })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Disable gebruiker editor" })
    );

    await waitFor(() => {
      expect(mockApi.updateAdminUserActive).toHaveBeenCalledWith("u2", false);
      expect(screen.getByText("Gebruikersstatus bijgewerkt.")).toBeInTheDocument();
    });
  });

  it("allows admin to delete a user", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Verwijder gebruiker editor" })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Verwijder gebruiker editor" })
    );

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        "Wilt u deze gebruiker echt verwijderen?"
      );
      expect(mockApi.deleteAdminUser).toHaveBeenCalledWith("u2");
      expect(screen.getByText("Gebruiker verwijderd.")).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it("cancels delete user when confirmation is rejected", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockApi.deleteAdminUser.mockClear();

    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Verwijder gebruiker editor" })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Verwijder gebruiker editor" })
    );

    expect(confirmSpy).toHaveBeenCalledWith(
      "Wilt u deze gebruiker echt verwijderen?"
    );
    expect(mockApi.deleteAdminUser).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("saves settings and applies selected theme", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Volledige naam"), {
      target: { value: "Admin Naam" }
    });
    fireEvent.change(screen.getByLabelText("E-mailadres"), {
      target: { value: "admin@example.com" }
    });
    fireEvent.change(screen.getByLabelText("Thema"), {
      target: { value: "dark" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => {
      expect(mockApi.updateCurrentUser).toHaveBeenCalled();
      expect(screen.getByText("Instellingen opgeslagen.")).toBeInTheDocument();
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    });
  });

  it("changes password from settings", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Wachtwoord wijzigen" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Huidig wachtwoord"), {
      target: { value: "admin12345" }
    });
    fireEvent.change(screen.getByLabelText("Nieuw wachtwoord"), {
      target: { value: "nieuw1234" }
    });
    fireEvent.change(screen.getByLabelText("Herhaal nieuw wachtwoord"), {
      target: { value: "nieuw1234" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Wachtwoord wijzigen" }));

    await waitFor(() => {
      expect(mockApi.changeCurrentUserPassword).toHaveBeenCalledWith({
        current_password: "admin12345",
        new_password: "nieuw1234"
      });
      expect(screen.getByText("Wachtwoord succesvol gewijzigd.")).toBeInTheDocument();
    });
  });

  it("renders planning table with expected columns", async () => {
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "Planning" }));

    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: "ID" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Onderwerp" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Thema" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Geplande datum" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Plaatsingdatum" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Illustratie" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Opmerkingen" })).toBeInTheDocument();
    });
  });

  it("shows source passages in planning review", async () => {
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "Planning" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Review en bronpassages" })).toBeInTheDocument();
      expect(screen.getByText("Onderhoudsupdate")).toBeInTheDocument();
      expect(screen.getByText(/Topic - topic-bron.txt, chunk 0/)).toBeInTheDocument();
      expect(
        screen.getByText(/Database - Windpark de Boldijk - database-bron.txt, chunk 1/)
      ).toBeInTheDocument();
      expect(mockApi.listVersions).toHaveBeenCalledWith("abc12345-1111");
    });
  });

  it("removes upload controls from main page", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Welkom, admin" })).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Bestand uploaden")).not.toBeInTheDocument();
    expect(screen.getByText(/ga naar Database om bronbestanden te uploaden/i)).toBeInTheDocument();
  });

  it("uploads a file from database page with project selection", async () => {
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "Database" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Database" })).toBeInTheDocument();
      expect(screen.getByText("wijkbericht.txt")).toBeInTheDocument();
      expect(screen.getByText("2026-03-12 11:00")).toBeInTheDocument();
      expect(screen.getByText("128 B")).toBeInTheDocument();
      expect(
        screen.queryByText("Upload bronbestanden per project. Deze database staat los van Topics.")
      ).not.toBeInTheDocument();
      expect(screen.getByText(/max 100 MB per bestand/i)).toBeInTheDocument();
      expect(screen.queryByLabelText("Bulkactie")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Doelproject")).not.toBeInTheDocument();
    });

    const rowCheckbox = await screen.findByLabelText("Selecteer bestand wijkbericht.txt");
    fireEvent.click(rowCheckbox);

    await waitFor(() => {
      expect(screen.getByLabelText("Bulkactie")).toBeInTheDocument();
      expect(screen.getByLabelText("Doelproject")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Voer bulkactie uit" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Bulkactie"), { target: { value: "delete" } });
    expect(screen.queryByLabelText("Doelproject")).not.toBeInTheDocument();

    const file = new File(["inhoud"], "nieuw.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Database bestand uploaden"), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(mockApi.uploadDatabaseDocumentWithProgress).toHaveBeenCalledWith(
        "p1",
        file,
        expect.any(Function)
      );
      expect(screen.getByLabelText("Upload voortgang")).toBeInTheDocument();
      expect(screen.getByLabelText("Bestandstype txt")).toBeInTheDocument();
      expect(screen.getByText("1 bestand(en) geupload naar de database.")).toBeInTheDocument();
    });
  });


  it("does not show per-row delete action on database page", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u3",
      username: "editor",
      full_name: null,
      email: "editor@example.com",
      is_admin: false,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "Database" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Database" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Verwijder bestand/i })).not.toBeInTheDocument();
    });
  });

  it("uploads multiple files in one action on database page", async () => {
    mockApi.uploadDatabaseDocumentWithProgress.mockClear();
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "Database" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Database" })).toBeInTheDocument();
      expect(screen.getByLabelText("Project")).toHaveValue("p1");
    });

    const fileA = new File(["inhoud-a"], "a.txt", { type: "text/plain" });
    const fileB = new File(["inhoud-b"], "b.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Database bestand uploaden"), {
      target: { files: [fileA, fileB] }
    });

    await waitFor(() => {
      expect(mockApi.uploadDatabaseDocumentWithProgress).toHaveBeenCalledTimes(2);
      expect(mockApi.uploadDatabaseDocumentWithProgress).toHaveBeenNthCalledWith(
        1,
        "p1",
        fileA,
        expect.any(Function)
      );
      expect(mockApi.uploadDatabaseDocumentWithProgress).toHaveBeenNthCalledWith(
        2,
        "p1",
        fileB,
        expect.any(Function)
      );
      expect(screen.getByText("2 bestand(en) geupload naar de database.")).toBeInTheDocument();
    });
  });

  it("allows admin to manage projects", async () => {
    mockApi.getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      full_name: null,
      email: null,
      is_admin: true,
      theme_preference: "system",
      has_avatar: false
    });
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
      expect(screen.getByDisplayValue("Windpark de Boldijk")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Nieuw project"), {
      target: { value: "Project Noord" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Project toevoegen" }));

    await waitFor(() => {
      expect(mockApi.createAdminProject).toHaveBeenCalledWith("Project Noord");
      expect(screen.getByText("Project toegevoegd.")).toBeInTheDocument();
    });
  });

  it("loads about content from API", async () => {
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "About" }));

    await waitFor(() => {
      expect(screen.getByText("Wervelnieuws helpt het communicatieteam.")).toBeInTheDocument();
      expect(screen.getByText(/Ontwikkeld door:/)).toBeInTheDocument();
      expect(screen.getByText("Iteratie 02 - Nieuwe shell")).toBeInTheDocument();
    });
  });
});
