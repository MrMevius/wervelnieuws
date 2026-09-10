import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResponsiveRow, ResponsiveTable } from "./ResponsiveTable";

describe("ResponsiveTable", () => {
  it("houdt sorteren en bewerken intact en koppelt elke waarde aan de juiste mobiele veldnaam", () => {
    const sort = vi.fn();
    const change = vi.fn();
    function PersonRow() {
      return <ResponsiveRow><td>Els</td><td><input aria-label="Naam bewerken" defaultValue="Els van Dijk" onChange={change} /></td><td>Actief</td></ResponsiveRow>;
    }
    render(<ResponsiveTable>
      <thead><ResponsiveRow><th><button onClick={sort}>Gebruiker</button></th><th>Naam</th><th aria-label="Status" /></ResponsiveRow></thead>
      <tbody><PersonRow /><ResponsiveRow><td colSpan={3}>Einde van de lijst</td></ResponsiveRow></tbody>
    </ResponsiveTable>);
    expect(screen.getAllByRole("table")).toHaveLength(1);
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells.map((cell) => cell.getAttribute("data-label"))).toEqual(["Gebruiker", "Naam", "Status"]);
    expect(screen.getByText("Einde van de lijst")).not.toHaveAttribute("data-label");
    fireEvent.click(screen.getByRole("button", { name: "Gebruiker" }));
    fireEvent.change(screen.getByLabelText("Naam bewerken"), { target: { value: "Els" } });
    expect(sort).toHaveBeenCalledOnce();
    expect(change).toHaveBeenCalledOnce();
  });
});
