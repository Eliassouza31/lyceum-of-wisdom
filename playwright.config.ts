import { defineConfig, devices } from "@playwright/test";

import { E2E_WEBHOOK_SECRET, FAKE_RESEND_URL } from "./tests/e2e/fake-resend";

/**
 * End-to-end tests run the production build against the local Supabase stack
 * (`npm run db:start`). Emails are read from the stack's Mailpit inbox.
 */
const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm start",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.SUPABASE_TEST_PUBLISHABLE_KEY ?? "",
      // Reminder emails go to a fake Resend started by tests/e2e/reminders.spec.ts.
      SUPABASE_SECRET_KEY: process.env.SUPABASE_TEST_SECRET_KEY ?? "",
      RESEND_API_KEY: "re_e2e_test",
      RESEND_API_URL: FAKE_RESEND_URL,
      RESEND_FROM_EMAIL: "reminders@example.com",
      RESEND_WEBHOOK_SECRET: E2E_WEBHOOK_SECRET,
    },
  },
});
