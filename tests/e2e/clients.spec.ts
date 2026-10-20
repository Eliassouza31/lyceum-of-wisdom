import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../integration/helpers";

let owner: TestUser;
let stranger: TestUser;
let strangerClientId: string;
const password = "ClientsPassw0rd";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(owner.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  owner = await createTestUser("Casey Morgan", password);
  const { error } = await owner.client.rpc("create_business", {
    p_name: "Casey Nails",
    p_timezone: "America/Chicago",
  });
  if (error) throw error;

  // Another business's client, which the owner must never see.
  stranger = await createTestUser("Other Owner");
  const { data: businessId, error: businessError } = await stranger.client.rpc(
    "create_business",
    { p_name: "Other Shop", p_timezone: "America/Denver" },
  );
  if (businessError) throw businessError;
  const { data, error: clientError } = await stranger.client
    .from("clients")
    .insert({ business_id: businessId, first_name: "Secret" })
    .select("id")
    .single();
  if (clientError) throw clientError;
  strangerClientId = data.id;
});

test.afterAll(async () => {
  await deleteTestUser(owner);
  await deleteTestUser(stranger);
});

test("the dashboard starts with no clients", async ({ page }) => {
  await signIn(page);
  const summary = page.getByRole("region", { name: "Summary" });
  await expect(
    summary.getByRole("link", { name: /^Clients 0$/ }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Add your first client" }).click();
  await expect(page).toHaveURL(/\/clients\/new$/);
});

test("add, edit, search and remove a client", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Clients", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No clients yet" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Add client" }).first().click();
  await page.getByLabel("First name").fill("Maria");
  await page.getByLabel("Last name").fill("Lopez");
  await page.getByLabel("Mobile phone").fill("123");
  await page.getByLabel(/agreed to receive appointment reminders/).check();
  await page.getByRole("button", { name: "Save client" }).click();
  await expect(
    page.getByText("Enter a valid phone number, e.g. (555) 123-4567."),
  ).toBeVisible();

  await page.getByLabel("Mobile phone").fill("555.234.5678");
  await page.getByRole("button", { name: "Save client" }).click();
  await expect(
    page.getByText("Add an email address to send reminders."),
  ).toBeVisible();
  // What was typed survives the failed submit.
  await expect(page.getByLabel("First name")).toHaveValue("Maria");
  await expect(
    page.getByLabel(/agreed to receive appointment reminders/),
  ).toBeChecked();

  const email = `maria-${randomUUID().slice(0, 8)}@example.com`;
  await page.getByLabel("Email", { exact: true }).fill(email.toUpperCase());
  await page.getByRole("button", { name: "Save client" }).click();

  await expect(
    page.getByRole("heading", { name: "Maria Lopez" }),
  ).toBeVisible();
  await expect(page.getByText("Client added.")).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  await expect(page.getByLabel("Mobile phone")).toHaveValue("(555) 234-5678");
  await expect(
    page.getByText("Email reminders allowed · Recorded by staff"),
  ).toBeVisible();

  // Turning consent off is added to the history.
  await page.getByLabel(/agreed to receive appointment reminders/).uncheck();
  await page.getByLabel("Notes").fill("Prefers mornings");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();
  await expect(
    page.getByText("Email reminders stopped · Recorded by staff"),
  ).toBeVisible();
  await expect(page.getByLabel("Notes")).toHaveValue("Prefers mornings");

  // A second client with the same email is refused.
  await page.goto("/clients/new");
  await page.getByLabel("First name").fill("Copy");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Save client" }).click();
  await expect(
    page.getByText("Another client already uses this email."),
  ).toBeVisible();

  await page.goto("/clients/new");
  await page.getByLabel("First name").fill("Zoe");
  await page.getByRole("button", { name: "Save client" }).click();
  await expect(page.getByRole("heading", { name: "Zoe" })).toBeVisible();

  await page.goto("/clients");
  await expect(page.getByText("2 clients")).toBeVisible();
  await page.getByLabel("Search clients").fill("lopez");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/clients\?q=lopez$/);
  await expect(page.getByText("1 client", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Maria Lopez/ }).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove client" }).click();
  await expect(page).toHaveURL(/\/clients\?removed=1$/);
  await expect(page.getByText("The client was removed.")).toBeVisible();
  await expect(page.getByText("1 client", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Maria Lopez/ })).toHaveCount(0);
});

test("the dashboard counts clients", async ({ page }) => {
  await signIn(page);
  const summary = page.getByRole("region", { name: "Summary" });
  await expect(
    summary.getByRole("link", { name: /^Clients 1$/ }),
  ).toBeVisible();
  await expect(page.getByText("Add your first client (done)")).toBeVisible();
});

test("unknown or foreign client pages are not found", async ({ page }) => {
  await signIn(page);
  for (const id of ["not-a-uuid", randomUUID(), strangerClientId]) {
    await page.goto(`/clients/${id}`);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page.getByText("Secret")).toHaveCount(0);
  }
});

test("client screens fit on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page);
  for (const path of ["/clients", "/clients/new"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  }
});
