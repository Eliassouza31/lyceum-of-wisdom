/** Formats a UTC timestamp in the business's time zone, e.g. "Oct 20, 2026, 4:05 PM CDT". */
export function formatDateTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const dateTime = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  return zone ? `${dateTime} ${zone}` : dateTime;
}
