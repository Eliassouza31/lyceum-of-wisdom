import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// No nonces: they would force every page to render on each request, which
// Partial Prerendering does not support. The app loads no third-party scripts:
// fonts are self-hosted by next/font and Sentry reports through /monitoring.
const contentSecurityPolicy = [
  "default-src 'self'",
  // React needs eval only in development, for its debugging tools.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  // Billing forms redirect to Stripe Checkout and the Stripe customer portal.
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  // Browser errors go to Sentry through this route on our own domain, so the
  // CSP stays 'self' and ad blockers do not drop them. src/proxy.ts skips it.
  tunnelRoute: "/monitoring",
  // Readable stack traces need SENTRY_AUTH_TOKEN, SENTRY_ORG and
  // SENTRY_PROJECT at build time. Without them, uploading is skipped.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  silent: !process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
  suppressOnRouterTransitionStartWarning: true,
});
