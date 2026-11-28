# SafeRide

SafeRide is a mobile-first scholar-transport coordination app for independent
South African transport operators and parents. It provides driver compliance
profiles, route and learner enrollment workflows, trip check-ins, trip history,
and fee ledgers. The production web app is deployed at
[saferide-rust.vercel.app](https://saferide-rust.vercel.app/).

SafeRide handles sensitive information about children. The deployed app and
backend are real, and the app now includes password recovery, account deletion,
and an in-app privacy notice. However, the notice still lacks the responsible
party's legal identity and contact details, and the hosting region and retention
arrangements have not been confirmed. Do not onboard real families or enter
children's personal information until those release requirements are resolved.

## Features

- Parent and driver account registration and email/password login through
  Supabase Auth; administrator accounts are provisioned manually.
- Driver compliance onboarding, private PDP and roadworthy document uploads,
  and an administrator verification queue.
- Driver vehicles, routes, invite codes, enrollment approvals, and learner
  rosters.
- Driver trip start, pickup/drop-off/absence check-ins, delay notices, trip
  history, and fee management.
- Parent child profiles, driver linking, trip status and history, fee history,
  and account profile management.
- Password reset email requests and password updates from a recovery session.
- Password-confirmed account deletion through a Supabase Edge Function,
  including compliance-file cleanup and deletion of the Auth user and cascaded
  application records.
- An in-app privacy notice at `/privacy`; it is a transparent draft, not yet a
  legally reviewed production notice.
- Row-level security policies and database RPCs for protected workflows; the
  compliance-documents Storage bucket is private.
- Responsive interface with light and dark themes.

The app is built with React 18, TypeScript, Vite, React Router, Supabase
(`@supabase/supabase-js`), and Tailwind CSS.

## Requirements

- Node.js 20.19+ or 22.12+ and npm.
- Docker Desktop for running the local Supabase stack.

## Local development

Use a local Supabase stack for development and testing. This prevents test
accounts and records from being created in the hosted production project.

1. Install dependencies and create a local environment file:

   ```powershell
   npm install
   Copy-Item .env.example .env.local
   ```

2. Start the local Supabase services and apply the migrations:

   ```powershell
   npm run db:start
   npm run db:reset
   ```

   The seed file currently contains no sample accounts or records. To connect
   the frontend to the local stack, set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` in `.env.local` to the local API URL and public
   anon/publishable key shown by `npx supabase status`.

3. Start Vite:

   ```powershell
   npm run dev
   ```

   Open the local URL printed by Vite. The frontend can also run without these
   environment variables, but backend-dependent actions will report that the
   service is not configured.

Stop the local Supabase services when finished:

```powershell
npm run db:stop
```

## Environment and credentials

The frontend reads these Vite environment variables:

| Variable                 | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project API URL                                   |
| `VITE_SUPABASE_ANON_KEY` | Public anon/publishable API key used by the browser client |

Vite embeds `VITE_*` values in browser assets. Only a public anon/publishable
key belongs here. Never put a Supabase `service_role` or `sb_secret` key in a
`VITE_*` variable, source file, or client bundle. Keep `.env.local` out of
version control and use separate local and production project credentials.

## Useful commands

| Command                                | Purpose                                                               |
| -------------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                          | Start the Vite development server                                     |
| `npm run build`                        | Type-check and create the production bundle                           |
| `npm run typecheck`                    | Run TypeScript checks                                                 |
| `npm test`                             | Run the Vitest suite once                                             |
| `npm run test:e2e`                     | Run Playwright browser tests in Chromium                              |
| `npm run lint`                         | Run ESLint                                                            |
| `npm run format:check`                 | Check formatting with Prettier                                        |
| `npm run check:service-role`           | Check that a service-role key is not shipped in `src/`                |
| `npm run db:start` / `npm run db:stop` | Start / stop local Supabase                                           |
| `npm run db:reset`                     | Recreate the local database, apply migrations, then run the seed file |
| `npm run db:test`                      | Run Supabase database tests                                           |
| `npm run db:push`                      | Push local migrations to the linked Supabase project; use with care   |
| `npm run types`                        | Generate TypeScript types from the local database                     |

GitHub Actions runs lint, typecheck, unit tests, the service-role scan, and the
production build. Separate jobs start a local Supabase stack and run database
tests, and install Chromium and run Playwright browser smoke tests. The E2E
tests use fake accounts and intercepted Auth responses; they do not create
production users or test real email delivery.

## Database and authorization

Database changes are maintained in `supabase/migrations/` and are applied in
order. The current chain is `0001` through `0016`. It defines profiles,
vehicles, learners, routes, enrollments, trips, trip logs, fee records, RPCs,
permissions, and the private compliance document bucket. `supabase/seed.sql`
is currently a placeholder, so a reset does not create test users or sample
transport records.

The database uses row-level security and role/relationship checks for access to
family, driver, and trip data. Admins are not self-registerable; an authorized
operator must provision an admin account and role. Do not bypass RLS or use a
service-role key from the browser.

For schema work, start with the local stack, add a new migration, then run
`npm run db:reset` and `npm run db:test`. Review migrations before using
`npm run db:push` against any hosted project. Never reset or seed production as
a development shortcut.

## Deployment

The frontend is a Vite single-page application. `vercel.json` rewrites app
routes to `index.html`, so direct navigation to routes such as `/signup` works.
Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Vercel environment
variables for the appropriate deployment environment. Supabase Auth's allowed
redirect URLs and email settings must also match the deployed domain.

The hosted Supabase project and production Vercel deployment are separate
services. Applying a database migration does not deploy frontend code, and a
frontend deployment does not apply database migrations.

Account deletion also requires deploying the `delete-account` Edge Function to
the target Supabase project. The function validates the caller's access token,
removes that user's private compliance files, then deletes the Auth user; the
existing foreign-key cascades remove associated database records. It uses
`SUPABASE_SERVICE_ROLE_KEY` only in the Edge Function runtime. Never expose this
key to Vite or the browser. After deploying it, verify the function's logs and
run a deletion test using a dedicated synthetic account.

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase functions deploy delete-account
```

Password recovery redirects to `/update-password`. Add that exact URL for each
deployment domain to Supabase Auth's allowed redirect URLs, and configure a
working email provider before relying on recovery emails.

## Remaining release requirements

- The privacy notice is available at `/privacy`, but is explicitly marked
  incomplete. The responsible party's legal name and a working privacy contact
  were not provided. The Supabase hosting region, international transfer
  arrangements, and backup-retention period also need confirmation. Have the
  responsible party provide those facts and obtain appropriate POPIA/legal
  review before using the notice for production consent.
- Confirm the deployed Edge Function is live and test deletion end to end using
  a synthetic account, including removal of uploaded compliance documents.
- Configure Supabase Auth's redirect allowlist and production email delivery;
  the built-in email provider has strict project-level sending limits.
- Auth email delivery is subject to Supabase project limits. With Supabase's
  built-in email provider, the documented default is 2 emails per hour per
  project; the same-user signup confirmation request also has a 60-second
  cooldown. Custom SMTP or an email hook can change the project email quota.
- CI runs database and browser tests, but these tests do not replace a
  production smoke test or validate provider email delivery.
- This README and the product requirements are not legal advice or a substitute
  for a privacy/security review, an incident-response process, and operational
  support arrangements.

Do not use production for test signups or enter real child data until the
remaining release requirements and relevant privacy, security, and operational
checks have passed. Use synthetic data with the local Supabase stack in the
meantime.

## Project documentation

- [Product requirements](docs/PRD.md) — product scope, roles, authorization
  rules, and acceptance criteria.
- [Business document](BUSINESS.md) — business model, assumptions, and pilot
  plans.
- [Design references](docs/designs/) — screen mockups. They are visual
  references; the PRD takes precedence when a mockup includes out-of-scope
  behavior.
- [Implementation plan](IMPLEMENTATION_PLAN.md) — original phased plan; check
  the code and tests for the current implementation state.
- [Online designs](https://stitch.google.com/projects/10900338452761913187).

The PRD is the source of truth. If code and PRD disagree, update one of them in
the same pull request.

## Key Engineering Rules

1. **Authorization lives in the database.** Every table has RLS enabled and forced. Client route guards are UX only. See PRD §2 and §4.5.
2. **Identity comes from `auth.uid()`**, never from a client-supplied `driver_id` or `parent_id`.
3. **Roles are immutable** after sign-up, and `admin` can never be chosen at sign-up.
4. **Parents never see other families' data**, even on the same trip. Row filtering happens in RLS, not in the client.
5. **Trip logs are append-only.** Corrections use `voided_at`; rows are never deleted (Realtime does not RLS-filter DELETE events).
6. **Money is stored as integer cents (ZAR)** and formatted with `Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })`.
7. **Times are stored as UTC** and displayed in `Africa/Johannesburg`.
8. **Never log children's personal data** (names, addresses, phone numbers, medical or allergy notes) to the console, error trackers, or analytics.

## Contributing

1. Branch from `main`: `feat/<short-name>` or `fix/<short-name>`.
2. Start from the relevant requirement or AC ID in `docs/PRD.md`.
3. Write tests first, keep commits small, and use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `test:`, `docs:`).
4. Open a pull request. Ensure configured checks pass and list the AC IDs it covers.
5. Schema changes go in a **new** migration file. Never edit an applied migration.

## Privacy and Compliance

SafeRide processes children's personal information, which is special personal information under South Africa's **POPIA (Act 4 of 2013)**. Treat all learner data as sensitive in code, logs, test fixtures, and screenshots. Never use real children's data in development. See PRD §6.3 for the full requirements.

SafeRide is an information and record-keeping tool. It is not a transport operator and does not guarantee safety or compliance.

## Out of Scope for V1

Live GPS tracking, in-app payments, school admin portals, native apps, and push/SMS/WhatsApp notifications. See PRD §6.6 for the full list.

## License and Project Credit

Copyright (c) 2026 Noluthando Molui. All rights reserved.

SafeRide is a capstone project developed for Melsoft Academy. It is provided for
academic evaluation and project demonstration. No commercial reuse or
redistribution is permitted without the copyright holder's written permission.
