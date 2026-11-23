# SafeRide — Product Requirements Document (MVP / V1)

| | |
|---|---|
| **Product** | SafeRide — Neighbourhood Scholar Transport & Safety Platform |
| **Document** | `docs/PRD.md` |
| **Version / Status** | 1.0 — Ready for build |
| **Date** | 2026-11-23 |
| **Market** | South Africa (timezone `Africa/Johannesburg`, currency ZAR, phone `+27`) |
| **Consumers of this doc** | Stitch (UI generation), TDD test authors (Vitest / Playwright / pgTAP), DB migration authors, backend/RLS authors |

**Conventions used in this document**
- **MUST** = required for Day-One MVP and gates launch. Nothing in this PRD is "Should/Could" unless explicitly labelled.
- Requirement IDs: `FR-<feature>.<n>`; acceptance criteria IDs: `AC-<feature>.<n>`. Every AC maps to at least one automated test (see §6.4).
- "Backend-enforced" means enforced by PostgreSQL (RLS, constraints, triggers, RPC) — **never** by client code alone.
- All timestamps are `timestamptz` stored in UTC and rendered in `Africa/Johannesburg` (SAST, UTC+2, no DST). All money is stored as integer **cents** in ZAR.

---

## 1. Product Overview & Success Criteria

### 1.1 Problem Statement
Independent scholar transport operators (kombis/minibuses) and the parents who rely on them coordinate through WhatsApp groups and paper notebooks. This causes:
1. **Safety anxiety:** parents don't know if their child was picked up, dropped off, or if the vehicle is late, and must message the driver while he is driving.
2. **Trust gap:** parents cannot easily see whether a driver's Professional Driving Permit (PDP) and vehicle roadworthy certificate are current.
3. **Money disputes:** monthly fees are tracked in paper notebooks or scattered chat messages, leading to "I already paid" disputes and lost records.
4. **Privacy risk:** children's names, addresses, and medical/allergy information are shared in large group chats.

### 1.2 Value Proposition
| For | SafeRide gives |
|---|---|
| **Parents** | A real-time, per-child status feed (`Picked Up`, `Dropped Off`, `Absent`), delay alerts, visible driver compliance status, and a clear fee balance and payment history. |
| **Drivers** | One-tap check-ins that replace typing in WhatsApp, a roster with each child's emergency contact and allergy information, a professional compliance profile that builds trust, and a monthly fee ledger that replaces the notebook. |

### 1.3 Target Users
- **Driver (Transport Operator):** owner-operator of 1+ vehicles, 4–15 learners per route, often on a mid-range Android phone with intermittent mobile data, typically uses the app while stopped or between stops.
- **Parent (Guardian):** 1–3 children, checks the app on a phone several times a day, expects glanceable status.
- **Admin (SafeRide staff, internal only):** verifies uploaded PDP / roadworthy documents. Not self-registerable.

### 1.3.1 Core Assumptions (change = PRD change)
- A learner may be on **at most one morning route and one afternoon route** at any time.
- Morning route: **pickup = learner's home address, drop-off = school**. Afternoon route: **pickup = school, drop-off = home**.
- A parent can only link a child to a route via a driver-issued **invite code**, and the driver must **approve** the request (anti-leak safety control).
- Check-ins are manual taps by the driver. There is **no GPS tracking** in V1.

### 1.4 MVP Launch Criteria (measurable)

**A. Pre-launch quality gates (all MUST pass before go-live)**
| # | Gate | Threshold |
|---|---|---|
| G1 | Acceptance criteria in §3 covered by automated tests | 100% of ACs have ≥1 passing test |
| G2 | RLS / authorization test suite (pgTAP or Vitest against local Supabase) | 100% pass; **zero** cross-tenant reads/writes in the negative test matrix (§2.4) |
| G3 | Unit/integration coverage on business logic (`/src/lib`, RPC wrappers) | ≥ 80% line coverage |
| G4 | Playwright E2E happy paths: F1–F4 at 375px and 1280px | 100% pass in CI |
| G5 | Lighthouse (mobile, Slow 4G, mid-tier CPU) on `/login`, `/parent/home`, `/driver/trip/:id` | Performance ≥ 85, Accessibility ≥ 90 |
| G6 | GitHub Actions CI on `main` | Green: lint, typecheck, unit, RLS tests, E2E, build, deploy |
| G7 | Live deployment reachable over HTTPS with production Supabase project, RLS enabled on **every** table | Verified by automated check (`select count(*) from pg_tables where schemaname='public' and rowsecurity=false` = 0) |

**B. Pilot success targets (first 30 days after launch, ≥ 5 drivers and ≥ 30 learners)**
| # | Metric | Target |
|---|---|---|
| P1 | Trips with a check-in logged for **every** enrolled learner (`Picked Up`/`Dropped Off`/`Absent`) | ≥ 80% of started trips |
| P2 | Check-in propagation latency (driver tap → parent UI update), p95, on 4G | ≤ 3 s (online); ≤ 10 s after reconnect for offline-queued taps |
| P3 | Driver effort | Start trip ≤ 3 taps from dashboard; each check-in ≤ 2 taps |
| P4 | Parent engagement | ≥ 70% of linked parents open the status feed on ≥ 3 school days per week |
| P5 | Fee ledger adoption | ≥ 60% of pilot drivers log fee records for all their learners for ≥ 1 full month |
| P6 | Compliance profile completeness | 100% of active drivers have PDP expiry + vehicle registration + roadworthy expiry on file; ≥ 80% have documents verified by Admin |
| P7 | Reliability | ≥ 99.5% successful check-in writes; zero Sev-1 privacy incidents |

---

## 2. User Roles & Backend Permissions Matrix (RBAC)

### 2.1 Roles
| Role | How obtained | Description |
|---|---|---|
| `driver` | Self sign-up (role selected at sign-up, immutable afterwards) | Transport operator. Owns vehicles, routes, trips, trip logs, and fee records. |
| `parent` | Self sign-up (role selected at sign-up, immutable afterwards) | Guardian. Owns learner profiles. Read-only view of trips, logs, and fees linked to their own children. |
| `admin` | Provisioned manually by SafeRide (SQL / dashboard). **Cannot** be chosen at sign-up. | Verifies compliance documents only. **No access to learners, trips, trip logs, or fee records** (data minimisation). |

### 2.2 Authorization Principles (backend-enforced)
1. **Deny by default.** RLS is `ENABLE`d and `FORCE`d on every table in `public`. No policy = no access. The `anon` role has **no** privileges on any table.
2. **Identity comes from `auth.uid()`**, never from a client-supplied `driver_id`/`parent_id`. Insert policies use `WITH CHECK (<owner_col> = auth.uid())`; a mismatched owner returns an RLS violation (HTTP 403 / Postgres `42501`).
3. **Role is stored in `profiles.role`** and is immutable after creation (trigger `prevent_role_change`). Role checks use `public.app_role()` (SECURITY DEFINER) — **not** JWT user-metadata that the user can edit.
4. **Relationship-based access:** a Driver's access to a learner exists **only** while an enrollment with `status='active'` links that learner to one of the driver's routes. A Parent's access to trips/logs/fees exists **only** through learners where `learners.parent_id = auth.uid()`.
5. **Privacy between families:** a Parent must never receive another family's learner IDs, names, logs, or fees — even from the same trip. Parent queries on `trip_logs` are row-filtered to their own learners by RLS, not by the client.
6. **Sensitive-column protection:** `profiles.role`, `*_verification`, `trips.driver_id`, `fee_records.driver_id`, etc. cannot be modified by the end user (column-level `GRANT UPDATE` lists + triggers).
7. **Service-role key is never shipped to the browser.** Admin actions run under an authenticated `admin` role, not the service key.

### 2.3 CRUD Permission Matrix
Legend: **C**=Create, **R**=Read, **U**=Update, **D**=Delete, **—**=no access. "own" = `owner_col = auth.uid()`.

| Resource | Parent | Driver | Admin | Backend enforcement notes |
|---|---|---|---|---|
| **`profiles`** | **C:** — (created by auth trigger at sign-up only). **R:** own row; read-only *limited columns* of drivers linked via an enrollment (any status) through view `driver_public_profiles` (`full_name, phone_e164, business_name, service_suburbs, pdp_expiry_date, pdp_verification`, vehicle summary). **U:** own (`full_name`, `phone_e164`). **D:** own (account-deletion RPC). | **C:** —. **R:** own row; limited columns of parents with ≥1 *active* enrollment on the driver's routes via view `parent_contacts` (`full_name, phone_e164` only). **U:** own (`full_name, phone_e164, business_name, pdp_number, pdp_expiry_date, pdp_document_path, service_suburbs`). **D:** own (account-deletion RPC). | **C:** —. **R:** driver rows (all columns, for verification). **U:** `pdp_verification` only (on drivers). **D:** — | Base-table SELECT limited to own row (+ admin → drivers). Cross-user reads go through views/RPCs exposing only listed columns. `role` immutable. Driver editing `pdp_number`/`pdp_expiry_date`/`pdp_document_path` auto-resets `pdp_verification` to `unverified` (trigger). Phone numbers of parents are never visible to other parents. |
| **`vehicles`** | **R:** vehicles of drivers linked via enrollment (any status), via view `driver_public_profiles`. **C/U/D:** — | **C:** own (`driver_id = auth.uid()`). **R:** own. **U:** own (editing `registration_number`/`roadworthy_expiry_date`/`roadworthy_document_path` resets `roadworthy_verification` to `unverified`). **D:** own, **only if** no route references it (FK `ON DELETE RESTRICT`); otherwise soft-deactivate (`is_active=false`). | **R:** all. **U:** `roadworthy_verification` only. **C/D:** — | `registration_number` globally unique (normalised upper-case, no spaces/hyphens). Driver cannot write `roadworthy_verification`. |
| **`routes`** | **R:** routes where the parent has an enrollment (any status) for one of their learners, via view exposing `name, direction, departure_time, days_of_week, driver`. **C/U/D:** — | **C:** own. **R:** own. **U:** own (incl. regenerate/deactivate invite code). **D:** own, **only if** no trips exist; otherwise `is_active=false`. | — | `vehicle_id` must belong to the same driver (composite FK `(vehicle_id, driver_id)`). `invite_code` is **never** returned to parents or other drivers. A parent can look up a route **only** via the `redeem_invite` RPC. |
| **`learners`** | **C:** own (`parent_id = auth.uid()`). **R:** own. **U:** own. **D:** own (archive = `is_active=false`; hard delete only via account deletion). | **C:** —. **R:** only learners with an **active** enrollment on one of the driver's routes (all columns incl. medical/allergy notes, emergency contact). **U/D:** — | **—** (explicitly no access) | `parent_id` immutable. Driver loses access immediately when an enrollment is removed/rejected or the learner is archived. |
| **`route_enrollments`** | **C:** via `redeem_invite` RPC only (creates `pending`) for own learner. **R:** rows for own learners. **U:** — (cannot approve). **D:** may *cancel* own `pending` request or *leave* (sets `status='removed'`) via RPC. | **C:** —. **R:** rows for own routes. **U:** own routes — `status` (`pending→active/removed`, `active→removed`) and `stop_sequence`. **D:** — (use `removed`). | — | Unique active/pending enrollment per `(learner, direction)`. Capacity check: active enrollments ≤ `vehicle.seating_capacity − 1`. State machine enforced by trigger. |
| **`trips`** | **R:** trips of routes on which the parent has an **active** enrollment for ≥1 of their learners. **C/U/D:** — | **C:** own, via `start_trip` RPC (blocked if PDP/roadworthy expired). **R:** own. **U:** own — only `status` transitions `active→completed/cancelled` via `complete_trip`/`cancel_trip` RPC. **D:** — | — | One `active` trip per driver (partial unique index). One `active`/`completed` trip per `(route, trip_date)`. Completed/cancelled trips are immutable. |
| **`trip_logs`** | **R:** only rows where `learner_id` ∈ own learners. **C/U/D:** — | **C:** own trips that are `active`, for learners with an active enrollment on that trip's route. **R:** own trips (all learners on the trip). **U:** only to *void* (`voided_at`) a log ≤ 5 min old while trip is `active`. **D:** — (append-only; use void). | — | State machine trigger: `dropped_off` requires prior non-voided `picked_up`; `absent` is mutually exclusive with `picked_up`/`dropped_off`. `logged_by = auth.uid()`. Logs on non-active trips rejected. |
| **`trip_delay_notices`** *(supporting)* | **R:** notices for trips they can read (active enrollment of own learner). **C/U/D:** — | **C:** own active trips (max 5 per trip). **R:** own. **U/D:** — | — | Append-only. |
| **`fee_records`** | **R:** only rows where `learner_id` ∈ own learners. **C/U/D:** — | **C:** own (`driver_id = auth.uid()`) for learners with an active enrollment on one of the driver's routes. **R:** own. **U:** own — `status`, `paid_at`, `payment_method`, `payment_reference`, `note`, `due_date`; `amount_cents` only while `status='pending'`. **D:** own, only while `status='pending'` and never paid. | — | Unique `(driver_id, learner_id, billing_month)`. `paid_at` set ⇔ `status='paid'` (CHECK). Allowed transitions enforced by trigger (§F4). `driver_id`/`learner_id`/`billing_month` immutable. |

