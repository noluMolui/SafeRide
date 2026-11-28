import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";

const authMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  profileLookup: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: authMocks.signInWithPassword,
      signUp: authMocks.signUp,
      resetPasswordForEmail: authMocks.resetPasswordForEmail,
      updateUser: authMocks.updateUser,
      getSession: authMocks.getSession,
      onAuthStateChange: authMocks.onAuthStateChange,
      signOut: authMocks.signOut,
      getUser: authMocks.getUser,
    },
    from: (table: string) => {
      let columns = "";
      const builder = {
        select: (selected: string) => {
          columns = selected;
          return builder;
        },
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        maybeSingle: () =>
          table === "profiles" && columns === "role"
            ? authMocks.profileLookup()
            : table === "profiles"
              ? Promise.resolve({
                  data: {
                    full_name: "Sipho Dlamini",
                    pdp_expiry_date: "2099-12-31",
                  },
                  error: null,
                })
              : table === "trips"
                ? Promise.resolve({ data: null, error: null })
                : Promise.resolve({ data: null, error: null }),
        then: (
          resolve: (value: { data: unknown[]; error: null }) => unknown,
          reject: (reason: unknown) => unknown,
        ) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
      };
      return builder;
    },
    rpc: authMocks.rpc,
    functions: { invoke: vi.fn() },
  },
}));

