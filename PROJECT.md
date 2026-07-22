# PROJECT.md — LaviMD Referral App

> **Living product document.** This is the single source of truth for _what_ we are building
> and _why_. Engineering conventions (the _how_) live in [CLAUDE.md](CLAUDE.md).
>
> Keep this file current. When a product decision is made, record it here.

## Status legend

- 🟢 **Confirmed** — decided and stable.
- 🟡 **Proposed** — a sensible default proposed by engineering; **needs product-owner sign-off**.
- 🔴 **Open** — an unanswered question blocking or shaping future work.

> ⚠️ **Most business specifics below are 🟡 Proposed or 🔴 Open.** They were drafted by
> engineering to give the project a spine and must be confirmed by the product owner before
> they are treated as binding. Nothing marked 🟡/🔴 should be implemented as an
> irreversible rule until promoted to 🟢.

---

## Product vision

🟡 LaviMD Referral App streamlines how referrals flow to and through LaviMD, giving referrers
a fast, trustworthy way to submit and track referrals, and giving LaviMD staff a clear
pipeline to manage them from intake to completion.

🔴 **Core ambiguity to resolve:** Is a "referral" primarily…

1. **Clinical** — a provider refers a patient to a specialty/receiving provider (the model
   currently in `packages/shared`), or
2. **Growth / rewards** — a referrer (provider, partner, or patient) refers _new business_ to
   LaviMD and may earn a **commission** (implied by the "commission rules" requirement), or
3. **Both**, as distinct referral types under one platform.

