# PROJECT.md — LaviMD Referral App

> **Living product document.** This is the single source of truth for _what_ we are building
> and _why_. Engineering conventions (the _how_) live in [CLAUDE.md](CLAUDE.md).
>
> Keep this file current. When a product decision is made, record it here.

## Status legend

- 🟢 **Confirmed** — decided and stable.
- 🟡 **Proposed** — a sensible default proposed by engineering; **needs product-owner sign-off**.
- 🔴 **Open** — an unanswered question blocking or shaping future work.

---

## Product vision

🟢 LaviMD Referral App is a **Professional Partner Network** — a **marketing / affiliate
referral platform**. Non-medical professionals ("partners") share educational content and
referral links to invite customers to LaviMD, and earn commission when those customers complete
**administrator-approved eligible transactions**.

🟢 **This is NOT a clinical referral platform.** It does not model provider-to-provider referrals
or any clinical decision-making. All medical decisions — diagnosis, prescriptions, treatment
recommendations — remain solely within LaviMD and its licensed providers, and are out of scope
for this system.

## Target users

- 🟢 **Partners** — non-medical professionals who promote LaviMD and earn commission. Categories:
  Personal Trainers, Hairstylists, Estheticians, Barbers, Wellness Coaches, Massage Therapists,
  Chiropractors, Gyms, Influencers.
- 🟢 **LaviMD administrators** — review and **approve/reject** eligible transactions and
  commissions, manage partners, and configure the program.
- 🟢 **Customers** — people invited to LaviMD by a partner. Their clinical relationship is with
  LaviMD's licensed providers and lives outside this system; here they are only an opaque,
  non-PHI attribution reference.
- 🔴 Which users get the **mobile app** vs. the **admin dashboard** (assumption: partners →
  mobile/portal, administrators → dashboard). Confirm.

## What partners may and may not do

🟢 **Partners MAY only:**

- Share educational content provided/approved by LaviMD.
- Share referral links / codes.
- Invite customers to LaviMD.
- Receive commission **only on administrator-approved eligible transactions**.

🟢 **Partners MUST NEVER:**

- Practice medicine, diagnose, prescribe, or recommend treatments.
- Represent themselves as LaviMD clinical staff or give medical advice.

