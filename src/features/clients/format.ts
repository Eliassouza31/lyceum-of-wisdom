import type { ConsentEvent } from "./queries";

export function clientName(client: {
  first_name: string;
  last_name: string;
}): string {
  return `${client.first_name} ${client.last_name}`.trim();
}

const SOURCE_LABELS: Record<ConsentEvent["source"], string> = {
  staff_entry: "Recorded by staff",
  import: "Imported",
  unsubscribe_link: "Unsubscribe link",
  sms_stop: "Replied STOP",
  booking_form: "Booking form",
};

export function consentEventLabel(event: ConsentEvent): string {
  const channel = event.channel === "email" ? "Email" : "SMS";
  const action =
    event.action === "granted" ? "reminders allowed" : "reminders stopped";
  return `${channel} ${action} · ${SOURCE_LABELS[event.source]}`;
}
