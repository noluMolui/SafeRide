import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChildProfile } from "./ChildProfile";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), insert: vi.fn(), maybeSingle: vi.fn() }));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: () => ({ insert: mocks.insert }),
  },
}));

describe("child profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "parent-1" } }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: { id: "child-1" }, error: null });
    mocks.insert.mockReturnValue({ select: () => ({ maybeSingle: mocks.maybeSingle }) });
  });

  function renderForm() {
    render(<MemoryRouter initialEntries={["/parent/children/new"]}><Routes><Route path="/parent/children/new" element={<ChildProfile />} /><Route path="/parent/children" element={<p>Children page</p>} /></Routes></MemoryRouter>);
  }

  it("does not write an empty form", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Save child" }));
    expect(await screen.findByText("Enter the child's full name")).toBeInTheDocument();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("creates a child for the signed-in parent with a normalized emergency number", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Child full name"), { target: { value: "Lerato Test" } });
    fireEvent.change(screen.getByLabelText("School name"), { target: { value: "Test School" } });
    fireEvent.change(screen.getByLabelText("Grade"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Home address"), { target: { value: "10 Main Road" } });
    fireEvent.change(screen.getByLabelText("School address"), { target: { value: "20 School Road" } });
    fireEvent.change(screen.getByLabelText("Contact name"), { target: { value: "Parent Test" } });
    fireEvent.change(screen.getByLabelText("Relationship"), { target: { value: "Parent" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "082 123 4567" } });
    fireEvent.click(screen.getByRole("button", { name: "Save child" }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ parent_id: "parent-1", full_name: "Lerato Test", emergency_contact_phone: "+27821234567" })));
    expect(await screen.findByText("Children page")).toBeInTheDocument();
  });
});