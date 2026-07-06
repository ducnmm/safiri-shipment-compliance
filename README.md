# Shipment Compliance Automation Mini-System

A production-minded backend that ingests shipment document data, maps it into a
canonical shipment record, validates it against compliance rules, produces a
readiness report for human review, and keeps an append-only audit trail of every
important action.

Built for the Safiri AI Software Engineer take-home. See [`ARCHITECTURE.md`](./ARCHITECTURE.md)
for design decisions and the path to production, and [`AI_NOTES.md`](./AI_NOTES.md)
for how AI tooling was used.

## Live demo

**https://safiri-api-production.up.railway.app** (Railway)

A sample shipment is seeded on boot. Open the URL for an endpoint index, or:

```bash
BASE=https://safiri-api-production.up.railway.app
SID=$(curl -s $BASE/shipments | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
curl -s -X POST $BASE/shipments/$SID/validate | python3 -m json.tool     # -> status "blocked", 3 issues
curl -s $BASE/shipments/$SID/readiness-report | python3 -m json.tool
```

> It is a demo instance (SQLite on a small volume); please don't load-test it.
> The reviewer's primary path is still cloning and running locally (below).

## Quickstart

Requires Node.js 20+ (developed on Node 22). No external services — the database
is a local SQLite file.

```bash
npm install
cp .env.example .env         # sets DATABASE_URL="file:./dev.db"
npx prisma migrate dev       # create prisma/dev.db and apply the schema
npm run seed                 # load the assignment's sample shipment
npm run dev                  # start the API on http://localhost:3000
```

Then, in another terminal, run the walkthrough below (or open `requests.http` in
VS Code with the REST Client extension and send the requests top to bottom).

## API walkthrough (curl)

```bash
# 1. Create the sample shipment
SID=$(curl -s -X POST localhost:3000/shipments -H 'content-type: application/json' \
  -H 'x-actor: ops-analyst' -d '{
    "shipment_reference":"SAF-IMP-2026-0100","exporter":"BlueRiver Manufacturing Ltd",
    "importer":"Eastland Retail Group","invoice_number":"INV-77821","invoice_value":48250.0,
    "currency":"USD","goods_description":"Industrial water pumps","hs_code":"8413.70",
    "country_of_origin":"CN","gross_weight_kg":12750,"net_weight_kg":12100,
    "number_of_packages":42,"container_number":"MSCU1234567","bill_of_lading_number":"BL-SHA-7788",
    "packaging_type":"wooden crates","ispm15_certified":null,"arrival_date":"2026-06-20"
  }' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')

# 2. Ingest a mock document (optional)
curl -s -X POST localhost:3000/shipments/$SID/documents -H 'content-type: application/json' \
  -d '{"source":"partner_feed","payload":{"invoice_value":50000.0}}'

# 3. Validate, then read the report and audit trail
curl -s -X POST localhost:3000/shipments/$SID/validate -H 'x-actor: ops-analyst'
curl -s localhost:3000/shipments/$SID/readiness-report
curl -s localhost:3000/shipments/$SID/audit-log
```

Validating the seeded sample yields **status `blocked`** with three issues —
missing ISPM-15 certification (critical), an out-of-window arrival date (high),
and an invalid container check digit (high). The readiness report looks like:

```jsonc
{
  "shipment_reference": "SAF-IMP-2026-0007",
  "summary": { "invoice": "48250 USD", "route": "CN → destination (not captured)", "arrival_date": "2026-06-20", "...": "..." },
  "current_status": "blocked",
  "validation": { "run_id": "…", "ran_at": "…", "total_issues": 3 },
  "issues_by_severity": { "critical": 1, "high": 2, "medium": 0, "low": 0 },
  "critical_blockers": [ { "rule_code": "WOOD_PACKAGING_CERT_MISSING", "field": "ispm15Certified", "...": "..." } ],
  "warnings": [ { "rule_code": "ARRIVAL_DATE_OUT_OF_REVIEW_WINDOW" }, { "rule_code": "INVALID_CONTAINER_NUMBER" } ],
  "human_review_required": true,
  "suggested_next_actions": [ "Obtain the ISPM-15 …", "…", "Resolve critical blockers and re-run validation." ]
}
```

> Note: the assignment's own sample container number `MSCU1234567` fails the
> ISO 6346 check-digit test (the computed digit is 6, not 7). This is expected
> output — see `AI_NOTES.md`.

## API reference

