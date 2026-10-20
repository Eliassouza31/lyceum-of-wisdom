# ReminderApp

Appointment scheduling and automated reminders SaaS for small businesses in the US.
"ReminderApp" is a codename; the commercial name is still to be decided.

- Technical plan (Portuguese): [`docs/saas-plan/PLANO-TECNICO.md`](docs/saas-plan/PLANO-TECNICO.md)
- Phase 2 setup guide (Portuguese): [`docs/saas-plan/FASE-2-AMBIENTE.md`](docs/saas-plan/FASE-2-AMBIENTE.md)
- Phase 3 auth and database guide (Portuguese): [`docs/saas-plan/FASE-3-AUTH-BANCO.md`](docs/saas-plan/FASE-3-AUTH-BANCO.md)

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS · Zod · Vitest · Supabase · Stripe · Resend · Vercel

## Getting started

Requires Node.js 22.12+ (24 LTS recommended).

```bash
npm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command                    | What it does                                   |
| -------------------------- | ---------------------------------------------- |
| `npm run dev`              | Development server with hot reload             |
| `npm run build`            | Production build                               |
| `npm start`                | Serve the production build                     |
| `npm run lint`             | ESLint                                         |
| `npm run typecheck`        | Generate route types and run `tsc`             |
| `npm test`                 | Unit tests (Vitest)                            |
| `npm run format`           | Format all files with Prettier                 |
| `npm run check`            | Format check + lint + typecheck + tests        |
| `npm run db:start`         | Start the local Supabase stack (Docker)        |
| `npm run db:reset`         | Recreate the local database from migrations    |
| `npm run db:lint`          | Lint the database schema                       |
| `npm run db:types`         | Regenerate `src/types/database.types.ts`       |
| `npm run test:integration` | Row Level Security tests (local Supabase)      |
| `npm run test:e2e`         | Browser tests with Playwright (local Supabase) |

CI (`.github/workflows/ci.yml`) runs the same checks plus a production build on every push.
