/** US time zones offered during onboarding (IANA names handle DST automatically). */
export const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (New York)" },
  { value: "America/Chicago", label: "Central Time (Chicago)" },
  { value: "America/Denver", label: "Mountain Time (Denver)" },
  { value: "America/Phoenix", label: "Mountain Time – no DST (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska Time (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (Honolulu)" },
  { value: "America/Puerto_Rico", label: "Atlantic Time (Puerto Rico)" },
] as const;

export type UsTimezone = (typeof US_TIMEZONES)[number]["value"];

export const DEFAULT_TIMEZONE: UsTimezone = "America/New_York";

export function isUsTimezone(value: string): value is UsTimezone {
  return US_TIMEZONES.some((zone) => zone.value === value);
}

export function timezoneLabel(value: string): string {
  return US_TIMEZONES.find((zone) => zone.value === value)?.label ?? value;
}
