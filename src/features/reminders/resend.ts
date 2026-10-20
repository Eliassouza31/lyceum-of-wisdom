/**
 * Minimal client for Resend's "send email" endpoint (https://resend.com/docs/api-reference/emails/send-email).
 * It uses fetch directly, so there is no SDK to keep up to date.
 */

export type OutgoingEmail = {
  from: string;
  to: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  /** Resend ignores a repeat of the same key for 24 hours: no duplicate emails. */
  idempotencyKey: string;
};

export type SendResult =
  { ok: true; id: string } | { ok: false; error: string; permanent: boolean };

export type SendEmail = (email: OutgoingEmail) => Promise<SendResult>;

/**
 * Whether trying again later could work. Rate limits, outages and setup
 * problems (a wrong key, a domain not verified yet) can be fixed or pass;
 * an email Resend rejects as invalid will be rejected again.
 */
export function isPermanentFailure(status: number): boolean {
  if (status === 429 || status >= 500) return false;
  if (status === 401 || status === 403 || status === 409) return false;
  return status >= 400;
}

export function createResendSender({
  apiKey,
  apiUrl = "https://api.resend.com",
  fetchImpl = fetch,
}: {
  apiKey: string;
  apiUrl?: string;
  fetchImpl?: typeof fetch;
}): SendEmail {
  return async (email) => {
    let response: Response;
    try {
      response = await fetchImpl(`${apiUrl}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": email.idempotencyKey,
        },
        body: JSON.stringify({
          from: email.from,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
          ...(email.headers ? { headers: email.headers } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      return {
        ok: false,
        error: `Could not reach Resend: ${error instanceof Error ? error.message : String(error)}`,
        permanent: false,
      };
    }

    const payload = (await response.json().catch(() => null)) as {
      id?: unknown;
      message?: unknown;
      name?: unknown;
    } | null;

    if (response.ok && typeof payload?.id === "string") {
      return { ok: true, id: payload.id };
    }
    const detail =
      typeof payload?.message === "string" ? payload.message : "no details";
    return {
      ok: false,
      error: `Resend responded ${response.status}: ${detail}`,
      permanent: response.ok ? false : isPermanentFailure(response.status),
    };
  };
}

/** "Name <address>" with characters that would break the header removed. */
export function formatSender(name: string, address: string): string {
  const safeName = name.replace(/["<>\\\r\n]/g, "").trim();
  return safeName ? `"${safeName}" <${address}>` : address;
}
