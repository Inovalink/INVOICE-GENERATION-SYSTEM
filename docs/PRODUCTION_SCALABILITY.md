# Production readiness, security, and scalability

This document describes **what should change** before running this invoice system in **production** for real customers or regulated environments. It is written for this codebase specifically (Next.js App Router, Prisma, SQLite, JWT cookies) and explains **why** each item matters—not only a checklist.

For intuition-first reading, skim the **Plain language** boxes; for implementation detail, read the full sections.

---

## Plain language: what “production-ready” means here

**Development** optimizes for speed of building: one database file, loose auth shortcuts, OTP codes in the console, and “good enough” security on localhost.

**Production** optimizes for **trust**: data must not leak between users, attackers must not break in or overload the service, the database must survive restarts and growth, and when something breaks you must **see it** and **recover**.

This document lists gaps in those areas and what to implement instead.

---

## 1. Database: SQLite is the first bottleneck

### Current state

The schema targets **SQLite** (`provider = "sqlite"` in `prisma/schema.prisma`). SQLite is excellent for development and small deployments, but it has important limits for a multi-user production app:

- **Concurrent writes** are serialized; many users saving invoices at once will queue and slow down.
- **Network hosting**: SQLite expects a **local file**. Serverless platforms (many Vercel-style setups) have **ephemeral filesystems** unless you attach persistent storage—wrong fit unless architected carefully.
- **Backups and replication** are manual compared to managed Postgres/MySQL.

### What to change

1. **Migrate to a server database** used in production: **PostgreSQL** is the most common Prisma pairing (or MySQL/MariaDB).  
   - Use Prisma Migrate to produce a migration path; test on a staging copy of data.  
   - Update `DATABASE_URL` to a connection string with **SSL** for cloud providers.

2. **Connection management**  
   - Use the **singleton** `lib/prisma.ts` everywhere. Today several modules call `new PrismaClient()` directly (`app/api/invoices/route.ts`, `app/api/tasks/route.ts`, pages under `clients/` and `services/`, etc.). In serverless, extra clients can exhaust connections; in long-running Node, it is still unnecessary duplication. **Standardize on `import { prisma } from '@/lib/prisma'`.**

3. **Connection pooling**  
   - For serverless + Postgres, use a pooler (**PgBouncer**, **Neon**, **Supabase pooler**, **Prisma Accelerate**, etc.) so each function instance does not open unlimited DB connections.

4. **Indexes**  
   - Review query patterns (search `contains`, dashboard aggregates, foreign keys). Add **indexes** for frequent filters (`Invoice.createdAt`, `Payment.paymentDate`, `Task.userId` + `dueDate`, etc.)—measure with `EXPLAIN` on Postgres.

**Plain language:** Move from “one spreadsheet file on the server” to “a real database server built for many simultaneous users and backups.”

---

## 2. Authentication and session model

### Current state (risks)

- **`getDefaultUserId()`** returns the **first user in the database** when no session exists (`lib/auth/getCurrentUser.ts`). Any route using this effectively allows **unauthenticated access** behaving as user #1. That is unsafe in production.

- **JWT in httpOnly cookie** without a **server-side session store** means you cannot easily **revoke** a token before expiry (logout clears the cookie on that browser, but a stolen token works until JWT expiry).

- **No `middleware.ts`** enforcing auth on matched paths: protection is **per-route** and inconsistent (some APIs require `getSessionClaims`, others use `getDefaultUserId`).

- **Workspace scoping**: `getCurrentContext()` picks the **first** membership. Production often needs **explicit workspace id** (header, subdomain, or path) and **role checks** (OWNER vs STAFF).

### What to change

1. **Remove or gate dev fallbacks**  
   - In production builds, `getDefaultUserId` should **not** fall back to the first user—return `null` and return **401** unless `NODE_ENV === 'development'` or an explicit `ALLOW_DEV_AUTH_FALLBACK=true` that is **never** set in prod.

2. **Centralize route protection**  
   - Add **Next.js middleware** (or layout-level checks) for `/`, `/invoices`, `/clients`, `/api/*` (except public auth routes) to require a valid session cookie and redirect to `/login` or return 401 JSON for APIs.

3. **Session strategy (choose one direction)**  
   - **Short-lived JWT + refresh** (more moving parts), or  
   - **Database sessions**: store session id in cookie, validate row in `Session` table on each request (easy revocation, logout-all-devices).  
   - For JWT-only setups: keep **short TTL** (e.g. 15–60 minutes) + refresh, or accept revocation limits.

4. **Password policy**  
   - Enforce minimum length/complexity on signup; consider **breached-password** checks (e.g. Have I Been Pwned API) for high-assurance deployments.

