import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../../App";

function renderRoute(path: string) {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe("third five frontend screens", () => {
  it("S09b does not show fabricated trip history when Supabase is unavailable", () => {
    renderRoute("/driver/trips");
    expect(screen.getByText("Trip history")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("service is not configured");
  });

  it("S10 does not show fabricated compliance details when Supabase is unavailable", () => {
    renderRoute("/driver/profile");
    expect(screen.getByRole("alert")).toHaveTextContent("service is not configured");
  });

  it("S11 does not show fabricated fee records when Supabase is unavailable", () => {
    renderRoute("/driver/fees");
    expect(screen.getByRole("alert")).toHaveTextContent("service is not configured");
  });

  it("S12 does not claim to save a fee when Supabase is unavailable", () => {
    renderRoute("/driver/fees/new");
    expect(screen.getByRole("status")).toHaveTextContent("service is not configured");
  });

  it("S12b hides account actions until the profile loads", () => {
    renderRoute("/driver/profile");
    expect(screen.queryByRole("button", { name: "Delete account" })).not.toBeInTheDocument();
  });
});
