# Plain language guide

This document explains the same system as [ARCHITECTURE.md](./ARCHITECTURE.md), but in **everyday terms**. Use it when you want intuition first and jargon second—or share it with someone who is not a full-time developer.

---

## What is this application, in one sentence?

It is a **web app for running a small business’s money paperwork**: you keep a list of **clients** and **services**, create **invoices** (bills you send out), record **payments** when money comes in, and get **receipts** and **dashboard numbers** so you can see how you are doing.

Everything runs inside **one program** (the Next.js app). Your data lives in a **single database file** on the server (SQLite), not scattered across five different cloud products.

---

## The mental model: three kinds of “rooms”

Imagine the app as a **building** with three rooms:

1. **The showroom (what you see in the browser)**  
   Buttons, tables, charts, forms. Some of this is painted **before** it reaches you (server-rendered pages). Some parts wake up in the browser and **ask the server for fresh numbers** (charts, search, notifications).

2. **The office (the server)**  
   This is where rules live: “Is this password correct?”, “Save this invoice”, “How much did we collect this month?” The browser never talks to the database **directly**—it always goes through this office.

3. **The filing cabinet (the database)**  
   A structured place where **clients**, **invoices**, **payments**, etc. are stored so nothing is lost when you close the tab.

Nothing in this project is a **separate** “backend company” you deploy on its own. The office and the showroom are **bundled**: that is what people mean by a **monolith** here—one codebase, one deployment.

---

## Who are the main “things” in your business data?

| Plain idea | What it is for |
|------------|----------------|
| **User** | A person who can log in. Invoices and receipts are tied to a user so the system knows who created them. |
| **Workspace** | A bucket for a business (name, location, optional logo). Signup creates one workspace and makes you the owner. Think “this company’s account.” |
| **Client** | Who you bill: a customer or company. |
| **Service** | Something you sell (with a price), used to speed up line items on invoices. |
| **Invoice** | A formal bill: line items, totals, dates, status (draft-like “proforma”, final, paid, etc.). |
| **Payment** | A record that money moved (cash, bank, mobile money, etc.)—**not** an automatic charge from a bank API in this codebase; you are **recording** what happened. |
| **Receipt** | Proof of payment, linked one-to-one to an invoice when things are fully settled (or when you convert manually). |
| **Task** | Your personal to-dos inside the app (due dates, priorities). |

You do **not** need to remember the database table names to understand the product—but those names map to these ideas.

---

## What happens when you log in?

1. You submit **email and password**.  
2. The server looks up your user, checks the password against a **hash** (a one-way scrambled version; the real password is not stored as plain text).  
3. If it matches, the server gives your browser a small **signed ticket** (a JWT) stored in an **http-only cookie**.  
4. On later requests, that cookie proves “this browser is still allowed to be you” without typing the password again.

**In plain terms:** The cookie is like a **wristband at an event**—it does not contain your whole life story, but the venue trusts it until it expires.

**Caveat in this codebase:** Some features fall back to “the first user in the database” when no wristband is present. That is a **developer convenience**, not how you would run a public production site.

---

## What happens when you open the home dashboard?

1. The server checks whether you are logged in. If not, you may be sent to **signup** (see `app/page.tsx` behavior).  
2. If you are allowed in, the server **loads a bundle of answers** in one go: totals, alerts, a slice of recent invoices, top products, etc.  
3. You see the page **quickly** because a lot of that work already happened on the server.  
4. After the page is visible, some widgets **fetch extra data** (for example, chart series) or **poll** the server every so often for **new alerts** so small notification cards can pop up without you refreshing.

So: **first paint** is server-driven; **ongoing freshness** mixes timed refresh and API polling.

**Why both?** Think of it like a newspaper: the **first edition** is printed for you when the page loads; **updates** can arrive as small inserts (charts, toasts) without reprinting the whole paper every second.

---

## What happens when you create an invoice?

1. You pick a client, add lines (maybe from your service catalog), and set dates and amounts in the **Create invoice** screen (a client-side React flow).  
2. When you submit, the browser sends a **JSON package** to `POST /api/invoices`.  
3. The server validates basics, picks the logged-in user (and workspace if present), generates an **invoice number**, and saves the invoice and its **line items** in the database.  
4. You might later **convert** a proforma to a final invoice, **record payments**, or **generate a receipt**—each of those is another server action or POST that updates rows and sometimes **redirects** you to the right page.

**Important:** “Payment” here means **your business recorded a payment** in the app. The app does not automatically pull money from MTN or a bank API in the code reviewed—mobile money fields are **metadata** you type for your own records.

---

## How do clients and services get created?

Some screens do **not** use `/api/...` at all. For example, **Add client** and **Add service** use **server actions**: the form submits to the server, Prisma inserts a row, and you are redirected back to the list.

**In plain terms:** Two styles coexist—**REST-style JSON** for the rich invoice builder, and **simple form posts** for straightforward CRUD. Both end up in the same database.

---

## Search in the top bar

When you type in search, the app asks `/api/search/suggest`, which runs **substring matches** in the database (“does this invoice number contain…?”). It is **not** Google-style full-text search across millions of documents—good enough for a small business dataset on SQLite.

---

## Alerts and “revenue trend” style messages

The system **computes** reminders and summaries: upcoming due dates, overdue amounts, recent activity, and comparisons like “collections this month vs last month.”

Those results are **data rows** the UI can show as cards or toasts. When the app polls for alerts, it compares **new** rows to the **previous** snapshot and shows a toast when something **new** appears.

**In plain terms:** The server does the math; the browser decides what **feels** new to you.

---

## Signup and email codes

Signup can ask for a **one-time code** to verify email. In development, the code may be **printed in the server console** instead of sent by real email. The `nodemailer` package exists in `package.json` as a likely **next step** for real SMTP email, but wiring it up is a **future** integration unless you add it.

---

## What you should *not* assume this project includes

- A separate deployed “API server” or “invoice microservice.”  
- Automatic payment processing with a telecom or card gateway.  
- Real email delivery for OTP (unless you add it).  
- A dedicated search engine (Elasticsearch, etc.)—search is database queries.

---

## Glossary: jargon → plain English

| Term | Plain meaning |
|------|----------------|
| **Next.js** | A framework for building web apps with React; handles routing, server code, and bundling. |
| **App Router** | Next.js’s way of organizing URLs as folders under `app/`. |
| **Server Component** | UI that runs on the server and sends HTML to you; good for loading data without shipping huge JavaScript. |
| **Client Component** | UI that runs in the browser; needed for interactivity (charts, typing, polling). |
| **Route Handler** | A function that answers a URL like `/api/...` with JSON or redirects. |
| **Prisma** | A tool that talks to the database with typed queries instead of hand-written SQL everywhere. |
| **SQLite** | A database stored as a file—simple, great for development and small deployments. |
| **JWT** | A compact, signed blob that proves a claim (here: “user id”) without storing session rows in the database. |
| **httpOnly cookie** | A cookie JavaScript on the page cannot read—helps reduce certain attacks; still not a silver bullet for all security. |
| **Monolith** | One application that does UI + API together, not many tiny services. |

---

## Where to go next

- Deeper **technical** structure: [ARCHITECTURE.md](./ARCHITECTURE.md)  
- **Endpoints and flows**: [API_AND_DATA_FLOW.md](./API_AND_DATA_FLOW.md)  
- **Libraries and env**: [SERVICES_AND_DEPENDENCIES.md](./SERVICES_AND_DEPENDENCIES.md)