### 2.4 Mandatory Negative Authorization Test Matrix (G2)
Each row must exist as an automated test (pgTAP or Vitest against a local Supabase with seeded users: `parentA`, `parentB`, `driverA`, `driverB`, `admin`, and an unauthenticated client).

| # | Actor | Attempt | Expected |
|---|---|---|---|
| N1 | anon | SELECT/INSERT on every table | Permission denied / 0 rows |
| N2 | parentA | SELECT `learners` of parentB | 0 rows |
| N3 | parentA | UPDATE/DELETE learner of parentB | 0 rows affected |
| N4 | parentA | INSERT learner with `parent_id = parentB.id` | RLS violation |
| N5 | parentA | SELECT `trip_logs` of a learner belonging to parentB on the same trip | 0 rows |
| N6 | parentA | INSERT/UPDATE/DELETE on `trips`, `trip_logs`, `routes`, `vehicles`, `fee_records` | RLS violation / 0 rows |
| N7 | parentA (child **pending**, not approved) | SELECT `trips`/`trip_logs` for that route | 0 rows |
| N8 | driverA | SELECT `learners` not enrolled on driverA's routes (incl. enrolled with driverB, or only `pending`) | 0 rows |
| N9 | driverA | INSERT `trip_logs` for a trip owned by driverB | RLS violation |
| N10 | driverA | INSERT `fee_records` for a learner not on driverA's roster | Rejected |
| N11 | driverA | SELECT `fee_records`/`routes`/`vehicles` of driverB | 0 rows |
| N12 | driverA | UPDATE own `profiles.role` or `pdp_verification` | Rejected |
| N13 | any user | Sign-up with `role='admin'` | Rejected; no profile created |
| N14 | parentA / driverA | SELECT `routes.invite_code` of any route not owned (driver) / any route (parent) | Column not accessible |
| N15 | admin | SELECT `learners`, `trips`, `trip_logs`, `fee_records` | 0 rows |
| N16 | driverA | UPDATE/INSERT `trip_logs` on a `completed` trip | Rejected |
| N17 | Realtime | parentA subscribes to `trip_logs` changes | Receives events **only** for own learners |

---

## 3. Core User Flows & Day-One "Must" Features

### 3.0 Global Flow Overview
```
Parent:  Sign up → Add child profile → Enter driver invite code → (driver approves) → Live status feed → Fee history
Driver:  Sign up + compliance profile → Create route → Share invite code → Approve learners → Start trip → Check-ins → Complete trip → Monthly fees
Admin:   Review verification queue → Verify / Reject PDP & roadworthy documents
```

---

### F1: Role-Based Auth & Driver Compliance Profile

**Goal:** Secure sign-up/login with role selection; drivers capture compliance data that parents can see.

#### Functional Requirements
- **FR-1.1** Email + password authentication via Supabase Auth. Password ≥ 8 chars with at least 1 letter and 1 number. Email confirmation required before first login (disabled only in the CI/E2E environment).
- **FR-1.2** Sign-up form collects: `role` (radio: *I'm a Parent* / *I'm a Driver*), `full_name` (2–100 chars), `email`, `phone` (South African mobile, input normalised to E.164 `+27XXXXXXXXX`; leading `0` converted), `password`, and a **mandatory POPIA consent checkbox** (stores `consent_accepted_at`).
- **FR-1.3** If role = Driver, the form continues to **Driver Compliance Onboarding**, collecting:
  - `pdp_number` (required, 4–20 alphanumeric)
  - `pdp_expiry_date` (required, **today or later**)
  - `service_suburbs` (required, 1–10 free-text suburb tags, 2–60 chars each)
  - Vehicle: `registration_number` (required; normalised uppercase, spaces/hyphens stripped; regex `^[A-Z0-9]{4,10}$`), `make_model` (required), `seating_capacity` (4–35), `roadworthy_expiry_date` (required, today or later)
  - Optional uploads: PDP document and roadworthy certificate (JPEG/PNG/PDF, ≤ 5 MB each, private Storage bucket `compliance-docs`, path `{driver_id}/...`).
  - Profile + vehicle creation happens in **one transaction** (RPC `register_driver_profile`).
- **FR-1.4** Role is set once at sign-up and is **immutable**. Sign-up with role `admin` (or any value other than `driver`/`parent`) is rejected server-side.
- **FR-1.5** Post-login redirect: Parent → `/parent/home`; Driver → `/driver/dashboard`; Admin → `/admin/verifications`. Route guards on the client are UX only; every data call is authorized by RLS.
- **FR-1.6** **Compliance status badge** is computed (never stored) for PDP and roadworthy: `Valid` (expiry > today + 30 days), `Expiring soon` (today ≤ expiry ≤ today + 30 days), `Expired` (expiry < today). Plus verification: `Unverified`, `Pending review`, `Verified`, `Rejected`.
- **FR-1.7** Parents see the compliance summary of a driver (name, phone, vehicle reg + make/model, PDP & roadworthy status/expiry/verification) before confirming a route link (F2) and on their feed header.
- **FR-1.8** Drivers can edit compliance details. Changing `pdp_number`/`pdp_expiry_date`/PDP document, or vehicle `registration_number`/`roadworthy_expiry_date`/roadworthy document, resets the relevant verification to `unverified`.
- **FR-1.9** Admin sees a queue of drivers/vehicles with `pending`/`unverified` documents and can set `Verified` or `Rejected` (with optional reason ≤ 200 chars). Admin cannot edit driver data.
- **FR-1.10** Rate limiting: 5 failed logins per email per 15 minutes → temporary lockout message (Supabase Auth rate limit + UI handling). Error messages never reveal whether an email exists.
- **FR-1.11** Session persists 7 days (refresh token); explicit **Log out** clears session.
- **FR-1.12** Account deletion (Settings): confirms, then permanently deletes the profile and all owned data (cascade), with a warning describing what is deleted.

#### Acceptance Criteria (Given / When / Then)

**Happy paths**
- **AC-1.1 Parent sign-up** — *Given* an unauthenticated visitor on `/signup`, *When* they select "Parent", enter a valid name, email, SA phone `082 123 4567`, password `Passw0rdA`, tick the POPIA checkbox and submit, *Then* an `auth.users` row and a `profiles` row with `role='parent'`, `phone_e164='+27821234567'` and non-null `consent_accepted_at` exist, and the user is redirected to `/parent/home` showing the empty state.
- **AC-1.2 Driver sign-up with compliance** — *Given* an unauthenticated visitor, *When* they select "Driver", complete step 1 and step 2 with valid PDP number, future PDP expiry, ≥ 1 service suburb, a valid vehicle registration `CA 123-456`, seating capacity 15 and a future roadworthy expiry, *Then* a `profiles` row (`role='driver'`, `pdp_verification='unverified'`) and a `vehicles` row (`registration_number='CA123456'`, `roadworthy_verification='unverified'`) are created atomically and the driver lands on `/driver/dashboard`.
- **AC-1.3 Login & role redirect** — *Given* an existing parent and an existing driver, *When* each logs in with valid credentials, *Then* the parent lands on `/parent/home` and the driver on `/driver/dashboard`.
- **AC-1.4 Compliance badges** — *Given* a driver with PDP expiry in 10 days and roadworthy expiry in 200 days, *When* a linked parent (or the driver) views the profile, *Then* PDP shows `Expiring soon` and roadworthy shows `Valid`; *and Given* an expiry date earlier than today, *Then* the badge shows `Expired`.
- **AC-1.5 Editing resets verification** — *Given* a driver whose `pdp_verification='verified'`, *When* they change `pdp_expiry_date`, *Then* `pdp_verification` becomes `unverified` and the parent-facing badge no longer shows "Verified".
- **AC-1.6 Admin verification** — *Given* an admin on `/admin/verifications`, *When* they mark a driver's PDP `Verified`, *Then* `profiles.pdp_verification='verified'` and linked parents see the "Verified" badge on next load/refresh.
- **AC-1.7 Log out** — *Given* a logged-in user, *When* they tap Log out, *Then* the session is cleared, and navigating to a protected route redirects to `/login`.

**Validation errors**
- **AC-1.8 Password rules** — *Given* the sign-up form, *When* the password is `abc123` (6 chars), *Then* submit is blocked with "Password must be at least 8 characters and include a letter and a number" and no account is created.
- **AC-1.9 Phone validation** — *Given* the sign-up form, *When* phone is `12345`, *Then* an inline error "Enter a valid South African mobile number" appears and submit is blocked.
- **AC-1.10 Missing POPIA consent** — *Given* all other fields valid, *When* the consent box is unticked and the user submits, *Then* submit is blocked with "You must accept the privacy notice to continue".
- **AC-1.11 Expired PDP at registration** — *Given* the driver form, *When* `pdp_expiry_date` is earlier than today, *Then* the error "Your PDP has expired. Renew it before registering." is shown and no profile is created.
- **AC-1.12 Duplicate email** — *Given* an existing account for `a@b.co`, *When* someone signs up with `a@b.co`, *Then* the form shows "An account with this email already exists. Log in instead." and no second profile is created.
- **AC-1.13 Duplicate/invalid vehicle registration** — *Given* vehicle `CA123456` already exists, *When* another driver registers `ca 123-456`, *Then* the request fails with HTTP 409 / error "This registration number is already registered"; *and When* registration is `!!`, *Then* a format error is shown.
- **AC-1.14 Invalid login** — *Given* a valid email, *When* the wrong password is entered, *Then* the generic error "Incorrect email or password" is shown; *and When* this occurs 5 times in 15 minutes, *Then* the user sees "Too many attempts. Try again in 15 minutes."

