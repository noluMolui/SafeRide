import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../App";

function renderRoute(path: string) {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe("final three frontend screens", () => {
  it("S17 renders parent balance and fee history", () => {
    renderRoute("/parent/fees");
    expect(screen.getByText("Outstanding balance")).toBeInTheDocument();
    expect(screen.getByText("R 3 000,00")).toBeInTheDocument();
  });

  it("S18 saves a parent profile and confirms account deletion", async () => {
    const user = userEvent.setup();
    renderRoute("/parent/account");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.getByText("Profile updated in this frontend preview.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByText("Delete SafeRide account?")).toBeInTheDocument();
  });

  it("S19 filters and verifies a driver", async () => {
    const user = userEvent.setup();
    renderRoute("/admin/verifications");
    await user.click(screen.getByRole("button", { name: "Pending" }));
    expect(screen.getByText("Sipho Dlamini")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verify" }));
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });
});
