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
    expect(screen.getByRole("heading", { name: "Today's trip status" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Supabase is not configured");
  });

  it("S14 blocks an empty child profile", async () => {
    const user = userEvent.setup();
    renderRoute("/parent/children/new");
    await user.click(screen.getByRole("button", { name: "Save child" }));
    expect(screen.getByText("Enter the child's full name")).toBeInTheDocument();
  });

  it("S14b does not show fabricated enrollments when Supabase is unavailable", () => {
    renderRoute("/parent/children");
    expect(screen.getByRole("heading", { name: "My children" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("service is not configured");
  });

  it("S15 does not look up an invite without Supabase", async () => {
    const user = userEvent.setup();
    renderRoute("/parent/link");
    await user.type(screen.getByLabelText("Driver invite code"), "FWY7K2P9");
    await user.click(screen.getByRole("button", { name: /Look up/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("service is not configured");
  });

  it("S16 does not show fabricated trip history when Supabase is unavailable", () => {
    renderRoute("/parent/children/child-1/history");
    expect(screen.getByRole("heading", { name: "Trip history" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("service is not configured");
  });
});
