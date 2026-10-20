import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../integration/helpers";

let owner: TestUser;
let stranger: TestUser;
let strangerAppointmentId: string;
const password = "AppointmentsPassw0rd";
// A Wednesday, far enough ahead to stay "upcoming" while this test suite is used.
const DAY = "2027-03-10";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(owner.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  owner = await createTestUser("Jordan Lee", password);
  const { data: businessId, error } = await owner.client.rpc(
    "create_business",
    { p_name: "Jordan Barbers", p_timezone: "America/Chicago" },
  );
  if (error) throw error;
  const { error: clientError } = await owner.client
    .from("clients")
    .insert({ business_id: businessId, first_name: "Ana", last_name: "Silva" });
  if (clientError) throw clientError;

  // Another business's appointment, which the owner must never see.
  stranger = await createTestUser("Other Owner");
  const { data: otherBusinessId, error: otherError } =
    await stranger.client.rpc("create_business", {
      p_name: "Other Shop",
      p_timezone: "America/Denver",
    });
  if (otherError) throw otherError;
  const { data: otherClient, error: otherClientError } = await stranger.client
    .from("clients")
    .insert({ business_id: otherBusinessId, first_name: "Secret" })
    .select("id")
    .single();
  if (otherClientError) throw otherClientError;
  const { data: otherAppointment, error: appointmentError } =
    await stranger.client
      .from("appointments")
      .insert({
        business_id: otherBusinessId,
        client_id: otherClient.id,
        title: "Secret visit",
        starts_at: `${DAY}T16:00:00Z`,
        ends_at: `${DAY}T17:00:00Z`,
      })
      .select("id")
      .single();
  if (appointmentError) throw appointmentError;
  strangerAppointmentId = otherAppointment.id;
});

test.afterAll(async () => {
  await deleteTestUser(owner);
  await deleteTestUser(stranger);
});

test("book, view, reschedule, cancel and delete an appointment", async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByText("Nothing scheduled yet.")).toBeVisible();

  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await page.getByRole("link", { name: "New appointment" }).click();

  // Validation errors keep what was typed.
  await page.getByLabel("Service").fill("Haircut");
  await page.getByRole("button", { name: "Save appointment" }).click();
  await expect(page.getByText("Choose a client.")).toBeVisible();
  await expect(page.getByLabel("Service")).toHaveValue("Haircut");

  await page.getByLabel("Client").selectOption({ label: "Ana Silva" });
  await page.getByLabel("Date").fill(DAY);
  await page.getByLabel("Start time").fill("14:30");
  await page.getByLabel("Length").selectOption({ label: "45 min" });
  await page.getByLabel("Location").fill("Chair 2");
  await expect(
    page.locator("form").getByText("Times are in Central Time (Chicago)."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save appointment" }).click();

  await expect(page.getByRole("heading", { name: "Haircut" })).toBeVisible();
  await expect(page.getByText("Appointment saved.")).toBeVisible();
  await expect(
    page.getByText("Wed, Mar 10, 2027 · 2:30 PM – 3:15 PM CST"),
  ).toBeVisible();
  await expect(page.getByText("Scheduled", { exact: true })).toBeVisible();
  const appointmentUrl = page.url().split("?")[0] as string;

  // The week and month views show it on the right day.
  await page.goto(`/calendar?view=week&date=${DAY}`);
  await expect(
    page.getByRole("heading", { name: "Mar 7 – Mar 13, 2027" }),
  ).toBeVisible();
  const wednesday = page.getByRole("region", { name: "Wed, Mar 10, 2027" });
  await expect(wednesday.getByText("2:30 PM – 3:15 PM")).toBeVisible();
  await expect(wednesday.getByText("Haircut · Ana Silva")).toBeVisible();
  await expect(page.getByText("Secret visit")).toHaveCount(0);

  await page.getByRole("link", { name: "Month" }).click();
  await expect(page.getByRole("heading", { name: "March 2027" })).toBeVisible();
  await page
    .getByRole("link", { name: "Wed, Mar 10, 2027: 1 appointment" })
    .click();
  await expect(page).toHaveURL(/view=day&date=2027-03-10$/);
  await page.getByRole("link", { name: /Haircut · Ana Silva/ }).click();
  await expect(page).toHaveURL(appointmentUrl);

  // A time skipped by daylight saving is refused.
  await page.getByLabel("Date").fill("2027-03-14");
  await page.getByLabel("Start time").fill("02:30");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/the clocks move forward/)).toBeVisible();

  // Reschedule into daylight time.
  await page.getByLabel("Date").fill("2027-03-17");
  await page.getByLabel("Start time").fill("10:00");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();
  await expect(
    page.getByText("Wed, Mar 17, 2027 · 10:00 AM – 10:45 AM CDT"),
  ).toBeVisible();
  await expect(page.getByLabel("Length")).toHaveValue("45");

  // The client's page lists it.
  await page.getByRole("link", { name: "Ana Silva" }).click();
  const clientAppointments = page.getByRole("region", {
    name: "Appointments",
  });
  await expect(
    clientAppointments.getByText("Wed, Mar 17, 2027 · 10:00 AM – 10:45 AM"),
  ).toBeVisible();
  await clientAppointments.getByRole("link", { name: /Haircut/ }).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel appointment" }).click();
  await expect(page.getByText("The appointment was cancelled.")).toBeVisible();
  // Scoped to the header: the appointment's reminders are cancelled too.
  const header = page.getByRole("heading", { name: "Haircut" }).locator("..");
  await expect(header.getByText("Cancelled", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Restore as scheduled" }).click();
  await expect(
    page.getByText("The appointment is scheduled again."),
  ).toBeVisible();

  // The dashboard counts it and lists it as next.
  await page.goto("/dashboard");
  const summary = page.getByRole("region", { name: "Summary" });
  await expect(
    summary.getByRole("link", { name: /^Upcoming appointments 1$/ }),
  ).toBeVisible();
  await expect(page.getByText("Schedule an appointment (done)")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Haircut · Ana Silva/ }),
  ).toBeVisible();

  // The list view shows it under Upcoming.
  await page.getByRole("link", { name: "Appointments", exact: true }).click();
  await expect(page.getByText("1 appointment", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Haircut · Ana Silva/ }).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete appointment" }).click();
  await expect(page).toHaveURL(/view=day&date=2027-03-17&deleted=1$/);
  await expect(page.getByText("The appointment was deleted.")).toBeVisible();
  await expect(page.getByText("Nothing booked on this day")).toBeVisible();
});

test("a client's page links to booking for that client", async ({ page }) => {
  await signIn(page);
  await page.goto("/clients");
  await page.getByRole("link", { name: /Ana Silva/ }).click();
  await page.getByRole("link", { name: "Book appointment" }).click();
  await expect(page).toHaveURL(/\/appointments\/new\?clientId=/);
  await expect(
    page.getByRole("combobox", { name: "Client", exact: true }),
  ).toHaveValue(/[0-9a-f-]{36}/);
  await expect(
    page
      .getByRole("combobox", { name: "Client", exact: true })
      .locator("option:checked"),
  ).toHaveText("Ana Silva");
});

test("unknown or foreign appointment pages are not found", async ({ page }) => {
  await signIn(page);
  for (const id of ["not-a-uuid", randomUUID(), strangerAppointmentId]) {
    await page.goto(`/appointments/${id}`);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page.getByText("Secret visit")).toHaveCount(0);
  }
});

test("appointment screens fit on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page);
  for (const path of [
    "/calendar?view=day",
    "/calendar?view=week",
    "/calendar?view=month",
    "/appointments",
    "/appointments/new",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, path).toBe(false);
  }
});