The public API speaks **snake_case** JSON (matching the assignment's sample), so
the sample payload can be pasted verbatim — including its `bill_of_lading_number`
field, which is accepted as an alias for the canonical `bill_of_lading` and
normalised on input. The optional `x-actor` header attributes actions in the
audit log (defaults to `system`).

| Method & path | Purpose |
|---|---|
| `POST /shipments` | Create a shipment (`shipment_reference` required; other fields optional). |
| `GET /shipments` | List shipments, newest first. |
| `GET /shipments/:id` | Fetch one shipment with document count + latest validation summary. |
| `POST /shipments/:id/documents` | Ingest a mock document (`{ source?, payload }`) and map its fields. |
| `POST /shipments/:id/validate` | Run the validation engine and record a run. |
| `GET /shipments/:id/issues` | Issues from the latest run (`?runId=` for a specific run). |
| `GET /shipments/:id/readiness-report` | The readiness report projection. |
| `GET /shipments/:id/audit-log` | The full audit trail, oldest first. |
| `PATCH /shipments/:id/status` | Record a human decision (`{ status: "approved" \| "rejected" }`). |
| `POST /shipments/import` | **Bonus:** bulk-create from a `text/csv` body; per-row success/failure. |

All errors use one envelope: `{ "error": { "code", "message", "details" } }` with
codes `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `INVALID_STATE` (409),
`INTERNAL` (500).

### Bonus: CSV bulk import

```bash
printf 'shipment_reference,exporter,invoice_value,arrival_date,ispm15_certified\n%s\n%s\n' \
  'SAF-CSV-1,Acme,1000,2026-07-01,true' \
  'SAF-CSV-2,Globex,2000,2026-07-02,false' \
  | curl -s -X POST localhost:3000/shipments/import \
      -H 'content-type: text/csv' -H 'x-actor: ops-analyst' --data-binary @-
```

Each row is imported independently; the response reports `{ total, created, failed, results[] }`
with a per-row `ok` flag so a partially valid file still imports its good rows.

## Tests

```bash
npm test          # unit tests (rules, engine, ISO 6346, CSV) + API tests
npm run build     # type-check the whole project (tsc --noEmit)
```

Rules are pure functions and are tested in isolation; API tests exercise the
HTTP layer against an isolated SQLite database per suite, including the sample
end-to-end workflow and negative cases (400/404/409).

## Assumptions

All tunable thresholds live in [`src/config.ts`](./src/config.ts):

| Constant | Value | Rationale |
|---|---|---|
| `REVIEW_WINDOW_DAYS` | 14 | Arrival older than ~2 weeks likely means the cargo has landed and is accruing demurrage; prioritise it. |
| `MAX_FUTURE_ARRIVAL_DAYS` | 180 | Arrival more than ~6 months out is implausible for ocean freight and almost always an OCR/data error (e.g. a year misread as 2062); flag rather than let it derive to `ready`. |
| `SUSPICIOUS_MIN_VALUE_PER_KG` | 0.1 | Below this, declared value per kg is implausibly low (possible under-invoicing). Currency-naive (see below). |
| `SUSPICIOUS_MAX_VALUE_PER_KG` | 10000 | Above this, value per kg is implausibly high (possible over-invoicing / data error). |
| `WOOD_KEYWORDS` | wood, wooden, timber, pallet, crate | Packaging descriptions containing these are treated as wood (ISPM-15 scope). |
| `HS_ALLOWED_LENGTHS` | 6, 8, 10 | 6 digits is the international HS length; 8/10 are national extensions. |
| `REQUIRED_FIELDS` | 12 fields | Fields needed for a documentation-complete shipment (country/B-L have their own rules). |
| `MISMATCH_FIELDS` | 10 fields | Fields compared between an ingested document and the shipment record. |

Other documented simplifications: authentication is reduced to an `x-actor`
header; list endpoints are unpaginated; monetary/weight values use SQLite `Float`
(they are compared, never summed); the suspicious-invoice heuristic does not
convert currencies.

## Reference data

Country, currency, and HS-chapter validity are checked against **local snapshot
files** in [`data/`](./data), not live feeds. Each file records its own source,
snapshot date, and refresh guidance:

- `iso-3166-alpha2.json` — ISO 3166-1 alpha-2 country codes (249). Re-snapshot quarterly.
- `iso-4217-currencies.json` — ISO 4217 currency codes (from the ICU/Intl database). Re-snapshot quarterly.
- `hs-chapters.json` — WCO HS chapters 01–97 (77 is reserved; 98/99 are national-use and treated as invalid at the 6-digit level).

This is **reference data for format/plausibility checks only — not legal,
customs, or classification advice.**

### Public data sources for a production version

The take-home uses mocked snapshots; a production service would integrate:

- **WCO Harmonized System** — authoritative HS nomenclature and hierarchy.
  Validates HS-code existence and enables chapter/heading classification checks.
  HS editions revise roughly every 5 years (2022 edition current) with interim
  amendments; refresh per edition. Licensing: WCO materials have usage terms.
- **ISO 3166 / ISO 4217** — country and currency codes. Validate `country_of_origin`
  and `currency`. Change rarely; refresh quarterly. Public code lists.
- **UN Comtrade** — historical trade values by HS × reporter × partner. Would turn
  the currency-naive value-per-kg heuristic into a statistically grounded
  plausibility band (e.g. percentile of declared unit value for that HS/route).
  Refresh monthly; free tier is rate-limited.

## Tech stack

TypeScript (strict) · Fastify · Prisma · SQLite · Zod · Vitest. Run via `tsx`.
