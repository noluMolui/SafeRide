# SafeRide — Implementation Plan (MVP / V1)

| | |
|---|---|
| **Document** | `docs/IMPLEMENTATION_PLAN.md` |
| **Inputs** | `docs/PRD.md` (source of truth), `docs/STITCH_PROMPTS.md` (UI), `docs/BUSINESS.md` (pilot goals) |
| **Version / Date** | 1.0 — 2026-11-23 |
| **Approach** | Test-driven, database-first, vertical slices per feature (F1 → F4) |

> **Estimates** assume **1 full-stack engineer** working full time (~10–12 weeks to pilot-ready). With **2 engineers** (one DB/backend-leaning, one UI-leaning) the calendar time drops to roughly **7–8 weeks**. Estimates are planning guesses, not commitments; re-baseline after Phase 2.

---

## 1. Guiding Principles

1. **Database first.** Authorization is enforced by RLS, constraints, triggers, and RPCs (PRD §2, §4). The UI is built on top of a backend that is already proven by tests.
2. **Tests before code (TDD).** For each feature: write failing DB/RLS tests → migration/policy → failing unit tests → logic → failing E2E → UI. Test titles start with the AC ID (`AC-3.15 …`).
3. **Vertical slices.** Each phase delivers a usable slice (schema + RLS + RPC + UI + tests), merged behind a green CI.
4. **CI from day one.** GitHub Actions is the first thing built, so every later PR is gated.
5. **Scope discipline.** Anything in PRD §6.6 (Non-Goals) is rejected in review. New ideas go to the backlog (§10).
6. **Privacy by default.** No real children's data in dev; no PII in logs; service-role key never in the client.

---

## 2. Roadmap at a Glance

| Phase | Name | Output | Est. (1 dev) | Exit gate |
|---|---|---|---|---|
| **0** | Foundation & CI | Repo, tooling, local Supabase, CI skeleton, design tokens | 3–4 days | CI green on an empty app; local stack boots in one command |
| **1** | Database & Authorization Core | All migrations, helper functions, RLS, triggers, seed, **negative test matrix N1–N17** | 1.5 weeks | G2: RLS suite 100% green; all tables RLS-enabled |
| **2** | F1 — Auth & Driver Compliance | Sign-up/login, role guards, driver onboarding, compliance badges, admin queue | 1.5 weeks | AC-1.x all passing (unit, DB, E2E) |
| **3** | F2 — Routes, Roster & Child Profiles | Routes, invite codes, child profiles, link/approve flow | 2 weeks | AC-2.x all passing |
| **4** | F3 — Live Trip & Parent Feed | Start/check-in/undo/delay/complete, Realtime feed, offline queue, history | 2.5 weeks | AC-3.x all passing; latency P2 verified |
| **5** | F4 — Fee Ledger | Fee CRUD, bulk generate, transitions, overdue job, parent history | 1.5 weeks | AC-4.x all passing |
| **6** | Hardening & Launch Readiness | A11y, performance, security review, POPIA artefacts, observability, docs | 1.5 weeks | **All launch gates G1–G7 pass** |
| **7** | Pilot Launch & Iteration | Production go-live, pilot onboarding, weekly iteration | Ongoing (60 days) | PRD pilot targets P1–P7 reviewed at day 60 |

**Critical path:** Phase 0 → Phase 1 → F1 → F2 → F3 → F4 → Phase 6. F3 depends on F2 (enrollments), and F4 depends on F2 (roster check). Phases 5 and parts of 6 can overlap if two engineers are available (see §9).

---

## 3. Phase 0 — Foundation & CI (3–4 days)

