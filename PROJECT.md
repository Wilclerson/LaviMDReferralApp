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
- 🟡 Attribution is single-partner per referral; last-touch vs. first-touch is TBD (see open questions).
- 🔴 Authorization matrix: exactly which roles can create/read/approve/reject/reverse each entity.

## Commission rules

> Structure is 🟢 confirmed; **amounts and payout mechanics are 🔴 open** — no specific rate or
> payout is implemented. `computeCommissionMinor(amount, rateBasisPoints)` takes the rate as an
> input; rates come from a versioned rule set, never hard-coded.

- 🟢 Commission is granted **only on administrator-approved eligible transactions**.
- 🟢 Money is represented in integer **minor units** (e.g. cents) with an ISO-4217 currency —
  never floats.
- 🟡 Each commission records the **rule-set version** used, so rate changes never retroactively
  alter commissions already computed.
- 🟡 Every commission is **auditable**: eligible amount, rate/rule version, computed amount,
  approver, and timestamps are recorded.
- 🔴 **Commission model & rates**: flat per transaction? percentage (bps)? tiered by category/volume?
- 🔴 **Eligible transaction**: the precise definition of what qualifies (product, first purchase
  only?, refunds excluded?).
- 🔴 **Attribution window**: how long after invite/sign-up a transaction still attributes.
- 🔴 **Payout**: cadence, minimum threshold, method/integration, tax handling (e.g. 1099).
- 🔴 **Clawback**: handling when an approved/paid transaction is later refunded/reversed
  (state machine supports `reversed`; policy is open).
- 🔴 **Legal review**: influencer/endorsement disclosure (FTC) and any healthcare-marketing
  constraints (e.g. anti-kickback if federal healthcare-program dollars are ever involved).
  **Needs legal sign-off before launch.**

## Referral rules

- 🟢 A referral is a marketing **attribution**, not a clinical event.
- 🟢 Fields at creation (current schema): `partnerId`, `referralCode`, `channel`
  (`link | code | content | invite`, default `link`); optional opaque `customerRef` set on sign-up.
- 🟢 `referralCode` is 6–20 uppercase alphanumerics.
- 🔴 Duplicate/fraud detection (same customer across partners, self-referral).
- 🔴 Notification rules (who is notified on each transition, via which channel).

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
3. ⏳ **M2 — Backend API foundation** (NestJS, Postgres/Prisma: partners, referrals, transactions,
   commissions, admin approval)
4. ⏳ **M3 — Admin dashboard** (Next.js: review/approval queues, partner management, reporting)
5. ⏳ **M4 — Partner mobile app** (Expo: links, referrals, earnings)
6. ⏳ **M5 — Auth & RBAC** (partner vs. administrator)
7. ⏳ **M6 — Commission engine & payouts** (versioned rules, statements, payout integration)
8. ⏳ **M7 — Infrastructure & deployment (AWS)**
9. ⏳ **M8 — Security & data-protection hardening** (before any sensitive customer data at scale)

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

## Open business questions

Ordered roughly by how much they block upcoming work.

1. 🔴 **Eligible-transaction definition** — what exactly qualifies for commission. _(Blocks M2 model.)_
2. 🔴 **Commission model & rates**, currency, and any category/tier differences. _(Blocks M6.)_
3. 🔴 **Payout** mechanics — cadence, threshold, method/integration, tax. _(Blocks M6.)_
4. 🔴 **Attribution model & window** — first- vs. last-touch, and expiry. _(Shapes M2.)_
5. 🔴 **Authorization matrix** — partner vs. admin capabilities. _(Blocks M5, shapes M2.)_
6. 🔴 **Legal** — FTC endorsement/influencer disclosure and healthcare-marketing review.
7. 🔴 **Which users get mobile vs. admin**, and notification requirements.
8. 🔴 **Official branding** — logo, colors, fonts, voice, required disclaimers.

## Integrations

> 🟡 Anticipated; confirm before selecting vendors.

- **Auth / identity** — partner and administrator sign-in (M5).
- **Email / SMS** — invites, transaction/commission notifications, payout statements.
- **Payments / payouts** — 🔴 partner commission payouts (e.g. a payouts provider). Selected in M6.
- **LaviMD core / commerce** — source of the **eligible transactions** that drive commissions;
  integration shape is 🔴 open (event feed vs. API vs. manual admin entry).
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
- 🟢 **Commission calculations are versioned and never retroactively altered** once earned.
- 🟢 **No PHI** in logs, URLs, analytics, error payloads, or the domain model; customers are
  referenced only by opaque, non-PHI identifiers.
- 🟢 **No secrets or credentials committed to the repository.**
- 🟢 **Untrusted input is validated at the boundary** (shared Zod schemas) before use.
- 🟢 **Shared types are the single contract** between client and server.
- 🟢 **The repository is never left in a broken state**; `main` always passes CI.
- 🟡 **API backward compatibility within a major version.**