This decision drives the data model, commission engine, and compliance scope for Milestone 2.
See [Open business questions](#open-business-questions).

## Target users

- 🟡 **Referrers** — the party who submits a referral. Depending on the model above: referring
  clinicians, partner organizations, or existing patients.
- 🟡 **LaviMD staff / coordinators** — triage, accept/decline, schedule, and complete referrals
  via the admin dashboard.
- 🟡 **Receiving providers / specialists** — the destination of a clinical referral.
- 🟡 **Administrators** — manage users, roles, commission configuration, and reporting.

🔴 Confirm the exact personas and which of them get the **mobile app** vs. the **admin dashboard**.

## Business rules

- 🟢 The system does **not** handle real PHI yet; no real patient data flows through any
  environment until the compliance milestone is complete (see [SECURITY.md](SECURITY.md)).
- 🟢 A referral moves only through **legal status transitions** enforced in code
  (`ALLOWED_TRANSITIONS` in `packages/shared`): `draft → submitted → accepted → scheduled →
completed`, with `declined`/`cancelled` as side exits. Terminal states are immutable.
- 🟡 Every referral has exactly one **referrer** and one **owning LaviMD coordinator** once accepted.
- 🟡 Referrals are **append-only for history**: status changes and edits are recorded, never
  silently overwritten (foundation for future audit/compliance).
- 🔴 Who may create, view, edit, or cancel a referral (authorization matrix)?
- 🔴 SLA/time limits on each status (e.g., auto-expire stale `submitted` referrals)?

## Commission rules

> 🔴 **Entirely unconfirmed.** Commissions were named as a requirement but no amounts,
> eligibility, or payout mechanics have been provided. The structure below is a 🟡 _proposed
> framework_ to be filled in — **do not implement any specific rate or payout until signed off.**

- 🟡 A commission is earned only when a referral reaches a defined **qualifying event**
  (proposed: `completed`), never merely on submission.
- 🟡 Commission is computed by a **versioned rule set**; changing rates creates a new version and
  never retroactively alters commissions already earned under a prior version.
- 🟡 Every commission calculation is **auditable**: inputs, rule version, and result are recorded.
- 🔴 Commission **model**: flat fee per referral? percentage of service value? tiered by volume?
- 🔴 **Amounts / rates** and currency.
- 🔴 **Eligibility**: who can earn (providers? partners? patients?) and any legal constraints
  (e.g., anti-kickback / Stark Law considerations for clinical referrals — **needs legal review**).
- 🔴 **Payout**: cadence, minimum threshold, method (integration), tax handling (e.g., 1099).
- 🔴 **Clawback**: what happens if a completed referral is later reversed/refunded?

> ⚠️ **Compliance flag:** paying commissions for _clinical patient referrals_ can implicate
> healthcare anti-kickback statutes. This must be reviewed by legal/compliance before any
> commission logic ships. Engineering will not implement clinical-referral commissions until
> this is cleared.

## Referral rules

- 🟢 Referral lifecycle and legal transitions are defined in code (see [Business rules](#business-rules)).
- 🟡 Required fields at creation (current schema): `patientRef` (opaque, non-PHI),
  `referringProviderId`, `specialty`, `reason`, `priority`; optional `receivingProviderId`, `notes`.
- 🟡 `priority` ∈ `routine | urgent | emergent`; defaults to `routine`.
- 🔴 Duplicate-detection rules (same patient + specialty within N days)?
- 🔴 Required attachments/documents, and how they are stored (PHI-bearing → deferred to compliance milestone)?
- 🔴 Notification rules (who is notified on each transition, and via which channel)?

## Branding

- 🟡 **Name:** LaviMD. Tone: trustworthy, clinical-grade, calm, efficient. Avoids "salesy" framing
  even where commissions exist.
- 🔴 Official logo, wordmark, and brand assets (none provided yet).
- 🔴 Voice & tone guidelines, do's/don'ts.

## UI direction

- 🟡 Clean, high-contrast, information-dense where it helps staff (tables, pipelines) and
  low-friction where it helps referrers (short forms, clear status).
- 🟡 Accessibility is a first-class constraint, not a retrofit (see [CLAUDE.md](CLAUDE.md)).
- 🟡 Consistent design tokens shared across admin (web) and mobile, sourced from one place.
- 🔴 Design system choice (e.g., custom tokens + Radix/shadcn on web; React Native equivalent).

## Color palette

> 🟡 **Proposed starter palette** — a calm, clinical, trustworthy scheme. Replace hex values
> once official brand colors exist. Contrast pairings must meet WCAG 2.1 AA.

| Token            | Hex       | Use                            |
| ---------------- | --------- | ------------------------------ |
| `primary`        | `#0F766E` | Primary actions, brand accents |
| `primary-strong` | `#0B5750` | Hover/pressed, emphasis        |
| `primary-subtle` | `#CCFBF1` | Tints, selected backgrounds    |
| `accent`         | `#2563EB` | Links, secondary emphasis      |
| `success`        | `#15803D` | Completed / positive states    |
| `warning`        | `#B45309` | Urgent / needs attention       |
| `danger`         | `#B91C1C` | Declined / destructive         |
| `info`           | `#0369A1` | Informational                  |
| `neutral-900`    | `#0F172A` | Primary text                   |
| `neutral-600`    | `#475569` | Secondary text                 |
| `neutral-200`    | `#E2E8F0` | Borders, dividers              |
| `neutral-050`    | `#F8FAFC` | App background                 |

🟡 Status colors should map to referral states: `submitted`→info, `accepted`→primary,
`scheduled`→accent, `completed`→success, `declined`/`cancelled`→neutral/danger, `urgent`/`emergent`→warning/danger.

## Typography

> 🟡 **Proposed.**

- **UI / body:** Inter (system-ui fallback: `-apple-system, Segoe UI, Roboto, sans-serif`).
- **Numeric / financial data:** tabular figures (e.g., Inter with `font-variant-numeric: tabular-nums`)
  so commission and count columns align.
- **Scale:** modular, e.g. 12 / 14 / 16 / 20 / 24 / 32 px; base body 16px; line-height ≥ 1.5 for body.
- 🔴 Confirm licensed brand fonts, if any.

## Roadmap

Milestone detail lives in [docs/milestones.md](docs/milestones.md). Summary:

1. 🟢 **M1 — Monorepo foundation & CI/CD** (done)
2. ⏳ **M2 — Backend API foundation** (NestJS, Postgres/Prisma, referral CRUD + transitions)
3. ⏳ **M3 — Admin dashboard** (Next.js)
4. ⏳ **M4 — Mobile app** (Expo React Native)
5. ⏳ **M5 — Auth & RBAC**
6. ⏳ **M6 — Infrastructure & deployment (AWS)**
7. ⏳ **M7 — Compliance (HIPAA) hardening** (gate before any real PHI)
8. 🔴 **M? — Commission engine** (position depends on the clinical-vs-growth decision)

## Future ideas

- 🟡 Analytics dashboard: referral volume, conversion, time-in-status, commission earned.
- 🟡 Bulk referral import / EHR integration.
- 🟡 In-app messaging between referrer and coordinator.
- 🟡 Referrer self-service portal for commission statements.
- 🟡 Automated SLA reminders and escalations.

## Product decisions

A dated log of decisions promoted to 🟢. (Append-only; do not rewrite history.)

- **2026-07-21** — Stack: TypeScript monorepo (pnpm + Turborepo), NestJS + PostgreSQL/Prisma,
  Expo mobile, Next.js admin, AWS (cloud-portable). No real PHI in the current phase; full
  HIPAA controls deferred to M7. _(See git history for M1.)_

## Open business questions

Ordered roughly by how much they block upcoming work.

1. 🔴 **Referral type** — clinical, growth/rewards, or both? _(Blocks M2 data model.)_
2. 🔴 **Commission model, rates, eligibility, and payout** — plus anti-kickback/Stark legal review
   for any clinical-referral commissions. _(Blocks the commission engine.)_
3. 🔴 **Authorization matrix** — which roles can do what to a referral. _(Blocks M5, shapes M2.)_
4. 🔴 **Which users get mobile vs. admin.**
5. 🔴 **Notification requirements** (events, channels, providers).
6. 🔴 **Official branding** — logo, colors, fonts, voice.
7. 🔴 **When does real PHI enter**, and therefore when M7 must complete.

## Integrations

> 🟡 Anticipated; confirm before selecting vendors. All vendors touching PHI require a BAA (see SECURITY.md).

- **Auth / identity** — TBD (e.g., managed provider vs. in-house). Decided in M5.
- **Email / SMS notifications** — TBD (e.g., transactional email + SMS provider).
- **Payments / payouts** — 🔴 only if commissions are paid out through the platform.
- **EHR / clinical systems** — 🔴 only if clinical referrals integrate with external systems (PHI → M7).
- **Observability** — logging/metrics/error tracking, chosen in M6.

## APIs

- 🟢 **Internal API** — the NestJS backend (M2) exposes a versioned REST API consumed by the admin
  dashboard and mobile app. Contracts are defined by shared Zod schemas / types in `packages/shared`.
- 🟡 API is **versioned** (e.g., `/api/v1`) and backward-compatible within a major version.
- 🟡 OpenAPI documentation generated from the backend.
- 🔴 Any **public / partner-facing API**? If so, separate auth, rate limiting, and SLAs apply.

## Things that must never change

These are invariants. Changing any of them requires an explicit, recorded product+engineering
decision (a new entry in [Product decisions](#product-decisions)).

- 🟢 **No PHI in logs, URLs, analytics, or error payloads — ever.**
- 🟢 **No secrets or credentials committed to the repository.**
- 🟢 **Untrusted input is validated at the boundary** (shared Zod schemas) before use.
- 🟢 **Shared types are the single contract** between client and server; apps never duplicate
  or diverge domain contracts.
- 🟢 **Referral history is append-only / auditable**; terminal referral states are immutable.
- 🟢 **Commission calculations are versioned and never retroactively altered** once earned.
- 🟢 **The repository is never left in a broken state**; `main` always passes CI.
- 🟡 **API backward compatibility within a major version.**

> Business invariants (e.g., specific commission guarantees) will be added here **only** after
> the corresponding 🔴/🟡 items are confirmed by the product owner.
