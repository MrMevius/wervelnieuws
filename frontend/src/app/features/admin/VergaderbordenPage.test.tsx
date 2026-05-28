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
  updateBoardCardDescription: vi.fn(),
  postBoardCardUpdate: vi.fn(),
  uploadBoardRecording: vi.fn()
}));

vi.mock("../../../lib/api/client", () => api);

let mediaRecorderInstances: FakeMediaRecorder[] = [];

class FakeMediaRecorder {
  public ondataavailable: ((evt: { data: Blob }) => void) | null = null;
  public onstop: (() => void) | null = null;
  constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {
    mediaRecorderInstances.push(this);
  }
  start() {
    // no-op
  }
  requestData() {
    this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
  }
  stop() {
    this.onstop?.();
  }
}

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
    api.updateBoardCardDescription.mockResolvedValue({ id: "c1", description: "Nieuwe beschrijving" });
    mediaRecorderInstances = [];
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    });
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true
    });
    Object.defineProperty(window, "MediaRecorder", {
      value: FakeMediaRecorder,
      configurable: true
    });
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

  it("bewerkt kaartbeschrijving inline en slaat op bij blur met refresh", async () => {
    const card = { id: "c1", project_id: "p1", title: "Titel", description: "Oud", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });
    api.getBoardCard.mockResolvedValue({ card, updates: [], recordings: [] });

    renderPage();

    fireEvent.click(await screen.findByTestId("board-card-c1"));
    const input = await screen.findByLabelText("Beschrijving");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Nieuwe beschrijving" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(api.updateBoardCardDescription).toHaveBeenCalledWith("c1", { description: "Nieuwe beschrijving" });
    });
    await waitFor(() => {
      expect(api.getBoardProject).toHaveBeenCalledTimes(2);
      expect(api.getBoardCard).toHaveBeenCalledTimes(2);
    });
  });

  it("doet geen description API-call bij ongewijzigde tekst", async () => {
    const card = { id: "c1", project_id: "p1", title: "Titel", description: "Ongewijzigd", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });
    api.getBoardCard.mockResolvedValue({ card, updates: [], recordings: [] });

    renderPage();

    fireEvent.click(await screen.findByTestId("board-card-c1"));
    const input = await screen.findByLabelText("Beschrijving");
    fireEvent.focus(input);
    fireEvent.blur(input);

    await waitFor(() => {
      expect(api.updateBoardCardDescription).not.toHaveBeenCalled();
    });
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
          message: "Kaart verplaatst van Te doen naar Bezig.",
          created_at: "2026-05-27T10:00:00Z"
        }
      ],
      recordings: []
    });

    renderPage();

    expect(await screen.findByTitle("Admin Gebruiker")).toBeInTheDocument();
    fireEvent.click(await screen.findByTestId("board-card-c1"));
    expect(await screen.findByText(/Kaart verplaatst van/)).toBeInTheDocument();
    expect(screen.getByText("Te doen", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Bezig", { selector: "strong" })).toBeInTheDocument();
    expect(await screen.findByText(/· Admin Gebruiker/)).toBeInTheDocument();
  });

  it("toont recordknoppen op alle kaarten en opent detail niet bij recordklik", async () => {
    const todoCardDetail = { id: "c1", project_id: "p1", title: "Todo kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [
        { id: "c1", project_id: "p1", title: "Todo kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "c2", project_id: "p1", title: "Doing kaart", description: "", column: "doing", position: 0, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "c3", project_id: "p1", title: "Done kaart", description: "", column: "done", position: 0, assignments: [], updates_count: 0, recordings_count: 0 }
      ]
    });
    api.getBoardCard.mockResolvedValue({ card: todoCardDetail, updates: [], recordings: [] });

    renderPage();

    const todoCard = await screen.findByTestId("board-card-c1");
    await screen.findByTestId("board-card-c2");
    await screen.findByTestId("board-card-c3");
    expect(screen.getAllByRole("button", { name: /Start opname voor/ })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Start opname voor Todo kaart" })).toHaveAttribute("title", "Start opname voor Todo kaart");
    expect(screen.getByRole("button", { name: "Start opname voor Todo kaart" })).toHaveClass("record-icon-button");
    expect(screen.queryByText("Start opname")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start opname voor Todo kaart" }));
    expect(await screen.findByRole("button", { name: "Stop opname voor Todo kaart" })).toHaveAttribute("title", "Stop opname voor Todo kaart");
    expect(screen.getByRole("button", { name: "Stop opname voor Todo kaart" })).toHaveClass("is-active");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(todoCard);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("start en stopt opname vanaf kaart, toont timer op actieve kaart en uploadt", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [
        { id: "c1", project_id: "p1", title: "Kaart 1", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "c2", project_id: "p1", title: "Kaart 2", description: "", column: "done", position: 0, assignments: [], updates_count: 0, recordings_count: 0 }
      ]
    });

    renderPage();

    await screen.findByTestId("board-card-c1");
    const startOne = screen.getByRole("button", { name: "Start opname voor Kaart 1" });
    fireEvent.click(startOne);
    await new Promise((resolve) => setTimeout(resolve, 5200));
    await waitFor(() => {
      expect(screen.getByText(/Timer: [1-9]\ds|Timer: [1-9]s/)).toBeInTheDocument();
    }, { timeout: 2500 });
    expect(screen.queryByRole("button", { name: "Stop opname voor Kaart 2" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Stop opname voor Kaart 1" }));
    await waitFor(() => {
      expect(api.uploadBoardRecording).toHaveBeenCalledWith("c1", expect.any(Blob), expect.any(Number));
    });
    await waitFor(() => {
      expect(api.getBoardProject).toHaveBeenCalledTimes(2);
    });
  }, 12000);

  it("blokkeert kaartopnames korter dan 5 seconden zonder upload en met NL-melding", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [{ id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 }]
    });

    renderPage();

    await screen.findByTestId("board-card-c1");
    fireEvent.click(screen.getByRole("button", { name: "Start opname voor Kaart" }));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    fireEvent.click(screen.getByRole("button", { name: "Stop opname voor Kaart" }));

    expect(api.uploadBoardRecording).not.toHaveBeenCalled();
    expect(await screen.findByText("Opname is te kort. Neem minimaal 5 seconden op.")).toBeInTheDocument();
    expect(screen.queryByText(/Timer:/)).not.toBeInTheDocument();
  });

  it("staat maar één actieve opname tegelijk toe en toont Nederlandse foutmelding", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [
        { id: "c1", project_id: "p1", title: "Kaart 1", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "c2", project_id: "p1", title: "Kaart 2", description: "", column: "done", position: 0, assignments: [], updates_count: 0, recordings_count: 0 }
      ]
    });

    renderPage();

    await screen.findByTestId("board-card-c1");
    fireEvent.click(screen.getByRole("button", { name: "Start opname voor Kaart 1" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start opname voor Kaart 2" })).toBeDisabled();
    });

    expect(screen.queryByText("Er kan maar één opname tegelijk actief zijn.")).not.toBeInTheDocument();
  });

  it("toont Nederlandse microfoonfout wanneer starten mislukt", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [{ id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 }]
    });
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true
    });

    renderPage();

    await screen.findByTestId("board-card-c1");
    fireEvent.click(screen.getByRole("button", { name: "Start opname voor Kaart" }));
    expect(await screen.findByText("Microfoon starten is mislukt. Controleer toestemming en probeer opnieuw.")).toBeInTheDocument();
  });
});
