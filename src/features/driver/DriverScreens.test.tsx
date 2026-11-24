import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../../App";

function renderRoute(path: string) {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe("second five frontend screens", () => {
  it("S05 renders the driver dashboard", () => {
    renderRoute("/driver/dashboard");
    expect(screen.getByText("Good morning, Sipho")).toBeInTheDocument();
    expect(screen.getByText("Fourways to Crawford")).toBeInTheDocument();
  });

  it("S06 renders route cards", () => {
    renderRoute("/driver/routes");
    expect(screen.getAllByText("Fourways to Crawford").length).toBeGreaterThan(0);
  });

  it("S07 saves a route in the preview", async () => {
    const user = userEvent.setup();
    renderRoute("/driver/routes/new");
    await user.click(screen.getByRole("button", { name: "Save route" }));
    expect(screen.getByText("Route saved in this frontend preview.")).toBeInTheDocument();
  });

  it("S08 approves a pending request", async () => {
    const user = userEvent.setup();
    renderRoute("/driver/routes/route-1");
    await user.click(screen.getByRole("button", { name: "Approve Thando Mthembu" }));
    expect(screen.queryByText("Thando Mthembu")).not.toBeInTheDocument();
  });

  it("S09 updates a learner check-in status", async () => {
    const user = userEvent.setup();
    renderRoute("/driver/trip/trip-1");
    await user.click(screen.getAllByRole("button", { name: /Dropped Off/ })[1]!);
    expect(screen.getAllByRole("button", { name: /Dropped Off/ })[1]!).toHaveClass("selected");
  });
});
