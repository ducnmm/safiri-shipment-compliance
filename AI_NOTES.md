# AI Usage Notes

The assignment explicitly asks how AI tooling was used. This file is kept up to
date **during** development, not written afterwards.

## 1. Tools used

- **Claude Code** (Anthropic) — used as a pair-programmer for scaffolding,
  writing rule boilerplate and their unit tests, and drafting documentation.
  A detailed implementation plan was written first (by me, with AI help) and
  then executed step by step, committing after each step.

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

_(Captured as they happen — the assignment treats blindly-trusted output as a
red flag, so these are real.)_

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

_(More entries added below as they occur during development.)_
