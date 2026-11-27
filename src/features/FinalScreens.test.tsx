import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../App";

function renderRoute(path: string) {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe("final three frontend screens", () => {
  it("S17 renders parent balance and fee history", () => {
    renderRoute("/parent/fees");
    expect(screen.getByRole("heading", { name: "Fees" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("service is not configured");
  });

  it("S18 does not show fabricated parent details when Supabase is unavailable", () => {
    renderRoute("/parent/account");
    expect(screen.getByRole("alert")).toHaveTextContent("service is not configured");
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
  });

  it("S19 does not show fabricated drivers when Supabase is unavailable", () => {
    renderRoute("/admin/verifications");
    expect(screen.getByRole("alert")).toHaveTextContent("service is not configured");
  });
});
