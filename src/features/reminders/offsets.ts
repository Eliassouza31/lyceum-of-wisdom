/** "Send X before the appointment", stored in the database as minutes. */

export const MIN_OFFSET_MINUTES = 15;
export const MAX_OFFSET_MINUTES = 14 * 24 * 60;
export const MAX_RULES = 5;

export const OFFSET_UNITS = {
  minutes: 1,
  hours: 60,
  days: 24 * 60,
} as const;

export type OffsetUnit = keyof typeof OFFSET_UNITS;

export function toOffsetMinutes(amount: number, unit: OffsetUnit): number {
  return amount * OFFSET_UNITS[unit];
}

/** The largest unit that divides the offset exactly, e.g. 1440 → 1 day. */
export function splitOffset(minutes: number): {
  amount: number;
  unit: OffsetUnit;
} {
  if (minutes % OFFSET_UNITS.days === 0) {
    return { amount: minutes / OFFSET_UNITS.days, unit: "days" };
  }
  if (minutes % OFFSET_UNITS.hours === 0) {
    return { amount: minutes / OFFSET_UNITS.hours, unit: "hours" };
  }
  return { amount: minutes, unit: "minutes" };
}

/** e.g. "1 day before", "2 hours before", "90 minutes before". */
export function formatOffset(minutes: number): string {
  const { amount, unit } = splitOffset(minutes);
  const singular = unit.slice(0, -1);
  return `${amount} ${amount === 1 ? singular : unit} before`;
}