### Tasks
- [ ] **Repo setup:** create repo, branch protection on `main` (PR + passing CI required), `.gitignore`, `.editorconfig`, `LICENSE` decision, add `docs/` files and `README.md`.
- [ ] **Scaffold app:** Vite + React 18 + TypeScript (`strict: true`, `noUncheckedIndexedAccess`), Tailwind, React Router, TanStack Query, Zod, `@supabase/supabase-js`.
- [ ] **Quality tooling:** ESLint, Prettier, `tsc --noEmit`, Husky + lint-staged (pre-commit), Conventional Commits (commitlint).
- [ ] **Test tooling:** Vitest + Testing Library + jsdom; Playwright with two projects (375 px mobile, 1280 px desktop); pgTAP (or Vitest DB harness) wired to local Supabase.
- [ ] **Supabase local:** `supabase init`, `config.toml` (email confirmation **off locally**, Realtime on), npm scripts `db:start`, `db:reset`, `test:db`.
- [ ] **Env handling:** `.env.example`; typed env loader that fails fast if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` is missing; add a CI check that no `service_role` string exists in `src/`.
- [ ] **CI skeleton** (`.github/workflows/ci.yml`): install → lint → typecheck → unit tests → build. Add DB and E2E jobs as they come online (Phases 1 and 2).
- [ ] **Design tokens:** Tailwind theme from `STITCH_PROMPTS.md` (colors, Inter font, radii, tap-target utilities, status colors). Build base components: `Button`, `Input`, `Select`, `Card`, `StatusPill`, `Badge`, `BottomTabBar`, `Sidebar`, `Skeleton`, `EmptyState`, `ErrorState`, `OfflineBanner`, `Toast`, `BottomSheet`, `Dialog`.
- [ ] **Traceability script:** `scripts/check-ac-coverage.ts` parses AC IDs from `docs/PRD.md` and fails CI if any AC has no test referencing it (enable as *warning* now, *blocking* in Phase 6).
- [ ] **Stitch export:** generate mobile + desktop frames for **S01, S02, S13, S09** first; save HTML/screenshots to `design/stitch/` for reference.

### Definition of Done
Fresh clone → `npm i && supabase start && npm run dev` works; CI is green on `main`; base components render in a simple component gallery route (dev-only).

---

## 4. Phase 1 — Database & Authorization Core (1.5 weeks)

**Goal:** the entire data model and every authorization rule exist and are proven **before** any feature UI is built.

### 4.1 Migration order (each as its own file under `supabase/migrations/`)
| # | File | Contents (PRD ref) |
|---|---|---|
| 1 | `0001_extensions_enums_utils.sql` | `pgcrypto`, enums, `set_updated_at`, `sast_today` (§4.2) |
| 2 | `0002_profiles_vehicles.sql` | `profiles`, `vehicles`, triggers `prevent_role_change`, `protect_verification_fields`, `handle_new_user`/`register_*` (§4.3) |
| 3 | `0003_routes_learners_enrollments.sql` | `routes`, invite code generator, `learners`, `route_enrollments`, `enforce_enrollment_rules` |
| 4 | `0004_trips_logs_delays.sql` | `trips`, `trip_logs`, `trip_delay_notices`, `enforce_trip_log_rules`, `enforce_delay_notice_rules` |
| 5 | `0005_fee_records.sql` | `fee_records`, `enforce_fee_rules`, `mark_overdue_fees()` + pg_cron schedule |
| 6 | `0006_helpers_rls.sql` | `app_role()`, `parent_owns_learner()`, `driver_serves_learner()`, `parent_sees_route()`, **enable + force RLS everywhere**, all policies, `revoke … from anon` |
| 7 | `0007_views_rpcs.sql` | Views `driver_public_profiles`, `parent_contacts`, `my_routes`; all RPCs in §4.4 (implemented as stubs first, bodies filled per feature) |
| 8 | `0008_storage.sql` | Private `compliance-docs` bucket + policies (driver own folder, admin read) |
| — | `seed.sql` | Users and data per PRD §4.6 (admin, driverA, driverB, driverExpired, parentA, parentB, routes, enrollments, fees) |

### 4.2 Tasks (TDD order)
- [ ] Write the **negative authorization matrix N1–N17** as failing tests first (`supabase/tests/rls_*.sql` or Vitest + supabase-js with per-user JWT clients).
- [ ] Write constraint/trigger tests: state machines (trip logs, enrollments, fees), capacity, uniqueness, `paid` consistency, date rules, immutability, timestamp validation.
- [ ] Implement migrations until tests pass.
- [ ] Build a **test helper** to sign in as a seeded user and return a Supabase client (reused by all later E2E/integration tests).
- [ ] Verify Realtime + RLS manually with two clients (parentA vs parentB) → informs N17.
- [ ] Generate TypeScript types: `supabase gen types typescript` → `src/lib/database.types.ts` (CI fails if types are out of date).
- [ ] Add CI job `db-tests`: start local Supabase, reset, run tests.
- [ ] Add the RLS-enabled check (PRD G7) as a CI step.

### Definition of Done
- N1–N17 green; every table has RLS enabled **and** forced; `anon` has no table privileges.
- Reset-and-seed from scratch takes < 60 s in CI.
- Review checkpoint: a second person (or a dedicated review pass) reads every policy and `SECURITY DEFINER` function for `search_path` and privilege-escalation issues.

### Risks specific to this phase
- **Recursive RLS / performance:** keep helper functions `SECURITY DEFINER`, `STABLE`, and index the columns they filter on (`route_enrollments(learner_id, status)`, `learners(parent_id)`).
- **Realtime + RLS gaps:** DELETE events are not filtered → keep append-only/soft-void (already in PRD).
- **pg_cron availability** on the chosen Supabase plan → fallback: scheduled Edge Function calling `mark_overdue_fees()`.

---

## 5. Phase 2 — F1: Auth & Driver Compliance (1.5 weeks)

**ACs:** AC-1.1 – AC-1.20 · **Screens:** S01, S02, S03, S04, S05a (join redirect), S10 (compliance profile), S19 (admin queue), account/logout.

### Backend
- [ ] Finalise `register_driver_profile` RPC and parent sign-up path (profile created atomically; role whitelist `driver|parent`; consent timestamp required).
- [ ] Storage upload policy tests (size ≤ 5 MB, MIME whitelist, owner-only folders, admin read) — AC-1.20.
- [ ] Rate-limiting configuration: Supabase Auth limits; document the settings (FR-1.10).

### Frontend (feature folder `src/features/auth`)
- [ ] Zod schemas + unit tests: phone E.164 normalisation (`082…` → `+2782…`), password rules, registration normalisation, date rules (AC-1.8 – AC-1.13).
- [ ] `AuthProvider` (session, profile, role), `RequireRole` route guard, role-based redirects (AC-1.3, AC-1.17, AC-1.19).
- [ ] Screens: S01 Login, S02 Sign-up (role cards), S03 Driver compliance (stepper, uploads), S04 Reset password.
- [ ] **Compliance logic** in `src/lib/compliance.ts`: `Valid / Expiring soon (≤30d) / Expired` + verification badges (AC-1.4) — pure functions, unit-tested with a fixed clock (`vi.setSystemTime`).
- [ ] S10 Driver profile & vehicles (edit resets verification — AC-1.5), S19 Admin queue (AC-1.6).
- [ ] Logout, delete-account flow (FR-1.12) with confirmation copy.

### E2E (Playwright)
- [ ] Parent sign-up → home empty state; driver sign-up → dashboard; login redirects; wrong-password lockout; role-tampering attempt via direct API call; cross-role URL access.

### Definition of Done
All AC-1.x have passing tests; Lighthouse check on `/login` meets PRD G5 budget; first Stitch-derived screens pass visual review at 375 px and 1280 px.

---

## 6. Phase 3 — F2: Routes, Roster & Child Profiles (2 weeks)

**ACs:** AC-2.1 – AC-2.21 · **Screens:** S05 (dashboard shell), S06, S07, S08 (+ learner detail sheet), S14, S14b, S15.

### Backend (RPC bodies + tests first)
- [ ] `regenerate_invite`, `lookup_invite` (rate-limited, uniform error), `redeem_invite` (direction conflict, archived learner check), `get_pending_requests` (minimal fields — AC-2.18), `decide_enrollment` (capacity — AC-2.14).
- [ ] Rate limiter table/function (10 attempts per user per hour) with test for AC-2.15.
- [ ] Views `driver_public_profiles`, `parent_contacts`, `my_routes` (no `invite_code`; AC-2.21).

### Frontend
- [ ] **Driver:** route CRUD (S06/S07), roster screen with invite card (copy + WhatsApp share intent), approve/reject, remove, reorder (`stop_sequence` normalisation function with unit tests — AC-2.5), learner detail sheet with tap-to-call.
- [ ] **Parent:** child form with validation (S14), children list with per-direction enrollment status (S14b), link flow with driver preview + compliance warning (S15), `/join/:code` deep link handling (preserve code through login/sign-up).
- [ ] Empty/loading/error states for every screen (reuse `EmptyState`, `Skeleton`, `ErrorState`).
- [ ] Update `Dashboard` (S05) with route cards and pending-requests chip (Start trip button wired in Phase 4).

### E2E
- [ ] Driver creates route → parent redeems code → driver approves → roster shows child with details.
- [ ] Negative: invalid/deactivated code, direction conflict, capacity full, parent B cannot see parent A's child.

### Definition of Done
AC-2.x green; a seeded pilot-like scenario (1 driver, 8 learners, 2 parents) can be built through the UI in < 10 minutes (supports onboarding target in BUSINESS §6.5).

---

## 7. Phase 4 — F3: Live Trip Execution & Parent Feed (2.5 weeks)

**ACs:** AC-3.1 – AC-3.28 · **Screens:** S05 (Start trip), S09 (check-in), S09b (driver history), S13 (parent live feed), S16 (parent history). **This is the riskiest phase; start with the backend and the offline queue.**

### Backend
- [ ] RPCs: `start_trip` (FR-3.2 a–e), `log_trip_event` (idempotent on client UUID), `void_trip_log`, `send_delay_notice`, `complete_trip(force)`, `cancel_trip`.
- [ ] Exhaustive tests of the state machine (AC-3.15 – AC-3.21, AC-3.26, AC-3.27) including timestamp validation and the 5-minute undo window with a controlled clock.
- [ ] Realtime publication on `trips`, `trip_logs`, `trip_delay_notices`; test N17 with two parent clients.

### Frontend — driver
- [ ] **Check-in state machine helper** (`nextAllowedActions(logs)`) with unit tests; used by UI and by optimistic updates.
- [ ] **Offline queue** (`src/lib/offlineQueue.ts`): IndexedDB store, client-generated UUIDs, ordered flush, exponential backoff (1 s → 30 s), idempotent retry, "Pending sync" chip, failure surface (AC-3.10, AC-3.21). Unit-test with fake IndexedDB and simulated network failures.
- [ ] S09 Active Trip screen: optimistic taps (< 100 ms), per-row error + retry, undo countdown, delay bottom sheet, complete/force-complete dialog, cancel.
- [ ] S05: Start trip with blocked-state reasons (expired compliance, no learners, active trip exists).
- [ ] S09b: paginated driver history.

### Frontend — parent
- [ ] `useLiveStatus` hook: subscribe to Realtime (scoped), merge events into TanStack Query cache, handle voided logs (UPDATE with `voided_at`), fallback to 15 s polling on disconnect, "Last updated" indicator (FR-3.12, AC-3.28).
- [ ] S13 Parent Home with all status states (not started, trip started, picked up, dropped off, absent, no update, cancelled, delay banner, offline/stale).
- [ ] S16 Parent history (20/page, last 90 days).

### E2E (two browser contexts: driver + parent)
- [ ] Start → picked up → parent sees update within 3 s (AC-3.3) → delay notice (AC-3.7) → dropped off → complete.
- [ ] Offline scenario: Playwright `context.setOffline(true)`, tap twice, reconnect, verify sync and no duplicates (AC-3.10).
- [ ] Privacy: parent B's network payloads contain only parent B's learner IDs (AC-3.24).

### Performance task
- [ ] Measure tap-to-parent latency (instrument with timestamps in a test harness; target p95 ≤ 3 s, PRD P2). Record baseline numbers in `docs/perf-notes.md`.

### Definition of Done
AC-3.x green; manual field test on a real mid-range Android over throttled 4G with a real driver-style walkthrough (10 learners, intermittent connectivity).

---

## 8. Phase 5 — F4: Monthly Fee & Payment Ledger (1.5 weeks)

**ACs:** AC-4.1 – AC-4.21 · **Screens:** S11, S12 (+ bulk dialog), S17.

### Backend
- [ ] `generate_monthly_fees` (idempotent via `ON CONFLICT DO NOTHING`; returns counts), `set_fee_status` (transition table, payment field handling).
- [ ] Tests: transitions (AC-4.3, 4.6, 4.11), cents/amount bounds (AC-4.8), duplicates (AC-4.9), due-date rule (AC-4.12), locked fields (AC-4.13), delete rule (AC-4.14), roster check (AC-4.18, AC-4.20), admin blocked (AC-4.19).
- [ ] **Overdue job tests** with controlled time around the SAST midnight boundary (AC-4.4, AC-4.21). Verify pg_cron schedule `0 0 * * *` UTC.

### Frontend
- [ ] Money utilities: rand ↔ cents parsing, `Intl.NumberFormat('en-ZA')` formatting, unit-tested (including rounding and spaces/commas input).
- [ ] S11 ledger: month picker, summary cards (billed/collected/outstanding), filters, quick **Mark paid**, empty states.
- [ ] S12 fee sheet and bulk-generate dialog with preview count and "Created N, skipped M" result.
- [ ] S17 parent fee history: balance card, overdue highlight, outstanding and payment-history lists (AC-4.5).

### E2E
- [ ] Driver bulk-generates fees → marks one paid → parent sees updated balance and history; parent cannot modify (AC-4.15).

### Definition of Done
AC-4.x green; a driver can bill and record a full month for 10 learners in under 5 minutes.

---

## 9. Phase 6 — Hardening & Launch Readiness (1.5 weeks)

### 9.1 Quality gates (PRD §1.4 A)
- [ ] **G1** Turn the AC-traceability script from *warning* to *blocking*; close all gaps.
- [ ] **G3** Coverage ≥ 80% on `src/lib` and RPC wrappers.
- [ ] **G4** E2E suite stable (no flaky tests: run 10× on CI; quarantine policy documented).
- [ ] **G5** Lighthouse CI budgets on `/login`, `/parent/home`, `/driver/trip/:id`; fix bundle-size issues (route-level code splitting, ≤ 200 KB gz initial JS).
- [ ] **G7** Post-deploy smoke test including the RLS-enabled assertion.

### 9.2 Security & privacy
- [ ] Policy review pass (every policy, every `SECURITY DEFINER` function, `search_path`, grants).
- [ ] Dependency audit (`npm audit`), lockfile committed, Dependabot enabled.
- [ ] Security headers (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`) configured at the host.
- [ ] Confirm **no PII in logs/error tracking**: configure Sentry (or equivalent) scrubbing; test with a deliberate error containing a child name.
- [ ] Production Supabase: email confirmation **on**, Auth rate limits set, daily backups/PITR verified, secrets only in GitHub encrypted secrets.
- [ ] **POPIA artefacts** (owner: founder + attorney): privacy notice text, consent copy (S02), Information Officer registration check, ToS with "information tool, not a safety guarantee" wording, data-retention job for trip logs > 12 months (NFR-18), account-deletion verification.

