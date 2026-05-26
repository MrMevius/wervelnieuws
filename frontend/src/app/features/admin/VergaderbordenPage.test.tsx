import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VergaderbordenPage } from "./VergaderbordenPage";

const api = vi.hoisted(() => ({
  listBoardProjects: vi.fn(),
  listAdminUsers: vi.fn(),
  getBoardProject: vi.fn(),
  getBoardCard: vi.fn(),
  createBoardProject: vi.fn(),
  createBoardCard: vi.fn(),
  moveBoardCard: vi.fn(),
  postBoardCardUpdate: vi.fn(),
  uploadBoardRecording: vi.fn()
}));

vi.mock("../../../lib/api/client", () => api);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VergaderbordenPage />
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
    api.listAdminUsers.mockResolvedValue([{ id: "u1", username: "admin", full_name: "Admin" }]);
    api.listBoardProjects.mockResolvedValue([
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
  });

  it("slaat direct op bij verplaatsen naar andere kolom", async () => {
    api.getBoardProject.mockResolvedValue({
      project_id: "p1",
      project_name: "Project A",
      invited_user_ids: ["u1"],
      cards: [{ id: "c1", project_id: "p1", title: "Kaart", description: "", column: "todo", position: 0, assignments: [], updates_count: 0, recordings_count: 0 }]
    });

    renderPage();
    fireEvent.click((await screen.findByText("Project A")).closest("button") as HTMLButtonElement);

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
    fireEvent.click((await screen.findByText("Project A")).closest("button") as HTMLButtonElement);

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
    fireEvent.click((await screen.findByText("Project A")).closest("button") as HTMLButtonElement);

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
});
