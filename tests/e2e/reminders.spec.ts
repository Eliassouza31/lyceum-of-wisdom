import { expect, test, type Page } from "./fixtures";

import {
  adminClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../integration/helpers";
import {
  signWebhook,
  startFakeResend,
  type CapturedEmail,
} from "./fake-resend";

let owner: TestUser;
let businessId: string;
let clientId: string;
let appointmentId: string;
let fakeResend: Awaited<ReturnType<typeof startFakeResend>>;
const password = "RemindersPassw0rd";
const clientEmail = `ana-${Date.now()}@example.com`;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(owner.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  fakeResend = await startFakeResend();
  owner = await createTestUser("Riley Park", password);
  const { data, error } = await owner.client.rpc("create_business", {
    p_name: "Riley Cuts",
    p_timezone: "America/Chicago",
  });
  if (error) throw error;
  businessId = data as string;

  const { data: client, error: clientError } = await owner.client
    .from("clients")
    .insert({
      business_id: businessId,
      first_name: "Ana",
      last_name: "Silva",
      email: clientEmail,
      email_reminders_consent: true,
    })
    .select("id")
    .single();
  if (clientError) throw clientError;
  clientId = client.id;
});

test.afterAll(async () => {
  await deleteTestUser(owner);
  await fakeResend?.close();
});

test("set up reminder times, the message and sender details", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Set up email reminders" }).click();
  await expect(page.getByRole("heading", { name: "Reminders" })).toBeVisible();

  const times = page.getByRole("list", { name: "Reminder times" });
  await expect(times.getByText("Email 1 day before")).toBeVisible();
  await expect(
    page.getByText("Add your business mailing address below."),
  ).toBeVisible();

  // Add, refuse a duplicate and an out-of-range time.
  await page.getByLabel("Send").fill("2");
  await page.getByLabel("Unit").selectOption("hours");
  await page.getByRole("button", { name: "Add reminder" }).click();
  await expect(page.getByText("Reminder added.")).toBeVisible();
  await expect(times.getByText("Email 2 hours before")).toBeVisible();

  await page.getByLabel("Send").fill("120");
  await page.getByLabel("Unit").selectOption("minutes");
  await page.getByRole("button", { name: "Add reminder" }).click();
  await expect(
    page.getByText("You already have a reminder at this time."),
  ).toBeVisible();
  await page.getByLabel("Send").fill("5");
  await page.getByRole("button", { name: "Add reminder" }).click();
  await expect(
    page.getByText("Choose a time between 15 minutes and 14 days."),
  ).toBeVisible();

  // Pause, then delete the 2-hour reminder.
  const twoHours = times.getByRole("listitem").filter({ hasText: "2 hours" });
  await twoHours.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText(/Reminder paused/)).toBeVisible();
  await expect(twoHours.getByText("Paused")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await twoHours.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Reminder deleted.")).toBeVisible();
  await expect(times.getByRole("listitem")).toHaveCount(1);

  // A typo in a variable is caught; the preview shows the result.
  await page.getByLabel("Subject").fill("See you soon, {{name}}");
  await page.getByRole("button", { name: "Save message" }).click();
  await expect(page.getByText(/Unknown variable: \{\{name\}\}/)).toBeVisible();
  await page.getByLabel("Subject").fill("See you soon, {{client_first_name}}");
  await page.getByRole("button", { name: "Save message" }).click();
  await expect(page.getByText("Message saved.")).toBeVisible();
  await expect(page.getByTestId("template-preview")).toContainText(
    "See you soon, Maria",
  );

  await page.getByLabel("Reply-to email").fill("riley@example.com");
  await page
    .getByLabel("Business mailing address")
    .fill("200 Oak Ave, Chicago, IL 60601");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Sender details saved.")).toBeVisible();
  await expect(
    page.getByText("Add your business mailing address below."),
  ).toHaveCount(0);
  await expect(page.getByTestId("template-preview")).toContainText(
    "200 Oak Ave, Chicago, IL 60601",
  );

  await page.goto("/dashboard");
  await expect(page.getByText("Set up email reminders (done)")).toBeVisible();
});