**Unauthorized access / edge cases**
- **AC-1.15 Role tampering at sign-up** — *Given* a crafted request with `role='admin'`, *When* it is sent to the sign-up endpoint/RPC, *Then* it is rejected (400/403) and no `auth.users` or `profiles` row is created. (N13)
- **AC-1.16 Role immutability** — *Given* a logged-in parent, *When* they attempt `UPDATE profiles SET role='driver'` via the API, *Then* the update is rejected and `role` is unchanged. (N12)
- **AC-1.17 Cross-role route guard** — *Given* a logged-in parent, *When* they navigate to `/driver/dashboard`, *Then* they are redirected to `/parent/home`; *and When* they call driver-only RPCs/tables directly, *Then* the backend returns 403 / 0 rows.
- **AC-1.18 Verification field protection** — *Given* a logged-in driver, *When* they attempt to `UPDATE profiles SET pdp_verification='verified'`, *Then* the update is rejected. (N12)
- **AC-1.19 Unauthenticated access** — *Given* no session, *When* any `/parent/*`, `/driver/*`, or `/admin/*` route is opened, *Then* the user is redirected to `/login` and no data requests succeed. (N1)
- **AC-1.20 Document upload limits** — *Given* the upload field, *When* a 7 MB file or a `.exe` is chosen, *Then* it is rejected client-side **and** by Storage policy (size/MIME), and one driver cannot read another driver's `compliance-docs/{driver_id}/...` objects (admin can).

---

### F2: Route & Learner Roster Management

**Goal:** Drivers define routes and control who is on them; parents create child profiles and link them to a driver's route using an invite code.

