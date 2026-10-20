import { expect } from "@playwright/test";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitSearch = {
  messages: Array<{ ID: string; Subject: string; Created: string }>;
};

/**
 * Waits for the newest email to `to` whose subject matches, and returns the
 * first link in its body that points at the Supabase verify endpoint.
 */
export async function getEmailLink(
  to: string,
  subject: RegExp,
): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
        );
        const { messages } = (await search.json()) as MailpitSearch;
        const message = messages.find((item) => subject.test(item.Subject));
        if (!message) return undefined;

        const detail = await fetch(
          `${MAILPIT_URL}/api/v1/message/${message.ID}`,
        );
        const { HTML, Text } = (await detail.json()) as {
          HTML: string;
          Text: string;
        };
        const match = `${HTML}\n${Text}`.match(
          /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]*/,
        );
        link = match?.[0].replaceAll("&amp;", "&");
        return link;
      },
      { timeout: 20_000, message: `email "${subject}" to ${to}` },
    )
    .toBeTruthy();
  return link!;
}
