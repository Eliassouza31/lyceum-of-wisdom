/**
 * Turns a search box value into a safe `ilike` pattern for PostgREST filters.
 * Characters with special meaning in the filter syntax (commas, parentheses,
 * quotes) or in LIKE (`%`, `_`, `\`) are dropped, so a search can never change
 * the shape of the query. Returns null when nothing searchable is left.
 */
export function searchPattern(input: string): string | null {
  const cleaned = input
    .replace(/[^\p{L}\p{N}@.+\-' ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return cleaned ? `*${cleaned}*` : null;
}

/** Reads a positive page number from the URL, defaulting to the first page. */
export function parsePage(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 0 && page <= 10_000 ? page : 1;
}