### 9.3 UX & accessibility
- [ ] Axe checks in Playwright on every screen; keyboard-only walkthrough of F1–F4; screen-reader pass on S09 and S13 (`aria-live`).
- [ ] Viewport sweep at 375/768/1280/1440 (NFR-1) for every screen.
- [ ] Copy review for SA English, plain language, error messages (no PII, no account enumeration).

### 9.4 Observability & operations
- [ ] Error tracking (scrubbed), uptime check on the live URL, Supabase log alerts for RLS violations and RPC errors.
- [ ] Runbook `docs/RUNBOOK.md`: deploy, rollback (migration policy: forward-only, write down-scripts for risky changes), restore from backup, rotate keys, incident/breach response checklist.
- [ ] Admin procedures: how to create an admin user, verify documents (SLA), handle account deletion requests.

### 9.5 Production deploy
- [ ] Create production Supabase project; run migrations via CI (`supabase db push`); seed **only** the admin user.
- [ ] Deploy frontend (Vercel/Netlify/Cloudflare Pages) with HTTPS and a custom domain.
- [ ] Final **go/no-go checklist** (below).

### Go / No-Go Checklist
| # | Check | Owner |
|---|---|---|
| 1 | G1–G7 all green on `main` | Eng |
| 2 | RLS negative matrix N1–N17 green against **production schema** | Eng |
| 3 | Privacy notice + ToS published; consent text approved | Founder/Legal |
| 4 | Admin account created; verification SOP written | Ops |
| 5 | Backups verified by a test restore | Eng |
| 6 | Pilot drivers (≥ 5) and their parents identified, onboarding scheduled | Ops |
| 7 | Support channel (WhatsApp/email) live | Ops |
| 8 | Rollback plan rehearsed once | Eng |

