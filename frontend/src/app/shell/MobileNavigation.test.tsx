import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavigation } from "./MobileNavigation";

function NavigationFixture() {
  const location = useLocation();
  return <><MobileNavigation projects={[{ id: "a", name: "Daarle" }, { id: "b", name: "Boldijk" }]} boardTarget="/vergaderborden?project=a" /><output>{location.pathname}{location.search}</output></>;
}

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

beforeEach(() => {
  // jsdom does not implement the browser's native modal-dialog methods.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); }) });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); }) });
});
afterEach(() => {
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

describe("MobileNavigation", () => {
  it("biedt bordkeuze zonder hover, markeert alleen het huidige bord en sluit na navigatie", async () => {
    render(<MemoryRouter initialEntries={["/vergaderborden?project=a"]}><NavigationFixture /></MemoryRouter>);
    expect(screen.queryByRole("navigation", { name: "Mobiele hoofdnavigatie" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Navigatie openen" }));
    const nav = screen.getByRole("navigation", { name: "Mobiele hoofdnavigatie" });
    expect(document.body.style.overflow).toBe("hidden");
    expect(within(nav).getByRole("link", { name: "Daarle" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Boldijk" })).not.toHaveAttribute("aria-current");
    fireEvent.click(within(nav).getByRole("link", { name: "Boldijk" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("/vergaderborden?project=b");
    expect(document.body.style.overflow).toBe("");
  });

  it("herstelt de pagina na sluiten en de native Escape-actie", () => {
    render(<MemoryRouter><NavigationFixture /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Navigatie openen" }));
    fireEvent.click(screen.getByRole("button", { name: "Navigatie sluiten" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Navigatie openen" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });
});
