import { expect, test } from "@playwright/test";

const mockUser = {
  id: "e2e-user",
  aud: "authenticated",
  role: "authenticated",
  email: "parent@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

test("privacy notice is reachable and discloses the current publication gap", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/privacy", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await expect(
    page.getByRole("heading", { name: "Privacy notice" }),
  ).toBeVisible();
  await expect(page.getByText(/legal name or privacy contact/)).toBeVisible();
  await expect(page.getByText(/medical or allergy notes/)).toBeVisible();
});

test("signup requires notice consent before making an auth request", async ({
  page,
}) => {
  const authRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/auth/v1/")) authRequests.push(request.url());
  });
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Test Parent");
  await page.getByLabel("Email address").fill("parent@example.test");
  await page.getByLabel("Mobile phone number").fill("0821234567");
  await page.getByLabel("Create password").fill("SmokeTest123");
  await expect(
    page.getByRole("link", { name: "Privacy Notice" }),
  ).toHaveAttribute("href", "/privacy");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText("You must accept the privacy notice to continue"),
  ).toBeVisible();
  expect(authRequests).toHaveLength(0);
});

test("password reset request uses Supabase and shows a generic confirmation", async ({
  page,
}) => {
  await page.route("**/auth/v1/recover**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto("/reset-password");
  await page.getByLabel("Email address").fill("parent@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your inbox" }),
  ).toBeVisible();
});

test("recovery link updates the password through Supabase Auth", async ({
  page,
}) => {
  await page.route("**/auth/v1/user", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUser),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUser),
      });
    }
  });
  await page.goto(
    "/update-password#access_token=e2e-access&expires_at=1893456000&expires_in=3600&refresh_token=e2e-refresh&token_type=bearer&type=recovery",
  );
  await expect(page.getByLabel("New password")).toBeVisible();
  await page.getByLabel("New password").fill("NewPass123");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(
    page.getByRole("heading", { name: "Password updated" }),
  ).toBeVisible();
});
