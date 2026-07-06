# AI Usage Notes

The assignment explicitly asks how AI tooling was used, so this is an honest
account of the workflow and where my judgement overrode the AI's.

**Workflow, plainly:** most of the thinking went into a detailed implementation
plan written up front (design, data model, the eleven rules, the ISO 6346
algorithm, the trade-offs in §4). Executing that plan with Claude Code was then a
single focused session — the git history is a tight ~1.5-hour run of small,
per-step commits, not a week of organic development. The design disagreements in
§4 happened while writing and reviewing the plan; I'm recording them here rather
than pretending they were narrated commit-by-commit. After the first pass I did a
review sweep that caught four real defects — those fixes are in §6.

## 1. Tools used

- **Claude Code** (Anthropic) — used as a pair-programmer for scaffolding,
  writing rule boilerplate and their unit tests, and drafting documentation,
  against a plan I wrote first and then executed step by step.

## 2. What was AI-assisted

- Project scaffold (Fastify + Prisma + Vitest wiring, tsconfig, error envelope).
- Boilerplate for the 11 validation rules and their table-driven unit tests.
- First drafts of `README.md` and `ARCHITECTURE.md`.
- The ISO 6346 container check-digit implementation (verified by hand against
  published examples — see §4).

## 3. How AI output was reviewed

- I read every generated diff before committing; nothing was blind-pasted.
- Tests were run after every step; no step was committed with failing tests.
- The API was exercised end-to-end via `requests.http` against the seeded sample.
- Numeric/algorithmic code (check digit, value-per-kg heuristic) was checked
  against independent references and hand calculation, not trusted on sight.

## 4. Disagreements and corrections

_(Real design decisions from the planning and review stages, each verifiable in
the code — the assignment treats blindly-trusted output as a red flag.)_

- **Build pipeline.** The initial suggestion was a full `tsc` emit-to-`dist`
  build. For an ESM + Node project that forces `.js` extensions on every
  relative import and adds a compile step the reviewer doesn't need. I chose to
  run TypeScript directly via `tsx` and make `npm run build` a type-check gate
  (`tsc --noEmit`) instead. Trade-off noted in ARCHITECTURE.md.

- **Strict vs lenient document ingestion.** The first cut validated the whole
  document payload with a strict schema and returned `400` on any type error.
  That contradicts the product goal — the system exists to *ingest messy data
  and surface problems*, not to reject it. I changed ingestion to be lenient:
  each known field is coerced independently, a value that fails is skipped (and
  reported in `skipped_fields`), unknown keys are kept in the raw payload and
  reported in `unknown_keys`. The document is always stored verbatim.

- **Verified the check-digit algorithm rather than trusting it.** AI-generated
  ISO 6346 code is easy to get subtly wrong (the letter-value table skips
  multiples of 11). I hand-computed the check digit for the published example
  `CSQU3054383` (→ 3, valid) and for the assignment's own sample container
  `MSCU1234567` (→ 6, but the number claims 7). The sample number is therefore
  *invalid*, which the validation engine correctly reports. Both are locked in
  as unit-test vectors so a future refactor can't silently break the maths.

- **Rejected a unique constraint on `shipment_reference`.** The obvious modelling
  instinct is to make the reference unique. I deliberately did not: this is a
  triage system for dirty data, so a duplicate reference must be *surfaced as a
  validation issue* (rule 10) for a human to resolve, not rejected by the
  database. The trade-off and the alternative (409 at creation) are in
  ARCHITECTURE.md.

- **Corrected assumptions about SQLite + Prisma.** Generated schema drafts reached
  for `enum`, `Json`, and `Decimal` column types. Prisma does not support these on
  SQLite, so status/severity are `String` (constrained by TS unions + Zod), JSON
  payloads are stringified, and money/weights are `Float` (compared, never summed).
  This was anticipated in the plan and confirmed against Prisma's docs.

## 5. Where AI helped most vs. least

- **Most useful**: mechanical breadth — 11 rule files + tests, serializers, the
  snake/camel mapping table. Fast and easy to review because each piece is small.
- **Least trustworthy**: anything numeric or product-shaped — the check-digit
  maths, the status-derivation policy, and the ingestion semantics all needed a
  human decision or verification. Those are the parts I own in an interview.

## 6. Review pass — defects I found and fixed after the first cut

A deliberate second read (the kind of thing AI output most needs) surfaced four
real bugs. Each is now fixed with a regression test:

- **`bill_of_lading_number` was rejected.** The assignment's sample names the
  field `bill_of_lading_number`, but my create schema used `bill_of_lading` with
  `.strict()`, so pasting the sample verbatim 400'd — while the README claimed it
  wouldn't. Fixed by accepting the sample's name as an alias (create schema, CSV
  import, and the document mapper) and canonicalising to `bill_of_lading`. Test:
  `tests/api/shipments.api.test.ts` posts the PDF sample verbatim.
- **ISO 6346 check digit resolving to 10.** My original `(sum mod 11) mod 10`
  folded a remainder of 10 down to 0, which wrongly validates a serial ending in
  0 whose true remainder is 10 (e.g. `MSCU0000060`). ISO 6346 does not assign
  those, so they're now rejected. Test vector added in `tests/iso6346.test.ts`.
- **Far-future arrival dates passed silently.** The arrival rule only checked the
  past-facing window, so an OCR typo like `2062-06-20` cleared every rule and
  could derive a shipment to `ready`. Added a `MAX_FUTURE_ARRIVAL_DAYS`
  (medium-severity) guard.
- **Two divergent `valuesEqual` helpers.** Document ingestion had a Date-aware
  copy; the mismatch rule had a non-Date-aware one — a latent trap if `arrivalDate`
  were ever added to `MISMATCH_FIELDS`. Consolidated into one shared helper in
  `src/validation/util.ts`.