5. **Account recovery**  
   - Secure password reset flow (one-time tokens, time-limited), not only signup OTP.

**Plain language:** Make sure **every** sensitive screen and API **requires a real login**, and **no silent “pretend to be the first user”** behavior exists in production.

---

## 3. Authorization (who can do what)

### Current state

- Invoice and client lists appear **global** in queries (no `where: { userId }` or `workspaceId` on all reads in every file). For a **single-tenant** install with one business, that may be acceptable; for **multi-tenant SaaS**, it is a **data isolation** risk.

### What to change

1. **Define tenant model**  
   - If multiple businesses share one database, **every** query must filter by `workspaceId` (or equivalent) from the authenticated context—never trust client-supplied ids without verifying membership.

2. **Row-level security (optional)**  
   - Postgres supports **RLS** policies as a second line of defense; Prisma still needs correct `where` clauses.

3. **Role-based access**  
   - Use `MembershipRole` (OWNER, ADMIN, STAFF) to hide admin actions (billing, user management) in UI and reject in API.

**Plain language:** Ensure user A **cannot** open user B’s invoices by guessing a URL or id.

---

## 4. API and application security

### Gaps typical for this stack

- **Rate limiting**: Login, signup, OTP, and search can be **abused** (credential stuffing, DoS). Add limits per IP / per account (e.g. Upstash Redis + middleware, or edge rate limits on your host).

- **CSRF**: Cookie-based auth is vulnerable to **cross-site** POSTs from malicious sites. Next.js Server Actions use **Origin checks**; for `POST /api/*` from same-site SPA, use **SameSite=Lax** (already used) and consider **CSRF tokens** for sensitive state-changing routes if you allow cross-origin access.

- **Input validation**: Prefer **Zod** (or similar) on every Route Handler body/query—reject unexpected fields, limit string lengths, and validate enums server-side (invoice status, payment method).

- **Security headers**: Set **Content-Security-Policy**, **X-Frame-Options** / **frame-ancestors**, **Referrer-Policy**, **Permissions-Policy** via `next.config.ts` headers or reverse proxy.

- **Dependency audit**: Run `npm audit`, enable **Dependabot** or Renovate, pin versions in CI.

**Plain language:** Slow down bots on login, validate everything the server receives, and add browser-level policies that reduce XSS and clickjacking impact.

---

## 5. Secrets and environment configuration

### Current state

- `AUTH_SECRET` falls back to a **hardcoded dev string** in `lib/auth/session.ts` if unset—**must never happen** in production.

### What to change

1. **Require secrets at startup**  
   - Fail fast if `AUTH_SECRET` is missing in production (or use validated config with `zod`/`envalid`).

2. **Separate environments**  
   - Distinct `DATABASE_URL`, secrets, and cookie names (or `__Host-` cookie prefix rules) for **staging** vs **production**.

3. **No secrets in client bundles**  
   - Only `NEXT_PUBLIC_*` is exposed; keep DB URLs and JWT secrets server-only.

**Plain language:** Production secrets come from **environment variables** or a **secret manager**, not from source code.

---

## 6. Email, OTP, and background work

### Current state

- Signup OTP is stored **in memory** (`lib/auth/otpStore.ts`) and **lost on process restart**; in multi-instance deployments, OTP would not be shared across servers.

- `nodemailer` is in dependencies but **not integrated**; dev flow logs OTP to console.

### What to change

1. **Real email** via **Resend**, **SendGrid**, **Amazon SES**, or **Postmark**—with templates and bounce handling.

2. **OTP storage** in **Redis** or database with TTL, not process memory.

3. **Job queue** for email and heavy work (**BullMQ** + Redis, **Inngest**, **Temporal**, cloud queues)—so HTTP requests stay fast and retries are reliable.

**Plain language:** Verification codes and emails must survive **server restarts** and **multiple machines**.

---

## 7. File uploads (logos and any future attachments)

### Current state

- Signup saves logos under `public/uploads/logos/` (`app/api/auth/signup/route.ts`). **Public** folder means files may be **directly served**; you rely on **random UUID filenames** and extension allowlists—good start, but production needs more.

### What to change

1. **Scan** uploads for malware (ClamAV or cloud AV API) for untrusted users.

2. **Store in object storage** (S3, GCS, R2) with **private** ACL and signed URLs if needed—not only local disk (ephemeral on PaaS).

3. **Size and dimension limits** stricter than today; strip **EXIF** if privacy-sensitive.

**Plain language:** Do not trust filenames; assume uploads could be malicious or huge.

---

