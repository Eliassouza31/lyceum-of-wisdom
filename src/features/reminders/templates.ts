/**
 * Reminder email templates. A business writes plain text with a few
 * {{variables}}; this module fills them in and builds the email. Values are
 * HTML-escaped, so neither the business nor its clients can inject markup.
 */

export const TEMPLATE_VARIABLES = {
  client_first_name: "Client's first name",
  appointment_title: "Service, e.g. Haircut",
  appointment_date: "Date, e.g. Tuesday, October 20, 2026",
  appointment_time: "Time, e.g. 4:00 PM CDT",
  business_name: "Your business name",
  location: "Appointment location (the line is left out when empty)",
} as const;

export type TemplateVariable = keyof typeof TEMPLATE_VARIABLES;
export type TemplateValues = Record<TemplateVariable, string>;

export const DEFAULT_TEMPLATE = {
  subject: "Reminder: {{appointment_title}} on {{appointment_date}}",
  body: [
    "Hi {{client_first_name}},",
    "",
    "This is a friendly reminder of your {{appointment_title}} with {{business_name}} on {{appointment_date}} at {{appointment_time}}.",
    "",
    "Location: {{location}}",
    "",
    "If you need to reschedule, please contact us.",
    "",
    "See you soon!",
    "{{business_name}}",
  ].join("\n"),
};

const VARIABLE = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

function isTemplateVariable(name: string): name is TemplateVariable {
  return Object.hasOwn(TEMPLATE_VARIABLES, name);
}

/** Variables used in the text that this app does not know, e.g. a typo. */
export function unknownVariables(text: string): string[] {
  const unknown = new Set<string>();
  for (const match of text.matchAll(VARIABLE)) {
    const name = match[1] ?? "";
    if (!isTemplateVariable(name)) unknown.add(name);
  }
  return [...unknown];
}

/**
 * Fills in the variables. A line whose variables are all empty (for example
 * "Location: {{location}}" without a location) is left out.
 */
export function renderTemplate(text: string, values: TemplateValues): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const rendered: string[] = [];
  for (const line of lines) {
    const names = [...line.matchAll(VARIABLE)].map((match) => match[1] ?? "");
    if (
      names.length > 0 &&
      names.every((name) => !isTemplateVariable(name) || !values[name].trim())
    ) {
      continue;
    }
    rendered.push(
      line.replace(VARIABLE, (_match, name: string) =>
        isTemplateVariable(name) ? values[name] : "",
      ),
    );
  }
  // Removing lines can leave runs of blank lines; keep at most one.
  return rendered
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`,
    )
    .join("");
}

export type ReminderEmailInput = {
  subject: string;
  body: string;
  values: TemplateValues;
  businessName: string;
  postalAddress: string;
  unsubscribeUrl: string;
};

export type ReminderEmail = {
  subject: string;
  text: string;
  html: string;
};

/**
 * The full email. The footer is fixed: CAN-SPAM requires the sender's postal
 * address and a working unsubscribe link in every message.
 */
export function buildReminderEmail(input: ReminderEmailInput): ReminderEmail {
  const subject = renderTemplate(input.subject, input.values)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  const body = renderTemplate(input.body, input.values);
  const footer = [
    `${input.businessName} · ${input.postalAddress.replace(/\s*\n\s*/g, ", ")}`,
    `You are receiving this because you have an appointment with ${input.businessName}.`,
  ];

  const text = [
    body,
    "",
    "--",
    ...footer,
    `Unsubscribe from reminders: ${input.unsubscribeUrl}`,
  ].join("\n");

  const html = [
    '<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;font-size:15px;line-height:1.5">',
    textToHtml(body),
    "</div>",
    '<div style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#71717a;text-align:center">',
    ...footer.map(
      (line) => `<p style="margin:0 0 4px">${escapeHtml(line)}</p>`,
    ),
    `<p style="margin:8px 0 0"><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#71717a">Unsubscribe from reminders</a></p>`,
    "</div></body></html>",
  ].join("");

  return { subject, text, html };
}

/** Example values for the preview on the Reminders page. */
export function sampleValues(businessName: string): TemplateValues {
  return {
    client_first_name: "Maria",
    appointment_title: "Haircut",
    appointment_date: "Tuesday, October 20, 2026",
    appointment_time: "4:00 PM CDT",
    business_name: businessName,
    location: "Chair 2",
  };
}
