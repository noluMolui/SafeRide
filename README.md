# SafeRide

**Neighbourhood scholar transport & safety platform for South African parents and independent kombi/minibus operators.**

SafeRide replaces WhatsApp check-ins and paper payment notebooks with real-time trip check-ins, delay alerts, driver compliance profiles, and a monthly fee ledger.

| For parents | For drivers |
|---|---|
| Live `Picked Up` / `Dropped Off` / `Absent` status per child | One-tap check-ins, even offline |
| Delay alerts and trip history | Roster with emergency contacts and allergy notes |
| Driver PDP and roadworthy status at a glance | Compliance profile that builds trust |
| Fee balance and payment history | Monthly fee ledger (`Pending` / `Paid` / `Overdue`) |


> **Status:** MVP (V1) in development. Scope is defined in [`docs/PRD.md`](docs/PRD.md); the business case is in [`docs/BUSINESS.md`](docs/BUSINESS.md).
stitch designs : https://stitch.google.com/projects/10900338452761913187
---

## Documentation

| Doc | Purpose |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Product requirements: RBAC matrix, features F1–F4 with Given/When/Then acceptance criteria, database schema, screen inventory, NFRs and non-goals |
| [`docs/BUSINESS.md`](docs/BUSINESS.md) | Business model, pricing, unit economics, go-to-market, risks |

The PRD is the source of truth. If code and PRD disagree, update one of them in the same pull request.

---

## Tech Stack

- **Frontend:** React 18, TypeScript (strict), Vite, Tailwind CSS, React Router, TanStack Query, Zod
- **Backend:** Supabase (PostgreSQL, Auth, Row-Level Security, Realtime, Storage, pg_cron)
- **Testing:** Vitest + Testing Library (unit), pgTAP or Vitest against local Supabase (database and RLS), Playwright (E2E)
- **CI/CD:** GitHub Actions

---

## Getting Started

### Prerequisites
- Node.js 20+ and npm
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (required by the Supabase local stack)

### 1. Install
```bash
git clone <your-repo-url> saferide
cd saferide
npm install
```

### 2. Start the local backend
```bash
supabase start          # starts local Postgres, Auth, Realtime, Storage
supabase db reset       # applies supabase/migrations/* and supabase/seed.sql
```
`supabase start` prints the local API URL and anon key. Use them in the next step.

### 3. Configure environment
Copy the example file and fill in the values:
```bash
cp .env.example .env.local
```
```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key printed by supabase start>
```
> **Never** put the Supabase `service_role` key in `.env.local`, client code, or CI logs. Only the `anon` key belongs in the browser bundle.

### 4. Run the app
```bash
npm run dev
```
Open the URL Vite prints (default `http://localhost:5173`).

### Seeded test users (local only)
`supabase/seed.sql` creates users for every role, defined in PRD §4.6: `admin`, `driverA`, `driverB`, `driverExpired` (PDP expired), `parentA`, `parentB`. Passwords are listed in the seed file and must never be used outside local/CI environments.

---

## Scripts

Add these to `package.json` if they are not present yet.

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm run format:check` | Prettier check |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit/integration tests |
| `npm run test:coverage` | Vitest with coverage (gate: 80%) |
| `npm run test:db` | Database, constraint and RLS tests against local Supabase |
| `npm run test:e2e` | Playwright E2E (375 px and 1280 px projects) |

---

## Project Structure

> Target layout. Adjust as the codebase grows, but keep migrations and tests in these locations so CI keeps working.

```
.
├── docs/
│   ├── PRD.md
│   └── BUSINESS.md
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

## Testing and TDD

Write the failing test first, then the migration, policy or UI.

- **Traceability:** every test title starts with its acceptance-criteria ID from the PRD, for example `AC-3.15 dropped_off before picked_up is rejected`. CI fails if any AC ID in `docs/PRD.md` has no matching test.
- **Authorization:** the negative test matrix N1–N17 (PRD §2.4) must pass in full. This is a launch gate.
- **E2E:** happy paths for F1–F4 at 375 px and 1280 px, plus two-browser tests (driver and parent) for real-time updates.

```bash
supabase start && supabase db reset
npm run test:db
npm test
npm run test:e2e
```

---

## Continuous Integration and Deployment

`.github/workflows/ci.yml` runs on every pull request and on `main`:

1. Install, lint, format check, type-check
2. Start local Supabase, apply migrations and seed, run database/RLS tests
3. Unit and integration tests with the coverage gate
4. Build, then Playwright E2E
5. Lighthouse CI budgets (mobile performance ≥ 85, accessibility ≥ 90)
6. On `main` only: apply migrations to production (`supabase db push`), deploy the frontend, run a post-deploy smoke test (login page responds; every `public` table has RLS enabled)

**Required GitHub secrets** (names are suggestions; set them under *Settings → Secrets and variables → Actions*):

| Secret | Used for |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI auth |
| `SUPABASE_PROJECT_REF` | Production project reference |
| `SUPABASE_DB_PASSWORD` | `supabase db push` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Production frontend build |
| Hosting token (Vercel, Netlify or Cloudflare) | Frontend deploy |

---

## Contributing

1. Branch from `main`: `feat/<short-name>` or `fix/<short-name>`.
2. Start from the relevant requirement or AC ID in `docs/PRD.md`.
3. Write tests first, keep commits small, and use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `test:`, `docs:`).
4. Open a pull request. CI must be green and the PR description should list the AC IDs it covers.
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