#### Functional Requirements
**Driver — routes**
- **FR-2.1** Driver creates a route with: `name` (2–60 chars), `direction` (`morning` | `afternoon`), `vehicle_id` (must be the driver's own active vehicle), `departure_time` (HH:MM, 24h), `days_of_week` (≥ 1 of Mon–Sun; default Mon–Fri).
- **FR-2.2** On creation the system generates an **8-character invite code** (alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no `0/O/1/I`), globally unique, with a shareable link `https://<app>/join/<CODE>` (WhatsApp share intent button + copy button).
- **FR-2.3** Driver can **regenerate** (old code instantly invalid) or **deactivate/reactivate** the invite code. Deactivated codes cannot be redeemed.
- **FR-2.4** Driver can edit/deactivate a route. A route with trips cannot be hard-deleted.
- **FR-2.5** Roster view per route shows enrollments grouped as **Pending requests** and **Active learners** (ordered by `stop_sequence`). Driver can Approve / Reject pending, Remove active, and reorder `stop_sequence` (move up/down; numeric, 1..n).
- **FR-2.6** Driver sees for each active learner: name, grade, school, home address, school address, emergency contact (name, relationship, phone — tap-to-call), medical/allergy notes (visually flagged if present), parent name + phone (tap-to-call).
- **FR-2.7** Capacity rule: active enrollments on a route ≤ `vehicle.seating_capacity − 1`. Approving beyond capacity is rejected.

**Parent — child profiles & linking**
- **FR-2.8** Parent creates a child profile with: `full_name` (2–100), `school_name` (required, 2–100), `grade` (Grade R, 1–12), `home_address` (required, 5–250; morning pickup / afternoon drop-off), `school_address` (required, 5–250; morning drop-off / afternoon pickup), `emergency_contact_name`, `emergency_contact_relationship`, `emergency_contact_phone` (E.164; **must differ from nothing else—may equal parent phone but UI warns**), optional `medical_notes` (≤ 1000) and `allergy_notes` (≤ 1000).
- **FR-2.9** Parent can edit or archive a child. Archiving sets `is_active=false` and sets any `pending`/`active` enrollments to `removed`.
- **FR-2.10** Parent enters an invite code (or opens `/join/<CODE>`), selects which child, and sees a **driver preview** (name, vehicle, PDP/roadworthy status, route name, direction, departure time) **before** confirming. Confirming creates an enrollment with `status='pending'` via RPC `redeem_invite(code, learner_id)`.
- **FR-2.11** One active-or-pending enrollment per `(learner, direction)`. A learner can have one morning route and one afternoon route.
- **FR-2.12** Parent sees enrollment status per child per direction: `Pending approval`, `Active`, `Removed`. Parent can cancel a pending request or leave an active route.
- **FR-2.13** Invite redemption is rate-limited: 10 attempts per user per hour; error messages for invalid, deactivated, or non-existent codes are **identical** ("This code isn't valid") to prevent enumeration.
- **FR-2.14** Medical/allergy and address fields are visible **only** to the owning parent and to drivers with an *active* enrollment (§2.3).

#### Acceptance Criteria

**Happy paths**
- **AC-2.1 Create route** — *Given* a logged-in driver with one vehicle, *When* they create a route "Sandton Morning Run", direction `morning`, departure `06:30`, days Mon–Fri, *Then* a `routes` row with `driver_id = auth.uid()` and a unique 8-char `invite_code` is created and the route detail shows the code and share link.
- **AC-2.2 Add child profile** — *Given* a logged-in parent, *When* they submit all required child fields (incl. allergy note "Peanuts"), *Then* a `learners` row with `parent_id = auth.uid()` is created and appears on `/parent/home`.
- **AC-2.3 Redeem invite** — *Given* a parent with child "Thabo" and a valid, active code, *When* they enter the code, review the driver preview, select Thabo and confirm, *Then* a `route_enrollments` row with `status='pending'` and the route's `direction` is created and the parent sees "Pending approval".
- **AC-2.4 Driver approval** — *Given* a pending enrollment on driver A's route, *When* driver A taps Approve, *Then* `status='active'`, `decided_at` is set, the learner appears in the Active roster with full details, and the parent's child card shows "Active".
- **AC-2.5 Reorder stops** — *Given* an active roster of 5 learners, *When* the driver moves learner 4 to position 2, *Then* `stop_sequence` values are re-saved consistently (1..5, no duplicates) and the Active Trip view uses the new order.
- **AC-2.6 Regenerate code** — *Given* a route with code `ABCD2345`, *When* the driver taps Regenerate, *Then* a new code is shown and redeeming `ABCD2345` fails with "This code isn't valid".
- **AC-2.7 Afternoon route** — *Given* Thabo is active on a morning route, *When* the parent links him to a different driver's afternoon route, *Then* a second enrollment (direction `afternoon`) is created (pending).
- **AC-2.8 Archive child** — *Given* Thabo has an active enrollment, *When* the parent archives him, *Then* `is_active=false`, the enrollment becomes `removed`, and the driver's roster no longer shows him.

**Validation errors**
- **AC-2.9 Route validation** — *Given* the route form, *When* name is empty, no day is selected, or `departure_time` is missing, *Then* inline errors are shown and nothing is saved.
- **AC-2.10 Vehicle ownership** — *Given* driver A, *When* they send a request creating a route with `vehicle_id` belonging to driver B, *Then* the request is rejected (composite FK / RLS).
- **AC-2.11 Child form validation** — *Given* the child form, *When* `school_name`, `home_address`, or emergency phone is missing/invalid, *Then* inline errors are shown and nothing is saved.
- **AC-2.12 Invalid code** — *Given* a parent, *When* they enter `ZZZZ9999` (non-existent) or a deactivated code, *Then* the identical message "This code isn't valid" is shown; no enrollment is created.
- **AC-2.13 Direction conflict** — *Given* Thabo already has a `pending`/`active` morning enrollment, *When* the parent redeems another morning route's code for Thabo, *Then* the request fails with "Thabo is already linked to a morning route. Leave it first."
- **AC-2.14 Capacity** — *Given* a route on a vehicle with seating capacity 5 and 4 active learners, *When* the driver approves a 5th, *Then* approval fails with "Route is full" and the status stays `pending`.
- **AC-2.15 Rate limit** — *Given* a parent who has made 10 failed redemptions in the last hour, *When* they try an 11th, *Then* they see "Too many attempts. Try again later." (regardless of code validity).

**Unauthorized access / edge cases**
- **AC-2.16 Learner isolation** — *Given* parent A and parent B, *When* parent A requests parent B's learner (by ID or list query), *Then* 0 rows are returned; update/delete affect 0 rows. (N2–N4)
- **AC-2.17 Roster isolation** — *Given* drivers A and B, *When* driver B queries driver A's route, enrollments, or learners, *Then* 0 rows are returned. (N8, N11)
- **AC-2.18 Pending learner privacy** — *Given* a **pending** (not approved) enrollment, *When* the driver queries `learners` for that child, *Then* only the minimal fields required to decide (child first name, grade, school, parent name) are exposed via RPC `get_pending_requests`; address, medical/allergy and emergency details are **not** returned until approval. (N8)
- **AC-2.19 Parent cannot manage routes** — *Given* a parent, *When* they attempt to INSERT/UPDATE `routes` or approve an enrollment, *Then* the backend rejects it (RLS). (N6)
- **AC-2.20 Access revoked on removal** — *Given* an active learner, *When* the driver removes the enrollment, *Then* the driver immediately loses SELECT access to that learner's row, and the parent loses access to future trips/logs for that route.
- **AC-2.21 Invite code confidentiality** — *Given* any parent or other driver, *When* they query `routes`, *Then* `invite_code` is never returned. (N14)

---

### F3: Live Trip Execution & Parent Status Feed

**Goal:** Drivers run a trip and record each learner's status with one tap; parents see updates in real time and can review history.

#### Functional Requirements
**Driver**
- **FR-3.1** Dashboard lists **Today's routes** (routes whose `days_of_week` include today, ordered by `departure_time`) with a **Start trip** button. Any of the driver's active routes can also be started off-schedule (with a confirmation if today isn't a scheduled day).
- **FR-3.2** `start_trip(route_id)` RPC creates a `trips` row (`status='active'`, `started_at=now()`, `trip_date` = today in SAST). It is **rejected** when: (a) PDP or roadworthy expiry is earlier than today, (b) the route has zero active learners, (c) the driver already has an active trip, (d) the route already has an `active`/`completed` trip for today, (e) the route belongs to another driver.
- **FR-3.3** **Active Trip Check-In view** lists active learners in `stop_sequence` order. Per learner, large tap targets (≥ 48×48 px): **Picked Up**, **Dropped Off**, **Absent**. Button availability follows the state machine:
  - No log → `Picked Up` and `Absent` enabled; `Dropped Off` disabled.
  - `picked_up` → `Dropped Off` enabled; `Picked Up`/`Absent` disabled.
  - `dropped_off` or `absent` → terminal (shows status + time); **Undo** available for 5 minutes.
- **FR-3.4** Each log stores `status`, `logged_at` (timestamp), `logged_by`. The UI shows the time next to each status (e.g., "Picked up 06:42").
- **FR-3.5** **Undo:** a log can be voided (soft) within 5 minutes of `logged_at` while the trip is active; voiding restores the previous state.
- **FR-3.6** **Quick delay broadcast:** driver chooses minutes (`5,10,15,20,30,45,60`) and a reason (`Traffic`, `Vehicle issue`, `Weather`, `School delay`, `Other`) with optional message (≤ 140 chars); creates a `trip_delay_notices` row. Max 5 per trip.
- **FR-3.7** `complete_trip(trip_id)`: sets `status='completed'`, `completed_at`. If any learner is `picked_up` but not `dropped_off`, completion is **blocked** with "N learners are still on board" unless the driver explicitly confirms **Force complete** (sets `completed_with_open_learners=true`). Learners with no log are shown to parents as "No update".
- **FR-3.8** `cancel_trip(trip_id)` (e.g., started by mistake) sets `status='cancelled'` and notifies parents "Trip cancelled". A cancelled trip can be restarted the same day.
- **FR-3.9** **Offline resilience:** check-in taps made offline are queued locally (IndexedDB) with a client-generated `id` (UUID) and `logged_at`; UI shows a "Pending sync" chip; queue flushes in order on reconnect; operations are **idempotent** on `id`. Server rejects `logged_at` in the future by > 60 s or before `trip.started_at`.
- **FR-3.10** Driver can view **trip history** (last 90 days, paginated 20/page) with per-learner statuses.

**Parent**
- **FR-3.11** Parent Home shows, per child, a **status card**: current state for today's trips (`Not started`, `Trip started`, `Picked Up hh:mm`, `Dropped Off hh:mm`, `Absent`, `No update`), route name/direction, driver name, and the latest **delay banner** (e.g., "Running 15 min late — Traffic").
- **FR-3.12** Updates arrive via **Supabase Realtime** subscriptions (`trips`, `trip_logs`, `trip_delay_notices`) with automatic fallback to polling every 15 s on disconnect. A "Last updated hh:mm:ss" indicator is shown; reconnect re-syncs.
- **FR-3.13** Parent **Trip History** per child: last 90 days, paginated 20/page, grouped by date, showing morning and afternoon trips with each status and time. Voided logs are not shown as events.
- **FR-3.14** Parents never see other learners' names/statuses (§2.2 #5). Delay notices and trip start/cancel/complete events are route-level and contain no other learner info.

#### Acceptance Criteria

**Happy paths**
- **AC-3.1 Start trip** — *Given* a driver with valid PDP & roadworthy and a route with 3 active learners, *When* they tap Start trip, *Then* a trip with `status='active'`, `started_at` ≈ now and `trip_date` = today (SAST) is created, and they land on the Check-In view with 3 learners.
- **AC-3.2 Picked Up** — *Given* an active trip and learner Thabo with no log, *When* the driver taps **Picked Up**, *Then* a `trip_logs` row (`status='picked_up'`, `logged_by=driver`, `logged_at` ≈ now) is created, the row shows "Picked up hh:mm" and `Dropped Off` becomes enabled.
- **AC-3.3 Realtime to parent** — *Given* Thabo's parent has `/parent/home` open on a stable connection, *When* the driver taps **Picked Up**, *Then* the parent's card updates to "Picked Up hh:mm" within 3 s (p95) without refresh.
- **AC-3.4 Dropped Off** — *Given* Thabo is `picked_up`, *When* the driver taps **Dropped Off**, *Then* a `dropped_off` log is created, Thabo's row shows a terminal state, and the parent card updates.
- **AC-3.5 Absent** — *Given* learner Lerato has no log, *When* the driver taps **Absent**, *Then* an `absent` log is created and the parent sees "Absent".
- **AC-3.6 Undo within window** — *Given* a `picked_up` log created 2 minutes ago, *When* the driver taps Undo, *Then* the log's `voided_at` is set, the learner returns to "No log", and the parent card reverts to "Trip started".
- **AC-3.7 Delay notice** — *Given* an active trip, *When* the driver selects 15 min + Traffic and sends, *Then* a `trip_delay_notices` row is created and every parent with an active enrollment on the route sees "Running 15 min late — Traffic" within 3 s.
- **AC-3.8 Complete trip** — *Given* all learners are `dropped_off` or `absent`, *When* the driver taps Complete trip, *Then* `status='completed'`, `completed_at` is set, and the trip appears in both driver and parent history.
- **AC-3.9 Parent history** — *Given* 25 completed trips for Thabo, *When* the parent opens History, *Then* page 1 shows 20 entries with statuses/times, and "Load more" shows the remaining 5.
- **AC-3.10 Offline queue** — *Given* the driver is offline mid-trip, *When* they tap **Picked Up** for two learners, *Then* both rows show "Pending sync"; *When* connectivity returns, *Then* both logs are created in order, the chips clear, and parents see them within 10 s. Re-sending the same queued `id` creates no duplicate.

**Validation errors / state-machine**
- **AC-3.11 Expired compliance blocks start** — *Given* a driver whose PDP expiry is yesterday (or roadworthy expired), *When* they call Start trip, *Then* it is rejected with "Your PDP/roadworthy has expired. Update your compliance profile to start trips." and no trip is created.
- **AC-3.12 No learners** — *Given* a route with 0 active learners, *When* Start trip is called, *Then* it is rejected with "Add at least one approved learner before starting a trip."
- **AC-3.13 Single active trip** — *Given* the driver has an active trip, *When* they try to start another, *Then* it is rejected with "Finish your current trip first."
- **AC-3.14 Duplicate daily trip** — *Given* a completed trip exists for route R today, *When* Start trip is called for R again, *Then* it is rejected "A trip for this route already ran today."
- **AC-3.15 Dropped Off before Picked Up** — *Given* a learner with no `picked_up` log, *When* a `dropped_off` log is submitted (UI or API), *Then* the backend rejects it with a state error and no row is created.
- **AC-3.16 Mutual exclusivity** — *Given* a learner is `absent`, *When* `picked_up` is submitted (or vice versa after `picked_up`), *Then* it is rejected.
- **AC-3.17 Idempotent double-tap** — *Given* Thabo is `picked_up`, *When* `picked_up` is submitted again (double-tap/retry), *Then* no second non-voided row is created and the response is a success/no-op.
- **AC-3.18 Undo window expired** — *Given* a log created 6 minutes ago, *When* Undo is requested, *Then* it is rejected "Undo is only available for 5 minutes."
- **AC-3.19 Complete with children on board** — *Given* Thabo is `picked_up` but not `dropped_off`, *When* the driver taps Complete trip, *Then* a blocking message "1 learner still on board" is shown; only **Force complete** (explicit confirm) completes the trip and sets `completed_with_open_learners=true`.
- **AC-3.20 Delay limits** — *Given* 5 delay notices already exist on the trip, *When* a 6th is sent, *Then* it is rejected "Delay notice limit reached."; *and* invalid minute values (e.g., 7) are rejected.
- **AC-3.21 Invalid timestamps** — *Given* an offline-queued log with `logged_at` 10 minutes in the future or before the trip start, *When* it syncs, *Then* it is rejected and the UI surfaces "Couldn't sync — retry".

**Unauthorized access / edge cases**
- **AC-3.22 Foreign trip write** — *Given* driver A and a trip owned by driver B, *When* A attempts to INSERT a `trip_logs` row / delay notice / complete that trip, *Then* it is rejected. (N9)
- **AC-3.23 Parent write attempts** — *Given* a parent, *When* they attempt to INSERT/UPDATE/DELETE `trips`, `trip_logs`, or `trip_delay_notices`, *Then* it is rejected. (N6)
- **AC-3.24 Family privacy in logs** — *Given* two parents with children on the same trip, *When* parent A loads/subscribes to `trip_logs`, *Then* the network responses and Realtime payloads contain **only** parent A's learner IDs. (N5, N17)
- **AC-3.25 Pending/removed enrollment sees nothing** — *Given* a learner with `pending` or `removed` enrollment, *When* the parent queries `trips`/`trip_logs` for that route, *Then* 0 rows are returned; after approval, subsequent trips become visible. (N7)
- **AC-3.26 Immutable completed trips** — *Given* a `completed` trip, *When* the driver tries to INSERT/void logs or add delay notices, *Then* it is rejected. (N16)
- **AC-3.27 Learner not on roster** — *Given* a learner not actively enrolled on the trip's route, *When* a log for that learner is submitted, *Then* it is rejected.
- **AC-3.28 Realtime reconnect** — *Given* a parent's connection drops for 60 s during an active trip, *When* the connection returns, *Then* the feed re-syncs current state (no stale status) and shows an offline indicator while disconnected.

---

### F4: Monthly Fee & Payment Ledger

**Goal:** Replace the paper notebook. Drivers record what each learner owes and whether it's been paid; parents see their balance and history.

#### Functional Requirements
**Driver**
- **FR-4.1** **Create fee record** for a learner with an active enrollment: `billing_month` (first day of month; UI picks month/year), `amount` (rand, 2 decimals; stored as `amount_cents`; > R0 and ≤ R50 000.00), `due_date` (≥ first day of billing month; default 7th of that month), optional `note` (≤ 200). Initial `status='pending'`.
- **FR-4.2** **Generate monthly fees (bulk):** driver selects billing month, default amount, due date, and optionally a route; the `generate_monthly_fees` RPC creates `pending` records for all of the driver's learners with an active enrollment (one record per learner per month **per driver**, even if the learner is on both morning and afternoon routes). Existing records are skipped (idempotent). The UI reports "Created N, skipped M". The driver can then edit individual amounts while `pending`.
- **FR-4.3** **Update status** among `Pending`, `Paid`, `Overdue`:
  - Allowed: `pending→paid`, `pending→overdue`, `overdue→paid`, `overdue→pending`, `paid→pending` (correction; requires confirmation).
  - **Not allowed:** `paid→overdue`, same-state no-ops.
  - Marking **Paid** requires `payment_method` (`cash` | `eft` | `other`) and sets `paid_at` (default now; driver may backdate ≤ today); optional `payment_reference` (≤ 50).
  - Leaving **Paid** clears `paid_at`, `payment_method`, `payment_reference`.
- **FR-4.4** **Automatic overdue:** a scheduled job (pg_cron, daily 02:00 SAST = `0 0 * * *` UTC) sets `pending` records with `due_date < today (SAST)` to `overdue`. Driver can also set overdue manually.
- **FR-4.5** Ledger screen filters: month (default current), status, learner search; shows per-month summary: **Total billed**, **Collected**, **Outstanding** (pending + overdue), and counts by status.
- **FR-4.6** Driver can edit `amount_cents` only while `pending`, and delete a record only while `pending` (never paid).

**Parent**
- **FR-4.7** **Fee History** per child (and an "All children" total): lists records newest first with month, amount, status chip, due date, paid date/method.
- **FR-4.8** **Current balance** = sum of `amount_cents` where `status IN ('pending','overdue')`. Display "Overdue" amount separately and highlight overdue records. A balance of R0.00 shows "All paid up".
- **FR-4.9** **Payment history** = records with `status='paid'`, with `paid_at`, method, and reference.
- **FR-4.10** Parents have **read-only** access; there is no payment processing in V1 (copy: "Pay your driver directly. The driver will mark it as paid.").
- **FR-4.11** Amounts are formatted with `Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })`.

#### Acceptance Criteria

**Happy paths**
- **AC-4.1 Create fee record** — *Given* driver A with active learner Thabo, *When* they create a fee for `2026-12`, R1 500.00, due `2026-12-07`, *Then* a `fee_records` row with `amount_cents=150000`, `status='pending'`, `billing_month='2026-12-01'`, `driver_id=A` exists and appears on the driver ledger.
- **AC-4.2 Bulk generate** — *Given* driver A has 10 active learners, none billed for December, *When* they generate December fees at R1 400.00, *Then* 10 `pending` records are created and the UI shows "Created 10, skipped 0"; running it again shows "Created 0, skipped 10".
- **AC-4.3 Mark paid** — *Given* a `pending` record, *When* the driver marks Paid with method `eft` and reference `REF123`, *Then* `status='paid'`, `paid_at` is set, `payment_method='eft'`, and the parent's history shows it under Payment history.
- **AC-4.4 Auto-overdue** — *Given* a `pending` record with `due_date` = yesterday, *When* the nightly job runs, *Then* the record becomes `overdue` and the parent's balance shows it highlighted as overdue.
- **AC-4.5 Parent balance** — *Given* Thabo has records: R1 400 `paid`, R1 400 `pending`, R1 400 `overdue`, *When* the parent opens Fee History, *Then* Current balance = R2 800.00 with R1 400.00 flagged overdue, and Payment history lists 1 record.
- **AC-4.6 Correction** — *Given* a `paid` record, *When* the driver changes it to `pending` and confirms, *Then* `paid_at`, `payment_method`, `payment_reference` are null and the parent's balance increases accordingly.
- **AC-4.7 Ledger summary** — *Given* December has 10 records (R14 000 billed, 6 paid), *When* the driver opens the ledger for December, *Then* Billed = R14 000.00, Collected = sum of paid, Outstanding = billed − collected.

**Validation errors**
- **AC-4.8 Amount validation** — *Given* the fee form, *When* amount is `0`, negative, non-numeric, or > R50 000.00, *Then* an inline error is shown and nothing is saved (and the DB CHECK rejects such values via API).
- **AC-4.9 Duplicate record** — *Given* a record exists for (driver A, Thabo, 2026-12), *When* another is created for the same month, *Then* it is rejected "A fee for this learner and month already exists."
- **AC-4.10 Paid requires method** — *Given* a `pending` record, *When* the driver attempts Paid without a method, *Then* it is blocked with "Select how it was paid."
- **AC-4.11 Invalid transition** — *Given* a `paid` record, *When* `status='overdue'` is submitted (UI or API), *Then* it is rejected by the transition trigger.
- **AC-4.12 Due date validation** — *Given* billing month Dec 2026, *When* `due_date` is `2026-11-30`, *Then* it is rejected (`due_date ≥ billing_month`).
- **AC-4.13 Edit locked fields** — *Given* a `paid` record, *When* the driver tries to change `amount_cents`, `learner_id`, or `billing_month`, *Then* it is rejected.
- **AC-4.14 Delete rule** — *Given* a `paid` or `overdue` record, *When* the driver attempts delete, *Then* it is rejected; deleting a `pending` record succeeds.

**Unauthorized access / edge cases**
- **AC-4.15 Parent read-only** — *Given* a parent, *When* they attempt INSERT/UPDATE/DELETE on `fee_records` (e.g., set own child's record to `paid`), *Then* it is rejected. (N6)
- **AC-4.16 Parent isolation** — *Given* parent A and parent B, *When* A queries `fee_records`, *Then* only rows for A's learners are returned. (N5-equivalent)
- **AC-4.17 Driver isolation** — *Given* drivers A and B, *When* B queries or updates A's `fee_records`, *Then* 0 rows are returned/affected. (N11)
- **AC-4.18 Roster check on create** — *Given* a learner not actively enrolled with driver A, *When* A creates a fee for that learner, *Then* it is rejected. (N10)
- **AC-4.19 Admin blocked** — *Given* an admin session, *When* querying `fee_records`, *Then* 0 rows. (N15)
- **AC-4.20 Removed learner** — *Given* a learner is removed from the roster with an `overdue` fee, *Then* the driver can still see/update that existing record (their financial record), but cannot create **new** records for that learner.
- **AC-4.21 Timezone boundary** — *Given* a record with `due_date = 2026-12-07`, *When* the overdue job runs at 02:00 SAST on `2026-12-08`, *Then* it becomes overdue; at 23:59 SAST on `2026-12-07` it is still `pending`.

---

## 4. Database Schema & Data Model

**Platform:** Supabase (PostgreSQL 15+, Supabase Auth, Row-Level Security, Realtime, Storage, pg_cron).
**Conventions:** `uuid` PKs (`gen_random_uuid()`), `timestamptz` timestamps, snake_case, money in integer cents, text enums via Postgres `ENUM` types. Table count: 7 core tables from the brief + 2 supporting tables (`route_enrollments`, `trip_delay_notices`).

### 4.1 Entity Relationship Overview
```
auth.users 1─1 profiles (driver | parent | admin)
profiles(driver) 1─* vehicles
profiles(driver) 1─* routes ─* (vehicle_id, driver_id) → vehicles
profiles(parent) 1─* learners
routes *─* learners via route_enrollments (status, direction, stop_sequence)
routes 1─* trips
trips 1─* trip_logs *─1 learners
trips 1─* trip_delay_notices
profiles(driver) 1─* fee_records *─1 learners
```

### 4.2 Migration SQL (copy into `supabase/migrations/0001_init.sql`)

```sql
-- =====================================================================
-- 0001_init.sql — SafeRide schema
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- ENUMS ----------
create type public.user_role           as enum ('driver', 'parent', 'admin');
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type public.route_direction     as enum ('morning', 'afternoon');
create type public.enrollment_status   as enum ('pending', 'active', 'removed');
create type public.trip_status         as enum ('active', 'completed', 'cancelled');
create type public.log_status          as enum ('picked_up', 'dropped_off', 'absent');
create type public.delay_reason        as enum ('traffic', 'vehicle_issue', 'weather', 'school_delay', 'other');
create type public.fee_status          as enum ('pending', 'paid', 'overdue');
create type public.payment_method      as enum ('cash', 'eft', 'other');

-- ---------- UTILITY ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.sast_today() returns date
language sql stable as $$ select (now() at time zone 'Africa/Johannesburg')::date $$;

-- ---------- 1. PROFILES ----------
create table public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  role                   public.user_role not null,
  full_name              text not null check (char_length(btrim(full_name)) between 2 and 100),
  phone_e164             text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  consent_accepted_at    timestamptz not null,
  -- driver-only compliance fields
  business_name          text check (business_name is null or char_length(business_name) <= 100),
  pdp_number             text check (pdp_number is null or pdp_number ~ '^[A-Za-z0-9]{4,20}$'),
  pdp_expiry_date        date,
  pdp_document_path      text,
  pdp_verification       public.verification_status not null default 'unverified',
  pdp_verification_note  text check (pdp_verification_note is null or char_length(pdp_verification_note) <= 200),
  service_suburbs        text[] not null default '{}',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint driver_fields_required check (
    role <> 'driver' or (
      pdp_number is not null and pdp_expiry_date is not null
      and cardinality(service_suburbs) between 1 and 10)),
  constraint non_driver_no_driver_fields check (
    role = 'driver' or (
      pdp_number is null and pdp_expiry_date is null and pdp_document_path is null
      and business_name is null and cardinality(service_suburbs) = 0))
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- 2. VEHICLES ----------
create table public.vehicles (
  id                          uuid primary key default gen_random_uuid(),
  driver_id                   uuid not null references public.profiles(id) on delete cascade,
  registration_number         text not null check (registration_number ~ '^[A-Z0-9]{4,10}$'),
  make_model                  text not null check (char_length(btrim(make_model)) between 2 and 80),
  seating_capacity            smallint not null check (seating_capacity between 4 and 35),
  roadworthy_expiry_date      date not null,
  roadworthy_document_path    text,
  roadworthy_verification     public.verification_status not null default 'unverified',
  roadworthy_verification_note text check (roadworthy_verification_note is null or char_length(roadworthy_verification_note) <= 200),
  is_active                   boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint vehicles_registration_unique unique (registration_number),
  constraint vehicles_id_driver_unique unique (id, driver_id)
);
create index vehicles_driver_idx on public.vehicles(driver_id);
create trigger trg_vehicles_updated before update on public.vehicles
  for each row execute function public.set_updated_at();

-- ---------- 3. ROUTES ----------
create table public.routes (
  id              uuid primary key default gen_random_uuid(),
  driver_id       uuid not null references public.profiles(id) on delete cascade,
  vehicle_id      uuid not null,
  name            text not null check (char_length(btrim(name)) between 2 and 60),
  direction       public.route_direction not null,
  departure_time  time not null,
  days_of_week    smallint[] not null default '{1,2,3,4,5}'
                  check (cardinality(days_of_week) between 1 and 7
                         and days_of_week <@ array[1,2,3,4,5,6,7]::smallint[]),  -- ISO: 1=Mon … 7=Sun
  invite_code     text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  invite_active   boolean not null default true,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint routes_vehicle_fk foreign key (vehicle_id, driver_id)
    references public.vehicles (id, driver_id) on delete restrict,
  constraint routes_id_direction_unique unique (id, direction),
  constraint routes_id_driver_unique    unique (id, driver_id)
);
create index routes_driver_idx on public.routes(driver_id);
create trigger trg_routes_updated before update on public.routes
  for each row execute function public.set_updated_at();

-- Invite code generator (unambiguous 8-char alphabet), used as column default via trigger
create or replace function public.generate_invite_code() returns text
language plpgsql volatile as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        code text; i int;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.routes where invite_code = code);
  end loop;
  return code;
end $$;
alter table public.routes alter column invite_code set default public.generate_invite_code();

-- ---------- 4. LEARNERS ----------
create table public.learners (
  id                              uuid primary key default gen_random_uuid(),
  parent_id                       uuid not null references public.profiles(id) on delete cascade,
  full_name                       text not null check (char_length(btrim(full_name)) between 2 and 100),
  school_name                     text not null check (char_length(btrim(school_name)) between 2 and 100),
  grade                           text not null check (grade in ('R','1','2','3','4','5','6','7','8','9','10','11','12')),
  home_address                    text not null check (char_length(btrim(home_address)) between 5 and 250),   -- AM pickup / PM drop-off
  school_address                  text not null check (char_length(btrim(school_address)) between 5 and 250), -- AM drop-off / PM pickup
  emergency_contact_name          text not null check (char_length(btrim(emergency_contact_name)) between 2 and 100),
  emergency_contact_relationship  text not null check (char_length(btrim(emergency_contact_relationship)) between 2 and 50),
  emergency_contact_phone         text not null check (emergency_contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  medical_notes                   text check (medical_notes is null or char_length(medical_notes) <= 1000),
  allergy_notes                   text check (allergy_notes is null or char_length(allergy_notes) <= 1000),
  is_active                       boolean not null default true,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);
create index learners_parent_idx on public.learners(parent_id);
create trigger trg_learners_updated before update on public.learners
  for each row execute function public.set_updated_at();

-- ---------- 5. ROUTE_ENROLLMENTS (supporting: links learners to routes) ----------
create table public.route_enrollments (
  id             uuid primary key default gen_random_uuid(),
  route_id       uuid not null,
  direction      public.route_direction not null,   -- denormalised; enforced by composite FK
  learner_id     uuid not null references public.learners(id) on delete cascade,
  status         public.enrollment_status not null default 'pending',
  stop_sequence  smallint check (stop_sequence is null or stop_sequence between 1 and 99),
  requested_at   timestamptz not null default now(),
  decided_at     timestamptz,
  updated_at     timestamptz not null default now(),
  constraint enrollments_route_dir_fk foreign key (route_id, direction)
    references public.routes (id, direction) on delete cascade,
  constraint enrollments_route_learner_unique unique (route_id, learner_id),
  constraint enrollments_decided_chk check ((status = 'pending') = (decided_at is null))
);
-- one pending/active enrollment per learner per direction
create unique index enrollments_one_per_direction
  on public.route_enrollments (learner_id, direction) where status in ('pending','active');
create index enrollments_route_idx   on public.route_enrollments(route_id, status);
create index enrollments_learner_idx on public.route_enrollments(learner_id, status);
create trigger trg_enrollments_updated before update on public.route_enrollments
  for each row execute function public.set_updated_at();

-- ---------- 6. TRIPS ----------
create table public.trips (
  id                          uuid primary key default gen_random_uuid(),
  route_id                    uuid not null,
  driver_id                   uuid not null,
  trip_date                   date not null default public.sast_today(),
  status                      public.trip_status not null default 'active',
  started_at                  timestamptz not null default now(),
  completed_at                timestamptz,
  completed_with_open_learners boolean not null default false,
  created_at                  timestamptz not null default now(),
  constraint trips_route_driver_fk foreign key (route_id, driver_id)
    references public.routes (id, driver_id) on delete restrict,
  constraint trips_completed_chk check ((status = 'active') = (completed_at is null)),
  constraint trips_id_unique unique (id)
);
create unique index trips_one_active_per_driver on public.trips(driver_id) where status = 'active';
create unique index trips_one_per_route_per_day  on public.trips(route_id, trip_date) where status in ('active','completed');
create index trips_route_date_idx  on public.trips(route_id, trip_date desc);
create index trips_driver_date_idx on public.trips(driver_id, trip_date desc);

-- ---------- 7. TRIP_LOGS ----------
create table public.trip_logs (
  id          uuid primary key default gen_random_uuid(),   -- client may supply (offline idempotency)
  trip_id     uuid not null references public.trips(id) on delete cascade,
  learner_id  uuid not null references public.learners(id) on delete cascade,
  status      public.log_status not null,
  logged_at   timestamptz not null default now(),
  logged_by   uuid not null references public.profiles(id),
  voided_at   timestamptz,
  created_at  timestamptz not null default now()
);
create unique index trip_logs_one_status_per_learner
  on public.trip_logs(trip_id, learner_id, status) where voided_at is null;
create index trip_logs_trip_idx    on public.trip_logs(trip_id, logged_at);
create index trip_logs_learner_idx on public.trip_logs(learner_id, logged_at desc);

-- ---------- 8. TRIP_DELAY_NOTICES (supporting) ----------
create table public.trip_delay_notices (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips(id) on delete cascade,
  driver_id      uuid not null references public.profiles(id),
  delay_minutes  smallint not null check (delay_minutes in (5,10,15,20,30,45,60)),
  reason         public.delay_reason not null,
  message        text check (message is null or char_length(message) <= 140),
  created_at     timestamptz not null default now()
);
create index delay_notices_trip_idx on public.trip_delay_notices(trip_id, created_at desc);

-- ---------- 9. FEE_RECORDS ----------
create table public.fee_records (
  id                 uuid primary key default gen_random_uuid(),
  driver_id          uuid not null references public.profiles(id) on delete cascade,
  learner_id         uuid not null references public.learners(id) on delete cascade,
  billing_month      date not null check (extract(day from billing_month) = 1),
  amount_cents       integer not null check (amount_cents > 0 and amount_cents <= 5000000),  -- ≤ R50 000.00; currency = ZAR
  due_date           date not null,
  status             public.fee_status not null default 'pending',
  paid_at            timestamptz,
  payment_method     public.payment_method,
  payment_reference  text check (payment_reference is null or char_length(payment_reference) <= 50),
  note               text check (note is null or char_length(note) <= 200),
  status_changed_at  timestamptz not null default now(),
  status_changed_by  uuid references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint fee_unique_per_month unique (driver_id, learner_id, billing_month),
  constraint fee_due_after_month  check (due_date >= billing_month),
  constraint fee_paid_consistency check (
    (status = 'paid' and paid_at is not null and payment_method is not null)
    or (status <> 'paid' and paid_at is null and payment_method is null and payment_reference is null))
);
create index fee_driver_month_idx  on public.fee_records(driver_id, billing_month desc, status);
create index fee_learner_month_idx on public.fee_records(learner_id, billing_month desc);
create trigger trg_fee_updated before update on public.fee_records
  for each row execute function public.set_updated_at();
```

### 4.3 Required Triggers & Server Functions (each needs unit/pgTAP tests)

| Name | Type | Behaviour |
|---|---|---|
| `handle_new_user` | trigger on `auth.users` (AFTER INSERT) **or** RPC `register_*` | Creates `profiles` from sign-up metadata; **rejects any role other than `driver`/`parent`** (N13). Role is never read from editable metadata after creation. |
| `prevent_role_change` | BEFORE UPDATE on `profiles` | Raises if `new.role <> old.role`. |
| `protect_verification_fields` | BEFORE UPDATE on `profiles`, `vehicles` | Non-admins cannot change `*_verification*`. If a driver changes `pdp_number/pdp_expiry_date/pdp_document_path` (or vehicle `registration_number/roadworthy_expiry_date/roadworthy_document_path`), set the relevant verification to `unverified`. |
| `enforce_enrollment_rules` | BEFORE INSERT/UPDATE on `route_enrollments` | State machine: `pending→active`, `pending→removed`, `active→removed` only; `removed` is terminal (new request = new row/re-insert after delete of removed row allowed via RPC). Only route owner may approve; parent may only set `removed` on own. Capacity: active count ≤ `vehicle.seating_capacity − 1`. Learner must be `is_active`. Sets `decided_at`. |
| `enforce_trip_log_rules` | BEFORE INSERT/UPDATE on `trip_logs` | Trip must be `active` and owned by `auth.uid()`; learner must have `active` enrollment on `trip.route_id`; `logged_by := auth.uid()`; `logged_at` ≤ now()+60 s and ≥ `trip.started_at`; `dropped_off` requires existing non-voided `picked_up`; `absent` excluded if `picked_up`/`dropped_off` exist and vice-versa; UPDATE only allowed to set `voided_at` within 5 min of `logged_at` (all other columns immutable). |
| `enforce_delay_notice_rules` | BEFORE INSERT on `trip_delay_notices` | Trip active & owned; ≤ 5 notices per trip. |
| `enforce_fee_rules` | BEFORE INSERT/UPDATE/DELETE on `fee_records` | Insert: learner has `active` enrollment with a route of `driver_id`. Update: `driver_id`, `learner_id`, `billing_month` immutable; `amount_cents` editable only if old status `pending`; transition table (§F4: no `paid→overdue`, no no-ops); sets `status_changed_at/by`. Delete: only `pending`. |
| `mark_overdue_fees()` | function + pg_cron `0 0 * * *` (02:00 SAST) | `update fee_records set status='overdue' where status='pending' and due_date < public.sast_today();` |
| `prevent_vehicle_delete_if_routes` | FK `ON DELETE RESTRICT` | Vehicle in use cannot be deleted. |

### 4.4 RPC (Postgres function) Contract
All are `SECURITY DEFINER` with `set search_path = public`, check `auth.uid()` and `app_role()` internally, and return typed errors (SQLSTATE `P0001` with stable message codes the UI maps to copy).

| RPC | Caller | Purpose / key checks |
|---|---|---|
| `register_driver_profile(profile jsonb, vehicle jsonb)` | driver (post-auth) | Atomic insert of driver `profiles` + first `vehicles` row; validates PDP/roadworthy dates ≥ today. |
| `lookup_invite(code text)` | parent | Returns driver preview (name, vehicle, compliance, route name/direction/time) for a valid active code; rate-limited (10/h/user); identical error for all invalid cases. |
| `redeem_invite(code text, learner_id uuid)` | parent | Creates `pending` enrollment for own, active learner; checks direction conflict; rate-limited. |
| `get_pending_requests(route_id uuid)` | driver | Minimal fields (child first name, grade, school, parent name) for pending enrollments on own route. |
| `decide_enrollment(enrollment_id uuid, decision text)` | driver | `approve`/`reject`; capacity check. |
| `regenerate_invite(route_id uuid)` | driver | New unique code; old invalid. |
| `start_trip(route_id uuid)` | driver | Checks FR-3.2 (a–e). |
| `log_trip_event(id uuid, trip_id uuid, learner_id uuid, status log_status, logged_at timestamptz)` | driver | Idempotent on `id`; state machine; returns row. |
| `void_trip_log(log_id uuid)` | driver | Soft-void within 5 min. |
| `send_delay_notice(trip_id uuid, minutes smallint, reason delay_reason, message text)` | driver | Limit 5/trip. |
| `complete_trip(trip_id uuid, force boolean default false)` / `cancel_trip(trip_id uuid)` | driver | See FR-3.7/3.8. |
| `generate_monthly_fees(month date, amount_cents int, due_date date, route_id uuid default null)` | driver | Idempotent bulk create; returns `{created, skipped}`. |
| `set_fee_status(fee_id uuid, new_status fee_status, method payment_method default null, reference text default null, paid_at timestamptz default null)` | driver | Transition rules; sets/clears payment fields. |
| `delete_my_account()` | any | Deletes `auth.users` row → cascades; also removes Storage objects. |

### 4.5 RLS Policy Specification (reference implementation for key tables)
```sql
-- Enable & force RLS on EVERY table
alter table public.profiles            enable row level security;  alter table public.profiles            force row level security;
alter table public.vehicles            enable row level security;  alter table public.vehicles            force row level security;
alter table public.routes              enable row level security;  alter table public.routes              force row level security;
alter table public.learners            enable row level security;  alter table public.learners            force row level security;
alter table public.route_enrollments   enable row level security;  alter table public.route_enrollments   force row level security;
alter table public.trips               enable row level security;  alter table public.trips               force row level security;
alter table public.trip_logs           enable row level security;  alter table public.trip_logs           force row level security;
alter table public.trip_delay_notices  enable row level security;  alter table public.trip_delay_notices  force row level security;
alter table public.fee_records         enable row level security;  alter table public.fee_records         force row level security;
revoke all on all tables in schema public from anon;

-- ---------- Helper functions (SECURITY DEFINER avoids recursive RLS) ----------
create or replace function public.app_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() $$;

create or replace function public.parent_owns_learner(p_learner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.learners where id = p_learner and parent_id = auth.uid()) $$;

create or replace function public.driver_serves_learner(p_learner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.route_enrollments e
    join public.routes r on r.id = e.route_id
    where e.learner_id = p_learner and e.status = 'active' and r.driver_id = auth.uid()) $$;

create or replace function public.parent_sees_route(p_route uuid) returns boolean   -- ACTIVE enrollment of an own learner
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.route_enrollments e
    join public.learners l on l.id = e.learner_id
    where e.route_id = p_route and e.status = 'active' and l.parent_id = auth.uid()) $$;

-- ---------- learners ----------
create policy learners_parent_all on public.learners for all to authenticated
  using (parent_id = auth.uid() and public.app_role() = 'parent')
  with check (parent_id = auth.uid() and public.app_role() = 'parent');
create policy learners_driver_read on public.learners for select to authenticated
  using (public.app_role() = 'driver' and public.driver_serves_learner(id));

-- ---------- route_enrollments ----------
create policy enroll_parent_read on public.route_enrollments for select to authenticated
  using (public.parent_owns_learner(learner_id));
create policy enroll_driver_read on public.route_enrollments for select to authenticated
  using (exists (select 1 from public.routes r where r.id = route_id and r.driver_id = auth.uid()));
create policy enroll_driver_update on public.route_enrollments for update to authenticated
  using  (exists (select 1 from public.routes r where r.id = route_id and r.driver_id = auth.uid()))
  with check (exists (select 1 from public.routes r where r.id = route_id and r.driver_id = auth.uid()));
-- inserts only through redeem_invite() (no INSERT policy for authenticated)

-- ---------- trips ----------
create policy trips_driver_read on public.trips for select to authenticated using (driver_id = auth.uid());
create policy trips_parent_read on public.trips for select to authenticated using (public.parent_sees_route(route_id));
-- writes only through start_trip / complete_trip / cancel_trip RPCs

-- ---------- trip_logs ----------
create policy logs_driver_read on public.trip_logs for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = auth.uid()));
create policy logs_parent_read on public.trip_logs for select to authenticated
  using (public.parent_owns_learner(learner_id));   -- own children only; voided rows included so Realtime can retract
create policy logs_driver_insert on public.trip_logs for insert to authenticated
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = auth.uid() and t.status = 'active'));
create policy logs_driver_void on public.trip_logs for update to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = auth.uid() and t.status = 'active'))
  with check (true);  -- column immutability + 5-min window enforced by trigger

-- ---------- fee_records ----------
create policy fees_driver_read   on public.fee_records for select to authenticated using (driver_id = auth.uid());
create policy fees_parent_read   on public.fee_records for select to authenticated using (public.parent_owns_learner(learner_id));
create policy fees_driver_insert on public.fee_records for insert to authenticated
  with check (driver_id = auth.uid() and public.app_role() = 'driver' and public.driver_serves_learner(learner_id));
create policy fees_driver_update on public.fee_records for update to authenticated
  using (driver_id = auth.uid()) with check (driver_id = auth.uid());
create policy fees_driver_delete on public.fee_records for delete to authenticated
  using (driver_id = auth.uid() and status = 'pending');

-- ---------- vehicles / routes (driver-owned; parents via views only) ----------
create policy vehicles_driver_all on public.vehicles for all to authenticated
  using (driver_id = auth.uid() and public.app_role() = 'driver')
  with check (driver_id = auth.uid() and public.app_role() = 'driver');
create policy vehicles_admin_read on public.vehicles for select to authenticated using (public.app_role() = 'admin');
create policy routes_driver_all on public.routes for all to authenticated
  using (driver_id = auth.uid() and public.app_role() = 'driver')
  with check (driver_id = auth.uid() and public.app_role() = 'driver');

-- ---------- profiles ----------
create policy profiles_self_read   on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_admin_read  on public.profiles for select to authenticated using (public.app_role() = 'admin' and role = 'driver');
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Cross-user reads exposed via views driver_public_profiles / parent_contacts (column-restricted; no invite_code, no medical data).
-- trip_delay_notices: driver insert/read own trips; parent read where parent_sees_route(trip.route_id). Same pattern as above.
```
> **Implementation notes:** (1) Grant column-level `UPDATE` only on the editable columns listed in §2.3 and rely on triggers for state rules. (2) `routes` has no parent SELECT policy: parents read route info only through `lookup_invite` and a `my_routes` view that omits `invite_code`. (3) Supabase Realtime `postgres_changes` honours RLS for INSERT/UPDATE; **DELETE events are not RLS-filtered**, which is why logs are soft-voided via UPDATE and never deleted. (4) Storage bucket `compliance-docs` is private; policies: driver can read/write `{auth.uid()}/*`, admin read all, nobody else.

### 4.6 Seed Data for Tests
`supabase/seed.sql` must create: `admin`, `driverA` (valid compliance), `driverB`, `driverExpired` (PDP expired yesterday), `parentA` (2 children), `parentB` (1 child), a morning route for driverA with parentA's and parentB's children active, a pending enrollment, and fee records in all three statuses.

---

## 5. Screen Inventory for Stitch UI Design

**Global design constraints (apply to every screen)**
- Mobile-first at **375×812**, responsive to tablet (768) and desktop (1280–1440). Single-column on mobile; on desktop, driver/parent areas use a left nav + content (max content width 1120 px).
- Min touch target 48×48 px; body text ≥ 16 px; color contrast WCAG AA; status never conveyed by color alone (icon + label).
- Status colors/labels: `Picked Up` (blue + bus icon), `Dropped Off` (green + check), `Absent` (grey/amber + slash), `Delay` (amber + clock), `Overdue` (red + alert), `Paid` (green), `Pending` (neutral).
- Every screen defines: **Loading** (skeleton, no layout shift), **Empty**, **Error** (inline message + Retry), **Active/Populated** states. Global **offline banner** ("You're offline — changes will sync when you reconnect") on all authenticated screens.
- Bottom tab bar on mobile (Parent: Home · Children · Fees · Account; Driver: Today · Routes · Fees · Account); sidebar on ≥ 1024 px.
- Copy tone: plain, short, South African English; currency `R 1 500,00` style via `en-ZA`.

---

### 5.1 Auth & Onboarding (shared)

**S01 — Welcome / Login** (`/login`)
- Components: logo, email field, password field (show/hide), **Log in** button, "Forgot password?" link, "Create account" link.
- States: *Empty* (default form); *Loading* (button spinner, fields disabled); *Error* (generic "Incorrect email or password", lockout message after 5 attempts, network error); *Active* (redirect by role).

**S02 — Sign Up: Role & Details** (`/signup`)
- Components: **role selector** (two large cards: *Parent* / *Driver*), full name, email, phone (+27 prefix chip), password with rules checklist, POPIA consent checkbox with link to privacy notice, **Continue/Create account** button.
- States: *Empty*; *Validation errors* (inline per field); *Loading*; *Error* (duplicate email, network); *Active* (Parent → S13; Driver → S03).

**S03 — Driver Compliance Onboarding** (`/signup/driver`)
- Components: stepper (1 Details ✓ → 2 Compliance), PDP number, PDP expiry date picker, service suburbs (tag input, max 10), vehicle registration, make/model, seating capacity stepper, roadworthy expiry date picker, optional document upload (PDP, roadworthy; preview + remove), **Finish** button.
- States: *Empty*; *Validation errors* (expired date, bad registration, duplicate registration); *Uploading* (progress bar per file); *Loading* (submit); *Error* (upload too large/wrong type, network); *Active* (→ S05).

**S04 — Forgot / Reset Password** (`/reset-password`) — email field, success confirmation, error states.

**S05a — Join via Link** (`/join/:code`) — if unauthenticated: prompt to log in/sign up (code preserved); if authenticated parent: forwards to S15 with the code prefilled; if driver: "This link is for parents" message.

---

### 5.2 Driver Screens

**S05 — Driver Dashboard / Today** (`/driver/dashboard`)
- Components: greeting + date; **compliance status strip** (PDP + roadworthy badges with expiry; warning banner if `Expiring soon`/`Expired`, with link to S10); **Today's routes** cards (name, direction chip, departure time, N learners, **Start trip** primary button / "Resume trip" if active); **Pending requests** count chip → S08; quick links (Routes, Fees).
- States: *Loading* (skeleton cards); *Empty* ("No routes yet — create your first route" + CTA to S07); *Empty-today* ("No trips scheduled today" + "Start an off-schedule trip"); *Error* (retry); *Active* (a trip in progress pinned at top: "Trip in progress — Resume"); *Blocked* (Start disabled with reason when compliance expired or 0 learners).

**S06 — Route & Roster Manager (Route list)** (`/driver/routes`)
- Components: route cards (name, direction, vehicle reg, departure time, days, active learner count, pending badge), **+ New route** button.
- States: *Loading*; *Empty* (illustration + "Create your first route"); *Error*; *Active*; *Inactive routes* (collapsed section).

**S07 — Route Create/Edit Form** (`/driver/routes/new`, `/driver/routes/:id/edit`)
- Components: name, direction segmented control, vehicle select, departure time, day-of-week chips, **Save**, **Deactivate route** (danger).
- States: *Empty (create)*; *Prefilled (edit)*; *Validation errors*; *Loading (save)*; *Error*; *No vehicle* (blocked → "Add a vehicle first" CTA to S10).

**S08 — Route Detail / Roster** (`/driver/routes/:id`)
- Components: header (route info); **Invite card** (8-char code in large mono text, **Copy**, **Share on WhatsApp**, **Regenerate**, **Active toggle**); **Pending requests** list (child first name, grade, school, parent name; **Approve** / **Reject**); **Active roster** list (drag/↑↓ reorder, name, grade, allergy/medical flag icon, tap → learner detail sheet with addresses, emergency contact (tap-to-call), medical/allergy notes, parent contact (tap-to-call), **Remove from route**); capacity indicator (e.g., 9/14).
- States: *Loading*; *Empty roster* ("No learners yet — share your code with parents"); *No pending*; *Error*; *Active*; *Full* (approve disabled, "Route is full"); *Code inactive* (banner).

**S09 — Active Trip Check-In View** (`/driver/trip/:tripId`) — **primary driver screen**
- Components: sticky header (route name, direction, started time, elapsed timer, **connection chip**: Online / Offline / "N pending sync"); progress summary ("4 of 9 picked up · 1 absent"); **learner rows** in stop order (name, grade, allergy flag, address line, current status + time, three large buttons **Picked Up / Dropped Off / Absent** per state machine, **Undo** link for 5 min); **Send delay** button (bottom sheet: minutes chips, reason chips, optional message, **Send**); **Complete trip** button (confirmation dialog; "N learners still on board" with **Force complete** secondary-danger); **Cancel trip** (overflow menu).
- States: *Loading* (skeleton rows); *Empty* (should not occur—start blocked; defensive message); *Active* (default); *Row-saving* (button spinner, optimistic update); *Row-error* ("Couldn't save — Retry"); *Offline* (rows show "Pending sync"); *Delay sent* (toast + banner with last notice); *Completed* (read-only summary; all buttons removed); *Cancelled*.

**S09b — Trip Summary / History** (`/driver/trips`, `/driver/trips/:id`)
- Components: date-grouped list (route, direction, start–end time, counts: picked up / dropped off / absent / no update), tap → read-only trip detail with per-learner timeline; "Completed with learners on board" flag.
- States: *Loading*; *Empty* ("No trips yet"); *Error*; *Active* (paginated 20/page "Load more").

**S10 — Compliance Profile & Vehicles** (`/driver/profile`)
- Components: PDP card (number, expiry, status badge + verification badge, document upload/replace), vehicle cards (reg, make/model, seats, roadworthy expiry + badges, document upload), **Add vehicle**, service suburbs editor, contact details, Log out, **Delete account** (danger zone).
- States: *Loading*; *Empty vehicles* (prompt); *Error*; *Active*; *Unverified / Pending review / Verified / Rejected* (badge + reason); *Expired* (red banner "You can't start trips until this is renewed").

**S11 — Driver Fee Ledger** (`/driver/fees`)
- Components: **month picker** (prev/next), **summary cards** (Billed · Collected · Outstanding), filters (status chips: All/Pending/Paid/Overdue; learner search), ledger rows (learner name, amount, due date, status chip, quick **Mark paid** button), **+ Add fee** and **Generate monthly fees** buttons, row tap → S12.
- States: *Loading*; *Empty month* ("No fees for December. Generate fees for all learners" + CTA); *No learners* (CTA to S08); *Error*; *Active*; *Filtered-empty*.

**S12 — Fee Entry / Detail** (`/driver/fees/new`, `/driver/fees/:id`; also as bottom sheet)
- Components: learner select (active roster only), month picker, amount (R, 2 decimals), due date, note, status selector (Pending/Paid/Overdue — invalid options disabled), when Paid: payment method (Cash/EFT/Other), paid date, reference; **Save**; **Delete** (only pending). **Bulk generate dialog:** month, default amount, due date, optional route filter, preview count, **Generate** → result "Created N, skipped M".
- States: *Empty (new)*; *Prefilled*; *Validation errors*; *Loading*; *Error* (duplicate month, invalid transition); *Locked fields* (amount/learner/month read-only once paid); *Success toast*.

**S12b — Driver Account/Settings** — within S10 (profile, log out, delete account confirmation with data-loss warning).

---

### 5.3 Parent Screens

**S13 — Parent Home / Live Status Feed** (`/parent/home`)
- Components: header with date and connection chip + "Last updated hh:mm:ss"; **child status cards** (child name, school, route + direction, driver name + phone tap-to-call, **status pill** [Not started / Trip started / Picked Up hh:mm / Dropped Off hh:mm / Absent / No update], **delay banner** with minutes and reason, compliance badge for driver, link to History); today's morning and afternoon trips shown as two stacked sections per child; **+ Add child** and **Link to a driver** buttons.
- States: *Loading* (skeleton cards); *Empty — no children* ("Add your child to get started" → S14); *Empty — no route linked* ("Enter your driver's code" → S15); *Pending* ("Waiting for driver approval"); *Active (no trip today)* ("No trip yet today"); *Live* (realtime updates, subtle highlight on change); *Delay*; *Cancelled* ("Trip cancelled by driver"); *Offline* (stale banner + polling fallback); *Error* (retry).

**S14 — Child Profile Form** (`/parent/children/new`, `/parent/children/:id/edit`)
- Components: child full name, school name, grade select (R–12), home address, school address, emergency contact (name, relationship, phone), medical notes (textarea, counter 1000), allergy notes (textarea, counter 1000), privacy helper text ("Only your approved driver can see this"), **Save**, **Archive child** (danger, confirmation).
- States: *Empty (new)*; *Prefilled (edit)*; *Validation errors*; *Loading (save)*; *Error*; *Archive confirmation* (warns route links will be removed).

**S14b — Children List** (`/parent/children`) — child cards with enrollment status per direction (*Pending approval / Active / None / Removed*), driver preview, **Leave route** / **Cancel request** actions. States: Loading, Empty, Error, Active.

**S15 — Link Child to Driver's Route** (`/parent/link`, `/join/:code` redirect)
- Components: code input (8 chars, auto-uppercase, paste support), **Look up** button; **driver preview card** (driver name, phone, vehicle reg + make/model, PDP & roadworthy status/expiry/verification badges, route name, direction, departure time, days); child selector (children without a conflicting direction link; disabled with reason otherwise); **Confirm request**.
- States: *Empty*; *Loading (lookup)*; *Error* ("This code isn't valid", rate-limit message, direction conflict); *Preview*; *Success* ("Request sent — waiting for driver approval"); *Compliance warning* (if driver PDP/roadworthy `Expired`/`Rejected`, a prominent warning before confirm).

**S16 — Parent Trip History** (`/parent/children/:id/history`)
- Components: child selector, date-grouped list (date; morning/afternoon trip cards with route, status + time per event, delay notices that occurred), "Load more".
- States: *Loading*; *Empty* ("No trips recorded yet"); *Error*; *Active* (20/page, last 90 days).

**S17 — Parent Fee History** (`/parent/fees`)
- Components: child filter (All / per child), **Current balance card** (total outstanding, overdue amount highlighted, "All paid up" when R0), **Outstanding list** (month, amount, due date, status chip), **Payment history** list (month, amount, paid date, method, reference), helper copy ("Pay your driver directly. They'll mark it as paid.").
- States: *Loading*; *Empty* ("No fees recorded yet"); *All paid*; *Overdue* (red highlight + icon); *Error*; *Active*.

**S18 — Parent Account** (`/parent/account`) — profile edit (name, phone), privacy notice link, Log out, **Delete account** (confirmation listing data to be deleted).

---

### 5.4 Admin Screens (internal, desktop-first)

**S19 — Verification Queue** (`/admin/verifications`)
- Components: table (driver name, phone, PDP no./expiry, vehicle reg/roadworthy expiry, document links via signed URL, current verification status), filter (Unverified/Pending/Rejected/Verified), row actions **Verify** / **Reject** (reason ≤ 200 chars).
- States: *Loading*; *Empty* ("Nothing to review"); *Error*; *Active*; *Document missing* (action disabled with reason).

---

## 6. Non-Functional Requirements & Out-of-Scope (Non-Goals)

### 6.1 Responsiveness & UX
- **NFR-1** All screens render correctly from **375 px to 1440 px** with no horizontal scroll; verified by Playwright viewport tests at **375, 768, 1280, 1440**.
- **NFR-2** Tailwind mobile-first breakpoints (`sm 640`, `md 768`, `lg 1024`, `xl 1280`); minimum touch target 48×48 px; check-in buttons on S09 ≥ 56 px high.
- **NFR-3** Accessibility: WCAG 2.1 AA, keyboard navigable, visible focus states, labelled form fields, `aria-live="polite"` on parent status updates, status not conveyed by colour alone.
- **NFR-4** Language: English (South Africa) only in V1; all copy in a single i18n-ready dictionary file.

### 6.2 Performance & Low-Data Design
- **NFR-5** Initial route JS ≤ **200 KB gzipped**; route-level code splitting; LCP ≤ 2.5 s on Slow 4G (1.6 Mbps / 150 ms RTT) mid-tier Android.
- **NFR-6** No images or video in the status feed or check-in screens (icons are inline SVG); no auto-playing media; web fonts limited to 1 family, `font-display: swap`, or system font stack.
- **NFR-7** Payloads: lists paginated (20/page); Realtime subscriptions scoped by filter (`trip_id`, `route_id`); select only needed columns. Check-in write payload < 1 KB.
- **NFR-8** **Offline-tolerant check-ins** (FR-3.9): queued in IndexedDB, idempotent, retried with exponential backoff (1 s → 30 s). Parent feed degrades to 15 s polling if Realtime disconnects. App shell cached by service worker (PWA installable; **offline push notifications are out of scope**).
- **NFR-9** Interaction speed: optimistic UI for check-ins (reflect tap < 100 ms; roll back with error on rejection).
- **NFR-10** Reliability: target ≥ 99.5% monthly availability; Supabase daily backups enabled with point-in-time recovery where the plan allows.

### 6.3 Security & Privacy of Children's Data (POPIA)
- **NFR-11 Legal basis:** children's personal information is **special personal information** under South Africa's **POPIA (Act 4 of 2013)**. Processing is based on **parental/guardian consent** captured at sign-up (`consent_accepted_at`) and a published privacy notice. *(Legal review of the notice is a launch task; this PRD is not legal advice.)*
- **NFR-12 Data minimisation:** the app **does not** collect children's ID numbers, dates of birth, photographs, or precise geolocation. Only fields in §4.2 are stored.
- **NFR-13 Access control:** all access governed by RLS (§2, §4.5); full-matrix negative tests (§2.4) are a **launch gate (G2)**. Admins cannot access children's data.
- **NFR-14 Encryption:** TLS 1.2+ in transit (HSTS enabled); Supabase encryption at rest. Compliance documents in a **private** bucket with signed URLs (≤ 60 s expiry).
- **NFR-15 Secrets:** only the Supabase `anon` key and project URL are in the browser bundle. Service-role key is **never** in client code, repo, or CI logs (GitHub Actions encrypted secrets only).
- **NFR-16 Auth hardening:** email confirmation; password min length 8; rate limits (FR-1.10, FR-2.13); generic auth error messages; session refresh rotation enabled.
- **NFR-17 Client hygiene:** no personal data in URLs or analytics events; no third-party trackers or advertising SDKs; error logging (e.g., Sentry) must **scrub** names, addresses, phone numbers, and notes. Medical/allergy notes never appear in logs, push payloads, or error messages.
- **NFR-18 Retention & deletion:** account deletion (FR-1.12) hard-deletes the profile and all owned data within 30 days (immediately in-app; backups age out). Archived learners are retained only until the parent deletes them. Trip logs older than **12 months** are purged by a scheduled job (configurable). Fee records are retained while the driver and learner exist.
- **NFR-19 Auditability:** `logged_by`, `status_changed_by`, `status_changed_at`, and `created_at` captured on mutable safety/financial records. Admin verification actions logged (who/when) in `profiles`/`vehicles` update timestamps.
- **NFR-20 Content security:** CSP headers; input sanitised/escaped (React default); free-text fields length-limited (DB CHECKs mirror UI limits); file upload MIME/size validated client- and server-side.

### 6.4 Testing, TDD & CI/CD Requirements
- **Test layers & tooling**
  - **Unit (Vitest + Testing Library):** validators (phone E.164 normalisation, registration normalisation, amount ↔ cents, compliance badge logic, state-machine helpers, offline queue).
  - **Database (pgTAP or Vitest + local Supabase):** constraints, triggers, RPCs, **RLS negative matrix N1–N17**.
  - **E2E (Playwright):** one spec per feature F1–F4 covering all happy-path ACs, plus multi-context tests (driver + parent browsers) for realtime AC-3.3, AC-3.7, AC-3.24.
- **Traceability:** each test title starts with its AC ID (e.g., `AC-3.15 dropped_off before picked_up is rejected`). A CI script fails the build if any AC ID in `docs/PRD.md` has no matching test.
- **TDD flow:** write failing DB/RLS tests from §2.4 and §4.3 first, then migrations/policies; write failing unit tests for validators; then UI.
- **GitHub Actions pipeline** (`.github/workflows/ci.yml`), on PR and `main`:
  1. install → `eslint` + `prettier --check` → `tsc --noEmit`
  2. `supabase start` (local) → apply migrations + seed → DB/RLS tests
  3. Vitest unit/integration with coverage gate (≥ 80%)
  4. build → Playwright E2E (375 px and 1280 px projects) against local stack
  5. Lighthouse CI budget check (G5)
  6. On `main`: run migrations on production project (`supabase db push` with protected secrets), deploy frontend (e.g., Vercel/Netlify/Cloudflare Pages), post-deploy smoke test (login page 200, RLS-enabled check G7).
- **Environments:** `local`, `preview` (per PR, optional), `production`. E2E uses seeded users and a Supabase project/local stack with email confirmation disabled.

### 6.5 Tech Stack (fixed for V1)
React 18 + TypeScript (strict) + Vite, Tailwind CSS, React Router, TanStack Query, Zod (shared validators), `@supabase/supabase-js` (Auth, Realtime, Storage, RPC), Vitest + Testing Library, Playwright, GitHub Actions. Backend = **Supabase Postgres + Auth + RLS** (preferred); Node/Express is **not** used unless Supabase is replaced — in which case §2.3 and §4.5 must be re-implemented as server-side middleware + DB policies with identical test matrix.

### 6.6 Out of Scope (Non-Goals) for V1
The following are **explicitly excluded**; no design, schema, or tests are required for them:
1. **Live hardware/phone GPS tracking**, maps, ETA calculation, geofencing, route optimisation, turn-by-turn navigation.
2. **In-app payment gateway** (card, EFT, SnapScan, Ozow, etc.), payment links, automatic reconciliation, payouts, invoices/PDF statements, or tax features. The ledger is a *record* only.
3. **School admin portals**, school integrations, or school-issued rosters.
4. **Native iOS/Android apps** (responsive PWA only) and **push/SMS/WhatsApp/email notifications** (V1 alerts are in-app real-time only).
5. Multi-language UI (isiZulu, Afrikaans, etc.), voice features, chat/messaging between parent and driver.
6. Multi-driver fleets/companies, driver employees/sub-accounts, co-guardians sharing a child, children with multiple parents.
7. Driver ratings/reviews, public driver directory/marketplace/search, driver–parent matching.
8. Automated verification of PDP/roadworthy with government systems (manual admin review only); operating-licence tracking; vehicle service history.
9. Child photos, QR/NFC/boarding-pass scanning, geofenced auto check-ins.
10. Complaints/incident reporting, panic/SOS button, emergency escalation workflows.
11. Analytics dashboards, data export tools, and driver payroll/expense tracking.
12. Social/OAuth login and phone-number OTP login (email + password only).

### 6.7 Open Questions (do not block build; defaults stated)
| # | Question | Default used in this PRD |
|---|---|---|
| Q1 | Should drivers be able to reopen a completed trip? | No. Use Force-complete rules; Admin DB fix only. |
| Q2 | Should Web Push be a fast-follow? | Yes, V1.1; V1 is in-app Realtime only. |
| Q3 | Retention period for trip logs | 12 months (configurable job). |
| Q4 | Should pending learners expose any data to drivers before approval? | Minimal fields only (AC-2.18). |
