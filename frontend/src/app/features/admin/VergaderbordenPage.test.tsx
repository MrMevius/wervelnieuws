import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VergaderbordenPage } from "./VergaderbordenPage";
import { VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY } from "./vergaderbordenProjectSelection";

const api = vi.hoisted(() => ({
  listBoardProjects: vi.fn(),
  listAdminUsers: vi.fn(),
  getBoardProject: vi.fn(),
  getBoardCard: vi.fn(),
  createBoardProject: vi.fn(),
  createBoardCard: vi.fn(),
  moveBoardCard: vi.fn(),
  updateBoardCardTitle: vi.fn(),
  postBoardCardUpdate: vi.fn(),
  uploadBoardRecording: vi.fn()
}));

vi.mock("../../../lib/api/client", () => api);

function renderPage(initialEntry = "/vergaderborden?project=p1", canManageProjects = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/vergaderborden" element={<VergaderbordenPage canManageProjects={canManageProjects} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function makeDataTransfer() {
  const store = new Map<string, string>();
  return {
    setData: (type: string, value: string) => store.set(type, value),
    getData: (type: string) => store.get(type) ?? ""
  };
}

describe("Vergaderborden drag/drop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.listAdminUsers.mockResolvedValue([{ id: "u1", username: "admin", full_name: "Admin" }]);
    api.listBoardProjects.mockResolvedValue([
      {
        id: "p0",
        name: "Algemeen",
        description: "",
        invited_user_ids: ["u1"],
        card_count: 0,
        last_activity_at: null
      },
      {
        id: "p1",
        name: "Project A",
        description: "",
        invited_user_ids: ["u1"],
        card_count: 1,
        last_activity_at: null
      }
    ]);
    api.getBoardCard.mockResolvedValue({ card: null, updates: [], recordings: [] });
    api.createBoardProject.mockResolvedValue({ id: "p2" });
    api.createBoardCard.mockResolvedValue({ id: "c2" });
    api.postBoardCardUpdate.mockResolvedValue({ id: "u2" });
    api.uploadBoardRecording.mockResolvedValue({ id: "r1" });
    api.moveBoardCard.mockResolvedValue({ status: "ok" });
    api.updateBoardCardTitle.mockResolvedValue({ id: "c1", title: "Nieuwe titel" });
  });

  it("slaat direct op bij verplaatsen naar andere kolom", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [{ id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 }]
    });

    renderPage();

    const card = await screen.findByTestId("board-card-c1");
    const doingColumn = await screen.findByTestId("board-column-doing");
    const dt = makeDataTransfer();
    fireEvent.dragStart(card, { dataTransfer: dt });
    fireEvent.drop(doingColumn, { dataTransfer: dt });

    await waitFor(() => {
      expect(api.moveBoardCard).toHaveBeenCalledWith("c1", { column: "doing", position: 0 });
    });
  });

  it("doet geen API-call bij same-column drop met meerdere kaarten", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [
        { id: "c1", project_id: "p1", title: "Kaart 1", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "c2", project_id: "p1", title: "Kaart 2", description: "", column: "todo", position: 1, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "c3", project_id: "p1", title: "Kaart 3", description: "", column: "todo", position: 2, assignments: [], updates_count: 0, recordings_count: 0 }
      ]
    });

    renderPage();

    const card = await screen.findByTestId("board-card-c1");
    const todoColumn = await screen.findByTestId("board-column-todo");
    const dt = makeDataTransfer();
    fireEvent.dragStart(card, { dataTransfer: dt });
    fireEvent.drop(todoColumn, { dataTransfer: dt });

    await waitFor(() => {
      expect(api.moveBoardCard).not.toHaveBeenCalled();
    });
  });

  it("toont Nederlandse foutmelding en herstelt consistent", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [{ id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 }]
    });
    api.moveBoardCard.mockRejectedValueOnce(new Error("Serverfout"));

    renderPage();

    const card = await screen.findByTestId("board-card-c1");
    const doingColumn = await screen.findByTestId("board-column-doing");
    const dt = makeDataTransfer();
    fireEvent.dragStart(card, { dataTransfer: dt });
    fireEvent.drop(doingColumn, { dataTransfer: dt });

    expect(await screen.findByText(/Kaart verplaatsen is mislukt:/)).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getBoardProject).toHaveBeenCalledTimes(2);
    });
  });

  it("bewerkt een kaarttitel alleen in het geopende kaartdetail en slaat op met Enter", async () => {
    const card = { id: "c1", project_id: "p1", title: "Oude titel", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });
    api.getBoardCard.mockResolvedValue({ card, updates: [], recordings: [] });

    renderPage();

    expect(screen.queryByRole("button", { name: "Kaarttitel bewerken: Oude titel" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByTestId("board-card-c1"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bewerken" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Kaarttitel bewerken: Oude titel" }));
    const input = await screen.findByLabelText("Kaarttitel");
    fireEvent.change(input, { target: { value: "Nieuwe titel" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(api.updateBoardCardTitle).toHaveBeenCalledWith("c1", { title: "Nieuwe titel" });
    });
  });

  it("houdt overzichtstitels niet bewerkbaar en slaat detailtitel op bij blur", async () => {
    const detailCard = { id: "c3", project_id: "p1", title: "Done titel", description: "", column: "done", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [
        { id: "c1", project_id: "p1", title: "Todo titel", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "c2", project_id: "p1", title: "Doing titel", description: "", column: "doing", position: 0, assignments: [], updates_count: 0, recordings_count: 0 },
        detailCard
      ]
    });
    api.getBoardCard.mockResolvedValue({ card: detailCard, updates: [], recordings: [] });

    renderPage();

    await screen.findByText("Todo titel");
    expect(screen.queryByRole("button", { name: "Kaarttitel bewerken: Todo titel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kaarttitel bewerken: Doing titel" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByTestId("board-card-c3"));
    expect(screen.queryByRole("button", { name: "Bewerken" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Kaarttitel bewerken: Done titel" }));
    const input = await screen.findByLabelText("Kaarttitel");
    fireEvent.change(input, { target: { value: "Done titel aangepast" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(api.updateBoardCardTitle).toHaveBeenCalledWith("c3", { title: "Done titel aangepast" });
    });
  });

  it("blokkeert lege kaarttitels met een Nederlandse foutmelding", async () => {
    const card = { id: "c1", project_id: "p1", title: "Oude titel", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });
    api.getBoardCard.mockResolvedValue({ card, updates: [], recordings: [] });

    renderPage();

    fireEvent.click(await screen.findByTestId("board-card-c1"));
    fireEvent.click(await screen.findByRole("button", { name: "Kaarttitel bewerken: Oude titel" }));
    const input = await screen.findByLabelText("Kaarttitel");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("Vul een kaarttitel in.")).toBeInTheDocument();
    expect(api.updateBoardCardTitle).not.toHaveBeenCalled();
  });

  it("opent kaartdetail vanaf het overzicht en annuleert detailtitelbewerking met Escape", async () => {
    const card = { id: "c1", project_id: "p1", title: "Oude titel", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });
    api.getBoardCard.mockResolvedValue({ card, updates: [], recordings: [] });

    renderPage();

    fireEvent.click(await screen.findByTestId("board-card-c1"));
    await waitFor(() => {
      expect(api.getBoardCard).toHaveBeenCalledWith("c1");
    });
    fireEvent.click(await screen.findByRole("button", { name: "Kaarttitel bewerken: Oude titel" }));
    const input = await screen.findByLabelText("Kaarttitel");
    fireEvent.change(input, { target: { value: "Niet opslaan" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(api.updateBoardCardTitle).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Kaarttitel bewerken: Oude titel" })).toBeInTheDocument();
  });

  it("kiest standaard Algemeen als project wanneer query ontbreekt", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p0",
      project_name: "Algemeen",
      invited_user_ids: ["u1"],
      cards: []
    });

    renderPage("/vergaderborden");

    await waitFor(() => {
      expect(api.getBoardProject).toHaveBeenCalledWith("p0");
    });
    expect(screen.getByRole("heading", { name: "Algemeen" })).toBeInTheDocument();
    expect(screen.queryByText("Projecten en kaarten overzichtelijk beheren per fase.")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY)).toBe("p0");
  });

  it("slaat alleen geldige project-id op in localStorage", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: []
    });

    renderPage("/vergaderborden?project=p1");

    await waitFor(() => {
      expect(api.getBoardProject).toHaveBeenCalledWith("p1");
    });

    expect(window.localStorage.getItem(VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY)).toBe("p1");
  });

  it("valideert ongeldige projectquery en valt terug op Algemeen", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p0",
      project_name: "Algemeen",
      invited_user_ids: ["u1"],
      cards: []
    });

    renderPage("/vergaderborden?project=bestaat-niet");

    await waitFor(() => {
      expect(api.getBoardProject).toHaveBeenCalledWith("p0");
    });
    expect(window.localStorage.getItem(VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY)).toBe("p0");
  });

  it("toont geen pagina-level projectselector en geen nieuw-project knop in reguliere context", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: []
    });

    renderPage("/vergaderborden?project=p1", false);

    await waitFor(() => {
      expect(api.getBoardProject).toHaveBeenCalledWith("p1");
    });
    expect(screen.queryByTestId("vergaderborden-project-select")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nieuw project" })).not.toBeInTheDocument();
  });

  it("toont nieuw-project knop alleen in admin-context", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: []
    });

    renderPage("/vergaderborden?project=p1", true);

    expect(await screen.findByRole("button", { name: "Nieuw project" })).toBeInTheDocument();
  });

  it("toont display names voor toewijzingen en update-auteur", async () => {
    const card = {
      id: "c1",
      project_id: "p1",
      title: "Kaart",
      description: "",
      column: "todo",
      position: 0,
      assignments: [{ id: "a1", user_id: "u1", username: "admin", user_display_name: "Admin Gebruiker" }],
      updates_count: 1,
      recordings_count: 0
    };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });
    api.getBoardCard.mockResolvedValue({
      card,
      updates: [
        {
          id: "u1",
          author_user_id: "u1",
          author_username: "admin",
          author_display_name: "Admin Gebruiker",
          message: "Verplaatst van Te doen naar Bezig door Admin Gebruiker.",
          created_at: "2026-05-27T10:00:00Z"
        }
      ],
      recordings: []
    });

    renderPage();

    expect(await screen.findByTitle("Admin Gebruiker")).toBeInTheDocument();
    fireEvent.click(await screen.findByTestId("board-card-c1"));
    expect(await screen.findByText("Verplaatst van Te doen naar Bezig door Admin Gebruiker.")).toBeInTheDocument();
    expect(await screen.findByText(/· Admin Gebruiker/)).toBeInTheDocument();
  });
});
