# Shipment Compliance Automation Mini-System

A production-minded backend that ingests shipment document data, maps it into a
canonical shipment record, validates it against compliance rules, produces a
readiness report for human review, and keeps an audit trail of every important
action.

> Take-home for Safiri AI (Software Engineer). See `ARCHITECTURE.md` for design
> decisions and `AI_NOTES.md` for how AI tooling was used.

## Quickstart

```bash
npm install
npx prisma migrate dev      # creates prisma/dev.db and applies the schema
npm run seed                # loads the sample shipment from the assignment
npm run dev                 # starts the API on http://localhost:3000
```

_Full setup instructions, API walkthrough, assumptions, and data-source notes
are completed in the final documentation step._

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the API with live reload (tsx watch). |
| `npm start` | Start the API once. |
| `npm run build` | Type-check the project (`tsc --noEmit`). |
| `npm test` | Run the unit + API test suites (Vitest). |
| `npm run seed` | Seed the sample shipment and document. |
| `npm run prisma:migrate` | Create/apply a database migration. |

## Tech stack

TypeScript · Fastify · Prisma · SQLite · Zod · Vitest.