---

## 10. Phase 7 — Pilot Launch & Iteration (60 days)

- [ ] **Week 0:** onboard pilot drivers in person (target < 10 min each); each driver invites parents via code.
- [ ] **Weekly cadence:** review PRD P1–P7 metrics, support log, and top 3 friction points; ship fixes in small releases (every PR still gated by CI).
- [ ] **Instrument minimal analytics** (privacy-safe, no PII): trips started, check-in completeness, time-to-check-in, parent feed opens, fee records created. Store as aggregate counts or event names only.
- [ ] **Pricing tests** per BUSINESS §4–5 (outside the product; manual billing).
- [ ] **Day 60 review:** pilot → paid decision; prioritise V1.1 backlog (web push, term billing/pause, subscription flag).

### Backlog parking lot (not V1)
Web push notifications · term-based billing/pause · fee reminders · PDF statements · multi-language UI · payment-gateway integration · GPS/ETA (see PRD §6.6 and BUSINESS §13).

---

## 11. Working Agreements

### Branching & PRs
- Trunk-based: short-lived branches `feat/f3-start-trip`, `fix/…`, merged via PR with squash.
- Each PR lists the **AC IDs** it implements; CI must be green; at least one review (self-review checklist if solo).
- Schema changes = **new migration file only** (never edit applied migrations).

