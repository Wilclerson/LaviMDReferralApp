# Security & Compliance

## Reporting a vulnerability

Do not open a public issue for security vulnerabilities. Contact the LaviMD maintainers
privately so the issue can be triaged and fixed before disclosure.

## Scope

LaviMD Referral App is a **marketing / affiliate referral platform** (a Professional Partner
Network), **not** a clinical system. It deliberately handles **no Protected Health Information
(PHI)** — customers are referenced only by opaque, non-PHI identifiers. It does, however, handle:

- **Partner PII** (e.g. name, email).
- **Financial data** (eligible transaction amounts, commissions, and future payouts).
- **Attribution data** (referral codes/links and opaque customer references).

Security is designed around protecting that data.

## Current posture

- **No PHI by design.** No clinical data is modeled, logged, placed in URLs/analytics, or stored.
  Customers appear only as opaque references. See [PROJECT.md](PROJECT.md) invariants.
- **No secrets in the repo.** Secrets come from environment variables; `.env*` is git-ignored;
  `*.example` files document required keys without values.
- **Input validation at the boundary.** Untrusted input is validated with Zod schemas from
  `packages/shared` before use.
- **Financial integrity.** Money is stored in integer minor units with an explicit currency
  (never floats). Commission is payable **only** after administrator approval, enforced by the
  domain state machine. Commission calculations are versioned and auditable.
- **Type safety and linting** enforced in CI (type-aware ESLint, `tsc`, zero warnings).
- **Least-privilege CI.** GitHub Actions runs with `permissions: contents: read`.

## Planned before launch

Tracked in later milestones (see [docs/milestones.md](docs/milestones.md)):

- **AuthN/AuthZ (M5):** partner vs. administrator roles; deny-by-default; per-record authorization
  (a partner sees only their own referrals/commissions).
- **Audit logging** of sensitive administrative actions (commission approve/reject/reverse, payouts).
- **Encryption in transit (TLS) and at rest** for PII/financial data; secrets management (M7).
- **PII-safe logging** (redaction) and log access controls.
- **Data retention & minimization** for partner PII and attribution data.
- **Dependency and secret scanning** in CI.

## Legal / regulatory (needs sign-off before launch)

Not security controls, but flagged here so they are not missed:

- **FTC endorsement/disclosure** requirements for influencer and partner promotion.
- **Healthcare-marketing constraints** — if commissions ever touch federal healthcare-program
  dollars, anti-kickback rules may apply. Requires legal review. Tracked in
  [PROJECT.md](PROJECT.md) → Open business questions.

## If PHI is ever introduced

PHI is **out of scope** and must not enter this system. If that ever changes, it triggers a
dedicated HIPAA compliance program (BAAs with all vendors, tamper-evident PHI audit logging,
encryption posture review, breach-notification procedures) **before** any real PHI flows through
any environment — it is not a configuration tweak.
