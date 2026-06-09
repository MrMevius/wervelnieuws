import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VergaderbordenPage } from "./VergaderbordenPage";
import { VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY } from "./vergaderbordenProjectSelection";

const api = vi.hoisted(() => ({
  listBoardProjects: vi.fn(),
  listAdminUsers: vi.fn(),
  getAdminUserAvatarUrl: vi.fn((userId: string) => `http://localhost:8001/api/admin/users/${userId}/avatar`),
  getBoardProject: vi.fn(),
  getBoardCard: vi.fn(),
  getCurrentUser: vi.fn(),
  createBoardProject: vi.fn(),
  createBoardCard: vi.fn(),
  moveBoardCard: vi.fn(),
  updateBoardCardTitle: vi.fn(),
  updateBoardCardDescription: vi.fn(),
  postBoardCardUpdate: vi.fn(),
  editBoardCardUpdate: vi.fn(),
  deleteBoardCardUpdate: vi.fn(),
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
    api.getCurrentUser.mockResolvedValue({ id: "u1", username: "admin" });
    api.createBoardProject.mockResolvedValue({ id: "p2" });
    api.createBoardCard.mockResolvedValue({ id: "c2" });
    api.postBoardCardUpdate.mockResolvedValue({ id: "u2" });
    api.editBoardCardUpdate.mockResolvedValue({ id: "u3" });
    api.deleteBoardCardUpdate.mockResolvedValue(undefined);
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
    const exactLimitTitle = "A".repeat(80);
    fireEvent.change(input, { target: { value: exactLimitTitle } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(api.updateBoardCardTitle).toHaveBeenCalledWith("c1", { title: exactLimitTitle });
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

  it("blokkeert kaarttitelbewerking boven 80 tekens", async () => {
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
    expect(input).toHaveAttribute("maxLength", "80");
    fireEvent.change(input, { target: { value: "A".repeat(81) } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("Kaarttitel mag maximaal 80 tekens bevatten.")).toBeInTheDocument();
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
    fireEvent.click(await screen.findByRole("button", { name: "Beschrijving bewerken" }));
    const input = await screen.findByLabelText("Beschrijving") as HTMLTextAreaElement;
    expect(input).toHaveAttribute("rows", "3");
    expect(input).toHaveAttribute("maxLength", "2000");
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
    fireEvent.click(await screen.findByRole("button", { name: "Beschrijving bewerken" }));
    const input = await screen.findByLabelText("Beschrijving");
    fireEvent.blur(input);

    await waitFor(() => {
      expect(api.updateBoardCardDescription).not.toHaveBeenCalled();
    });
  });

  it("blokkeert kaartbeschrijving boven 2000 tekens bij opslaan", async () => {
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
    fireEvent.click(await screen.findByRole("button", { name: "Beschrijving bewerken" }));
    const input = await screen.findByLabelText("Beschrijving");
    fireEvent.change(input, { target: { value: "x".repeat(2001) } });
    fireEvent.blur(input);

    expect(await screen.findByText("Beschrijving mag maximaal 2000 tekens bevatten.")).toBeInTheDocument();
    expect(api.updateBoardCardDescription).not.toHaveBeenCalled();
  });

  it("toont foutmelding en houdt editor open als kaartbeschrijving opslaan mislukt", async () => {
    const card = { id: "c1", project_id: "p1", title: "Titel", description: "Oud", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });
    api.getBoardCard.mockResolvedValue({ card, updates: [], recordings: [] });
    api.updateBoardCardDescription.mockRejectedValueOnce(new Error("Opslaan niet gelukt"));

    renderPage();
    fireEvent.click(await screen.findByTestId("board-card-c1"));
    fireEvent.click(await screen.findByRole("button", { name: "Beschrijving bewerken" }));
    const input = await screen.findByLabelText("Beschrijving");
    fireEvent.change(input, { target: { value: "Nieuwe beschrijving" } });
    fireEvent.blur(input);

    expect(await screen.findByText("Opslaan niet gelukt")).toBeInTheDocument();
    expect(screen.getByLabelText("Beschrijving")).toBeInTheDocument();
  });

  it("toont rijke beschrijving veilig in kolom en detail maximaal één keer", async () => {
    const description = "Regel met **vet**\n- punt\n<script>alert(1)</script>";
    const card = { id: "c1", project_id: "p1", title: "Titel", description, column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });
    api.getBoardCard.mockResolvedValue({ card, updates: [], recordings: [] });

    renderPage();

    const cardEl = await screen.findByTestId("board-card-c1");
    expect(cardEl.querySelector("strong")?.textContent).toContain("Titel");
    expect(screen.getByText("vet", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("punt", { selector: "li" })).toBeInTheDocument();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(cardEl.querySelector("script")).toBeNull();

    fireEvent.click(cardEl);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Beschrijving bewerken" })).toBeInTheDocument();
    expect(within(dialog).getAllByText("Regel met")).toHaveLength(1);
    expect(screen.queryByText("alert(1)", { selector: "script" })).not.toBeInTheDocument();
  });

  it("toont een klikbare placeholder voor lege kaartbeschrijving", async () => {
    const card = { id: "c1", project_id: "p1", title: "Titel", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });
    api.getBoardCard.mockResolvedValue({ card, updates: [], recordings: [] });

    renderPage();

    fireEvent.click(await screen.findByTestId("board-card-c1"));
    fireEvent.click(await screen.findByRole("button", { name: "Beschrijving toevoegen" }));

    expect(await screen.findByLabelText("Beschrijving")).toBeInTheDocument();
  });

  it("biedt rijke beschrijving-editor in nieuw-kaart flow", async () => {
    const card = { id: "c1", project_id: "p1", title: "Titel", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });

    renderPage();
    const todoColumn = await screen.findByTestId("board-column-todo");
    fireEvent.click(within(todoColumn).getByRole("button", { name: "+ Kaart toevoegen" }));
    const textarea = await screen.findByLabelText("Beschrijving nieuwe kaart") as HTMLTextAreaElement;
    expect(textarea).toHaveAttribute("rows", "3");
    expect(textarea).toHaveAttribute("maxLength", "2000");
    fireEvent.change(textarea, { target: { value: "regel" } });
    textarea.setSelectionRange(0, 5);
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    const exactLimitTitle = "N".repeat(80);
    fireEvent.change(screen.getByLabelText("Titel") as HTMLInputElement, { target: { value: exactLimitTitle } });
    fireEvent.click(screen.getByRole("button", { name: "Kaart toevoegen" }));

    await waitFor(() => {
      expect(api.createBoardCard).toHaveBeenCalledWith("p1", expect.objectContaining({ title: exactLimitTitle, description: "**regel**" }));
    });
  });

  it("blokkeert nieuwe kaarttitels boven 80 tekens", async () => {
    const card = { id: "c1", project_id: "p1", title: "Titel", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });

    renderPage();
    const todoColumn = await screen.findByTestId("board-column-todo");
    fireEvent.click(within(todoColumn).getByRole("button", { name: "+ Kaart toevoegen" }));
    const input = await screen.findByLabelText("Titel") as HTMLInputElement;
    expect(input).toHaveAttribute("maxLength", "80");
    fireEvent.change(input, { target: { value: "A".repeat(81) } });
    fireEvent.click(screen.getByRole("button", { name: "Kaart toevoegen" }));

    expect(await screen.findByText("Titel mag maximaal 80 tekens bevatten.")).toBeInTheDocument();
    expect(api.createBoardCard).not.toHaveBeenCalled();
  });

  it("selecteert teamleden via avatar-tiles zonder zichtbare namen en met initialen-fallback", async () => {
    api.listAdminUsers.mockResolvedValue([
      { id: "u1", username: "admin", full_name: "Admin", has_avatar: true },
      { id: "u2", username: "els", full_name: "Els van Dijk", has_avatar: false }
    ]);
    const card = { id: "c1", project_id: "p1", title: "Titel", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });

    renderPage();
    const todoColumn = await screen.findByTestId("board-column-todo");
    fireEvent.click(within(todoColumn).getByRole("button", { name: "+ Kaart toevoegen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Selecteer teamleden" }));

    const selector = await screen.findByRole("listbox", { name: "Teamleden kiezen" });
    const adminTile = within(selector).getByRole("option", { name: "Admin" });
    const elsTile = within(selector).getByRole("option", { name: "Els van Dijk" });

    const visibleLabels = Array.from(selector.querySelectorAll("span:not(.sr-only)"))
      .map((el) => el.textContent?.trim() ?? "")
      .filter(Boolean);
    expect(visibleLabels).not.toContain("Admin");
    expect(visibleLabels).not.toContain("Els van Dijk");
    expect(within(elsTile).getByText("EV", { selector: ".vergaderborden-member-tile-initials" })).toBeInTheDocument();
    const adminAvatar = adminTile.querySelector("img.vergaderborden-member-tile-avatar") as HTMLImageElement | null;
    expect(adminAvatar).not.toBeNull();
    expect(adminAvatar?.src).toContain("/api/admin/users/u1/avatar");

    fireEvent.click(adminTile);
    fireEvent.click(elsTile);
    fireEvent.change(screen.getByLabelText("Titel") as HTMLInputElement, { target: { value: "Avatar kaart" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaart toevoegen" }));

    await waitFor(() => {
      expect(api.createBoardCard).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ assignment_user_ids: expect.arrayContaining(["u1", "u2"]) })
      );
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
      assignments: [{ id: "a1", user_id: "u1", username: "admin", user_display_name: "Admin Gebruiker", has_avatar: true }],
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
          image_url: null,
          edited_from_update_id: null,
          created_at: "2026-05-27T10:00:00Z"
        }
      ],
      recordings: []
    });

    renderPage();

    const overviewAvatar = await screen.findByTitle("Admin Gebruiker");
    expect(overviewAvatar.querySelector("img.assignment-avatar-image")).not.toBeNull();
    fireEvent.click(await screen.findByTestId("board-card-c1"));
    expect(await screen.findByText(/Kaart verplaatst:/)).toBeInTheDocument();
    expect(screen.getByText(/→/)).toBeInTheDocument();
    expect(screen.getAllByTitle("Admin Gebruiker").some((el) => el.querySelector("img.assignment-avatar-image")?.getAttribute("src")?.includes("/api/admin/users/u1/avatar"))).toBe(true);
    expect(screen.getByText("Te doen", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Bezig", { selector: "strong" })).toBeInTheDocument();
    expect(await screen.findByText("Admin Gebruiker")).toBeInTheDocument();
    expect(await screen.findByText(/27-05-2026/)).toBeInTheDocument();
    expect(screen.getByText("AG")).toBeInTheDocument();
  });

  it("toont opnames in dezelfde updates-lijst zonder aparte Opnames-sectie en sorteert newest-first", async () => {
    const card = { id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 1, recordings_count: 1 };
    api.getBoardProject.mockResolvedValue({ project_id: "p1", project_name: "Project A", invited_user_ids: ["u1"], cards: [card] });
    api.getBoardCard.mockResolvedValue({
      card,
      updates: [
        {
          id: "u1",
          author_user_id: "u1",
          author_username: "admin",
          author_display_name: "Admin",
          message: "Tekstupdate",
          image_url: null,
          edited_from_update_id: null,
          created_at: "2026-05-28T10:00:00Z"
        }
      ],
      recordings: [
        {
          id: "r1",
          uploaded_by_user_id: "u1",
          uploaded_by_username: "admin",
          uploaded_by_display_name: "Admin",
          filename: "opname.webm",
          file_path: "/tmp/opname.webm",
          duration: 7,
          recorded_at: "2026-05-28T11:00:00Z",
          transcription_status: "pending",
          transcription_text: "",
          mime_type: "audio/webm",
          size_bytes: 1234,
          created_at: "2026-05-28T11:00:00Z",
          download_url: "/api/boards/recordings/r1/download"
        }
      ]
    });

    renderPage();
    fireEvent.click(await screen.findByTestId("board-card-c1"));

    expect(screen.queryByRole("heading", { name: "Opnames" })).not.toBeInTheDocument();
    expect(await screen.findByText("Audio-opname")).toBeInTheDocument();
    expect(screen.getByText("Tekstupdate")).toBeInTheDocument();

    const cards = document.querySelectorAll(".board-update-item");
    expect(cards[0]).toHaveTextContent("Audio-opname");
    expect(cards[0]).toHaveTextContent("Duur: 0:07 · Grootte: 1,2 KB");
    expect(cards[1]).toHaveTextContent("Tekstupdate");
    expect(screen.getByText("Download opname")).toHaveAttribute("href", "/api/boards/recordings/r1/download");
    const audioEl = document.querySelector("audio");
    expect(audioEl).toHaveAttribute("src", "/api/boards/recordings/r1/download");
  });

  it("toont nette fallback voor bestaande opnames met nul/onbekende duur of grootte", async () => {
    const card = { id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 1 };
    api.getBoardProject.mockResolvedValue({ project_id: "p1", project_name: "Project A", invited_user_ids: ["u1"], cards: [card] });
    api.getBoardCard.mockResolvedValue({
      card,
      updates: [],
      recordings: [
        {
          id: "r-old",
          uploaded_by_user_id: "u1",
          uploaded_by_username: "admin",
          uploaded_by_display_name: "Admin",
          filename: "oude-opname.webm",
          file_path: "/tmp/oude-opname.webm",
          duration: 0,
          recorded_at: "2026-05-28T09:00:00Z",
          transcription_status: "pending",
          transcription_text: "",
          mime_type: "audio/webm",
          size_bytes: undefined,
          created_at: "2026-05-28T09:00:00Z",
          download_url: "/api/boards/recordings/r-old/download"
        }
      ]
    });

    renderPage();
    fireEvent.click(await screen.findByTestId("board-card-c1"));

    expect(await screen.findByText("Audio-opname")).toBeInTheDocument();
    expect(screen.getByText("Duur: Duur onbekend · Grootte: Grootte onbekend")).toBeInTheDocument();
    expect(screen.getByText("Download opname")).toHaveAttribute("href", "/api/boards/recordings/r-old/download");
    const audioEl = document.querySelector("audio");
    expect(audioEl).toHaveAttribute("src", "/api/boards/recordings/r-old/download");
  });

  it("rendert markdown-opmaak, lijstjes en escaped html veilig", async () => {
    const card = { id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 1, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({ project_id: "p1", project_name: "Project A", invited_user_ids: ["u1"], cards: [card] });
    api.getBoardCard.mockResolvedValue({
      card,
      updates: [
        {
          id: "u1",
          author_user_id: "u1",
          author_username: "admin",
          author_display_name: "Admin",
          message: "Eerste regel\nTweede met **vet** en *cursief* en ++onderstreept++\n- punt 1\n- punt 2\n1. stap 1\n2. stap 2\n<script>alert(1)</script>",
          image_url: null,
          edited_from_update_id: null,
          created_at: "2026-05-28T10:00:00Z"
        }
      ],
      recordings: []
    });

    renderPage();
    fireEvent.click(await screen.findByTestId("board-card-c1"));

    expect(await screen.findByText("vet", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("cursief", { selector: "em" })).toBeInTheDocument();
    expect(screen.getByText("onderstreept", { selector: "u" })).toBeInTheDocument();
    expect(screen.getByText("punt 1", { selector: "li" })).toBeInTheDocument();
    expect(screen.getByText("stap 2", { selector: "li" })).toBeInTheDocument();
    expect(screen.getByText("Tweede met", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(screen.queryByText("alert(1)", { selector: "script" })).not.toBeInTheDocument();
  });

  it("voegt opmaak via toolbar toe in nieuw- en bewerk-update formulier", async () => {
    const card = { id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 1, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({ project_id: "p1", project_name: "Project A", invited_user_ids: ["u1"], cards: [card] });
    api.getBoardCard.mockResolvedValue({
      card,
      updates: [
        { id: "u1", author_user_id: "u1", author_username: "admin", author_display_name: "Admin", message: "Eigen update", image_url: null, edited_from_update_id: null, created_at: "2026-05-28T10:00:00Z" }
      ],
      recordings: []
    });

    renderPage();
    fireEvent.click(await screen.findByTestId("board-card-c1"));

    const createTextarea = await screen.findByPlaceholderText("Beschrijf kort de voortgang") as HTMLTextAreaElement;
    fireEvent.change(createTextarea, { target: { value: "regel" } });
    createTextarea.setSelectionRange(0, 5);
    const boldButtons = screen.getAllByRole("button", { name: "B" });
    const underlineButtons = screen.getAllByRole("button", { name: "U" });
    const bulletButtons = screen.getAllByRole("button", { name: "• Lijst" });
    fireEvent.click(boldButtons[boldButtons.length - 1]);
    fireEvent.click(underlineButtons[underlineButtons.length - 1]);
    fireEvent.click(bulletButtons[bulletButtons.length - 1]);
    fireEvent.click(screen.getByRole("button", { name: "Update plaatsen" }));

    await waitFor(() => {
      expect(api.postBoardCardUpdate).toHaveBeenCalledWith("c1", expect.stringContaining("**regel**"));
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerken" }));
    const editTextarea = await screen.findByLabelText("Update bewerken") as HTMLTextAreaElement;
    editTextarea.focus();
    editTextarea.setSelectionRange(0, 5);
    const numberButtons = screen.getAllByRole("button", { name: "1. Lijst" });
    fireEvent.click(numberButtons[numberButtons.length - 1]);
    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => {
      expect(api.editBoardCardUpdate).toHaveBeenCalledWith("c1", "u1", expect.objectContaining({ message: "1. Eigen update" }));
    });
  });

  it("toont compacte update-acties alleen voor auteur en ondersteunt save/cancel", async () => {
    const card = { id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 1, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({ project_id: "p1", project_name: "Project A", invited_user_ids: ["u1"], cards: [card] });
    api.getBoardCard.mockResolvedValue({
      card,
      updates: [
        { id: "u1", author_user_id: "u1", author_username: "admin", author_display_name: "Admin", message: "Eigen update", image_url: "https://example.com/update.png", edited_from_update_id: null, created_at: "2026-05-28T10:00:00Z" },
        { id: "u2", author_user_id: "u2", author_username: "editor", author_display_name: "Editor", message: "Andermans update", image_url: null, edited_from_update_id: null, created_at: "2026-05-28T09:00:00Z" }
      ],
      recordings: []
    });

    renderPage();
    fireEvent.click(await screen.findByTestId("board-card-c1"));
    expect(await screen.findByText("Eigen update")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Update-afbeelding" })).toHaveAttribute("src", "https://example.com/update.png");
    const editButtons = screen.getAllByRole("button", { name: "Bewerken" });
    expect(editButtons).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Verwijderen" })).toBeInTheDocument();
    expect(screen.getByText("•")).toBeInTheDocument();

    fireEvent.click(editButtons[0]);
    const textarea = await screen.findByLabelText("Update bewerken");
    fireEvent.change(textarea, { target: { value: "Eigen update aangepast" } });
    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));
    await waitFor(() => {
      expect(api.editBoardCardUpdate).toHaveBeenCalledWith("c1", "u1", expect.objectContaining({ message: "Eigen update aangepast" }));
    });

    fireEvent.click(await screen.findByRole("button", { name: "Bewerken" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuleren" }));
    expect(screen.queryByLabelText("Update bewerken")).not.toBeInTheDocument();
  });

  it("doet geen delete API-call bij annuleren van confirm", async () => {
    const card = { id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 1, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({ project_id: "p1", project_name: "Project A", invited_user_ids: ["u1"], cards: [card] });
    api.getBoardCard.mockResolvedValue({
      card,
      updates: [{ id: "u1", author_user_id: "u1", author_username: "admin", author_display_name: "Admin", message: "Eigen update", image_url: null, edited_from_update_id: null, created_at: "2026-05-28T10:00:00Z" }],
      recordings: []
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderPage();
    fireEvent.click(await screen.findByTestId("board-card-c1"));
    fireEvent.click(await screen.findByRole("button", { name: "Verwijderen" }));

    expect(api.deleteBoardCardUpdate).not.toHaveBeenCalled();
  });

  it("verwijdert update na confirm en refresht kaart/project", async () => {
    const card = { id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 1, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({ project_id: "p1", project_name: "Project A", invited_user_ids: ["u1"], cards: [card] });
    api.getBoardCard
      .mockResolvedValueOnce({
        card,
        updates: [{ id: "u1", author_user_id: "u1", author_username: "admin", author_display_name: "Admin", message: "Eigen update", image_url: null, edited_from_update_id: null, created_at: "2026-05-28T10:00:00Z" }],
        recordings: []
      })
      .mockResolvedValueOnce({ card, updates: [], recordings: [] });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();
    fireEvent.click(await screen.findByTestId("board-card-c1"));
    fireEvent.click(await screen.findByRole("button", { name: "Verwijderen" }));

    await waitFor(() => {
      expect(api.deleteBoardCardUpdate).toHaveBeenCalledWith("c1", "u1");
    });
    await waitFor(() => {
      expect(api.getBoardCard).toHaveBeenCalledTimes(2);
      expect(api.getBoardProject).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText("Eigen update")).not.toBeInTheDocument();
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
    const uploadDuration = api.uploadBoardRecording.mock.calls[0]?.[2];
    expect(typeof uploadDuration).toBe("number");
    expect(uploadDuration).toBeGreaterThan(0);
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
