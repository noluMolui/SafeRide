import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../../App";

describe("authentication preview", () => {
  it("shows login and explains that it cannot authenticate", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);
    await user.type(screen.getByLabelText("Email"), "user@example.co.za");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByText(/Login is not available yet/)).toBeInTheDocument();
  });
  it("AC-1.10 shows validation instead of creating an account without consent", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/signup"]}><App /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("You must accept the privacy notice to continue")).toBeInTheDocument();
  });
  it("AC-1.2 lets a driver continue to compliance and return to their details", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/signup"]}><App /></MemoryRouter>);
    await user.click(screen.getByLabelText(/I'm a Driver/));
    await user.type(screen.getByLabelText("Full name"), "Sipho Dlamini");
    await user.type(screen.getByLabelText("Email address"), "sipho@example.co.za");
    await user.type(screen.getByLabelText("Mobile phone number"), "082 123 4567");
    await user.type(screen.getByLabelText("Create password"), "Passw0rdA");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByText("Professional Driving Permit")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Back to account details" }));
    expect(screen.getByLabelText("Full name")).toHaveValue("Sipho Dlamini");
  });
});
