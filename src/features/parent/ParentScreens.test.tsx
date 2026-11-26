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

  it("S14 blocks an empty child profile", async () => {
    const user = userEvent.setup();
    renderRoute("/parent/children/new");
    await user.click(screen.getByRole("button", { name: "Save child" }));
    expect(screen.getByText("Enter the child's full name")).toBeInTheDocument();
  });

  it("S14b renders the children screen", () => {
    renderRoute("/parent/children");
    expect(screen.getByRole("heading", { name: "My children" })).toBeInTheDocument();
  });

  it("S15 rejects an invalid invite code", async () => {
    const user = userEvent.setup();
    renderRoute("/parent/link");
    await user.type(screen.getByLabelText("Driver invite code"), "123");
    await user.click(screen.getByRole("button", { name: /Look up/ }));
    expect(screen.getByText("Enter a valid 8-character invite code.")).toBeInTheDocument();
  });

  it("S16 renders parent trip history for the selected child", () => {
    renderRoute("/parent/children/child-1/history");
    expect(screen.getByText("Trip history")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lethabo Mokoena")).toBeInTheDocument();
  });
});
