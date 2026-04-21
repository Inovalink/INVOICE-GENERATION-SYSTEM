# Invoice system documentation

This folder contains architecture and reference material for the **Invoice & Financial Tracking System** (Next.js + Prisma + SQLite).

| Document | Contents |
|----------|----------|
| [PLAIN_LANGUAGE.md](./PLAIN_LANGUAGE.md) | **Non-technical walkthrough:** what the app does, analogies, user flows, glossary (read this first if jargon is heavy) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture plus **“In plain terms”** callouts and a link to the plain-language guide |
| [SERVICES_AND_DEPENDENCIES.md](./SERVICES_AND_DEPENDENCIES.md) | NPM packages, runtime services, environment, external integrations |
| [API_AND_DATA_FLOW.md](./API_AND_DATA_FLOW.md) | App Router pages, Route Handlers, Server Actions, how data moves |
| [PRODUCTION_SCALABILITY.md](./PRODUCTION_SCALABILITY.md) | **Going to production:** security, database, auth, scaling, ops—what to fix and why |

Start with **PLAIN_LANGUAGE.md** or the plain-language section at the top of **ARCHITECTURE.md** for intuition; use the other docs when you need filenames and exact behavior. Before a public launch, read **PRODUCTION_SCALABILITY.md** and work through priorities (P0 first).