These are hard product invariants — see [Things that must never change](#things-that-must-never-change).

## Roles & authorization matrix

🟢 Four roles. **All authorization is role-based and enforced server-side, deny-by-default.**
Client permissions are never trusted — the UI may render from these rules, but every decision is
re-checked on the server. Implemented in `packages/shared/src/domain/authorization.ts`.

| Capability                                             | Super Admin | Administrator | Partner | Customer |
| ------------------------------------------------------ | :---------: | :-----------: | :-----: | :------: |
| Full system access                                     |     ✅      |      ❌       |   ❌    |    ❌    |
| Manage administrators                                  |     ✅      |      ❌       |   ❌    |    ❌    |
| Create/manage Super Admins                             |     ✅      |      ❌       |   ❌    |    ❌    |
| Configure system & security settings                   |     ✅      |      ❌       |   ❌    |    ❌    |
| Configure integrations                                 |     ✅      |      ❌       |   ❌    |    ❌    |
| View audit logs                                        |     ✅      |      ❌       |   ❌    |    ❌    |
| Configure commission plans                             |     ✅      |      ❌       |   ❌    |    ❌    |
| Configure payout settings                              |     ✅      |      ❌       |   ❌    |    ❌    |
| Manage partner categories                              |     ✅      |      ❌       |   ❌    |    ❌    |
| Approve / suspend partners                             |     ✅      |      ✅       |   ❌    |    ❌    |
| Manage referrals / view any referral                   |     ✅      |      ✅       |   ❌    |    ❌    |
| Review transactions / view any transaction             |     ✅      |      ✅       |   ❌    |    ❌    |
| Approve commissions / view any commission              |     ✅      |      ✅       |   ❌    |    ❌    |
| Create payout batches / view any payout                |     ✅      |      ✅       |   ❌    |    ❌    |
| Manage education, marketing assets, announcements      |     ✅      |      ✅       |   ❌    |    ❌    |
| Full financial reporting (`financial_report.view_all`) |     ✅      |      ❌       |   ❌    |    ❌    |
| Operational financial data only (`…view_operational`)  |     ✅      |      ✅       |   ❌    |    ❌    |
| Edit own profile / upload own documents                |     ✅      |       —       |   ✅    |    ❌    |
| View education / complete certifications               |     ✅      |      ✅       |   ✅    |   ✅¹    |
| Access marketing materials                             |     ✅      |      ✅       |   ✅    |    ❌    |
| View **own** referrals / commissions / payouts / txns  |     ✅      |       —       |   ✅    |    ❌    |
| Generate referral links & QR codes                     |     ✅      |       —       |   ✅    |    ❌    |
| Complete onboarding / manage own account               |     ✅      |      ✅       |   ✅    |    ✅    |

¹ Customers may view educational content; certifications are partner-only.

🟢 **Financial visibility is split:** Super Admin holds `financial_report.view_all` (full financial
reporting). Administrators hold only `financial_report.view_operational` — the transaction,
commission, and payout figures their duties require, never program-wide reporting.

🟡 **Future:** permissions become individually configurable rather than tied directly to roles.
The code already supports this: roles supply _defaults_ and `resolvePermissions(role, overrides)`
applies per-user `allow`/`deny` overrides (deny always wins), stored in the `PermissionGrant`
table. Enforcement checks a resolved permission set, never the role — so enabling configurable
permissions is a data change, not a rewrite.

**Partners may never:** view another partner's information, approve commissions, modify commission
rules, view financial reports, view audit logs, view customer clinical information, or view
transactions that are not theirs. Partner-owned records are scoped by
`canViewPartnerOwnedResource`.

**Customers** never see commissions or partner administration.

🟢 **Customer registration is a public, unauthenticated action for the MVP** — deliberately not a
permission, since no session exists at sign-up. It is protected by: per-IP **rate limiting**,
strict schema **validation**, mandatory **consent capture** (append-only records for terms,
privacy, and marketing), and **abuse prevention** — the response is identical whether or not the
email is already registered, so the endpoint cannot be used to enumerate accounts.

> There is deliberately **no permission for customer clinical information** — the platform holds no
> clinical data at all, so such access is denied by absence rather than by rule.

## Audit logging

🟢 **Every sensitive administrator action creates an immutable audit record.** The trail is
append-only: no update or delete path exists anywhere in the application.

Audited actions: **Partner Approved**, **Partner Suspended**, **Commission Approved**,
**Commission Rejected**, **Commission Reversed**, **Payout Created**, **Payout Approved**,
**Payout Cancelled**, **Commission Plan Changed**, **Role Changed**, **Permission Changed**,
**Manual Attribution Override**, **Manual Transaction Import**.

🟢 Every audit entry stores: **user** (actor id + role), **timestamp**, **IP** (when available),
**previous value**, **new value**, and a **reason** — the reason is required, so privileged
actions always explain themselves.

## Business rules

- 🟢 Partners are non-medical and act only as described above.
- 🟢 **Commission is earned only on administrator-approved eligible transactions** — never on
  sign-up, click, or an unreviewed transaction.
- 🟢 The affiliate funnel is: **Partner → Referral (attribution) → eligible Transaction →
  Commission (admin-approved) → Payout.**
- 🟢 A **referral** tracks attribution through a status machine (`packages/shared`):
  `pending → signed_up → converted`, with `expired`/`cancelled` as exits; `converted` may still be
  `cancelled` (e.g. fraud reversal).
- 🟢 A **commission** moves `pending_review → approved → paid`, with `rejected` and `reversed`
  (clawback) as defined exits. It becomes payable **only** at `approved`.
- 🟢 Only **active** partners accrue commission on new eligible transactions.
- 🟢 Attribution is **Last-Click** with a **30-day** window; the newest referral within the window
  owns attribution (details under [Referral & attribution rules](#referral--attribution-rules)).
- 🟢 Access is governed by the four-role [authorization matrix](#roles--authorization-matrix),
  enforced server-side and deny-by-default.

## Eligible transactions

🟢 A transaction is **eligible** for commission only when **all** of the following hold — and it
is **not** merely a lead:

1. It is a completed purchase that originated from a valid referral.
2. Payment has successfully **settled**.
3. It has **not** been refunded.
4. It has **not** been charged back.
5. It has **not** been cancelled.
6. The referral **attribution is valid**.
7. The **partner is active**.
8. An **administrator approves** the commission.

Conditions 1–7 are objective and evaluated by `evaluateTransactionEligibility` in
`packages/shared`; condition 8 is the final, separate gate (the commission state machine). **No
commission is earned until an administrator approves it.**

## Commission rules & plans

- 🟢 Commission is granted **only on administrator-approved eligible transactions**.
- 🟢 Administrators can create **multiple commission plans**. Every plan is **versioned**; earned
  commissions reference the exact plan version used, so rate changes never apply retroactively.
- 🟢 Plans support multiple **levels** (e.g. Level 1 = 10%, Level 2 = 3%).
- 🟢 Each level's calculation type is **percentage**, **flat amount**, or **hybrid** (flat +
  percentage). **Rates/amounts are always data — never hard-coded.** `computeRuleCommissionMinor`
  takes the rule (rate in basis points / flat in minor units) as input.
- 🟢 Money is integer **minor units** with an ISO-4217 currency — never floats.
- 🟢 Every commission is **auditable**: eligible amount, plan id + version + level, computed
  amount, approver, and timestamps.
- 🟡 Example starter plan (illustrative, admin-configurable): L1 10%, L2 3%.
- 🔴 **Clawback policy** when an approved/paid transaction is later refunded/reversed (the state
  machine supports `reversed`; the operational policy is open).
- 🔴 **Legal review**: influencer/endorsement disclosure (FTC) and any healthcare-marketing
  constraints. **Needs legal sign-off before launch.**

## Referral & attribution rules

- 🟢 A referral is a marketing **attribution**, not a clinical event. Fields at creation:
  `partnerId`, `referralCode`, `channel` (`link | code | content | invite`, default `link`);
  optional opaque `customerRef` set on sign-up. `referralCode` is 6–20 uppercase alphanumerics.
- 🟢 **Attribution model: Last Click.** Cookie duration **30 days**. If another referral occurs
  within 30 days, the **newest referral owns attribution** (`resolveLastClickAttribution`).
- 🟢 Administrators may **manually override** attribution. **All overrides must be audited.**
- 🔴 Duplicate/fraud detection (same customer across partners, self-referral).
- 🔴 Notification rules (who is notified on each transition, via which channel).

## Payouts

- 🟢 **Frequency: monthly.**
- 🟢 **Minimum balance: $50** (`DEFAULT_MINIMUM_PAYOUT_BALANCE_MINOR = 5000`; policy-configurable).
- 🟢 **Methods: ACH, PayPal, Manual.**
- 🟢 **No automatic payouts in MVP.** Every payout **requires administrator approval**.
- 🟢 Every payout creates an **immutable, append-only ledger record** (`LedgerEntry`); the ledger
  is the source of truth for partner balances.
- 🔴 Tax handling (e.g. 1099) and payout-provider selection (see Integrations).

## Transaction ingestion

- 🟢 Ingestion is behind an **abstraction layer** supporting: **manual import, CSV import, REST
  API, and webhooks** (`TransactionSource = manual | csv | api | webhook`).
- 🟢 **MVP:** transactions are entered/approved **manually in the Admin Dashboard**.
- 🟡 **Future integrations:** WooCommerce, Hint, Stripe (adapters implement the same ingestion
  contract). See [Integrations](#integrations).

## Event-driven architecture

- 🟢 The backend is **event-driven**: business logic reacts to domain events rather than directly
  calling unrelated services.
- 🟢 Events are published through a **simple internal in-process event bus** — no external broker
  in MVP (deliberately not overengineered).
- 🟢 Event catalog (`DOMAIN_EVENT_TYPES` in `packages/shared`): `ReferralCreated`,
  `ReferralClicked`, `ReferralRegistered`, `PurchaseCompleted`, `CommissionPending`,
  `CommissionApproved`, `CommissionPaid`, `PayoutCreated`, `PayoutCompleted`.
- 🟢 The `EventPublisher` contract lives in `packages/shared`; the bus implementation lands in the
  backend (M2).

## Branding

- 🟡 **Name:** LaviMD. Tone: trustworthy, professional, wellness-oriented, clear about the
  partner (non-clinical) relationship.
- 🔴 Official logo, wordmark, and brand assets (none provided yet).
- 🔴 Voice & tone guidelines; required partner disclosures/disclaimers.

## UI direction

- 🟡 Two surfaces with different priorities: a **partner** experience (simple: my links, my
  referrals, my earnings) and an **admin** experience (dense: review queues, approvals, reporting).
- 🟡 Accessibility is a first-class constraint (see [CLAUDE.md](CLAUDE.md)).
- 🟡 Shared design tokens across admin (web) and mobile from one source.
- 🔴 Design system choice (e.g. tokens + Radix/shadcn on web; RN equivalent).

## Color palette

> 🟡 **Proposed starter palette** — calm, professional, wellness-leaning. Replace hex values once
> official brand colors exist. Contrast pairings must meet WCAG 2.1 AA.

| Token            | Hex       | Use                            |
| ---------------- | --------- | ------------------------------ |
| `primary`        | `#0F766E` | Primary actions, brand accents |
| `primary-strong` | `#0B5750` | Hover/pressed, emphasis        |
| `primary-subtle` | `#CCFBF1` | Tints, selected backgrounds    |
| `accent`         | `#2563EB` | Links, secondary emphasis      |
| `success`        | `#15803D` | Approved / paid / positive     |
| `warning`        | `#B45309` | Needs review / attention       |
| `danger`         | `#B91C1C` | Rejected / reversed            |
| `info`           | `#0369A1` | Informational                  |
| `neutral-900`    | `#0F172A` | Primary text                   |
| `neutral-600`    | `#475569` | Secondary text                 |
| `neutral-200`    | `#E2E8F0` | Borders, dividers              |
| `neutral-050`    | `#F8FAFC` | App background                 |

🟡 Suggested status mappings — referral: `pending`→neutral, `signed_up`→info, `converted`→success,
`expired`/`cancelled`→neutral/danger. Commission: `pending_review`→warning, `approved`→primary,
`paid`→success, `rejected`/`reversed`→danger.

## Typography

> 🟡 **Proposed.**

- **UI / body:** Inter (fallback `-apple-system, Segoe UI, Roboto, sans-serif`).
- **Money / counts:** tabular figures (`font-variant-numeric: tabular-nums`) so earnings columns align.
- **Scale:** 12 / 14 / 16 / 20 / 24 / 32 px; base body 16px; line-height ≥ 1.5 for body.
- 🔴 Confirm any licensed brand fonts.

## Roadmap

Milestone detail lives in [docs/milestones.md](docs/milestones.md). Summary:

1. 🟢 **M1 — Monorepo foundation & CI/CD** (done)
2. 🟢 **M1.5 — Domain remodel to the affiliate/partner-network model** (done)
3. 🟢 **M1.7 — Affiliate rules in the domain** (done): eligibility, commission plans, attribution,
   payouts, ledger, and the event catalog in `packages/shared`
4. 🟢 **M2 — Backend API foundation** (done): NestJS + Postgres/Prisma, JWT auth, RBAC guards,
   partner/referral/transaction/commission/ledger/audit modules, in-process event bus, OpenAPI,
   Docker, migrations, seed
5. 🟢 **M2.1 — Database validation & hardening** (done): schema verified against real PostgreSQL,
   42 integration tests, idempotent ingestion, public customer registration with consent capture
   and rate limiting, production-only Docker runtime
6. ⏳ **M3 — Admin dashboard** (Next.js: review/approval queues, partner management, reporting)
7. ⏳ **M4 — Partner mobile app** (Expo: links, referrals, earnings)
8. ⏳ **M5 — Auth & RBAC** (partner vs. administrator)
9. ⏳ **M6 — Commission engine & payouts** (versioned rules, statements, payout integration)
10. ⏳ **M7 — Infrastructure & deployment (AWS)**
11. ⏳ **M8 — Security & data-protection hardening** (before any sensitive customer data at scale)

## Future ideas

- 🟡 Partner analytics: clicks, sign-ups, conversion rate, earnings over time.
- 🟡 Content library partners can share (LaviMD-approved educational assets).
- 🟡 Tiered/bonus commission programs; referral leaderboards.
- 🟡 Automated payout statements and tax-document generation.
- 🟡 Fraud/self-referral detection.

## Product decisions

A dated log of decisions promoted to 🟢. (Append-only; do not rewrite history.)

- **2026-07-21** — Stack: TypeScript monorepo (pnpm + Turborepo), NestJS + PostgreSQL/Prisma,
  Expo mobile, Next.js admin, AWS (cloud-portable). No real PHI in the current phase.
- **2026-07-21** — **Product is a Professional Partner Network (marketing/affiliate referral
  platform), NOT a clinical referral system.** Partners are non-medical and only share content /
  links, invite customers, and earn commission on **administrator-approved eligible transactions**.
  No provider-to-provider or clinical referrals are modeled. The clinical domain from M1 was
  replaced with a Partner → Referral → Transaction → Commission → Payout model (M1.5).
- **2026-07-21** — **Affiliate rules confirmed and encoded in `packages/shared`:** the 8-point
  eligible-transaction definition; commission plans (percentage/flat/hybrid, multi-level, versioned;
  rates never hard-coded); **Last-Click** attribution with a **30-day** window (newest wins;
  admin overrides audited); payouts (**monthly**, **$50** minimum, **ACH/PayPal/Manual**, no
  automatic payouts in MVP, admin-approved, immutable ledger); a transaction **ingestion
  abstraction** (manual/CSV/REST/webhook; MVP = manual admin approval; future: WooCommerce, Hint,
  Stripe); and an **event-driven** design over a simple in-process bus with a 9-event catalog.
- **2026-07-21** — **Authorization matrix confirmed:** four roles (Super Admin, Administrator,
  Partner, Customer) with an explicit permission catalog, encoded in
  `packages/shared/src/domain/authorization.ts`. Authorization is role-based, **server-side, and
  deny-by-default**; client permissions are never trusted. Administrators cannot change
  system/security settings or create Super Admins; partners can only ever see their own data.
- **2026-07-22** — **Administrator financial visibility limited to operational needs**
  (`financial_report.view_operational`); full financial reporting is Super Admin only
  (`financial_report.view_all`). **Permissions are designed to become configurable later**:
  roles supply defaults, per-user `allow`/`deny` overrides resolve on top (deny wins), and
  enforcement checks the resolved set rather than the role.
- **2026-07-22** — **Immutable audit logging is mandatory for every privileged administrator
  action**, storing user, timestamp, IP (when available), previous value, new value, and a
  required reason. See [Audit logging](#audit-logging).

## Open business questions

Ordered roughly by how much they block upcoming work. _(The eligible-transaction definition,
commission model, attribution, and payout mechanics are now resolved — see Product decisions.)_

1. 🔴 **Clawback policy** — handling refunds/chargebacks after approval/payment. _(Shapes M6.)_
2. 🔴 **Legal** — FTC endorsement/influencer disclosure and healthcare-marketing review.
3. 🔴 **Payout provider & tax** — ACH/PayPal provider selection and 1099 handling. _(Shapes M6.)_
4. 🔴 **Which users get mobile vs. admin**, and notification requirements.
5. 🔴 **Official branding** — logo, colors, fonts, voice, required disclaimers.
6. 🔴 **Fraud/duplicate detection** — self-referral and cross-partner rules.
7. 🔴 **Consent policy versions** — who owns the terms/privacy text and its version string, and
   what happens when it changes (re-consent prompt?).

## Integrations

> 🟡 Anticipated; confirm before selecting vendors.

- **Auth / identity** — partner and administrator sign-in (M5).
- **Email / SMS** — invites, transaction/commission notifications, payout statements.
- **Payments / payouts** — 🟢 methods are ACH, PayPal, Manual; 🔴 provider selection in M6.
- **Commerce / transaction sources** — 🟢 ingestion abstraction accepts manual, CSV, REST API, and
  webhook sources. MVP is manual admin entry; 🟡 future adapters: **WooCommerce, Hint, Stripe**.
- **Observability** — logging/metrics/error tracking (M7).

## APIs

- 🟢 **Internal API** — the NestJS backend (M2) exposes a versioned REST API consumed by the admin
  dashboard and partner mobile app. Contracts come from the shared Zod schemas/types in
  `packages/shared`.
- 🟡 API is **versioned** (e.g. `/api/v1`) and backward-compatible within a major version, with
  generated OpenAPI docs.
- 🔴 Any **partner-facing public API** (for influencers/tools)? If so, separate auth, rate limits, SLAs.

## Things that must never change

Invariants. Changing any of them requires an explicit, recorded decision (a new entry in
[Product decisions](#product-decisions)).

- 🟢 **Partners never practice medicine, diagnose, prescribe, or recommend treatments**, and the
  product never presents partner actions as medical advice.
- 🟢 **All medical decisions remain solely with LaviMD's licensed providers** and are out of scope
  for this system.
- 🟢 **Commission is paid only on administrator-approved eligible transactions** — never
  automatically on click, sign-up, or an unreviewed transaction.
- 🟢 **Money is stored in integer minor units** with an explicit currency; never floats.
- 🟢 **Commission calculations are versioned and never retroactively altered** once earned;
  commission rates/amounts are never hard-coded.
- 🟢 **Attribution is Last-Click within the configured window** (default 30 days); administrator
  overrides are always audited.
- 🟢 **Payouts require administrator approval and are never automatic**; every payout writes an
  immutable, append-only ledger record.
- 🟢 **No PHI** in logs, URLs, analytics, error payloads, or the domain model; customers are
  referenced only by opaque, non-PHI identifiers.
- 🟢 **All authorization is role-based and enforced server-side, deny-by-default. Client-supplied
  permissions, roles, or capability flags are never trusted.**
- 🟢 **Partners can only ever see their own data** (referrals, transactions, commissions, payouts);
  they never see another partner's information, financial reports, or audit logs.
- 🟢 **Administrators can never change system/security settings or create Super Admins.**
- 🟢 **Every sensitive administrator action writes an immutable audit record** (user, timestamp,
  IP when available, previous value, new value, reason). Audit entries are never updated or deleted.
- 🟢 **No secrets or credentials committed to the repository.**
- 🟢 **Untrusted input is validated at the boundary** (shared Zod schemas) before use.
- 🟢 **Shared types are the single contract** between client and server.
- 🟢 **The repository is never left in a broken state**; `main` always passes CI.
- 🟡 **API backward compatibility within a major version.**