### Definition of Done (every PR)
1. Failing tests were written first for new behaviour; AC IDs in test titles.
2. Lint, typecheck, unit, DB/RLS, and E2E all green.
3. Loading, empty, error (and offline where relevant) states implemented.
4. No new PII in logs; no `service_role` usage in client code.
5. 375 px and 1280 px visually checked against the Stitch design.
6. Docs updated if behaviour differs from the PRD (PRD change in the same PR).

### Stitch → code workflow
1. Generate screens via `STITCH_PROMPTS.md`; export HTML/screenshots to `design/stitch/`.
2. Do **not** paste exported HTML as-is. Rebuild with the shared components and Tailwind tokens (Phase 0), using the export as a visual reference.
3. Any design deviation needed for the PRD (e.g., a missing state) is fixed in code and noted back in the Stitch prompt file.

### Suggested repo ticket structure
One epic per phase; one story per screen/RPC; each story links AC IDs. Labels: `db`, `rls`, `ui`, `e2e`, `a11y`, `perf`, `security`, `docs`.

---

## 12. Milestones & Timeline (1 engineer; shift earlier with 2)

| Week | Milestone |
|---|---|
| 1 | Phase 0 done; Phase 1 migrations + RLS tests underway |
| 2 | **M1:** Database & authorization core complete (N1–N17 green) |
| 3–4 | **M2:** F1 complete — sign-up/login/compliance working end to end on a deployed preview |
| 5–6 | **M3:** F2 complete — driver/parent linking flow demo-able |
| 7–9 | **M4:** F3 complete — live trip demo with two phones; offline test passed |
| 10 | **M5:** F4 complete — full feature set |
| 11–12 | **M6:** Hardening done; go/no-go checklist passed; **production live** |
| 13–20 | Pilot (60 days), weekly iteration |

