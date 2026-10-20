import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { getEmailLink } from "./mailbox";

const email = `owner-${randomUUID().slice(0, 8)}@example.com`;
const password = "FirstPassw0rd";
const newPassword = "SecondPassw0rd";

async function signIn(page: Page, withPassword: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(withPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
}

test.describe.configure({ mode: "serial" });

test("protected pages redirect visitors to sign in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to your account" }),
  ).toBeVisible();
});

test("sign-up validates input and sends a confirmation email", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Jordan Rivera");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  // Non-secret values survive the failed submit.
  await expect(page.getByLabel("Full name")).toHaveValue("Jordan Rivera");

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText(`We sent a confirmation link to ${email}`),
  ).toBeVisible();
});

test("an unconfirmed account cannot sign in", async ({ page }) => {
  await signIn(page, password);
  await expect(
    page.getByText("Please confirm your email address first."),
  ).toBeVisible();
});

test("confirming the email leads to onboarding and the dashboard", async ({
  page,
}) => {
  // The PKCE code verifier cookie is set by the sign-up request, so sign up in
  // this same browser context, then follow the email link.
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Jordan Rivera");
  const freshEmail = `confirm-${randomUUID().slice(0, 8)}@example.com`;
  await page.getByLabel("Work email").fill(freshEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/We sent a confirmation link/)).toBeVisible();

  await page.goto(await getEmailLink(freshEmail, /confirm/i));
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel("Business name").fill("x");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter your business name.")).toBeVisible();

  await page.getByLabel("Business name").fill("Riverside Barbershop");
  await page.getByLabel("Time zone").selectOption("America/Chicago");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Welcome, Jordan" }),
  ).toBeVisible();
  await expect(
    page.getByText("Riverside Barbershop · Central Time (Chicago)"),
  ).toBeVisible();

  // Onboarding is a one-time step.
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("the email link also works when opened in another browser", async ({
  page,
}) => {
  // `email` signed up earlier in a different context. Its link confirms the
  // account; the session cannot be created here, so the user is sent to sign in.
  await page.goto(await getEmailLink(email, /confirm/i));
  await expect(page).toHaveURL(/\/login\?notice=confirm_link_invalid$/);
  await expect(
    page.getByText(/If you already confirmed your email/),
  ).toBeVisible();

  // The account is confirmed, so signing in works and leads to onboarding.
  await signIn(page, password);
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Business name").fill("Second Street Salon");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByText("Second Street Salon · Eastern Time (New York)"),
  ).toBeVisible();
});

test("signed-in users skip the sign-in page and can sign out", async ({
  page,
}) => {
  await signIn(page, password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("wrong passwords show a clear error", async ({ page }) => {
  await signIn(page, "WrongPassw0rd");
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(email);
});

test("sign-in returns to the page that was requested", async ({ page }) => {
  await page.goto("/dashboard?from=test");
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard\?from=test$/);
});

test("password reset by email", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByText(/If an account exists for that email/),
  ).toBeVisible();

  await page.goto(await getEmailLink(email, /reset/i));
  await expect(page).toHaveURL(/\/reset-password$/);

  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill("Mismatch123");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();

  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/dashboard\?passwordUpdated=1$/);
  await expect(page.getByText("Your password was updated.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, password);
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await signIn(page, newPassword);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("forgot-password does not reveal whether an account exists", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(`nobody-${randomUUID()}@example.com`);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByText(/If an account exists for that email/),
  ).toBeVisible();
});

test("open redirects are blocked", async ({ page }) => {
  await page.goto("/login?next=//evil.example.com");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/localhost:3000\/dashboard$/);
});

test("screens fit on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/", "/login", "/signup", "/forgot-password"]) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  }
  await signIn(page, newPassword);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
});
