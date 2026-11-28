import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const deletionMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  invoke: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: deletionMocks.getUser,
      signInWithPassword: deletionMocks.signInWithPassword,
      signOut: deletionMocks.signOut,
    },
    functions: { invoke: deletionMocks.invoke },
  },
}));

import { AccountDeletionDialog } from "./AccountDeletionDialog";

describe("account deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deletionMocks.getUser.mockResolvedValue({
      data: { user: { email: "parent@example.co.za" } },
    });
    deletionMocks.signInWithPassword.mockResolvedValue({ error: null });
    deletionMocks.invoke.mockResolvedValue({ error: null });
    deletionMocks.signOut.mockResolvedValue({ error: null });
  });

  it("requires password reauthentication before calling the deletion function", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    render(<AccountDeletionDialog onCancel={vi.fn()} onDeleted={onDeleted} />);
    await waitFor(() =>
      expect(screen.getByLabelText("Account email")).toHaveValue(
        "parent@example.co.za",
      ),
    );
    await user.type(
      screen.getByLabelText("Confirm your password"),
      "Passw0rdA",
    );
    await user.click(
      screen.getByRole("button", { name: "Permanently delete" }),
    );

    expect(deletionMocks.signInWithPassword).toHaveBeenCalledWith({
      email: "parent@example.co.za",
      password: "Passw0rdA",
    });
    expect(deletionMocks.invoke).toHaveBeenCalledWith("delete-account", {
      body: {},
    });
    expect(deletionMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("does not invoke deletion when password verification fails", async () => {
    const user = userEvent.setup();
    deletionMocks.signInWithPassword.mockResolvedValue({
      error: new Error("invalid credentials"),
    });
    render(<AccountDeletionDialog onCancel={vi.fn()} onDeleted={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByLabelText("Account email")).toHaveValue(
        "parent@example.co.za",
      ),
    );
    fireEvent.change(screen.getByLabelText("Confirm your password"), {
      target: { value: "wrong" },
    });
    await user.click(
      screen.getByRole("button", { name: "Permanently delete" }),
    );

    expect(deletionMocks.invoke).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/Password could not be verified/),
    ).toBeInTheDocument();
  });
});
