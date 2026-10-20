/**
 * Converts a phone number typed by a user into E.164 (`+15551234567`).
 * Numbers without a country code are treated as US/Canada (+1).
 * Returns null when the input cannot be a valid number.
 */
export function toE164(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  // North American numbers: area code and exchange never start with 0 or 1.
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(national) ? `+1${national}` : null;
}

/** Shows a stored E.164 number the way people in the US expect to read it. */
export function formatPhone(e164: string): string {
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}
