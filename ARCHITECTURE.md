# Architecture

## Overview

```
          HTTP (snake_case JSON)
                │
                ▼
   ┌───────────────────────────┐
   │  routes/shipments.ts       │  Fastify plugin; Zod validation at the boundary;
   │                            │  uniform error envelope; x-actor -> actor.
   └───────────┬───────────────┘
               │  (camelCase DTOs)
               ▼
   ┌───────────────────────────┐      ┌───────────────────────────┐
   │  services/                 │────▶ │  validation/               │
   │   shipmentService          │      │   engine.runRules()        │
   │   documentService          │      │   registry -> 11 rules     │  pure, sync
   │   validationService        │      │   iso6346, util            │
   │   reportService            │      └───────────────────────────┘
   │   auditService (choke pt)  │                 ▲
   └───────────┬───────────────┘                 │ ValidationContext
               │  Prisma ($transaction)           │ (pre-fetched IO)
               ▼                                   │
   ┌───────────────────────────┐      ┌───────────────────────────┐
   │  SQLite (Prisma)           │      │  reference/ + data/*.json  │
   │  Shipment, Document,       │      │  ISO 3166 / 4217 / HS / FX │
   │  ValidationRun/Issue,      │      └───────────────────────────┘
   │  AuditLog                  │
   └───────────────────────────┘
```

Request flow: **routes** validate and translate input, **services** own
persistence and transactions, the **validation engine** is a pure function over
a shipment snapshot plus a pre-fetched context. All IO happens in the service
layer; rules never touch the database.

## Data model

- **Shipment** — the canonical record. All fields except `reference` are nullable:
  dirty/partial data is accepted and flagged, not rejected.
- **Document** — a raw ingested payload (mock OCR / partner feed) kept separate
  from the shipment. This separation is what makes the document-vs-shipment
  mismatch rule possible.
- **ValidationRun** + **ValidationIssue** — each validation is persisted as a run
  with its issues. History is never overwritten, so a shipment's compliance state
  is auditable over time.
- **AuditLog** — append-only; one row per state-changing action, written through a
  single helper in the same transaction as the change.

## Decision log

| Decision | Why | Alternative considered |
|---|---|---|
| **SQLite + Prisma** | Zero-setup for the reviewer; the assignment says data modelling matters more than DB choice. Swapping to Postgres is a one-line datasource change + migrate. | Postgres (needs a running server / Docker). |
| **No unique constraint on `reference`** | The product is a triage tool for messy data. Surfacing a duplicate as a validation issue lets the ops team decide which record is canonical; a DB constraint would just 500/409 and hide it. | `@unique` + 409 at creation. |
| **Rules pure & synchronous** | Deterministic, mock-free unit tests. The service pre-fetches duplicate counts, documents, reference sets, and the clock into a `ValidationContext`. | Rules that query the DB themselves (hard to test, N+1 risk). |
| **Injected clock (`now`)** | Date-based rules (arrival window) must be deterministic in tests without threading a timestamp through HTTP. | `new Date()` inside rules (untestable, flaky). |
| **Report computed, not stored** | The `ValidationRun` is the single source of truth; a stored report would duplicate state and drift. | Persist a `ReportSnapshot` (only needed if regulators require immutable snapshots — noted below). |
| **Fill-if-missing ingestion** | The shipment record is canonical; the system must never silently overwrite reviewed data. Conflicts survive on the document and are caught by the mismatch rule. | Last-write-wins overwrite (loses the conflict signal). |
| **Lenient document mapping** | Ingestion should absorb messy payloads and surface problems, not 400 on a single bad field. | Strict all-or-nothing schema on the payload. |
| **snake_case API, camelCase internals** | The assignment's sample payload is snake_case; reviewers paste it verbatim (least surprise). Internal code stays idiomatic. | snake_case throughout (leaks into domain code) or camelCase API (breaks the sample). |
| **`tsx` run + `tsc --noEmit` build** | Avoids `.js`-extension churn of ESM emit; the reviewer runs nothing extra. `build` still type-checks as a CI gate. | Full `tsc` emit to `dist/`. |

## Validation engine

Adding a rule is a one-line change to `registry.ts` plus a new file under
`validation/rules/`. Each rule is `{ code, description, check(shipment, ctx) }`
and returns zero or more `IssueDraft`s with a severity (`low`/`medium`/`high`/
`critical`), the field involved, an explanation, and a suggested action. The
engine flattens and sorts issues by severity. Status is then derived: any
critical → `blocked`; any high/medium → `requires_review`; otherwise → `ready`.

The 11 rules cover required fields, HS-code format, country/currency codes,
weight consistency, Bill of Lading presence, ISO 6346 container check digit,
invoice-value sanity, wood-packaging (ISPM-15) certification, arrival window,
duplicate reference, and document/shipment mismatch.

## Status machine

```
draft ──(ingest)──▶ documents_ingested ──(validate)──▶ blocked | requires_review | ready
                                                              │
                        (human PATCH from ready/requires_review)
                                                              ▼
                                                    approved | rejected  (terminal)
```

Re-validation is allowed from any non-terminal status. `blocked` has no manual
override — the underlying data must be fixed and the shipment re-validated.

**Concurrency:** the rule engine runs against a snapshot read outside the write
transaction (rules are read-only, so a slightly stale snapshot is acceptable),
but the status transition is guarded *inside* the transaction: `validate`
re-reads the current status and re-checks the terminal guard before updating, so
a validate racing a `PATCH` approve/reject can never clobber a terminal decision,
and the audit `from` always reflects the real prior status. On SQLite the write
transaction serialises; on Postgres this would use the default read-committed
isolation with the same re-read-and-guard pattern.

## Path to production

- **Database**: Postgres with `NUMERIC` for money/weights; keep the Prisma schema, change the datasource.
- **Ingestion at scale**: accept documents onto a queue (e.g. SQS) with an idempotency key; process asynchronously.
- **AuthN/Z**: replace the `x-actor` header with authenticated sessions (JWT) and role-based access (admin / ops / reviewer).
- **Rule governance**: version the rule set and store the engine version on each `ValidationRun` so historical results stay explainable; move thresholds to per-tenant config.
- **Observability**: structured request logs + OpenTelemetry traces; metrics on issue rates by rule and status transitions.
- **Audit durability**: the audit log is append-only; in production put it on retention/WORM storage and never expose deletes.
- **Reference data**: scheduled sync jobs for HS/ISO/Comtrade with a cache and a fallback to the last-good snapshot; record source + fetch time per record.
- **Report snapshots**: if a regulator needs an immutable report, persist a `ReportSnapshot` at generation time (today it is recomputed on demand).
- **Hardening**: rate limiting, request size limits, and cursor-based pagination on list endpoints (bounded offset paging is already in place).

## Notes

- `npm audit` reports advisories in the **dev-only** `esbuild`/`vitest` toolchain
  (a dev-server CORS issue). Runtime dependencies (Fastify, Prisma, Zod) are
  clean; these do not ship in a production build.
