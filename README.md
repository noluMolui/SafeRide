# SafeRide

**Neighbourhood scholar transport & safety platform for South African parents and independent kombi/minibus operators.**

SafeRide aims to replace WhatsApp check-ins and paper payment notebooks with real-time trip check-ins, delay alerts, driver compliance profiles, and a monthly fee ledger.

| For parents                                                  | For drivers                                         |
| ------------------------------------------------------------ | --------------------------------------------------- |
| Live `Picked Up` / `Dropped Off` / `Absent` status per child | One-tap check-ins, even offline                     |
| Delay alerts and trip history                                | Roster with emergency contacts and allergy notes    |
| Driver PDP and roadworthy status at a glance                 | Compliance profile that builds trust                |
| Fee balance and payment history                              | Monthly fee ledger (`Pending` / `Paid` / `Overdue`) |

> **Status:** MVP (V1) in development. Scope is defined in [`docs/PRD.md`](docs/PRD.md); the business case is in [`BUSINESS.md`](BUSINESS.md).

The current mobile-first frontend preview covers the first three PRD screens:
login, sign-up and driver compliance. This is **not an operational
authentication system**. No accounts are created, credentials sent, consent
recorded, or documents uploaded. Form details stay in browser memory and
disappear when the page is refreshed or closed. Privacy notice text and
password reset are pending. Do not enter real personal information or
documents. Server-side validation, authorisation, private storage and the rest
of the PRD remain to be implemented before launch.

Design references in `docs/designs` are named `Sxx-screen-name.png`, using the
uppercase screen ID and full screen name from the PRD for easy sorting and
searching. They are visual references, not feature specifications: the PRD
takes precedence where a design includes out-of-scope features.

Designs: https://stitch.google.com/projects/10900338452761913187
---

## Documentation

| Doc                          | Purpose                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/PRD.md`](docs/PRD.md) | Product requirements: RBAC matrix, features F1–F4 with Given/When/Then acceptance criteria, database schema, screen inventory, NFRs and non-goals |
| [`BUSINESS.md`](BUSINESS.md) | Business model, pricing, unit economics, go-to-market, risks                                                                                      |

The PRD is the source of truth. If code and PRD disagree, update one of them in the same pull request.

---

## Tech Stack

- **Current frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router and Zod
- **Planned backend:** Supabase (PostgreSQL, Auth, Row-Level Security, Realtime, Storage and pg_cron), as described in the PRD
- **Current tests:** Vitest and Testing Library

---

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the address printed by Vite.

---

## Validation

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` to
validate changes.

---

## Project Structure

> Target layout from the PRD; some components are not implemented in the current frontend preview.

```
.
├── docs/
│   └── PRD.md
├── BUSINESS.md
├── supabase/
│   ├── migrations/          # SQL migrations (0001_init.sql from PRD §4.2 onward)
│   ├── tests/               # pgTAP / RLS tests (PRD §2.4, matrix N1–N17)
│   ├── seed.sql             # test users, routes, learners, fees
│   └── config.toml
├── src/
│   ├── app/                 # routing, providers, route guards
│   ├── features/
│   │   ├── auth/            # F1: sign-up, login, driver compliance
│   │   ├── routes/          # F2: routes, roster, invites, child profiles
│   │   ├── trips/           # F3: check-in, delay notices, parent feed, history
│   │   └── fees/            # F4: driver ledger, parent fee history
│   ├── lib/                 # validators, formatters, offline queue, supabase client
│   ├── components/          # shared UI components
│   └── test/                # test utilities and fixtures
├── e2e/                     # Playwright specs (one per feature F1–F4)
├── .github/workflows/ci.yml
└── README.md
```

---

## Key Engineering Rules

1. **Authorization lives in the database.** Every table has RLS enabled and forced. Client route guards are UX only. See PRD §2 and §4.5.
2. **Identity comes from `auth.uid()`**, never from a client-supplied `driver_id` or `parent_id`.
3. **Roles are immutable** after sign-up, and `admin` can never be chosen at sign-up.
4. **Parents never see other families' data**, even on the same trip. Row filtering happens in RLS, not in the client.
5. **Trip logs are append-only.** Corrections use `voided_at`; rows are never deleted (Realtime does not RLS-filter DELETE events).
6. **Money is stored as integer cents (ZAR)** and formatted with `Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })`.
7. **Times are stored as UTC** and displayed in `Africa/Johannesburg`.
8. **Never log children's personal data** (names, addresses, phone numbers, medical or allergy notes) to the console, error trackers, or analytics.

---

## Contributing

1. Branch from `main`: `feat/<short-name>` or `fix/<short-name>`.
2. Start from the relevant requirement or AC ID in `docs/PRD.md`.
3. Write tests first, keep commits small, and use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `test:`, `docs:`).
4. Open a pull request. Ensure configured checks pass and list the AC IDs it covers.
5. Schema changes go in a **new** migration file. Never edit an applied migration.

---

## Privacy and Compliance

SafeRide processes children's personal information, which is special personal information under South Africa's **POPIA (Act 4 of 2013)**. Treat all learner data as sensitive in code, logs, test fixtures, and screenshots. Never use real children's data in development. See PRD §6.3 for the full requirements.

SafeRide is an information and record-keeping tool. It is not a transport operator and does not guarantee safety or compliance.

---

## Out of Scope for V1

Live GPS tracking, in-app payments, school admin portals, native apps, and push/SMS/WhatsApp notifications. See PRD §6.6 for the full list.

---

## License

TBD. Add a `LICENSE` file before making the repository public.
