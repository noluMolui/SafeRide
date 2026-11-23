# SafeRide — Business Document (V1)

| | |
|---|---|
| **Document** | `docs/BUSINESS.md` |
| **Companion** | `docs/PRD.md` (product scope) |
| **Version / Date** | 1.0 — 2026-11-23 |
| **Market** | South Africa (Gauteng pilot), currency ZAR |

> **How to read this document.** Facts with a named source are marked *(Source)*. Everything else is an **assumption (A#)** to be validated in the pilot. Section 11 lists the assumptions and how each will be tested. Nothing here is legal or financial advice.

---

## 1. Executive Summary
SafeRide is a mobile-first platform that replaces WhatsApp check-ins and paper payment notebooks for **independent scholar transport operators** (kombi/minibus drivers) and the **parents** who use them. Parents get real-time `Picked Up / Dropped Off / Absent` updates, delay alerts, visible driver compliance (PDP and roadworthy status), and a clear fee ledger. Drivers get one-tap check-ins, a roster with emergency/allergy details, a professional compliance profile, and an end to "I already paid" disputes.

**Business model:** a low-priced monthly subscription **paid by drivers**; the parent app is **free**. Parents drive adoption (they want visibility); drivers pay because the product makes them look professional, saves admin time, and helps them get paid on time.

**Why now:** minibus taxis dominate scholar transport and safety/trust concerns are well documented *(Safety and security challenges of scholar transport in South Africa: An overview, Journal of Transport and Supply Chain Management)*; smartphone and WhatsApp use among both drivers and parents is already routine, so the behaviour change is "tap a button instead of typing a message", not "adopt new hardware".

---

## 2. Problem & Opportunity

### 2.1 Customer problems
| Who | Pain today | Cost of the pain |
|---|---|---|
| **Parent** | No reliable way to know if the child was collected or dropped; must message a driver who is driving. Cannot easily verify PDP/roadworthy status. | Anxiety, safety risk, wasted time, switching drivers on trust grounds. |
| **Driver** | Types check-ins into WhatsApp groups, answers repeated "where are you?" messages, tracks fees in a notebook, chases late payers manually. | Lost time while driving/stopped, lost income from forgotten or disputed fees, reputational risk. |
| **Both** | Children's names, addresses and medical notes are shared in large group chats. | Privacy exposure (POPIA). |

### 2.2 Market context *(Source: Stats SA National Household Travel Survey 2020)*
- About **10.1 million learners walked all the way** to their institution in 2020, **59.4%** of all learners; the rest (roughly 40%, about 6.9 million by implication) used some other mode.
- Among learners who used **public transport**, **72.4% used a taxi** and **26.6% a bus**; taxi use was more common among urban learners.
- Implication: the largest addressable segment for SafeRide is **urban/peri-urban learners riding minibus taxis or private kombis**, a group that includes both public taxi riders (not our customer) and **dedicated, parent-contracted scholar transport** (our customer). The NHTS does **not** separate these two, so a bottom-up estimate is used below.

### 2.3 Bottom-up market sizing (assumptions — validate in pilot)
| Step | Value | Basis |
|---|---|---|
| Urban/peri-urban learners using any taxi/kombi/car-share transport | ~3–4 million | A1 — derived from NHTS 2020 shares; refine with NHTS microdata |
| Share on **contracted, recurring scholar transport** (vs. ad-hoc public taxi) | 10–20% | A2 — to be validated by driver and school interviews |
| Learners on contracted scholar transport | ~300 000 – 800 000 | A1 × A2 |
| Avg. learners per independent operator | 12 | A3 |
| Independent operators (addressable) | ~25 000 – 65 000 | Learners ÷ A3 |
| **Initial beachhead (Gauteng, 3 metros)** | ~30% of the above | A4 — Gauteng weighting |
| **Serviceable obtainable (Year 1)** | 150–300 paying drivers | Execution target, not market size |

**Revenue pool (illustrative):** at 25 000 operators × R149/month (see §4) the national ceiling is ≈ **R45 million/year**; this is a *niche, bootstrappable* market, not a venture-scale one, unless the product expands into payments (§4.3) and adjacent services (§9).

---

## 3. Customers & Segments

| Segment | Profile | Role in business | Priority |
|---|---|---|---|
| **Independent driver-owners** (1 vehicle, 8–15 learners) | Owner-operator, mid-range Android, WhatsApp-native, cash/EFT payments | **Paying customer**; also the distribution channel (brings parents) | Primary |
| **Parents/guardians** | Working parents, 1–3 children, want certainty and transparency | **Free user**; creates pull on drivers | Primary |
| **Small fleet owners** (2–5 vehicles) | Employ drivers | Deferred (no multi-driver in V1) | Later |
| **Schools / associations / unions** | Coordinate local operators | Partner/channel, **not** a V1 customer | Later |

**Ideal first customer:** a driver with 10+ learners in a suburb with an active parent WhatsApp group, who already complains about fee chasing or "are you there yet?" messages.

---

## 4. Business Model & Pricing

### 4.1 Revenue model (V1)
| Plan | Price (assumption A5) | Includes |
|---|---|---|
| **Parent** | **Free** | Unlimited children, live feed, history, fee view |
| **Driver — Pilot** | **Free for 60 days**, no card | Full product |
| **Driver — Standard** | **R149 / month** (or **R1 490 / year**, 2 months free) | Up to **15 learners**, unlimited routes/trips, fee ledger, compliance profile |
| **Driver — Plus** *(later test)* | **R249 / month** | Up to 30 learners / 2 vehicles |

*Rationale (A5):* a driver collecting roughly R1 000–R1 500 per learner per month (A6) on a 12-learner route handles ~R12 000–R18 000/month; R149 is **~1% of monthly flow**, comparable to a few litres of fuel, and priced below the cost of one lost fee. Price should be tested at R99 / R149 / R199 during the pilot.

**Billing in V1:** manual — invoice and EFT, or a hosted debit-order/card link created outside the product. **No in-app payment processing** (see PRD §6.6). Subscription state is tracked internally (a simple `subscription_status` flag is a post-launch addition, not part of the V1 schema).

### 4.2 Why drivers pay (value to the payer)
1. **Fewer disputes and faster payment** — dated ledger replaces the notebook.
2. **Time saved** — one tap instead of typing messages; fewer "where are you?" interruptions.
3. **Trust and retention** — verified compliance profile and professional image help win and keep families.
4. **Safety/liability protection** — timestamped record of pickups and drop-offs.

### 4.3 Future revenue options (not V1; each needs separate validation)
| Option | Description | Risk / dependency |
|---|---|---|
| **Payments & collections** | Parent pays via card/EFT/instant EFT inside the app; SafeRide takes a small fee or earns on float | Regulatory (payment service provider rules), fraud, support load. Likely partner with a licensed gateway. |
| **Compliance verification add-on** | Paid, faster verification of PDP/roadworthy documents | Needs a reliable verification process |
| **School/association licences** | Bulk licences for associations to onboard members | Sales cycle length |
| **Insurance/finance referrals** | Referral fees for vehicle/school-run insurance | Trust and conflicts of interest |

---

## 5. Unit Economics (illustrative, assumptions flagged)

### 5.1 Per paying driver (Standard plan)
| Item | Value | Note |
|---|---|---|
| ARPU | R149 / month | A5 |
| Hosting & backend (Supabase, hosting, email) per driver | ≈ R10–R20 / month at 200 drivers | A7 — fixed platform costs spread over users; verify against actual plan pricing |
| Payment collection cost (if card/debit-order link) | ≈ R5–R10 / month | A8 — gateway fees |
| Support (WhatsApp/phone) | ≈ R15–R30 / month | A9 — 15–30 min/driver/month at blended rate |
| **Gross margin per driver** | **≈ R95–R115 / month (≈ 65–77%)** | |

### 5.2 Customer acquisition (A10)
- **Target blended CAC:** ≤ **R300** per paying driver (driver referral, parent pull-through, local activations).
- **Target payback:** ≤ **3 months** of gross margin.
- **Target LTV:** if monthly churn is 4% (A11) → avg. lifetime ≈ 25 months → **LTV ≈ R2 400–R2 900** → **LTV:CAC ≈ 8–10×** (optimistic; to be proven).
- **Churn risk:** drivers are seasonal (school terms, December–January gap). Plan for **term-based billing** or a **pause** option to avoid December churn.

### 5.3 Indicative scenarios (Year 1 exit, paying drivers)
| Scenario | Paying drivers | MRR | ARR |
|---|---|---|---|
| Conservative | 60 | R8 940 | ≈ R107 k |
| Base | 200 | R29 800 | ≈ R358 k |
| Optimistic | 400 | R59 600 | ≈ R715 k |

*Base-case costs (illustrative):* platform ≈ R3–R5 k/month, tooling ≈ R2 k/month, part-time support and field onboarding ≈ R10–R15 k/month. **Break-even ≈ 150–200 paying drivers** *(A12; founder labour not costed)*. This is a lean, founder-run business, not a funded-growth model.

---

## 6. Go-To-Market

### 6.1 Principle
**Driver-led, parent-pulled, community-distributed.** Each driver brings 8–15 parents via invite code; each parent is a free advocate who requests the app from their driver's competitors if a neighbour already uses it.

### 6.2 Phases
| Phase | Timing (from go-live) | Goal | Tactics |
|---|---|---|---|
| **0. Pre-launch** | Weeks −4 to 0 | Recruit 5–8 pilot drivers | Door-to-door at school gates, local Facebook/WhatsApp community groups, personal networks; sign simple pilot agreements |
| **1. Pilot** | Days 0–60 | ≥ 5 drivers, ≥ 30 learners; meet PRD pilot targets P1–P7 | Weekly check-ins with each driver; fix top 3 friction points per week; collect testimonials |
| **2. Neighbourhood density** | Months 3–6 | 40–80 drivers in 3–5 suburbs | Referral credit (1 free month per referred paying driver), suburb-by-suburb focus so parents see multiple drivers using it |
| **3. Scale in Gauteng** | Months 6–12 | 150–300 drivers | Partnerships with scholar-transport associations and local schools; short demo videos; WhatsApp-shareable onboarding |

### 6.3 Channels (ranked by expected CAC)
1. **Driver referrals** (lowest CAC)
2. **Parent invitations** ("Ask your driver to join SafeRide" share link)
3. **School gate activations / local community groups**
4. **Association and union partnerships**
5. Paid social (small tests only; low expected efficiency for this audience)

### 6.4 Messaging
- **To parents:** "Know your child is safe, without sending a single message."
- **To drivers:** "Tap once. Parents stay informed. Get paid on time."
- **Trust cues:** verified PDP/roadworthy badge, POPIA-aligned privacy, "free for parents".

### 6.5 Onboarding
- Target **under 10 minutes** from sign-up to first route and invite code.
- Hands-on onboarding (in person or via call) for each of the first 30 drivers.
- WhatsApp-shareable invite link (`/join/<CODE>`) is the primary viral loop.

---

## 7. Competitive Landscape (qualitative — validate with field research)
| Alternative | Strengths | Weaknesses vs. SafeRide |
|---|---|---|
| **WhatsApp groups + paper notebook** (status quo, main competitor) | Free, familiar, zero setup | No structured status, privacy exposure, no ledger, noisy |
| **Generic school-run / fleet-tracking apps** (international or enterprise) | GPS tracking, routing | Priced and designed for fleets/schools, not independent kombi operators; GPS hardware costs; may lack SA-specific compliance (PDP, roadworthy) and ZAR fee workflows |
| **School-run lift-clubs / carpool apps** | Community, cost sharing | Not a paid, compliant operator relationship |
| **Spreadsheets / accounting apps** | Flexible | No parent view, no check-in, high admin |

**Positioning:** the simplest, cheapest, mobile-first tool built for *independent* SA scholar transport operators and the parents who rely on them; no hardware, no school integration needed.
**Moat (earned over time):** neighbourhood density (network effects), historical trip and payment data, verified compliance data, driver brand/reputation, and trust.

> **Action:** before launch, do a structured competitor scan (app stores, local operators, associations) and update this section. No competitor data was gathered for this draft.

---

## 8. Operations & Team

### 8.1 Minimum team (founder-run)
| Function | V1 owner | Notes |
|---|---|---|
| Product & engineering | Founder/engineer(s) | Per PRD; Supabase + React |
| Driver onboarding & support | Part-time ops hire or founder | WhatsApp support line, weekday hours; in-person onboarding |
| Compliance document verification | Part-time admin (same person) | ≤ 24 h business-day SLA (target) |
| Data protection / Information Officer | Named founder | POPIA registration with the Information Regulator (verify requirements) |

### 8.2 Support model
- WhatsApp Business line + email; target first response ≤ 4 business hours.
- Top 10 FAQs inside the app; short vernacular-friendly guides/videos (post-V1 for languages).

### 8.3 Key processes
- Weekly pilot review; monthly KPI review (§10).
- Document verification queue (PRD S19).
- Incident response for any data-privacy event (see §9).

---

## 9. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Children's data breach / privacy incident** | Low–Med | Severe | Strict RLS and negative-test launch gate (PRD G2), data minimisation, no analytics PII, incident plan, legal review of privacy notice, POPIA compliance (children's data is special personal information) |
| R2 | **Drivers don't adopt / forget to tap** | Med | High | One-tap UX, offline queue, in-person onboarding, parent pressure via free app, measure P1/P3 weekly |
| R3 | **Parents won't pay and drivers won't pay** (no willingness) | Med | High | Pilot pricing tests (R99/R149/R199), tie value to fee collection, free-for-parents to drive demand |
| R4 | **Connectivity/data costs** | High | Med | Low-data design, offline-tolerant check-ins (PRD NFR-5–8) |
| R5 | **Seasonality / churn in school holidays** | High | Med | Term/annual billing, pause option, December-January communications |
| R6 | **Liability if app shows wrong status** (e.g., missed tap) | Med | High | "No update" state (not assumed absent), force-complete safeguard, clear T&Cs: SafeRide is an information tool, not a safety guarantee or transport operator |
| R7 | **Compliance badge misread as endorsement** | Med | Med | Label as "documents checked on date X", show expiry dates, Admin verification SOP, disclaimers |
| R8 | **Regulatory change** (scholar transport, operator licensing, payments) | Low–Med | Med | Monitor Department of Transport / provincial rules; keep payments out of V1 |
| R9 | **Large incumbent or free competitor** | Low–Med | Med | Neighbourhood density, low price, speed of iteration, driver community |
| R10 | **Key-person / founder bandwidth** | Med | Med | Lean scope (PRD), documented tests/CI, part-time ops support |
| R11 | **Platform dependency (Supabase/hosting outage or pricing change)** | Low | Med | Standard Postgres schema (portable), backups, monitoring |

---

## 10. Metrics & Milestones

### 10.1 North-star and KPIs
- **North-star:** *Trips with complete check-ins per week* (every enrolled learner has `Picked Up`/`Dropped Off`/`Absent`).
- **Product KPIs:** see PRD §1.4 (P1–P7).
- **Business KPIs:**
  | KPI | Target (A#) |
  |---|---|
  | Activated drivers (route + ≥ 3 approved learners) | 5 by day 30; 40 by month 6; 150+ by month 12 |
  | Pilot → paid conversion | ≥ 50% (A13) |
  | Monthly logo churn (paying drivers) | ≤ 4% (A11) |
  | Parent-to-driver ratio | ≥ 8 linked parents per driver |
  | CAC / payback | ≤ R300 / ≤ 3 months |
  | NPS (drivers / parents) | ≥ 40 / ≥ 50 |
  | Support load | ≤ 0.5 tickets per driver per month |

### 10.2 Milestones
| Date (relative) | Milestone |
|---|---|
| T−4 weeks | PRD gates G1–G7 passing in CI; pilot drivers signed |
| T0 | Live in production; pilot starts |
| T+60 days | Pilot review: price test results, P1–P7 verdict, go/no-go for paid launch |
| T+3 months | Paid plans live; first R10 k MRR |
| T+6 months | 40–80 paying drivers; referral loop proven |
| T+12 months | 150–300 paying drivers; decide on payments/partner roadmap |

---

## 11. Assumptions to Validate
| ID | Assumption | Validation method | Owner / when |
|---|---|---|---|
| A1 | 3–4 M urban learners use taxi/kombi/car transport | Re-cut NHTS 2020 microdata; industry associations | Pre-launch |
| A2 | 10–20% of those are on contracted scholar transport | 20 driver interviews + 10 school interviews | Pre-launch |
| A3 | Avg. 12 learners per independent operator | Pilot roster data | Pilot |
| A4 | Gauteng ≈ 30% of addressable operators | Association / DoT data | Pre-launch |
| A5 | Drivers will pay R149/month | Pilot price tests (R99/R149/R199), Van Westendorp survey | Pilot |
| A6 | Typical monthly fee R1 000–R1 500 per learner | Ledger data + interviews | Pilot |
| A7 | Platform cost R10–R20 per driver | Actual Supabase/hosting bills at 100+ users | Month 3 |
| A8 | Payment collection costs R5–R10 per driver | Gateway quote | Pre-launch |
| A9 | Support 15–30 min/driver/month | Pilot support log | Pilot |
| A10 | Blended CAC ≤ R300 | Cost tracking per channel | Months 2–6 |
| A11 | Monthly churn ≤ 4% | Cohort analysis (excluding school holidays) | Months 3–9 |
| A12 | Break-even at 150–200 paying drivers | Update with real costs | Month 6 |
| A13 | ≥ 50% of pilot drivers convert to paid | Pilot funnel | Day 60 |

---

## 12. Legal, Compliance & Governance (checklist — requires qualified advice)
- **POPIA:** register an **Information Officer**; confirm whether registration with the Information Regulator is required; publish a privacy notice; parental consent captured at sign-up; breach-notification process; data-processing terms with sub-processors (Supabase, hosting, email). Children's data is special personal information (PRD §6.3).
- **Terms of Service:** SafeRide is an **information and record-keeping tool**; it is not a transport operator and does not guarantee safety, compliance or payment. Drivers remain solely responsible for licences, permits and operating authority.
- **Compliance badge wording:** state what was checked and when; avoid "approved/certified by SafeRide" language.
- **Consumer/e-commerce rules:** subscription terms, cancellation, refunds (verify under the Consumer Protection Act and ECTA).
- **Company & tax:** register the entity, VAT threshold monitoring, tax on subscription income.
- **Insurance:** consider cyber/professional indemnity once there are paying customers.
- **Payments (future):** do **not** handle funds without a licensed partner; get advice first.

---

## 13. Roadmap Beyond V1 (conditional on validation)
| Horizon | Candidates | Trigger |
|---|---|---|
| **V1.1 (0–3 mo.)** | Web push notifications, term-based billing/pause, WhatsApp share improvements, subscription status flag | Pilot feedback |
| **V1.2 (3–6 mo.)** | Fee reminders to parents, monthly statements (PDF), second language (isiZulu/Afrikaans) | Support data / churn reasons |
| **V2 (6–12 mo.)** | Payment-gateway integration, association dashboards, multi-vehicle/small-fleet accounts | ≥ 150 paying drivers, payment partner secured |
| **Later** | GPS/ETA (phone-based), school integrations, compliance verification add-on | Demand + unit economics proven |

---

## 14. Decisions Needed from the Founder
1. **Pricing:** confirm pilot price points to test (R99 / R149 / R199) and the free pilot length.
2. **Beachhead suburbs:** pick 2–3 Gauteng suburbs for density-first launch.
3. **Support capacity:** who runs onboarding and the WhatsApp support line?
4. **Legal:** engage a POPIA-aware attorney to review privacy notice, ToS, and Information Officer registration.
5. **Billing method for pilot-to-paid:** manual EFT invoicing vs. a debit-order/card-link provider.
