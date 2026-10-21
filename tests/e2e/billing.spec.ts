import { expect, test, type Page } from "@playwright/test";

import {
  adminClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../integration/helpers";

let owner: TestUser;
let businessId: string;
const password = "BillingPassw0rd";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(owner.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  owner = await createTestUser("Riley Brooks", password);
  const { data, error } = await owner.client.rpc("create_business", {
    p_name: "Riley Spa",
    p_timezone: "America/Chicago",
  });
  if (error) throw error;
  businessId = data as string;
});

test.afterAll(async () => {
  await deleteTestUser(owner);
});

test("a new business is on a 14-day free trial", async ({ page }) => {
  await signIn(page);
  // Plenty of trial left: no banner yet.
  await expect(page.getByText(/free trial (ends|has ended)/i)).toHaveCount(0);

  await page
    .getByRole("navigation", { name: "Main" })
    .first()
    .getByRole("link", { name: "Plans & billing" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Plans & billing" }),
  ).toBeVisible();
  await expect(page.getByText("Free trial", { exact: true })).toBeVisible();
  await expect(page.getByText(/14 days left/)).toBeVisible();
  await expect(page.getByText("0 of 1,000")).toBeVisible();
  for (const plan of ["Basic", "Pro", "Business"]) {
    await expect(page.getByRole("heading", { name: plan })).toBeVisible();
  }
  // The test server has no Stripe keys, so plans cannot be bought.
  await expect(
    page.getByText("Online payments are not connected yet"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Choose / })).toHaveCount(0);
});

test("an expired trial pauses reminders and says so", async ({ page }) => {
  const { error } = await adminClient()
    .from("subscriptions")
    .update({ trial_ends_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("business_id", businessId);
  if (error) throw error;

  await signIn(page);
  await expect(
    page.getByText(
      "Your free trial has ended. Reminders are paused until you choose a plan.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "See plans" }).click();
  await expect(page.getByText("Reminders are paused.")).toBeVisible();
});