describe("authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: "parent-1",
          app_metadata: {},
          user_metadata: { role: "parent" },
        },
      },
      error: null,
    });
    authMocks.signUp.mockResolvedValue({
      data: { user: { id: "driver-1" }, session: {} },
      error: null,
    });
    authMocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    authMocks.updateUser.mockResolvedValue({ error: null });
    authMocks.getSession.mockResolvedValue({ data: { session: null } });
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    authMocks.signOut.mockResolvedValue({ error: null });
    authMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "driver-1",
          user_metadata: {
            role: "driver",
            full_name: "Sipho Dlamini",
            phone_e164: "+27821234567",
          },
        },
      },
      error: null,
    });
    authMocks.rpc.mockImplementation(async (name: string) => {
      if (name === "register_driver_profile")
        return { data: { profile_id: "driver-1" }, error: null };
      if (name === "get_driver_trip_detail")
        return { data: null, error: { message: "not found" } };
      return { data: [], error: null };
    });
    authMocks.profileLookup.mockResolvedValue({
      data: { id: "parent-1", role: "parent" },
      error: null,
    });
  });

  it("signs in and redirects a parent to the parent home", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText("Email"), "user@example.co.za");
    await user.type(screen.getByLabelText("Password"), "Passw0rdA");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.co.za",
      password: "Passw0rdA",
    });
    expect(
      screen.getByRole("heading", { name: "Today's trip status" }),
    ).toBeInTheDocument();
  });
  it("does not call authentication when login fields are empty", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(authMocks.signInWithPassword).not.toHaveBeenCalled();
  });
  it("keeps the selected appearance across navigation and reload", async () => {
    localStorage.setItem("saferide-theme", "light");
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    );
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    await user.click(screen.getByRole("link", { name: "Create account" }));
    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeInTheDocument();
    view.unmount();
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );
    expect(localStorage.getItem("saferide-theme")).toBe("light");
    localStorage.removeItem("saferide-theme");
  });
  it("AC-1.10 shows validation instead of creating an account without consent", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <App />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      screen.getByText("You must accept the privacy notice to continue"),
    ).toBeInTheDocument();
    expect(authMocks.signUp).not.toHaveBeenCalled();
  });
  it("creates a parent account through Supabase after valid details and consent", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Naledi Mokoena" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "naledi@example.co.za" },
    });
    fireEvent.change(screen.getByLabelText("Mobile phone number"), {
      target: { value: "082 123 4567" },
    });
    fireEvent.change(screen.getByLabelText("Create password"), {
      target: { value: "Passw0rdA" },
    });
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(authMocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "naledi@example.co.za",
        options: expect.objectContaining({
          data: expect.objectContaining({
            role: "parent",
            full_name: "Naledi Mokoena",
            phone_e164: "+27821234567",
            consent: true,
          }),
        }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Today's trip status" }),
    ).toBeInTheDocument();
  });
  it("AC-1.2 lets a driver continue to compliance and return to their details", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <App />
      </MemoryRouter>,
    );
    await user.click(screen.getByLabelText(/I'm a Driver/));
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Sipho Dlamini" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "sipho@example.co.za" },
    });
    fireEvent.change(screen.getByLabelText("Mobile phone number"), {
      target: { value: "082 123 4567" },
    });
    fireEvent.change(screen.getByLabelText("Create password"), {
      target: { value: "Passw0rdA" },
    });
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByText("Professional Driving Permit")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Finish registration" }),
    );
    expect(
      screen.getByText("Enter 4–20 letters or numbers"),
    ).toBeInTheDocument();
    expect(authMocks.rpc).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("link", { name: "Back to account details" }),
    );
    expect(screen.getByLabelText("Full name")).toHaveValue("Sipho Dlamini");
  });
  it("registers a valid driver profile and vehicle through the Supabase RPC", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <App />
      </MemoryRouter>,
    );
    await user.click(screen.getByLabelText(/I'm a Driver/));
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Sipho Dlamini" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "sipho@example.co.za" },
    });
    fireEvent.change(screen.getByLabelText("Mobile phone number"), {
      target: { value: "082 123 4567" },
    });
    fireEvent.change(screen.getByLabelText("Create password"), {
      target: { value: "Passw0rdA" },
    });
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Continue/ }));

    await user.type(screen.getByLabelText("PrDP number"), "PDP12345");
    await user.type(screen.getByLabelText("PrDP expiry date"), "2027-12-31");
    await user.type(screen.getByLabelText(/Operating suburbs/), "Fourways");
    await user.click(screen.getByRole("button", { name: "+ Add" }));
    await user.type(screen.getByLabelText("Registration number"), "CA 123-456");
    await user.type(screen.getByLabelText("Make and model"), "Toyota Quantum");
    await user.type(
      screen.getByLabelText("Roadworthy expiry date"),
      "2027-12-31",
    );
    await user.click(
      screen.getByRole("button", { name: "Finish registration" }),
    );

    expect(authMocks.rpc).toHaveBeenCalledWith(
      "register_driver_profile",
      expect.objectContaining({
        profile: expect.objectContaining({
          pdp_number: "PDP12345",
          service_suburbs: ["Fourways"],
        }),
        vehicle: expect.objectContaining({
          registration_number: "CA123456",
          make_model: "Toyota Quantum",
        }),
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Hello, Sipho" }),
    ).toBeInTheDocument();
  });
  it("S04 sends a password reset email with the recovery route", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <App />
      </MemoryRouter>,
    );
    await user.type(
      screen.getByLabelText("Email address"),
      "parent@example.co.za",
    );
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "parent@example.co.za",
      {
        redirectTo: `${window.location.origin}/update-password`,
      },
    );
    expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
  });
  it("updates a password only from a recovery session", async () => {
    const user = userEvent.setup();
    window.history.replaceState(
      null,
      "",
      "/update-password#access_token=reset&type=recovery",
    );
    authMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "parent-1" } } },
    });
    render(
      <MemoryRouter initialEntries={["/update-password"]}>
        <App />
      </MemoryRouter>,
    );
    await user.type(await screen.findByLabelText("New password"), "NewPass123");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(authMocks.updateUser).toHaveBeenCalledWith({
      password: "NewPass123",
    });
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(
      await screen.findByRole("heading", { name: "Password updated" }),
    ).toBeInTheDocument();
    window.history.replaceState(null, "", "/");
  });
  it("shows the privacy notice from its public route", () => {
    render(
      <MemoryRouter initialEntries={["/privacy"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "Privacy notice" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/legal name or privacy contact/),
    ).toBeInTheDocument();
  });
  it("S05a displays the invite code and account choices", () => {
    render(
      <MemoryRouter initialEntries={["/join/ABC12345"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("ABC12345")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Log in/ })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Create account/ }),
    ).toBeInTheDocument();
  });
});
