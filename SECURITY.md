# Security & Compliance

## Reporting a vulnerability

Do not open a public issue for security vulnerabilities. Contact the LaviMD maintainers
privately so the issue can be triaged and fixed before disclosure.

## Current posture (Milestone 1)

The system does **not** yet handle real Protected Health Information (PHI). We build with
strong security defaults now so that a future compliance milestone can layer full HIPAA
controls without redesign:

- **No secrets in the repo.** Secrets are provided via environment variables; `.env*` files
  are git-ignored and `*.example` files document required keys without values.
- **No PHI in the domain model, logs, or URLs.** The referral model references patients via
  an opaque `patientRef`, never inline demographics or clinical identifiers.
- **Input validation at the boundary.** Untrusted input is validated with Zod schemas from
  `packages/shared`.
- **Type safety and linting** are enforced in CI (type-aware ESLint, `tsc`, zero warnings).
- **Least-privilege CI.** GitHub Actions runs with `permissions: contents: read`.

## Deferred to the compliance milestone (before any real PHI)

These are intentionally **not** implemented yet and are tracked as a dedicated milestone:

- Business Associate Agreements (BAA) with all vendors touching PHI.
- Encryption at rest (KMS-managed keys) and enforced TLS in transit.
- Tamper-evident audit logging of all PHI access.
- Role-based access control and per-record authorization.
- Data retention, minimization, and breach-notification procedures.
- PHI-safe logging (redaction) and log access controls.

**Rule:** no real PHI may flow through any environment until the compliance milestone is
complete and signed off.
