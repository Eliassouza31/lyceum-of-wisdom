import { randomInt } from "node:crypto";

import { test as base } from "@playwright/test";

export { expect, type Page } from "@playwright/test";

/** A random address in the 198.18.0.0/15 benchmarking range. */
export function randomIp(): string {
  return `198.${18 + randomInt(2)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

/**
 * Every test acts as a different visitor (its own IP address), as real users
 * would. Otherwise the whole suite shares one IP and trips the per-IP rate
 * limits of src/lib/rate-limit.ts. Next.js keeps an x-forwarded-for it receives.
 */
export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, provide) => {
    await provide({ ...extraHTTPHeaders, "x-forwarded-for": randomIp() });
  },
});
