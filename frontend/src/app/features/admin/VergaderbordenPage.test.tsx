import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  archiveBoardCard: vi.fn(),
  restoreBoardCard: vi.fn(),
  deleteBoardCard: vi.fn(),
  listBoardRecycleBin: vi.fn(),
  restoreDeletedBoardCard: vi.fn(),
  moveBoardCard: vi.fn(),
  updateBoardCardTitle: vi.fn(),
  updateBoardCardDescription: vi.fn(),
  postBoardCardUpdate: vi.fn(),
  editBoardCardUpdate: vi.fn(),
  deleteBoardCardUpdate: vi.fn(),
  uploadBoardRecording: vi.fn(),
  uploadBoardCardAttachment: vi.fn(),
  deleteBoardCardAttachment: vi.fn()
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

function makeDataTransfer(options: { readable?: boolean } = {}) {
  const { readable = true } = options;
  const store = new Map<string, string>();
  return {
    setData: (type: string, value: string) => store.set(type, value),
    getData: vi.fn((type: string) => (readable ? store.get(type) ?? "" : ""))
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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
    api.archiveBoardCard.mockResolvedValue({ id: "c1" });
    api.restoreBoardCard.mockResolvedValue({ id: "c1" });
    api.deleteBoardCard.mockResolvedValue({ status: "deleted" });
    api.listBoardRecycleBin.mockResolvedValue([]);
    api.restoreDeletedBoardCard.mockResolvedValue({ id: "c1" });
    api.postBoardCardUpdate.mockResolvedValue({ id: "u2" });
    api.editBoardCardUpdate.mockResolvedValue({ id: "u3" });
    api.deleteBoardCardUpdate.mockResolvedValue(undefined);
    api.uploadBoardRecording.mockResolvedValue({ id: "r1" });
    api.uploadBoardCardAttachment.mockResolvedValue({ id: "a1" });
    api.deleteBoardCardAttachment.mockResolvedValue({ status: "deleted" });
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("houdt een direct geopend verborgen bord leesbaar maar zonder mutatieacties", async () => {
    const card = { id: "c1", project_id: "p1", title: "Historische kaart", description: "Historie", column: "todo", position: 0, assignments: [], updates_count: 1, recordings_count: 1, attachments_count: 1 };
    const archivedCard = { id: "c-archive", project_id: "p1", title: "Gearchiveerde historie", description: "Oude kaart", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0, attachments_count: 0, is_archived: true };
    api.listBoardProjects.mockResolvedValue([]);
    api.getBoardProject.mockResolvedValue({ project_id: "p1", project_name: "Verborgen", invited_user_ids: ["u1"], cards: [card], archived_cards: [archivedCard], is_read_only: true });
    api.getBoardCard.mockResolvedValue({
      card,
      updates: [{ id: "update-1", author_user_id: "u1", author_username: "admin", author_display_name: "Admin", message: "Historische update", created_at: "2026-08-10T10:00:00Z" }],
      recordings: [{ id: "recording-1", filename: "historisch.webm", duration: 7, size_bytes: 12, created_at: "2026-08-10T10:00:00Z", download_url: "/download" }],
      attachments: [{ id: "attachment-1", filename: "historisch.txt", mime_type: "text/plain", size_bytes: 9, created_at: "2026-08-10T10:00:00Z", download_url: "/download" }]
    });

    renderPage("/vergaderborden?project=p1");

    expect(await screen.findByText(/alleen-lezen/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Kaart toevoegen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Prullenbak/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("board-card-c1")).toHaveAttribute("draggable", "false");
    fireEvent.click(screen.getByTestId("board-card-c1"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Historische update")).toBeInTheDocument();
    expect(screen.getByText("Audio-opname")).toBeInTheDocument();
    expect(screen.getByText("historisch.txt")).toBeInTheDocument();
    expect(screen.queryByLabelText("Kaarttitel bewerken: Historische kaart")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Beschrijving bewerken")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kaart archiveren: Historische kaart" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kaart verwijderen: Historische kaart" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kaart terugzetten: Historische kaart" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kaart herstellen: Historische kaart" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update plaatsen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bewerken" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verwijderen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start opname/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toevoegen" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Archief/ }));
    expect(await screen.findByText("Gearchiveerde historie")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kaart terugzetten: Gearchiveerde historie" })).not.toBeInTheDocument();
    expect(screen.queryByText(/kun je hier terugzetten/i)).not.toBeInTheDocument();
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

  it("toont een duidelijke horizontale invoegstreep op de middenpositie in een andere kolom", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [
        { id: "c1", project_id: "p1", title: "Todo 1", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "c2", project_id: "p1", title: "Todo 2", description: "", column: "todo", position: 1, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "d1", project_id: "p1", title: "Doing 1", description: "", column: "doing", position: 0, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "d2", project_id: "p1", title: "Doing 2", description: "", column: "doing", position: 1, assignments: [], updates_count: 0, recordings_count: 0 }
      ]
    });

    renderPage();

    const sourceCard = await screen.findByTestId("board-card-c1");
    const targetCard = await screen.findByTestId("board-card-d1");
    Object.defineProperty(targetCard, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 100,
        top: 100,
        left: 0,
        right: 240,
        bottom: 160,
        width: 240,
        height: 60,
        toJSON: () => ({})
      }),
      configurable: true
    });
    const dt = makeDataTransfer({ readable: false });
    fireEvent.dragStart(sourceCard, { dataTransfer: dt });
    fireEvent.dragOver(targetCard, { dataTransfer: dt, clientY: 150 });

    expect(await screen.findByTestId("board-drop-indicator-doing-d1-after")).toBeInTheDocument();

    fireEvent.drop(targetCard, { dataTransfer: dt, clientY: 150 });

    expect(dt.getData).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(api.moveBoardCard).toHaveBeenCalledWith("c1", { column: "doing", position: 1 });
    });
  });

  it("plaatst een kaart onderaan een niet-lege kolom echt als laatste", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [
        { id: "c1", project_id: "p1", title: "Todo 1", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "c2", project_id: "p1", title: "Todo 2", description: "", column: "todo", position: 1, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "d1", project_id: "p1", title: "Doing 1", description: "", column: "doing", position: 0, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "d2", project_id: "p1", title: "Doing 2", description: "", column: "doing", position: 1, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "d3", project_id: "p1", title: "Doing 3", description: "", column: "doing", position: 2, assignments: [], updates_count: 0, recordings_count: 0 }
      ]
    });

    renderPage();

    const sourceCard = await screen.findByTestId("board-card-c1");
    const doingColumn = await screen.findByTestId("board-column-doing");
    const dt = makeDataTransfer({ readable: false });
    fireEvent.dragStart(sourceCard, { dataTransfer: dt });
    fireEvent.dragOver(doingColumn, { dataTransfer: dt, clientY: 999 });

    expect(await screen.findByTestId("board-drop-indicator-doing-end")).toBeInTheDocument();

    fireEvent.drop(doingColumn, { dataTransfer: dt, clientY: 999 });

    expect(dt.getData).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(api.moveBoardCard).toHaveBeenCalledWith("c1", { column: "doing", position: 3 });
    });
  });

  it("verplaatst een kaart binnen dezelfde kolom naar een nieuwe positie en gebruikt drag state in plaats van dataTransfer tijdens dragover", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [
        { id: "c1", project_id: "p1", title: "Todo 1", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "c2", project_id: "p1", title: "Todo 2", description: "", column: "todo", position: 1, assignments: [], updates_count: 0, recordings_count: 0 },
        { id: "c3", project_id: "p1", title: "Todo 3", description: "", column: "todo", position: 2, assignments: [], updates_count: 0, recordings_count: 0 }
      ]
    });

    renderPage();

    const sourceCard = await screen.findByTestId("board-card-c3");
    const targetCard = await screen.findByTestId("board-card-c1");
    Object.defineProperty(targetCard, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 100,
        top: 100,
        left: 0,
        right: 240,
        bottom: 160,
        width: 240,
        height: 60,
        toJSON: () => ({})
      }),
      configurable: true
    });

    const dt = makeDataTransfer({ readable: false });
    fireEvent.dragStart(sourceCard, { dataTransfer: dt });
    fireEvent.dragOver(targetCard, { dataTransfer: dt, clientY: 120 });
    expect(dt.getData).not.toHaveBeenCalled();

    fireEvent.drop(targetCard, { dataTransfer: dt, clientY: 120 });

    expect(dt.getData).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(api.moveBoardCard).toHaveBeenCalledWith("c3", { column: "todo", position: 1 });
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

  it("houdt beschrijving-toolbaracties intact bij blur en slaat daarna gepolijst op", async () => {
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
    fireEvent.change(input, { target: { value: "Nieuwe beschrijving" } });
    input.setSelectionRange(0, "Nieuwe beschrijving".length);

    const boldButton = within(screen.getByRole("dialog")).getAllByRole("button", { name: "B" })[0];
    fireEvent.blur(input, { relatedTarget: boldButton });
    expect(api.updateBoardCardDescription).not.toHaveBeenCalled();

    fireEvent.mouseDown(boldButton);
    fireEvent.click(boldButton);
    await waitFor(() => {
      expect(input).toHaveValue("**Nieuwe beschrijving**");
    });

    fireEvent.blur(input);

    await waitFor(() => {
      expect(api.updateBoardCardDescription).toHaveBeenCalledWith("c1", { description: "**Nieuwe beschrijving**" });
    });
  });

  it("zet initial focus, houdt focus in de modal en geeft focus terug aan de trigger", async () => {
    const card = { id: "c1", project_id: "p1", title: "Titel", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });
    api.getBoardCard.mockResolvedValue({ card, updates: [], recordings: [] });

    renderPage();

    const trigger = await screen.findByTestId("board-card-c1");
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByText("Beschrijving")).toHaveLength(1);
    expect(within(dialog).queryByText("Klik om de kaartomschrijving direct te bewerken.")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("De update blijft op dezelfde plek, maar is rustiger opgebouwd.")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Sleep een bestand in de zone of kies handmatig een bijlage.")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Bijlage selecteren")).not.toBeInTheDocument();
    const closeButton = within(dialog).getByRole("button", { name: "Kaartdetail sluiten" });

    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });

    const attachmentInput = within(dialog).getByLabelText("Bijlagen selecteren") as HTMLInputElement;
    fireEvent.change(attachmentInput, { target: { files: [new File(["bijlage"], "bijlage.txt", { type: "text/plain" })] } });

    const uploadButton = within(dialog).getByRole("button", { name: "Toevoegen" });
    expect(uploadButton).not.toBeDisabled();
    const titleEditButton = within(dialog).getByRole("button", { name: "Kaarttitel bewerken: Titel" });

    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((element) => element.tabIndex >= 0);
    const lastFocusable = focusables[focusables.length - 1];
    expect(lastFocusable).toBeDefined();

    uploadButton.focus();
    fireEvent.keyDown(uploadButton, { key: "Tab", code: "Tab" });
    expect(titleEditButton).toHaveFocus();

    lastFocusable.focus();
    fireEvent.keyDown(lastFocusable, { key: "Tab", code: "Tab" });
    expect(titleEditButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
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

  it("toont meerdere geselecteerde bijlagen en uploadt ze automatisch na aanmaken", async () => {
    const card = { id: "c1", project_id: "p1", title: "Titel", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });
    const createCard = deferred<{ id: string }>();
    const firstUpload = deferred<{ id: string }>();
    const secondUpload = deferred<{ id: string }>();
    api.createBoardCard.mockReturnValueOnce(createCard.promise);
    api.uploadBoardCardAttachment.mockReturnValueOnce(firstUpload.promise).mockReturnValueOnce(secondUpload.promise);

    renderPage();
    const todoColumn = await screen.findByTestId("board-column-todo");
    fireEvent.click(within(todoColumn).getByRole("button", { name: "+ Kaart toevoegen" }));

    const attachmentInput = screen.getByLabelText("Bijlagen selecteren") as HTMLInputElement;
    const fileA = new File(["een"], "eerste.txt", { type: "text/plain" });
    const fileB = new File(["twee"], "tweede.txt", { type: "text/plain" });
    fireEvent.change(attachmentInput, { target: { files: [fileA, fileB] } });

    expect(screen.getByText("Geselecteerd: eerste.txt, tweede.txt")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Titel"), { target: { value: "Nieuwe kaart" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaart toevoegen" }));

    expect(await screen.findByText("Kaart wordt aangemaakt…")).toBeInTheDocument();
    await act(async () => {
      createCard.resolve({ id: "c2" });
    });

    await waitFor(() => {
      expect(api.createBoardCard).toHaveBeenCalledWith("p1", expect.objectContaining({ title: "Nieuwe kaart", description: "", column: "todo", assignment_user_ids: [] }));
    });

    await waitFor(() => {
      expect(api.uploadBoardCardAttachment).toHaveBeenNthCalledWith(1, "c2", fileA);
    });
    await act(async () => {
      firstUpload.resolve({ id: "a1" });
    });

    await waitFor(() => {
      expect(api.uploadBoardCardAttachment).toHaveBeenNthCalledWith(2, "c2", fileB);
    });
    await act(async () => {
      secondUpload.resolve({ id: "a2" });
    });

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("laat een nieuwe kaart zonder bijlagen normaal aanmaken", async () => {
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
    fireEvent.change(screen.getByLabelText("Titel"), { target: { value: "Zonder bijlagen" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaart toevoegen" }));

    await waitFor(() => {
      expect(api.createBoardCard).toHaveBeenCalledWith("p1", expect.objectContaining({ title: "Zonder bijlagen", description: "", column: "todo", assignment_user_ids: [] }));
    });
    expect(api.uploadBoardCardAttachment).not.toHaveBeenCalled();
  });

  it("toont Nederlandse melding als een nieuwe bijlage-upload faalt", async () => {
    const card = { id: "c1", project_id: "p1", title: "Titel", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [card]
    });
    api.uploadBoardCardAttachment.mockResolvedValueOnce({ id: "a1" }).mockRejectedValueOnce(new Error("Upload mislukt"));

    renderPage();
    const todoColumn = await screen.findByTestId("board-column-todo");
    fireEvent.click(within(todoColumn).getByRole("button", { name: "+ Kaart toevoegen" }));
    const attachmentInput = screen.getByLabelText("Bijlagen selecteren") as HTMLInputElement;
    const fileA = new File(["een"], "eerste.txt", { type: "text/plain" });
    const fileB = new File(["twee"], "tweede.txt", { type: "text/plain" });
    fireEvent.change(attachmentInput, { target: { files: [fileA, fileB] } });
    fireEvent.change(screen.getByLabelText("Titel"), { target: { value: "Met fout" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaart toevoegen" }));

    await waitFor(() => {
      expect(api.createBoardCard).toHaveBeenCalledWith("p1", expect.objectContaining({ title: "Met fout", description: "", column: "todo", assignment_user_ids: [] }));
    });
    await waitFor(() => {
      expect(api.uploadBoardCardAttachment).toHaveBeenNthCalledWith(1, "c2", fileA);
      expect(api.uploadBoardCardAttachment).toHaveBeenNthCalledWith(2, "c2", fileB);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Kaart is aangemaakt, maar 1 van de 2 bijlagen konden niet worden geüpload. De kaart blijft beschikbaar.");
    expect(api.uploadBoardCardAttachment).toHaveBeenNthCalledWith(1, "c2", fileA);
    expect(api.uploadBoardCardAttachment).toHaveBeenNthCalledWith(2, "c2", fileB);
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
      { id: "u9", username: "anders", full_name: "Anders", has_avatar: true }
    ]);
    const card = { id: "c1", project_id: "p1", title: "Titel", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      access_users: [
        { id: "u1", username: "admin", full_name: "Admin", is_admin: true, is_active: true, has_avatar: true },
        { id: "u2", username: "els", full_name: "Els van Dijk", is_admin: false, is_active: true, has_avatar: false }
      ],
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

  it("toont laden-, fout- en lege-status voor teamleden in de selector", async () => {
    const pendingBoard = new Promise<never>(() => undefined);
    api.getBoardProject.mockReturnValueOnce(pendingBoard);

    renderPage();
    const todoColumn = await screen.findByTestId("board-column-todo");
    fireEvent.click(within(todoColumn).getByRole("button", { name: "+ Kaart toevoegen" }));

    expect(await screen.findByText("Teamleden worden geladen…")).toBeInTheDocument();
  });

  it("toont een foutmelding als teamleden niet kunnen worden geladen", async () => {
    api.getBoardProject.mockRejectedValueOnce(new Error("Netwerkfout"));

    renderPage();
    const todoColumn = await screen.findByTestId("board-column-todo");
    fireEvent.click(within(todoColumn).getByRole("button", { name: "+ Kaart toevoegen" }));

    expect(await screen.findByText("Teamleden konden niet worden geladen. Probeer het later opnieuw.")).toBeInTheDocument();
  });

  it("toont een lege-status als er geen actieve teamleden beschikbaar zijn", async () => {
    const card = { id: "c1", project_id: "p1", title: "Titel", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      access_users: [
        { id: "u1", username: "admin", full_name: "Admin", is_admin: true, is_active: false, has_avatar: false }
      ],
      cards: [card]
    });

    renderPage();
    const todoColumn = await screen.findByTestId("board-column-todo");
    fireEvent.click(within(todoColumn).getByRole("button", { name: "+ Kaart toevoegen" }));

    expect(await screen.findByText("Er zijn geen actieve teamleden beschikbaar voor dit bord.")).toBeInTheDocument();
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
    expect(await screen.findByRole("button", { name: "Kaart archiveren: Oude titel" })).toHaveAttribute("title", "Kaart archiveren: Oude titel");
    expect(screen.getByRole("button", { name: "Kaart verwijderen: Oude titel" })).toHaveAttribute("title", "Kaart verwijderen: Oude titel");
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

    await waitFor(() => expect(window.localStorage.getItem(VERGADERBORDEN_LAST_PROJECT_STORAGE_KEY)).toBe("p1"));
  });

  it("valideert ongeldige projectquery en valt terug op Algemeen", async () => {
    api.getBoardProject.mockRejectedValueOnce(new Error("Niet gevonden"));
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

  it("toont in de geopende header admins en genodigden als compacte badges met overflow", async () => {
    api.listAdminUsers.mockResolvedValue([]);
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u3", "u4", "u5", "u6", "u7"],
      access_users: [
        { id: "u1", username: "alex", full_name: "Alex Admin", is_admin: true, has_avatar: true },
        { id: "u2", username: "bram", full_name: "Bram Beheerder", is_admin: true, has_avatar: false },
        { id: "u3", username: "cato", full_name: "Cato", is_admin: false, has_avatar: true },
        { id: "u4", username: "daan", full_name: "Daan", is_admin: false, has_avatar: false },
        { id: "u5", username: "eva", full_name: "Eva", is_admin: false, has_avatar: false },
        { id: "u6", username: "fleur", full_name: "Fleur", is_admin: false, has_avatar: true },
        { id: "u7", username: "gijs", full_name: "Gijs", is_admin: false, has_avatar: false }
      ],
      cards: []
    });

    renderPage("/vergaderborden?project=p1");

    const header = await screen.findByLabelText("Gebruikers met toegang tot dit bord");
    expect(header.querySelectorAll(".vergaderborden-header-access-badge")).toHaveLength(6);

    const alexBadge = within(header).getByLabelText("Toegang: Alex Admin");
    expect(alexBadge.querySelector("img.assignment-avatar-image")).not.toBeNull();
    expect(alexBadge).not.toHaveTextContent("Alex Admin");

    const bramBadge = within(header).getByLabelText("Toegang: Bram Beheerder");
    expect(bramBadge).toHaveTextContent("BB");
    expect(bramBadge.querySelector("img.assignment-avatar-image")).toBeNull();

    const catoBadge = within(header).getByLabelText("Toegang: Cato");
    expect(catoBadge.querySelector("img.assignment-avatar-image")).not.toBeNull();

    expect(within(header).getByLabelText("Toegang: Daan")).toHaveTextContent("D");
    expect(within(header).getByLabelText("Toegang: Eva")).toHaveTextContent("E");
    expect(within(header).queryByLabelText("Toegang: Fleur")).not.toBeInTheDocument();
    const overflowBadge = within(header).getByText("+2");
    expect(overflowBadge).toHaveAttribute("tabindex", "0");
    expect(overflowBadge).toHaveAttribute("title", "Fleur, Gijs");
    expect(overflowBadge).toHaveAttribute("aria-label", "+2 verborgen gebruikers: Fleur, Gijs");
  });

  it("toont toegangsbadges voor een uitgenodigde niet-admin op basis van board metadata", async () => {
    api.listAdminUsers.mockResolvedValue([]);
    api.getCurrentUser.mockResolvedValue({
      id: "u3",
      username: "cato",
      full_name: "Cato",
      email: null,
      is_admin: false,
      theme_preference: "system",
      has_avatar: false
    });
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u3"],
      access_users: [
        { id: "u1", username: "alex", full_name: "Alex Admin", is_admin: true },
        { id: "u3", username: "cato", full_name: "Cato", is_admin: false }
      ],
      cards: []
    });

    renderPage("/vergaderborden?project=p1");

    const header = await screen.findByLabelText("Gebruikers met toegang tot dit bord");
    expect(within(header).getByLabelText("Toegang: Alex Admin")).toBeInTheDocument();
    expect(within(header).getByLabelText("Toegang: Cato")).toBeInTheDocument();
    expect(within(header).queryByLabelText(/Nog \d+ gebruikers met toegang/)).not.toBeInTheDocument();
    expect(api.listAdminUsers).toHaveBeenCalled();
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
    const moveMessage = screen.getByText(/Kaart verplaatst:/).closest(".board-update-message");
    expect(moveMessage).not.toBeNull();
    expect(moveMessage?.children).toHaveLength(1);
    expect(moveMessage?.firstElementChild?.tagName).toBe("SPAN");
    expect(screen.getByText(/→/)).toBeInTheDocument();
    expect(within(moveMessage as HTMLElement).queryByRole("button", { name: "Bewerken" })).not.toBeInTheDocument();
    expect(within(moveMessage as HTMLElement).queryByRole("button", { name: "Verwijderen" })).not.toBeInTheDocument();
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
    expect(cards[0].querySelector(".board-update-message")?.children).toHaveLength(2);
    expect(cards[0].querySelector(".board-recording-summary")).toBeInTheDocument();
    expect(cards[1]).toHaveTextContent("Tekstupdate");
    expect(screen.queryByText("Download opname")).not.toBeInTheDocument();
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

    const recordingMessage = (await screen.findByText("Audio-opname")).closest(".board-update-message");
    expect(recordingMessage).toHaveTextContent("Audio-opname · Duur: Duur onbekend · Grootte: Grootte onbekend");
    expect(recordingMessage?.querySelector(".board-recording-summary")).toBeInTheDocument();
    expect(screen.queryByText("Download opname")).not.toBeInTheDocument();
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
    expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();
    fireEvent.focus(createTextarea);
    const createToolbar = await screen.findByRole("toolbar", { name: "Opmaak knoppen" });
    fireEvent.change(createTextarea, { target: { value: "regel" } });
    createTextarea.setSelectionRange(0, 5);
    fireEvent.click(within(createToolbar).getByRole("button", { name: "B" }));
    fireEvent.click(within(createToolbar).getByRole("button", { name: "U" }));
    fireEvent.click(within(createToolbar).getByRole("button", { name: "• Lijst" }));
    const updateSubmitButton = screen.getByRole("button", { name: "Update plaatsen" });
    fireEvent.mouseDown(updateSubmitButton);
    fireEvent.click(updateSubmitButton);

    await waitFor(() => {
      expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(api.postBoardCardUpdate).toHaveBeenCalledWith("c1", expect.stringContaining("**regel**"));
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerken" }));
    const editTextarea = await screen.findByLabelText("Update bewerken") as HTMLTextAreaElement;
    expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();
    fireEvent.focus(editTextarea);
    const editToolbar = await screen.findByRole("toolbar", { name: "Opmaak knoppen" });
    editTextarea.setSelectionRange(0, 5);
    fireEvent.click(within(editToolbar).getByRole("button", { name: "1. Lijst" }));
    const saveButton = screen.getByRole("button", { name: "Opslaan" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(api.editBoardCardUpdate).toHaveBeenCalledWith("c1", "u1", expect.objectContaining({ message: "1. Eigen update" }));
    });
  });

  it("verbergt de update-toolbar zodra focus de volledige editor-shell verlaat", async () => {
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

    const dialog = await screen.findByRole("dialog");
    const closeButton = within(dialog).getByRole("button", { name: "Kaartdetail sluiten" });

    const createTextarea = await screen.findByPlaceholderText("Beschrijf kort de voortgang") as HTMLTextAreaElement;
    expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();

    fireEvent.focus(createTextarea);
    const createToolbar = await screen.findByRole("toolbar", { name: "Opmaak knoppen" });
    const createBoldButton = within(createToolbar).getByRole("button", { name: "B" });

    fireEvent.blur(createTextarea, { relatedTarget: createBoldButton });
    expect(screen.getByRole("toolbar", { name: "Opmaak knoppen" })).toBeInTheDocument();

    fireEvent.blur(createBoldButton, { relatedTarget: closeButton });
    await waitFor(() => {
      expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bewerken" }));
    const editTextarea = await screen.findByLabelText("Update bewerken") as HTMLTextAreaElement;
    expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();

    fireEvent.focus(editTextarea);
    const editToolbar = await screen.findByRole("toolbar", { name: "Opmaak knoppen" });
    const editItalicButton = within(editToolbar).getByRole("button", { name: "I" });

    fireEvent.blur(editTextarea, { relatedTarget: editItalicButton });
    expect(screen.getByRole("toolbar", { name: "Opmaak knoppen" })).toBeInTheDocument();

    fireEvent.blur(editItalicButton, { relatedTarget: closeButton });
    await waitFor(() => {
      expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();
    });
  });

  it("houdt de update-toolbar zichtbaar tijdens Tab-navigatie binnen de editor-shell en verbergt die zodra focus de shell verlaat", async () => {
    const user = userEvent.setup();
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

    const closeButton = await screen.findByRole("button", { name: "Kaartdetail sluiten" });
    await waitFor(() => expect(closeButton).toHaveFocus());
    const createTextarea = await screen.findByPlaceholderText("Beschrijf kort de voortgang") as HTMLTextAreaElement;
    expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();
    await user.click(createTextarea);
    const createToolbar = await screen.findByRole("toolbar", { name: "Opmaak knoppen" });
    expect(createTextarea).toHaveFocus();
    const createLastToolbarButton = within(createToolbar).getByRole("button", { name: "1. Lijst" });
    const createShell = createTextarea.closest(".board-update-editor-shell") as HTMLElement;

    await user.tab({ shift: true });
    expect(createLastToolbarButton).toHaveFocus();
    expect(screen.getByRole("toolbar", { name: "Opmaak knoppen" })).toBeInTheDocument();

    await user.tab();
    expect(createTextarea).toHaveFocus();
    expect(screen.getByRole("toolbar", { name: "Opmaak knoppen" })).toBeInTheDocument();

    await user.tab();
    await waitFor(() => {
      expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();
    });
    expect(createShell).not.toContainElement(document.activeElement as HTMLElement);

    await user.tab({ shift: true });
    await screen.findByRole("toolbar", { name: "Opmaak knoppen" });
    expect(createTextarea).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(screen.getByRole("toolbar", { name: "Opmaak knoppen" })).getByRole("button", { name: "1. Lijst" })).toHaveFocus();
    for (let index = 0; index < 5; index += 1) await user.tab({ shift: true });
    await waitFor(() => {
      expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();
    });
    expect(createShell).not.toContainElement(document.activeElement as HTMLElement);

    await user.click(screen.getByRole("button", { name: "Bewerken" }));
    const editTextarea = await screen.findByLabelText("Update bewerken") as HTMLTextAreaElement;
    expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();
    await user.click(editTextarea);
    const editToolbar = await screen.findByRole("toolbar", { name: "Opmaak knoppen" });
    expect(editTextarea).toHaveFocus();
    const editLastToolbarButton = within(editToolbar).getByRole("button", { name: "1. Lijst" });
    const editShell = editTextarea.closest(".board-update-editor-shell") as HTMLElement;

    await user.tab({ shift: true });
    expect(editLastToolbarButton).toHaveFocus();
    expect(screen.getByRole("toolbar", { name: "Opmaak knoppen" })).toBeInTheDocument();

    await user.tab();
    expect(editTextarea).toHaveFocus();
    expect(screen.getByRole("toolbar", { name: "Opmaak knoppen" })).toBeInTheDocument();

    await user.tab();
    await waitFor(() => {
      expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();
    });
    expect(editShell).not.toContainElement(document.activeElement as HTMLElement);

    await user.tab({ shift: true });
    await screen.findByRole("toolbar", { name: "Opmaak knoppen" });
    expect(editTextarea).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(screen.getByRole("toolbar", { name: "Opmaak knoppen" })).getByRole("button", { name: "1. Lijst" })).toHaveFocus();
    for (let index = 0; index < 5; index += 1) await user.tab({ shift: true });
    await waitFor(() => {
      expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();
    });
    expect(editShell).not.toContainElement(document.activeElement as HTMLElement);
  });

  it("houdt de update-toolbar zichtbaar wanneer focus van de textarea naar een toolbar-knop verhuist", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: "Bewerken" }));
    const editTextarea = await screen.findByLabelText("Update bewerken") as HTMLTextAreaElement;

    fireEvent.focus(editTextarea);
    const editToolbar = await screen.findByRole("toolbar", { name: "Opmaak knoppen" });
    const editBoldButton = within(editToolbar).getByRole("button", { name: "B" });
    const saveButton = screen.getByRole("button", { name: "Opslaan" });

    fireEvent.blur(editTextarea, { relatedTarget: null });
    fireEvent.focus(editBoldButton);

    expect(screen.getByRole("toolbar", { name: "Opmaak knoppen" })).toBeInTheDocument();

    fireEvent.blur(editBoldButton, { relatedTarget: saveButton });
    await waitFor(() => {
      expect(screen.queryByRole("toolbar", { name: "Opmaak knoppen" })).not.toBeInTheDocument();
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
    const ownUpdateArticle = screen.getByText("Eigen update").closest("article");
    expect(ownUpdateArticle).not.toBeNull();
    expect(within(ownUpdateArticle as HTMLElement).getByRole("button", { name: "Verwijderen" })).toBeInTheDocument();
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
    await screen.findByText("Eigen update");
    const updateArticle = screen.getByText("Eigen update").closest("article");
    expect(updateArticle).not.toBeNull();
    fireEvent.click(within(updateArticle as HTMLElement).getByRole("button", { name: "Verwijderen" }));

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
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();
    fireEvent.click(await screen.findByTestId("board-card-c1"));
    await screen.findByText("Eigen update");
    const updateArticle = screen.getByText("Eigen update").closest("article");
    expect(updateArticle).not.toBeNull();
    fireEvent.click(within(updateArticle as HTMLElement).getByRole("button", { name: "Verwijderen" }));

    await waitFor(() => {
      expect(api.deleteBoardCardUpdate).toHaveBeenCalledWith("c1", "u1");
    });
    await waitFor(() => {
      expect(api.getBoardCard).toHaveBeenCalledTimes(2);
      expect(api.getBoardProject).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText("Eigen update")).not.toBeInTheDocument();
  });

  it("toont archiefkaarten in een aparte tab en laat archiveren herstellen of verwijderen na bevestiging", async () => {
    const activeCard = { id: "c1", project_id: "p1", title: "Actief", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0, is_archived: false };
    const archivedCard = { id: "c2", project_id: "p1", title: "Gearchiveerd", description: "", column: "doing", position: 1, assignments: [], updates_count: 0, recordings_count: 0, is_archived: true };
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [activeCard],
      archived_cards: [archivedCard]
    });
    const confirmSpy = vi.spyOn(window, "confirm");

    renderPage("/vergaderborden?project=p1", true);

    fireEvent.click(await screen.findByRole("button", { name: /Archief/ }));
    expect(await screen.findByText("Gearchiveerd")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+ Kaart toevoegen/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Terugzetten")).not.toBeInTheDocument();
    expect(screen.queryByText("Verwijderen")).not.toBeInTheDocument();
    expect(screen.getByTestId("board-card-c2")).toHaveAttribute("draggable", "false");
    expect(screen.getByRole("button", { name: "Kaart terugzetten: Gearchiveerd" })).toHaveAttribute("title", "Kaart terugzetten: Gearchiveerd");
    expect(screen.getByRole("button", { name: "Kaart verwijderen: Gearchiveerd" })).toHaveAttribute("title", "Kaart verwijderen: Gearchiveerd");

    fireEvent.click(screen.getByRole("button", { name: "Kaart terugzetten: Gearchiveerd" }));
    await waitFor(() => {
      expect(api.restoreBoardCard).toHaveBeenCalledWith("c2");
    });

    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Kaart verwijderen: Gearchiveerd" }));
    await waitFor(() => {
      expect(api.deleteBoardCard).not.toHaveBeenCalled();
    });

    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Kaart verwijderen: Gearchiveerd" }));
    await waitFor(() => {
      expect(api.deleteBoardCard).toHaveBeenCalledWith("c2");
    });
    confirmSpy.mockRestore();
  });

  it("plaatst de boardtabs compact in de header en laat archief dezelfde kolommen zien als het actieve bord", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [
        { id: "c1", project_id: "p1", title: "Todo kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0, is_archived: false }
      ],
      archived_cards: [
        { id: "c2", project_id: "p1", title: "Archief kaart", description: "", column: "doing", position: 0, assignments: [], updates_count: 0, recordings_count: 0, is_archived: true }
      ]
    });

    renderPage("/vergaderborden?project=p1");

    const boardViewGroup = await screen.findByRole("group", { name: "Kaartweergave" });
    expect(boardViewGroup).toBeInTheDocument();
    expect(within(boardViewGroup).getAllByRole("button")).toHaveLength(2);

    fireEvent.click(await screen.findByRole("button", { name: /Archief/ }));
    expect(await screen.findByTestId("board-column-todo")).toBeInTheDocument();
    expect(await screen.findByTestId("board-column-doing")).toBeInTheDocument();
    expect(await screen.findByTestId("board-column-done")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+ Kaart toevoegen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start opname voor/ })).not.toBeInTheDocument();
    expect(within(boardViewGroup).getByRole("button", { name: /Archief/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("toont de admin-prullenbak en laat soft-verwijderde kaarten herstellen", async () => {
    const recycleCard = {
      id: "d1",
      project_id: "p1",
      project_name: "Project A",
      title: "Verwijderd",
      description: "",
      column: "todo",
      position: 0,
      is_archived: false,
      deleted_at: "2026-07-29T10:00:00Z",
      deleted_by_user_id: "u1",
      deleted_by_username: "admin",
      deleted_by_display_name: "Admin",
      assignments: [],
      updates_count: 0,
      recordings_count: 0,
      attachments_count: 0
    };
    api.getBoardProject.mockResolvedValue({ project_id: "p1", project_name: "Project A", invited_user_ids: ["u1"], cards: [], archived_cards: [] });
    api.listBoardRecycleBin.mockResolvedValue([recycleCard]);

    renderPage("/vergaderborden?project=p1", true);

    fireEvent.click(await screen.findByRole("button", { name: /Prullenbak/ }));
    expect(await screen.findByText("Verwijderd")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kaart herstellen: Verwijderd" })).toHaveAttribute("title", "Kaart herstellen: Verwijderd");

    fireEvent.click(screen.getByRole("button", { name: "Kaart herstellen: Verwijderd" }));
    await waitFor(() => {
      expect(api.restoreDeletedBoardCard).toHaveBeenCalledWith("d1");
    });
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
    const recordButton = screen.getByRole("button", { name: "Start opname voor Todo kaart" });
    expect(recordButton).toHaveAttribute("title", "Start opname voor Todo kaart");
    expect(recordButton).toHaveClass("record-icon-button");
    expect(recordButton.querySelector("svg.record-icon-glyph")).toBeInTheDocument();
    expect(todoCard.lastElementChild).toHaveClass("board-card-recording-controls");
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

  it("toont, uploadt en verwijdert kaartbijlagen in het kaartdetail", async () => {
    const card = { id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0, attachments_count: 1 };
    api.getBoardProject.mockResolvedValue({ project_id: "p1", project_name: "Project A", invited_user_ids: ["u1"], cards: [card] });
    api.getBoardCard.mockResolvedValue({
      card,
      updates: [],
      recordings: [],
      attachments: [
        {
          id: "a1",
          uploaded_by_user_id: "u1",
          uploaded_by_username: "admin",
          uploaded_by_display_name: "Admin",
          filename: "notitie.pdf",
          mime_type: "application/pdf",
          size_bytes: 2048,
          created_at: "2026-06-16T10:00:00Z",
          download_url: "/api/boards/attachments/a1/download"
        },
        {
          id: "a2",
          uploaded_by_user_id: "u1",
          uploaded_by_username: "admin",
          uploaded_by_display_name: "Admin",
          filename: "foto.jpg",
          mime_type: "image/jpeg",
          size_bytes: 4096,
          created_at: "2026-06-16T10:05:00Z",
          download_url: "/api/boards/attachments/a2/download"
        }
      ]
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();

    fireEvent.click(await screen.findByTestId("board-card-c1"));
    const detailDialog = await screen.findByRole("dialog");
    expect(await screen.findByText("notitie.pdf")).toBeInTheDocument();
    const pdfAttachment = screen.getByText("notitie.pdf").closest("article");
    expect(pdfAttachment).not.toBeNull();
    expect(within(pdfAttachment as HTMLElement).getByRole("link", { name: "Downloaden" })).toHaveAttribute("href", "/api/boards/attachments/a1/download");
    expect(screen.getByRole("list", { name: "Chronologische updates" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voorbeeld van notitie.pdf" })).not.toBeInTheDocument();

    const previewButton = screen.getByRole("button", { name: "Voorbeeld van foto.jpg" });
    fireEvent.click(previewButton);

    const previewDialog = await screen.findByRole("dialog", { name: "Voorbeeld van foto.jpg" });
    const previewCloseButton = within(previewDialog).getByRole("button", { name: "Sluiten" });
    expect(within(previewDialog).getByAltText("Voorbeeld van foto.jpg")).toBeInTheDocument();
    await waitFor(() => {
      expect(previewCloseButton).toHaveFocus();
    });

    fireEvent.keyDown(previewCloseButton, { key: "Tab", code: "Tab" });
    expect(previewCloseButton).toHaveFocus();

    fireEvent.keyDown(previewCloseButton, { key: "Tab", code: "Tab", shiftKey: true });
    expect(previewCloseButton).toHaveFocus();

    fireEvent.click(previewCloseButton);
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Voorbeeld van foto.jpg" })).not.toBeInTheDocument();
    });
    expect(detailDialog).toBeInTheDocument();
    expect(previewButton).toHaveFocus();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);

    fireEvent.click(previewButton);
    const backdropPreviewDialog = await screen.findByRole("dialog", { name: "Voorbeeld van foto.jpg" });
    fireEvent.click(backdropPreviewDialog);
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Voorbeeld van foto.jpg" })).not.toBeInTheDocument();
    });
    expect(detailDialog).toBeInTheDocument();

    fireEvent.click(previewButton);
    const escapePreviewDialog = await screen.findByRole("dialog", { name: "Voorbeeld van foto.jpg" });
    const escapeCloseButton = within(escapePreviewDialog).getByRole("button", { name: "Sluiten" });
    fireEvent.keyDown(escapeCloseButton, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Voorbeeld van foto.jpg" })).not.toBeInTheDocument();
    });
    expect(detailDialog).toBeInTheDocument();

    const attachmentInput = screen.getByLabelText("Bijlagen selecteren") as HTMLInputElement;
    const firstUpload = deferred<{ id: string }>();
    const secondUpload = deferred<{ id: string }>();
    api.uploadBoardCardAttachment.mockReturnValueOnce(firstUpload.promise).mockReturnValueOnce(secondUpload.promise);
    const firstFile = new File(["nieuw"], "nieuw.txt", { type: "text/plain" });
    const secondFile = new File(["extra"], "extra.txt", { type: "text/plain" });
    fireEvent.change(attachmentInput, { target: { files: [firstFile, secondFile] } });
    expect(screen.getByText("Geselecteerd (2): nieuw.txt, extra.txt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toevoegen" }));

    await waitFor(() => {
      expect(api.uploadBoardCardAttachment).toHaveBeenNthCalledWith(1, "c1", firstFile);
    });

    await act(async () => {
      firstUpload.resolve({ id: "a3" });
    });

    await waitFor(() => {
      expect(api.uploadBoardCardAttachment).toHaveBeenNthCalledWith(2, "c1", secondFile);
    });

    await act(async () => {
      secondUpload.resolve({ id: "a4" });
    });

    expect(await screen.findByText("2 bijlagen geüpload.")).toBeInTheDocument();

    fireEvent.click(within(pdfAttachment as HTMLElement).getByRole("button", { name: "Verwijderen" }));
    await waitFor(() => {
      expect(api.deleteBoardCardAttachment).toHaveBeenCalledWith("c1", "a1");
    });
    confirmSpy.mockRestore();
  });

  it("verwijdert een kaart vanuit detail en toont succesfeedback", async () => {
    const card = { id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 };
    api.getBoardProject
      .mockResolvedValueOnce({ project_id: "p1", project_name: "Project A", invited_user_ids: ["u1"], cards: [card], archived_cards: [] })
      .mockResolvedValueOnce({ project_id: "p1", project_name: "Project A", invited_user_ids: ["u1"], cards: [], archived_cards: [] });
    api.getBoardCard
      .mockResolvedValueOnce({ card, updates: [], recordings: [] })
      .mockResolvedValueOnce({ card: null, updates: [], recordings: [] });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();

    fireEvent.click(await screen.findByTestId("board-card-c1"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Kaart verwijderen: Kaart" }));

    await waitFor(() => {
      expect(api.deleteBoardCard).toHaveBeenCalledWith("c1");
    });
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Kaart verwijderd.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it("neemt meerdere gedropte bijlagen over en toont partial success", async () => {
    const card = { id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0, attachments_count: 1 };
    api.getBoardProject.mockResolvedValue({ project_id: "p1", project_name: "Project A", invited_user_ids: ["u1"], cards: [card] });
    api.getBoardCard.mockResolvedValue({
      card,
      updates: [],
      recordings: [],
      attachments: []
    });
    api.uploadBoardCardAttachment.mockResolvedValueOnce({ id: "a1" }).mockRejectedValueOnce(new Error("Upload mislukt"));

    renderPage();

    fireEvent.click(await screen.findByTestId("board-card-c1"));
    await screen.findByRole("dialog");

    const detailForm = screen.getByRole("dialog").querySelector("form.board-attachment-form");
    expect(detailForm).not.toBeNull();

    const firstFile = new File(["een"], "eerste.txt", { type: "text/plain" });
    const secondFile = new File(["twee"], "tweede.txt", { type: "text/plain" });
    fireEvent.drop(detailForm as Element, { dataTransfer: { files: [firstFile, secondFile] } });

    expect(screen.getByText("Geselecteerd (2): eerste.txt, tweede.txt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toevoegen" }));

    await waitFor(() => {
      expect(api.uploadBoardCardAttachment).toHaveBeenNthCalledWith(1, "c1", firstFile);
      expect(api.uploadBoardCardAttachment).toHaveBeenNthCalledWith(2, "c1", secondFile);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("1 van de 2 bijlagen geüpload. Mislukt: tweede.txt.");
    const resultList = screen.getByRole("list", { name: "Uploadresultaten bijlagen" });
    expect(resultList).toHaveTextContent("eerste.txt");
    expect(resultList).toHaveTextContent("Geüpload");
    expect(resultList).toHaveTextContent("tweede.txt");
    expect(resultList).toHaveTextContent("Mislukt");
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