**With two engineers:** Engineer A (DB/backend + F3/F4 logic) and Engineer B (UI + F1/F2 front end) can run in parallel after Phase 1; F4 backend can start while F3 UI is in progress. Expected calendar: ~7–8 weeks to production.

---

## 13. Risk Register (Delivery)

| # | Risk | Likelihood | Impact | Mitigation | Trigger / Fallback |
|---|---|---|---|---|---|
| D1 | RLS misconfiguration leaks children's data | Low–Med | Severe | DB-first, N1–N17 launch gate, policy review pass, forced RLS | Any failing N-test blocks merge; stop-ship rule |
| D2 | Realtime latency/instability on poor networks | Med | High | Scoped subscriptions, polling fallback, offline queue, field test on throttled 4G | If p95 > 3 s: reduce payload, tune subscriptions, increase polling cadence |
| D3 | Offline queue bugs (dupes, ordering) | Med | High | Client UUID idempotency, unique index on active logs, dedicated unit/E2E tests | Disable queue replay behind a flag and fall back to online-only taps |
| D4 | pg_cron unavailable/misbehaving | Low | Med | Test the job; alternative scheduled Edge Function | Manual SQL run until fixed (documented in RUNBOOK) |
| D5 | Scope creep (GPS, payments, push) | Med | Med | PRD §6.6 enforced in review; parking-lot backlog | Founder sign-off required to add scope |
| D6 | Stitch output diverges from the component system | Med | Low | Use designs as reference only; shared tokens/components | Time-box visual polish per screen |
| D7 | Flaky E2E tests slow delivery | Med | Med | Deterministic seeds, fixed clocks, 10× stability run in Phase 6 | Quarantine with ticket + owner; never ignore silently |
| D8 | Legal/POPIA artefacts late | Med | High | Start attorney engagement in Phase 2; text needed by Phase 6 | Launch gate: no go-live without privacy notice and consent text |
| D9 | Solo-founder bandwidth | Med | Med | Strict vertical slices; cut non-AC polish first | Drop Admin UI to SQL-only verification (PRD S19 deferred) if schedule slips |
| D10 | Supabase plan limits/cost surprises | Low | Low–Med | Monitor usage in pilot; keep standard Postgres portability | Upgrade plan; review BUSINESS A7 |

### Scope-cut order if time runs short (protect safety & core flows first)
1. S19 Admin UI → replace with SQL/dashboard verification procedure.
2. Document uploads (F1 optional part) → defer; keep manual verification by contact.
3. Bulk "Generate monthly fees" UI → keep single-record creation.
4. Desktop polish beyond functional responsiveness (mobile stays complete).
5. **Never cut:** RLS tests, state-machine enforcement, offline check-in queue, compliance-blocks-trip rule, privacy controls.

---

## 14. Immediate Next Steps (first 5 working days)

1. **Day 1:** Create repo, add docs, scaffold app, wire lint/typecheck/test scripts, push — CI green.
2. **Day 2:** `supabase init`, local stack, `0001`–`0002` migrations, first failing RLS tests (N1, N12, N13).
3. **Day 3:** Base component library + Tailwind tokens; Stitch frames for S01/S02/S13/S09.
4. **Day 4–5:** Migrations `0003`–`0006` with tests; seed data; CI `db-tests` job.
5. **Parallel (founder):** book the POPIA attorney consult; identify 5–8 pilot drivers and 2–3 target suburbs.
