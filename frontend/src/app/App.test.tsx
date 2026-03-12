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
  updateAdminUser: vi.fn().mockResolvedValue({
    id: "u2",
    username: "editor",
    full_name: "Editor",
    email: "editor@example.com",
    is_admin: true,
    is_active: true
  }),
  changeAdminUserPassword: vi.fn().mockResolvedValue({ status: "ok" }),
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
