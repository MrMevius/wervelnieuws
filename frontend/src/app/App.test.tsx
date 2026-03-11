import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const mockApi = vi.hoisted(() => ({
  login: vi.fn().mockResolvedValue(undefined),
  listTopics: vi.fn().mockResolvedValue([]),
  createTopic: vi.fn().mockResolvedValue(undefined),
  triggerGeneration: vi.fn().mockResolvedValue(undefined),
  listRetryJobs: vi.fn().mockResolvedValue([]),
  listAuditEvents: vi.fn().mockResolvedValue([]),
  listDocuments: vi.fn().mockResolvedValue([]),
  listNotes: vi.fn().mockResolvedValue([]),
  listVersions: vi.fn().mockResolvedValue([]),
  channelStatus: vi.fn().mockResolvedValue([]),
  addNote: vi.fn().mockResolvedValue(undefined),
  uploadDocument: vi.fn().mockResolvedValue(undefined),
  manualEdit: vi.fn().mockResolvedValue(undefined),
  approveTopic: vi.fn().mockResolvedValue(undefined),
  rejectTopic: vi.fn().mockResolvedValue(undefined),
  requeueRetryJob: vi.fn().mockResolvedValue(undefined),
  rollbackVersion: vi.fn().mockResolvedValue(undefined),
  scheduleTopic: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../lib/api/client", () => mockApi);

function renderApp() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

describe("App", () => {
  it("shows login form first", () => {
    renderApp();
    expect(screen.getByRole("button", { name: "Inloggen" })).toBeInTheDocument();
  });

  it("logs in and creates topic", async () => {
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Inloggen" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Nieuw topic" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Titel"), { target: { value: "Netupdate" } });
    fireEvent.change(screen.getByPlaceholderText("Onderwerp"), { target: { value: "Werkzaamheden" } });
    fireEvent.change(screen.getByPlaceholderText("Thema"), { target: { value: "Planning" } });

    fireEvent.click(screen.getByRole("button", { name: "Topic aanmaken" }));

    await waitFor(() => {
      expect(mockApi.createTopic).toHaveBeenCalledTimes(1);
    });
  });
});
