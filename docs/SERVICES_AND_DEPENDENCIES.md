# Services and dependencies

This document lists what the project **actually uses** today: runtime stack, NPM packages, and how they relate. It also calls out declared-but-unused dependencies where relevant.

### Plain language

You can think of this page as the **parts list and power requirements** for the app: which **libraries** (pre-built code) the project depends on, where **data** lives, and which **external systems** are actually wired up (versus only listed for later). If a package name means nothing to you, skip to the short explanations in each subsection—or read **[PLAIN_LANGUAGE.md](./PLAIN_LANGUAGE.md)** for the whole system in everyday terms first.

## Runtime and hosting model

| Layer | Technology |
|-------|------------|
| Application framework | **Next.js 16** (App Router) |
| UI | **React 19** |
| Language | **TypeScript** |
| Database | **SQLite** via **Prisma ORM** (`DATABASE_URL` in environment) |
| Process | Single Node.js process: server components, API routes, and static assets share one deployment unit |

There is **no separate backend service** (no standalone Express/Fastify server). All server logic lives in Next.js Route Handlers (`app/api/**/route.ts`) and Server Actions (`'use server'`).

## NPM dependencies (what each is for)

### Core framework

- **next** — Routing, bundling, React Server Components, Route Handlers, metadata.
- **react**, **react-dom** — UI rendering (client and server).

### Data and persistence

- **@prisma/client**, **prisma** (dev) — Type-safe access to SQLite; schema in `prisma/schema.prisma`; singleton client in `lib/prisma.ts`.

### Security and sessions

- **jose** — Create and verify **HS256 JWTs** stored in an **httpOnly cookie** (`lib/auth/session.ts`). The JWT `sub` claim holds the user id.
- **bcryptjs** — Password hashing at signup and verification at login.

### Dates and charts

- **date-fns** — Date math and formatting in finance helpers.
- **recharts** — Revenue trend area charts (`components/finance/RevenueTrendsSection.tsx`).

### UI utilities

- **lucide-react** — Icon set (sidebar, dashboard, forms).
- **react-day-picker** — Calendar widgets (`components/ui/DatePicker.tsx`, `DateRangePicker`, etc.).

### Other

- **jsbarcode** — Barcode rendering for printable invoice/receipt views where used.
- **nodemailer** — Listed in `package.json` but **not imported anywhere in the source tree** as of this documentation. Signup OTP is simulated (code logged in development); email sending is a future integration point.

### Tooling (dev)

- **eslint**, **eslint-config-next**, **typescript**, **ts-node**, **babel-plugin-react-compiler** — Linting, types, Prisma seed, React Compiler (see `next.config.ts`).

## “Services” in the sense of integrations

| Capability | Status in codebase |
|------------|-------------------|
| Email (OTP / reminders) | OTP generation uses in-memory store + console log in dev (`app/api/auth/signup/send-otp/route.ts`). No SMTP delivery wired. |
| Payment gateways | **No** MTN/Telecel APIs — mobile money fields are **metadata** on `Payment` rows and forms. |
| Search index | `lib/search/invoiceSearch.ts` exports `indexInvoiceById` as a **no-op** placeholder. `/api/search/suggest` queries Prisma directly. |
| File uploads | Signup can save a workspace logo to `public/uploads/logos/` (`app/api/auth/signup/route.ts`). |

## Environment variables (conceptual)

| Variable | Role |
|----------|------|
| `DATABASE_URL` | SQLite file URL for Prisma (see `prisma/schema.prisma` and `prisma.config.ts`). |
| `AUTH_SECRET` | Secret for signing session JWTs (`lib/auth/session.ts`); falls back to a dev default if unset (not for production). |
| `NODE_ENV` | Affects `secure` flag on cookies and OTP logging behavior. |

## Prisma engine

- `prisma.config.ts` uses the **classic** engine with migrations path `prisma/migrations`.