## 8. Observability: logs, metrics, errors

### What to add

1. **Structured logging** (JSON) with **request id**, **user id** (hashed or internal), route, duration.

2. **Error tracking**: **Sentry**, **Datadog**, or similar for unhandled exceptions with source maps.

3. **Uptime monitoring** synthetic checks on `/` and critical APIs.

4. **Database metrics**: slow query log, connection count, disk (managed DB dashboards).

**Plain language:** When production breaks at 3 a.m., you need **alerts** and **clues**, not only `console.error` on one server.

---

## 9. Performance and scalability (application layer)

1. **Caching**  
   - **Next.js** `unstable_cache` or HTTP cache headers for read-heavy public endpoints (if any).  
   - **CDN** for static assets (`/_next/static`, images).

2. **Pagination**  
   - Dashboard and invoice lists already use limits in places; ensure **all** list endpoints paginate and indexes exist for sort columns.

3. **N+1 queries**  
   - Audit Prisma `include` chains in hot paths; use `select` to reduce payload.

4. **Search**  
   - `contains` on SQLite/Postgres without proper indexing does not scale; consider **Postgres full-text**, **Meilisearch**, **Typesense**, or **Algolia** for large catalogs.

**Plain language:** As data grows, **measure** slow endpoints and add **indexes** and **smaller responses** before buying bigger servers.

---

## 10. Deployment topology

### Considerations

- **Single region** is simpler; **multi-region** needs replicated DB and session affinity or shared session store.

- **Horizontal scaling**: multiple Node instances require **shared session/OTP store**, **sticky sessions** not sufficient for JWT alone if you add server-side session state.

- **HTTPS**: Terminate TLS at load balancer or platform; enforce **HSTS**.

- **Backups**: Automated daily DB backups + **test restores** quarterly.

- **Disaster recovery**: Document RTO/RPO; keep infrastructure as code (Terraform, Pulumi).

**Plain language:** Know how you **restore** data and how long that takes before you need it.

---

## 11. Compliance and legal (context-dependent)

If you store **personal data** (emails, names, client addresses):

- Document **data processing**, retention, and deletion (GDPR-style **right to erasure** may require cascading deletes or anonymization).

- **Audit logs** for who viewed or exported financial data (SOC 2 style).

- Terms of service and privacy policy for SaaS.

**Plain language:** Production is not only technical—**legal and privacy** expectations apply once you have real users.

---

## 12. Testing and release discipline

Before production:

- **Automated tests**: unit tests for money calculations; integration tests for Prisma + API routes; e2e for login and create-invoice happy path.

- **Staging environment** mirroring production config (smaller DB).

- **CI pipeline**: lint, typecheck, test, build on every PR.

**Plain language:** Catch regressions **before** deploy, not after customers complain.

---

## 13. Prioritized roadmap (suggested phases)

| Phase | Focus | Examples |
|-------|--------|----------|
| **P0 — Security blockers** | Stop unsafe auth and secrets | Remove `getDefaultUserId` fallback in prod; require `AUTH_SECRET`; middleware auth; audit all API routes |
| **P1 — Data layer** | Survive real load | Postgres + pooled connection; unify Prisma client; indexes |
| **P2 — Hardening** | Abuse and mistakes | Rate limits; Zod validation; security headers; structured logs + Sentry |
| **P3 — Product ops** | Email OTP, jobs, backups | Redis + real email; queue; automated backups + restore drill |
| **P4 — Scale-out** | Growth | Search service; read replicas; caching; multi-region if needed |

---

## 14. Quick reference: codebase-specific touchpoints

| Area | Files / patterns to review |
|------|----------------------------|
| Dev auth fallback | `lib/auth/getCurrentUser.ts` (`getDefaultUserId`) |
| JWT secret | `lib/auth/session.ts` |
| Duplicate Prisma | `grep "new PrismaClient"` — align with `lib/prisma.ts` |
| Cookie settings | `app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts` |
| OTP memory | `lib/auth/otpStore.ts`, `app/api/auth/signup/send-otp/route.ts` |
| Uploads | `app/api/auth/signup/route.ts` (`public/uploads/logos`) |
| Dashboard polling | `components/notifications/FinancialAlertNotifications.tsx` (consider backoff + auth errors) |

---

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the system fits together today  
- [PLAIN_LANGUAGE.md](./PLAIN_LANGUAGE.md) — non-technical overview  
- [SERVICES_AND_DEPENDENCIES.md](./SERVICES_AND_DEPENDENCIES.md) — current packages and gaps  

This document should evolve as you implement items—turn each **P0/P1** bullet into tickets and mark them done when verified in **staging** before production.
