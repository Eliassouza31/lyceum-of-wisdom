import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";

/** Where the app under test sends reminder emails during e2e tests. */
export const FAKE_RESEND_PORT = 4010;
export const FAKE_RESEND_URL = `http://127.0.0.1:${FAKE_RESEND_PORT}`;
export const E2E_WEBHOOK_SECRET = `whsec_${Buffer.from("e2e-webhook-secret").toString("base64")}`;

export type CapturedEmail = {
  id: string;
  idempotencyKey: string | undefined;
  body: {
    to: string[];
    from: string;
    subject: string;
    text: string;
    html: string;
    reply_to?: string;
    headers?: Record<string, string>;
  };
};

/** A stand-in for Resend's POST /emails that records what it receives. */
export function startFakeResend(): Promise<{
  emails: CapturedEmail[];
  close: () => Promise<void>;
}> {
  const emails: CapturedEmail[] = [];
  const server: Server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk: Buffer) => (raw += chunk.toString()));
    request.on("end", () => {
      if (request.method !== "POST" || request.url !== "/emails") {
        response.writeHead(404).end();
        return;
      }
      const email: CapturedEmail = {
        id: `email_e2e_${emails.length + 1}`,
        idempotencyKey: request.headers["idempotency-key"] as string,
        body: JSON.parse(raw) as CapturedEmail["body"],
      };
      emails.push(email);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ id: email.id }));
    });
  });
  return new Promise((resolve) => {
    server.listen(FAKE_RESEND_PORT, "127.0.0.1", () =>
      resolve({
        emails,
        close: () => new Promise((done) => server.close(() => done())),
      }),
    );
  });
}

/** Headers Resend (via Svix) would send with this webhook body. */
export function signWebhook(body: string, id: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(E2E_WEBHOOK_SECRET.replace("whsec_", ""), "base64");
  const signature = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${signature}`,
    "content-type": "application/json",
  };
}