test("a booked appointment is reminded, delivered and shown in the history", async ({
  page,
  request,
}) => {
  const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const { data: appointment, error } = await owner.client
    .from("appointments")
    .insert({
      business_id: businessId,
      client_id: clientId,
      title: "Beard trim",
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + 30 * 60_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  appointmentId = appointment.id;

  await signIn(page);
  await page.goto(`/appointments/${appointmentId}`);
  const reminders = page.getByRole("list", {
    name: "Reminders for this appointment",
  });
  await expect(reminders.getByText("Queued")).toBeVisible();
  await expect(reminders.getByText("Email 1 day before")).toBeVisible();

  // The dispatcher only answers pg_cron, which knows the secret.
  const unauthorized = await request.post("/api/cron/dispatch", {
    headers: { Authorization: "Bearer wrong" },
  });
  expect(unauthorized.status()).toBe(401);

  // Pretend the send time has come, then run the dispatcher like pg_cron does.
  const admin = adminClient();
  await admin
    .from("reminder_jobs")
    .update({ next_attempt_at: new Date(Date.now() - 1000).toISOString() })
    .eq("appointment_id", appointmentId);
  const { data: secret } = await admin.rpc("get_dispatch_secret");
  const dispatched = await request.post("/api/cron/dispatch", {
    headers: { Authorization: `Bearer ${secret as string}` },
  });
  expect(dispatched.status()).toBe(200);
  expect(await dispatched.json()).toMatchObject({ sent: 1 });

  const email = fakeResend.emails.find((item) =>
    item.body.to.includes(clientEmail),
  ) as CapturedEmail;
  expect(email.body.subject).toBe("See you soon, Ana");
  expect(email.body.from).toBe('"Riley Cuts" <reminders@example.com>');
  expect(email.body.reply_to).toBe("riley@example.com");
  expect(email.idempotencyKey).toMatch(/^reminder-/);
  expect(email.body.text).toContain("200 Oak Ave, Chicago, IL 60601");

  // Resend reports the delivery through a signed webhook.
  const body = JSON.stringify({
    type: "email.delivered",
    data: { email_id: email.id },
  });
  const forged = await request.post("/api/webhooks/resend", {
    data: body,
    headers: { ...signWebhook(body, "msg_e2e_1"), "svix-signature": "v1,AAA=" },
  });
  expect(forged.status()).toBe(401);
  const delivered = await request.post("/api/webhooks/resend", {
    data: body,
    headers: signWebhook(body, `msg_e2e_${Date.now()}`),
  });
  expect(delivered.status()).toBe(200);

  await page.getByRole("link", { name: "Notification history" }).click();
  const history = page.getByRole("list", { name: "Reminders" });
  const row = history.getByRole("listitem").filter({ hasText: "Beard trim" });
  await expect(row.getByText("Delivered")).toBeVisible();
  await expect(row.getByText("Beard trim · Ana Silva")).toBeVisible();
  await expect(page.getByText(/1\s+email sent this month/)).toBeVisible();

  // The unsubscribe link in the email works and is recorded.
  const link = email.body.text.match(/https?:\/\/\S+\/unsubscribe\?token=\S+/);
  expect(link).not.toBeNull();
  await page.goto(new URL(link![0]).pathname + new URL(link![0]).search);
  await expect(
    page.getByText(/Stop receiving appointment reminder/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(
    page.getByText(
      /You will no longer receive email reminders from Riley Cuts/,
    ),
  ).toBeVisible();

  await page.goto(`/clients/${clientId}`);
  await expect(
    page.getByText(/Email reminders stopped · Unsubscribe link/i),
  ).toBeVisible();
});

test("an invalid unsubscribe link explains what to do", async ({ page }) => {
  await page.goto("/unsubscribe?token=00000000-0000-4000-8000-000000000000");
  await expect(
    page.getByText("This unsubscribe link is not valid."),
  ).toBeVisible();
});

test("reminder screens fit on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page);
  for (const path of ["/reminders", "/notifications"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, path).toBe(false);
  }
});
