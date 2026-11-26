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
    expect(screen.getByRole("heading", { name: "Hello, Driver" })).toBeInTheDocument();
  });

  it("S06 renders the routes screen", () => {
    renderRoute("/driver/routes");
    expect(screen.getByRole("heading", { name: "Routes" })).toBeInTheDocument();
  });

  it("S07 renders the route form screen", () => {
    renderRoute("/driver/routes/new");
    expect(screen.getByRole("heading", { name: "New route" })).toBeInTheDocument();
  });

  it("S08 renders the roster screen", () => {
    renderRoute("/driver/routes/route-1");
    expect(screen.getByRole("heading", { name: "Route roster" })).toBeInTheDocument();
  });

  it("S09 updates a learner check-in status", async () => {
    const user = userEvent.setup();
    renderRoute("/driver/trip/trip-1");
    await user.click(screen.getAllByRole("button", { name: /Dropped Off/ })[1]!);
    expect(screen.getAllByRole("button", { name: /Dropped Off/ })[1]!).toHaveClass("selected");
  });
});
