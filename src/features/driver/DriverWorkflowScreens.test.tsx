import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../../App";

function renderRoute(path: string) {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe("third five frontend screens", () => {
  it("S09b renders trip history", () => {
    renderRoute("/driver/trips");
    expect(screen.getByText("Trip history")).toBeInTheDocument();
    expect(screen.getAllByText("Fourways to Crawford").length).toBeGreaterThan(0);
  });

  it("S10 renders compliance and opens account deletion confirmation", async () => {
    const user = userEvent.setup();
    renderRoute("/driver/profile");
    expect(screen.getByText("PrDP 123456789")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByText("Delete SafeRide account?")).toBeInTheDocument();
  });

  it("S11 filters the fee ledger", async () => {
    const user = userEvent.setup();
    renderRoute("/driver/fees");
    await user.click(screen.getByRole("button", { name: "Overdue" }));
    expect(screen.getByText("Ruan van Wyk")).toBeInTheDocument();
  });

  it("S12 saves a fee in the preview", async () => {
    const user = userEvent.setup();
    renderRoute("/driver/fees/new");
    await user.click(screen.getByRole("button", { name: "Save fee" }));
    expect(screen.getByText("Fee saved in this frontend preview.")).toBeInTheDocument();
  });

  it("S12b account delete confirmation can be cancelled", async () => {
    const user = userEvent.setup();
    renderRoute("/driver/profile");
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Delete SafeRide account?")).not.toBeInTheDocument();
  });
});
