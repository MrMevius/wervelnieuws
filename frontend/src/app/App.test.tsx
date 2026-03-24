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
  listAdminThemes: vi.fn().mockResolvedValue([
    {
      id: "planning",
      name: "Planning",
      is_active: true
    }
  ]),
  createAdminTheme: vi.fn().mockResolvedValue({
    id: "communicatie",
    name: "Communicatie",
    is_active: true
  }),
  updateAdminTheme: vi.fn().mockResolvedValue({
    id: "planning",
    name: "Planning aangepast",
    is_active: false
  }),
  getAdminUiSettings: vi.fn().mockResolvedValue({
    wind_theme_enabled: true
  }),
  updateAdminUiSettings: vi.fn().mockResolvedValue({
    wind_theme_enabled: false
  }),
  listAdminActivity: vi.fn().mockResolvedValue([
    {
      id: "a1",
      event_type: "topic.created",
      topic_id: "abc12345-1111",
      topic_subject: "Onderwerp test",
      actor_user_id: "u1",
      actor_username: "admin",
      created_at: "2026-03-14T10:00:00Z"
    }
  ]),
  getAdminGenAIConfig: vi.fn().mockResolvedValue({
    system_prompt: "Standaard systeemprompt voor lokale windparkcommunicatie.",
    website_prompt: "Schrijf uitgebreid voor website.",
    facebook_prompt: "Schrijf kort voor Facebook.",
    newsletter_prompt: "Schrijf overzichtelijk voor nieuwsbrief.",
    text_model: "gpt-4.1-mini",
    image_model: "gpt-image-1",
    websearch_enabled: false,
    websearch_max_results: 3,
    has_api_key: false
  }),
  getAdminGenAIModelOptions: vi.fn().mockResolvedValue({
    text_models: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"],
    image_models: ["gpt-image-1"]
  }),
  updateAdminGenAIConfig: vi.fn().mockResolvedValue({
    system_prompt: "Aangepaste systeemprompt.",
    website_prompt: "Websiteprompt",
    facebook_prompt: "Facebookprompt",
    newsletter_prompt: "Nieuwsbriefprompt",
    text_model: "gpt-4.1-mini",
    image_model: "gpt-image-1",
    websearch_enabled: true,
    websearch_max_results: 4,
    has_api_key: true
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
  createTopic: vi.fn().mockResolvedValue({
    id: "abc99999-1111",
    title: "Nieuw onderwerp",
    subject: "Nieuw onderwerp",
    theme: "Planning",
    project_id: "p1",
    project_name: "Windpark de Boldijk",
    editorial_notes: "Handmatig toegevoegd",
    planning_at: "2026-03-20T09:00:00Z",
    workflow_state: "draft",
    is_archived: false,
    target_channels: ["website", "facebook"]
  }),
  updateTopic: vi.fn().mockResolvedValue({
    id: "abc12345-1111",
    title: "Titel",
    subject: "Onderwerp test",
    theme: "Thema test",
    project_id: "p1",
    project_name: "Windpark de Boldijk",
    editorial_notes: "Notitie",
    planning_at: null,
    workflow_state: "planned",
    is_archived: false,
    target_channels: ["website", "facebook", "newsletter"]
  }),
  deleteTopic: vi.fn().mockResolvedValue({ status: "deleted" }),
  importTopicsCsv: vi.fn().mockResolvedValue({
    created: 2,
    failed: 0,
    errors: []
  }),
  listTopics: vi.fn().mockResolvedValue([
    {
      id: "abc12345-1111",
      title: "Titel",
      subject: "Onderwerp test",
      theme: "Thema test",
      project_id: "p1",
      project_name: "Windpark de Boldijk",
      editorial_notes: "Notitie",
      planning_at: "2026-03-20T09:00:00Z",
      workflow_state: "draft",
      is_archived: false,
      target_channels: ["website", "facebook", "newsletter"]
    }
  ]),
  listTopicThemes: vi.fn().mockResolvedValue([
    { id: "planning", name: "Planning" },
    { id: "algemeen", name: "Algemeen" }
  ]),
  listTopicScheduleTemplates: vi.fn().mockResolvedValue([
    {
      id: "weekly-update",
      label: "Wekelijkse projectupdate",
      subject_template: "Wekelijkse update {project}",
      theme: "Planning",
      editorial_notes: "Gebruik feitelijke en rustige toon.",
      planning_time: "09:00"
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
          relevance_score: 72,
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
          relevance_score: 91,
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
  listCurrentVariants: vi.fn().mockResolvedValue([
    {
      id: "cv1",
      content_version_id: "v1",
      topic_id: "abc12345-1111",
      channel: "website",
      title: "Website titel",
      article_body: "<p>Website artikel</p>",
      summary: "<p>Website samenvatting</p>",
      generated_image_id: null,
      generated_image_path: null,
      approval_state: "pending",
      approved_by_user_id: null,
      approved_at: null,
      created_at: "2026-03-12T11:00:00Z",
      updated_at: "2026-03-12T11:00:00Z"
    },
    {
      id: "cv2",
      content_version_id: "v1",
      topic_id: "abc12345-1111",
      channel: "facebook",
      title: "Facebook titel",
      article_body: "<p>Facebook artikel</p>",
      summary: "<p>Facebook samenvatting</p>",
      generated_image_id: null,
      generated_image_path: null,
      approval_state: "approved",
      approved_by_user_id: "u1",
      approved_at: "2026-03-12T11:05:00Z",
      created_at: "2026-03-12T11:00:00Z",
      updated_at: "2026-03-12T11:05:00Z"
    },
    {
      id: "cv3",
      content_version_id: "v1",
      topic_id: "abc12345-1111",
      channel: "newsletter",
      title: "Nieuwsbrief titel",
      article_body: "<p>Nieuwsbrief artikel</p>",
      summary: "<p>Nieuwsbrief samenvatting</p>",
      generated_image_id: null,
      generated_image_path: null,
      approval_state: "rejected",
      approved_by_user_id: "u1",
      approved_at: "2026-03-12T11:05:00Z",
      created_at: "2026-03-12T11:00:00Z",
      updated_at: "2026-03-12T11:05:00Z"
    }
  ]),
  getCurrentSchedule: vi.fn().mockRejectedValue(new Error("No publication schedule")),
  getSchedulerOverview: vi.fn().mockResolvedValue({
    generated_at: "2026-03-14T10:30:00Z",
    recent_runs: [
      {
        schedule_id: "s-recent-1",
        topic_id: "abc12345-1111",
        topic_subject: "Onderwerp test",
        content_version_id: "v1",
        scheduled_for: "2026-03-14T08:00:00Z",
        status: "published",
        updated_at: "2026-03-14T08:01:00Z"
      }
    ],
    upcoming_runs: [
      {
        schedule_id: "s-upcoming-1",
        topic_id: "abc12345-1111",
        topic_subject: "Onderwerp test",
        content_version_id: "v1",
        scheduled_for: "2026-03-15T08:00:00Z",
        status: "scheduled"
      }
    ],
    retry_jobs: [
      {
        id: "r1",
        topic_id: "abc12345-1111",
        topic_subject: "Onderwerp test",
        flow_name: "publish_schedule",
        status: "queued",
        attempt: 1,
        max_attempts: 5,
        next_run_at: "2026-03-14T10:45:00Z",
        error_type: "RuntimeError",
        error_message: "temporary"
      }
    ]
  }),
  listActivityFeed: vi.fn().mockResolvedValue([
    {
      id: "l1",
      event_type: "content.generated",
      topic_id: "abc12345-1111",
      topic_subject: "Onderwerp test",
      actor_user_id: "u1",
      actor_username: "admin",
      details_json: "{}",
      created_at: "2026-03-14T10:20:00Z"
    }
  ]),
  listNotificationFeed: vi.fn().mockResolvedValue([
    {
      id: "n1",
      event_type: "content.generation",
      status: "success",
      topic_id: "abc12345-1111",
      topic_subject: "Onderwerp test",
      message: "Generatie geslaagd",
      payload_json: "{}",
      delivery_attempts: 1,
      delivered_at: "2026-03-14T10:20:02Z",
      last_error: "",
      created_at: "2026-03-14T10:20:01Z"
    }
  ]),
  scheduleTopic: vi.fn().mockResolvedValue({ schedule_id: "s1" }),
  updateVariant: vi.fn().mockResolvedValue({ status: "ok" }),
  approveVariant: vi.fn().mockResolvedValue({ status: "ok" }),
  approveVariantPart: vi.fn().mockResolvedValue({ status: "ok" }),
  rejectVariant: vi.fn().mockResolvedValue({ status: "ok" }),
  rejectVariantPart: vi.fn().mockResolvedValue({ status: "ok" }),
  regenerateContent: vi.fn().mockResolvedValue({ version_id: "v2" }),
  approveTopic: vi.fn().mockResolvedValue({ status: "approved" }),
  getGeneratedImageBlob: vi.fn().mockResolvedValue(new Blob(["img"], { type: "image/png" })),
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
  }),
  getUiSettings: vi.fn().mockResolvedValue({
    wind_theme_enabled: true
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
    expect(screen.getByRole("heading", { name: "Workflow overzicht" })).toBeInTheDocument();
  });
}

function openWervelnieuwsDropdown() {
  const wervelLink = screen.getByRole("link", { name: "Wervelnieuws" });
  fireEvent.mouseEnter(wervelLink.parentElement as HTMLElement);
}

function clickWervelSubmenu(label: string) {
  openWervelnieuwsDropdown();
  fireEvent.click(screen.getByRole("link", { name: label }));
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

  it("shows Windwilly suite modules after login", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "WindWilly" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Wervelnieuws" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Urenverantwoording" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Trello" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Participatiemomenten" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Workflow overzicht" })).toBeInTheDocument();
    });
  });

  it("opens trello placeholder page from top navigation", async () => {
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "Trello" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Trello" })).toBeInTheDocument();
      expect(screen.getByText(/placeholder voor onze eigen trello-achtige module/i)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Trello" }).closest("section")).toHaveClass("trello-placeholder-page");
    });
  });

  it("opens general landing page when clicking Windwilly logo", async () => {
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "Windwilly landing" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Welkom bij Windwilly" })).toBeInTheDocument();
      expect(screen.getByText(/bundelt meerdere interne diensten/i)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Main" })).not.toBeInTheDocument();
    });
  });

  it("shows Wervelnieuws subtabs on hover", async () => {
    renderApp();
    await loginIntoApp();

    fireEvent.click(screen.getByRole("link", { name: "Urenverantwoording" }));

    expect(screen.queryByRole("link", { name: "Main" })).not.toBeInTheDocument();

    const wervelLink = screen.getByRole("link", { name: "Wervelnieuws" });
    fireEvent.mouseEnter(wervelLink.parentElement as HTMLElement);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Main" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Planning" })).toBeInTheDocument();
    });
  });

  it("redirects legacy /main to /wervelnieuws/main", async () => {
    renderApp(["/main"]);
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Workflow overzicht" })).toBeInTheDocument();
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

    clickWervelSubmenu("Planning");

    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: "Onderwerp" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Thema" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Project" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Geplande datum" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Plaatsingdatum" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Website" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Facebook" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Nieuwsbrief" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Acties" })).toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "Illustratie" })).not.toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "Opmerkingen" })).not.toBeInTheDocument();
    });
  });

  it("keeps status read-only and updates per-row target media", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");

    await waitFor(() => {
      expect(screen.getByText("Nieuw")).toBeInTheDocument();
      expect(screen.queryByLabelText("Status Onderwerp test")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Nieuwsbrief Onderwerp test"));

    await waitFor(() => {
      expect(mockApi.updateTopic).toHaveBeenCalledWith(
        "abc12345-1111",
        expect.objectContaining({ target_channels: ["website", "facebook"] })
      );
    });
  });

  it("adds planning rule manually with selected target channels", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");

    await waitFor(() => {
      expect(screen.getByLabelText("Onderwerp")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Onderwerp"), {
      target: { value: "Handmatige regel" }
    });
    fireEvent.change(screen.getByLabelText("Thema"), {
      target: { value: "Planning" }
    });
    fireEvent.change(screen.getByLabelText("Geplande datum en tijd"), {
      target: { value: "2026-03-20T09:00" }
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Nieuwsbrief" }));

    fireEvent.click(screen.getByRole("button", { name: "Regel toevoegen" }));

    await waitFor(() => {
        expect(mockApi.createTopic).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Handmatige regel",
            subject: "Handmatige regel",
            theme: "Planning",
            editorial_notes: "",
            project_id: "p1",
            target_channels: ["website", "facebook"]
          }),
          expect.any(Object)
      );
      expect(screen.getByText("Planningsregel toegevoegd.")).toBeInTheDocument();
    });
  });

  it("imports planning rules via csv", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");

    await waitFor(() => {
      expect(screen.getByLabelText("CSV planning import")).toBeInTheDocument();
    });

    const file = new File([
      "onderwerp,thema,project,geplande_datum,opmerkingen,website,facebook,nieuwsbrief\n" +
        "Regel 1,Planning,Windpark de Boldijk,2026-03-20 09:00,Opmerking,ja,nee,1\n"
    ], "planning.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("CSV planning import"), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(mockApi.importTopicsCsv).toHaveBeenCalledWith(file, expect.any(Object));
      expect(screen.getByText("Import klaar: 2 toegevoegd.")).toBeInTheDocument();
    });
  });

  it("opens planning rule detail page from table", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Verwijder planningsregel Onderwerp test" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Planningsregel detail" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Planningvoortgang" })).toBeInTheDocument();
      expect(screen.getByText(/Huidige stap:/)).toBeInTheDocument();
      expect(screen.getAllByText("moet nog gebeuren").length).toBeGreaterThan(0);
      expect(screen.getByText("gepland")).toBeInTheDocument();
      expect(screen.getByText(/AI generatie gepland:/)).toBeInTheDocument();
      expect(screen.getByText(/Geplande publicatiedatum:/)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Opmerkingen" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Kanaalredactie" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Website/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Facebook/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Nieuwsbrief/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Preview Website" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Preview Facebook" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Preview Nieuwsbrief" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Artikelen opnieuw genereren" })).toBeInTheDocument();
    });
  });

  it("shows all three previews on planning detail by default", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Preview Website" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Preview Facebook" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Preview Nieuwsbrief" })).toBeInTheDocument();
    });
  });

  it("shows source passages on planning detail page", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Bronpassages" })).toBeInTheDocument();
      expect(screen.getByText(/Bron: Topic - topic-bron.txt - chunk 0/)).toBeInTheDocument();
      expect(screen.getByText(/Bron: Database - database-bron.txt - chunk 1/)).toBeInTheDocument();
      expect(screen.getByText("Score 91")).toBeInTheDocument();
      expect(screen.getByText("Score 72")).toBeInTheDocument();
      expect(mockApi.listVersions).toHaveBeenCalledWith("abc12345-1111");
    });
  });

  it("rejects text part with global text note", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Opmerkingen tekst")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Tekst afwijzen" }).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("Opmerkingen tekst"), {
      target: { value: "Herschrijf rustiger" }
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Tekst afwijzen" })[0]);

    await waitFor(() => {
      expect(mockApi.rejectVariantPart).toHaveBeenCalledWith(
        "abc12345-1111",
        "facebook",
        "text",
        "Herschrijf rustiger"
      );
    });
  });

  it("shows readable preview when channel content arrives as json", async () => {
    mockApi.listCurrentVariants.mockResolvedValueOnce([
      {
        id: "cv-json-1",
        content_version_id: "v1",
        topic_id: "abc12345-1111",
        channel: "website",
        title: "Ruwe varianttitel",
        article_body:
          '```json\n{"title":"Stormprotocol uitgelegd","article_body":"<p>Het protocol is getest met drie controles.</p>","summary":"<p>Protocol werkt naar verwachting.</p>"}\n```',
        summary: "",
        generated_image_id: null,
        generated_image_path: null,
        approval_state: "pending",
        approved_by_user_id: null,
        approved_at: null,
        created_at: "2026-03-12T11:00:00Z",
        updated_at: "2026-03-12T11:00:00Z"
      },
      {
        id: "cv-json-2",
        content_version_id: "v1",
        topic_id: "abc12345-1111",
        channel: "facebook",
        title: "Facebook titel",
        article_body: "<p>Facebook artikel</p>",
        summary: "<p>Facebook samenvatting</p>",
        generated_image_id: null,
        generated_image_path: null,
        approval_state: "pending",
        approved_by_user_id: null,
        approved_at: null,
        created_at: "2026-03-12T11:00:00Z",
        updated_at: "2026-03-12T11:00:00Z"
      },
      {
        id: "cv-json-3",
        content_version_id: "v1",
        topic_id: "abc12345-1111",
        channel: "newsletter",
        title: "Nieuwsbrief titel",
        article_body: "<p>Nieuwsbrief artikel</p>",
        summary: "<p>Nieuwsbrief samenvatting</p>",
        generated_image_id: null,
        generated_image_path: null,
        approval_state: "pending",
        approved_by_user_id: null,
        approved_at: null,
        created_at: "2026-03-12T11:00:00Z",
        updated_at: "2026-03-12T11:00:00Z"
      }
    ]);

    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Preview Website" })).toBeInTheDocument();
      expect(screen.getByText("Stormprotocol uitgelegd")).toBeInTheDocument();
      expect(screen.getAllByText("Het protocol is getest met drie controles.").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Protocol werkt naar verwachting.").length).toBeGreaterThan(0);
    });
  });

  it("retries publication planning after regeneration when first schedule call fails", async () => {
    mockApi.scheduleTopic.mockClear();
    mockApi.regenerateContent.mockClear();
    mockApi.scheduleTopic
      .mockRejectedValueOnce(new Error('{"detail":"No content version available"}'))
      .mockResolvedValueOnce({ schedule_id: "s2" });

    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Planning");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open planningsregel Onderwerp test" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Publicatiedatum opslaan" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Publicatiedatum"), {
      target: { value: "2026-03-22T08:30" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicatiedatum opslaan" }));

    const expectedIso = new Date("2026-03-22T08:30").toISOString();

    await waitFor(() => {
      expect(mockApi.scheduleTopic).toHaveBeenCalledTimes(2);
      expect(mockApi.regenerateContent).toHaveBeenCalledWith("abc12345-1111");
      expect(mockApi.scheduleTopic).toHaveBeenNthCalledWith(1, "abc12345-1111", expectedIso);
      expect(mockApi.scheduleTopic).toHaveBeenNthCalledWith(2, "abc12345-1111", expectedIso);
      expect(screen.getByText("Publicatiedatum opgeslagen.")).toBeInTheDocument();
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
      expect(screen.getByRole("heading", { name: "Workflow overzicht" })).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Bestand uploaden")).not.toBeInTheDocument();
    expect(screen.getByText("Totaal onderwerpen")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recente meldingen" })).toBeInTheDocument();
    expect(screen.getAllByText("Generatie").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Feature suggestie #1" })).toBeInTheDocument();
    expect(mockApi.listActivityFeed).toHaveBeenCalledWith({ period: "7d", limit: 5 });
    expect(mockApi.listNotificationFeed).toHaveBeenCalledWith({ period: "7d", limit: 5 });
  });

  it("renders log page with filters and activity rows", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Log");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Log" })).toBeInTheDocument();
      expect(screen.getByLabelText("Actie")).toBeInTheDocument();
      expect(screen.getByLabelText("Status")).toBeInTheDocument();
      expect(screen.getByLabelText("Onderwerp")).toBeInTheDocument();
      expect(screen.getByLabelText("Periode")).toBeInTheDocument();
      expect(screen.getAllByText("Onderwerp test").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Content gegenereerd").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Generatie").length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("Onderwerp"), {
      target: { value: "test" }
    });
    fireEvent.change(screen.getByLabelText("Periode"), {
      target: { value: "30d" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Filter toepassen" }));

    await waitFor(() => {
      expect(mockApi.listActivityFeed).toHaveBeenLastCalledWith({
        event_type: undefined,
        topic: "test",
        period: "30d",
        limit: 120
      });
      expect(mockApi.listNotificationFeed).toHaveBeenLastCalledWith({
        event_type: undefined,
        status: undefined,
        topic: "test",
        period: "30d",
        limit: 120
      });
    });
  });

  it("uploads a file from database page with project selection", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Bronbestanden");

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

    clickWervelSubmenu("Bronbestanden");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Database" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Verwijder bestand/i })).not.toBeInTheDocument();
    });
  });

  it("uploads multiple files in one action on database page", async () => {
    mockApi.uploadDatabaseDocumentWithProgress.mockClear();
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("Bronbestanden");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Database" })).toBeInTheDocument();
      expect(screen.getByLabelText("Filter project")).toHaveValue("all");
      expect(screen.getByLabelText("Upload project")).toHaveValue("p1");
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
      expect(screen.getByRole("tab", { name: "Gebruikers" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Projecten" }));

    await waitFor(() => {
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

  it("allows admin to update GenAI configuration", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Gebruikers" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "AI" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "GenAI configuratie" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Website prompt"), {
      target: { value: "Websiteprompt iteratie 9" }
    });
    fireEvent.click(screen.getByLabelText("Websearch inschakelen (standaard uit)"));
    fireEvent.change(screen.getByLabelText(/OpenAI API key/i), {
      target: { value: "new-api-key" }
    });
    fireEvent.click(screen.getByRole("button", { name: "GenAI-config opslaan" }));

    await waitFor(() => {
      expect(mockApi.updateAdminGenAIConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          website_prompt: "Websiteprompt iteratie 9",
          websearch_enabled: true,
          openai_api_key: "new-api-key"
        })
      );
      expect(screen.getByText("GenAI-config opgeslagen.")).toBeInTheDocument();
    });
  });

  it("allows admin to toggle global wind theme", async () => {
    mockApi.updateAdminUiSettings.mockClear();
    mockApi.updateAdminUiSettings.mockResolvedValueOnce({ wind_theme_enabled: false });

    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Thema's" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Thema's" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Wind-thema actief")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Wind-thema actief"));

    await waitFor(() => {
      expect(mockApi.updateAdminUiSettings).toHaveBeenCalledWith({ wind_theme_enabled: false });
      expect(screen.getByText("Wind-thema uitgeschakeld.")).toBeInTheDocument();
    });
  });

  it("opens scheduler tab in admin", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Gebruikers" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Scheduler" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Scheduler" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Recent gedraaid" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Komende planning" })).toBeInTheDocument();
      expect(screen.getAllByText("Onderwerp test").length).toBeGreaterThan(0);
      expect(mockApi.getSchedulerOverview).toHaveBeenCalled();
    });
  });

  it("shows admin log tab with topic subject", async () => {
    renderApp();
    await loginIntoApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "admin" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "admin" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Admin" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Admin log" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Admin log" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Admin log" })).toBeInTheDocument();
      expect(screen.getAllByText("Onderwerp test").length).toBeGreaterThan(0);
      expect(mockApi.listAdminActivity).toHaveBeenCalled();
    });
  });

  it("loads about content from API", async () => {
    renderApp();
    await loginIntoApp();

    clickWervelSubmenu("About");

    await waitFor(() => {
      expect(screen.getByText("Wervelnieuws helpt het communicatieteam.")).toBeInTheDocument();
      expect(screen.getByText(/Ontwikkeld door:/)).toBeInTheDocument();
      expect(screen.getByText("Iteratie 02 - Nieuwe shell")).toBeInTheDocument();
    });
  });
});
