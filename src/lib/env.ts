import { z } from "zod";

/**
 * Public variables are inlined into the browser bundle at build time.
 * Never add a secret here. Server-only secrets get their own schema in later phases.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .url({ protocol: /^https?$/ })
    .transform((value) => value.replace(/\/+$/, ""))
    .default("http://localhost:3000"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(
  source: Record<string, string | undefined>,
): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid public environment variables: ${issues}`);
  }
  return result.data;
}

// Each NEXT_PUBLIC_ variable must be referenced explicitly so Next.js can inline it.
export const publicEnv: PublicEnv = parsePublicEnv({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
