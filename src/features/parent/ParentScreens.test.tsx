import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../../App";

function renderRoute(path: string) {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe("next five parent frontend screens", () => {
  it("S13 renders the parent live status feed", () => {
    renderRoute("/parent/home");
    expect(screen.getByText("Good morning, Naledi")).toBeInTheDocument();
    expect(screen.getByText("Lethabo Mokoena")).toBeInTheDocument();
  });

  it("S14 saves a child profile in the preview", async () => {
    const user = userEvent.setup();
    renderRoute("/parent/children/new");
    await user.click(screen.getByRole("button", { name: "Save child" }));
    expect(screen.getByText("Child profile saved in this frontend preview.")).toBeInTheDocument();
  });

  it("S14b renders active and pending enrollment states", () => {
    renderRoute("/parent/children");
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Pending approval")).toBeInTheDocument();
  });

  it("S15 looks up an invite and sends a request", async () => {
    const user = userEvent.setup();
    renderRoute("/parent/link");
    await user.type(screen.getByLabelText("Driver invite code"), "FWY7K2P9");
    await user.click(screen.getByRole("button", { name: /Look up/ }));
    expect(screen.getByText("Sipho Dlamini")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm request" }));
    expect(screen.getByText("Request sent")).toBeInTheDocument();
  });

  it("S16 renders parent trip history for the selected child", () => {
    renderRoute("/parent/children/child-1/history");
    expect(screen.getByText("Trip history")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lethabo Mokoena")).toBeInTheDocument();
  });
});
