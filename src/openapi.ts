/**
 * Hand-authored OpenAPI 3 document served by @fastify/swagger-ui at /docs.
 *
 * It is kept as a static document (rather than generated from route schemas)
 * on purpose: request validation stays with Zod at the boundary (see
 * ARCHITECTURE.md), so the docs never change the runtime behaviour. The
 * trade-off is that this file must be updated by hand when the contract changes.
 *
 * `servers` is left relative ("/") so Swagger UI's "Try it out" targets whatever
 * origin is serving the page — localhost in development, the Railway URL in the
 * live demo — with no configuration.
 */

const errorEnvelope = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'NOT_FOUND' },
        message: { type: 'string' },
        details: { nullable: true },
      },
      required: ['code', 'message'],
    },
  },
};

const shipment = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: {
      type: 'string',
      enum: ['draft', 'documents_ingested', 'blocked', 'requires_review', 'ready', 'approved', 'rejected'],
    },
    shipment_reference: { type: 'string' },
    exporter: { type: 'string', nullable: true },
    importer: { type: 'string', nullable: true },
    invoice_number: { type: 'string', nullable: true },
    invoice_value: { type: 'number', nullable: true },
    currency: { type: 'string', nullable: true },
    goods_description: { type: 'string', nullable: true },
    hs_code: { type: 'string', nullable: true },
    country_of_origin: { type: 'string', nullable: true },
    gross_weight_kg: { type: 'number', nullable: true },
    net_weight_kg: { type: 'number', nullable: true },
    number_of_packages: { type: 'integer', nullable: true },
    container_number: { type: 'string', nullable: true },
    bill_of_lading: { type: 'string', nullable: true },
    packaging_type: { type: 'string', nullable: true },
    ispm15_certified: { type: 'boolean', nullable: true },
    arrival_date: { type: 'string', nullable: true, example: '2026-06-20' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
};

const validationIssue = {
  type: 'object',
  properties: {
    rule_code: { type: 'string', example: 'WOOD_PACKAGING_CERT_MISSING' },
    issue_type: { type: 'string', example: 'missing_certification' },
    severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    field: { type: 'string', nullable: true },
    explanation: { type: 'string' },
    suggested_action: { type: 'string' },
  },
};

/** The assignment's sample payload, using its own `bill_of_lading_number` spelling
 *  (accepted as an alias) and a distinct reference so "Try it out" does not create
 *  a duplicate of the seeded SAF-IMP-2026-0007 shipment. */
const createExample = {
  shipment_reference: 'SAF-IMP-2026-0042',
  exporter: 'BlueRiver Manufacturing Ltd',
  importer: 'Eastland Retail Group',
  invoice_number: 'INV-77821',
  invoice_value: 48250.0,
  currency: 'USD',
  goods_description: 'Industrial water pumps and spare impellers',
  hs_code: '8413.70',
  country_of_origin: 'CN',
  gross_weight_kg: 12750,
  net_weight_kg: 12100,
  number_of_packages: 42,
  container_number: 'MSCU1234567',
  bill_of_lading_number: 'BL-SHA-7788',
  packaging_type: 'wooden crates',
  ispm15_certified: null,
  arrival_date: '2026-06-20',
};

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description: 'Shipment id',
};

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
});

export const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Shipment Compliance Automation API',
    version: '1.0.0',
    description:
      'Ingest shipment data, validate it against compliance rules, produce a readiness report, ' +
      'and keep an audit trail. Use **Try it out** on any endpoint below.\n\n' +
      'A sample shipment is seeded on boot — call `GET /shipments`, copy its `id`, then ' +
      '`POST /shipments/{id}/validate` to see the engine flag three issues (uncertified wood ' +
      'packaging, a stale arrival date, and an invalid ISO 6346 container check digit).',
  },
  servers: [{ url: '/', description: 'This instance' }],
  tags: [
    { name: 'Shipments', description: 'Create, list, and fetch shipments' },
    { name: 'Documents', description: 'Ingest mock document data' },
    { name: 'Validation', description: 'Run the compliance engine and read issues' },
    { name: 'Reporting', description: 'Readiness report' },
    { name: 'Audit', description: 'Audit trail' },
    { name: 'Decisions', description: 'Human approve / reject' },
    { name: 'Bulk', description: 'CSV import (bonus)' },
    { name: 'System', description: 'Health' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness check',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/shipments': {
      get: {
        tags: ['Shipments'],
        summary: 'List shipments (newest first)',
        description:
          'Bounded pagination. The body is a plain array; the total count and paging window are ' +
          'returned in the `X-Total-Count`, `X-Limit`, and `X-Offset` response headers.',
        parameters: [
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer', minimum: 0, default: 0 } },
        ],
        responses: {
          200: {
            description: 'Array of shipments (newest first)',
            headers: {
              'X-Total-Count': { schema: { type: 'integer' }, description: 'Total shipments matching (ignores paging)' },
              'X-Limit': { schema: { type: 'integer' } },
              'X-Offset': { schema: { type: 'integer' } },
            },
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Shipment' } },
              },
            },
          },
          400: errorResponse('Invalid limit/offset (envelope)'),
        },
      },
      post: {
        tags: ['Shipments'],
        summary: 'Create a shipment',
        description:
          'Only `shipment_reference` is required — dirty/partial data is accepted by design and ' +
          'flagged later by the engine. The assignment sample can be pasted verbatim; its ' +
          '`bill_of_lading_number` field is accepted as an alias for `bill_of_lading`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Shipment' },
              example: createExample,
            },
          },
        },
        responses: {
          201: {
            description: 'Created shipment',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Shipment' } } },
          },
          400: errorResponse('Validation error (envelope)'),
        },
      },
    },
    '/shipments/{id}': {
      get: {
        tags: ['Shipments'],
        summary: 'Fetch one shipment',
        parameters: [idParam],
        responses: {
          200: {
            description: 'Shipment with document count + latest run summary',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Shipment' } } },
          },
          404: errorResponse('Not found (envelope)'),
        },
      },
    },
    '/shipments/{id}/documents': {
      post: {
        tags: ['Documents'],
        summary: 'Ingest a mock document',
        description:
          'Maps known snake_case fields onto the shipment using a fill-if-missing policy: a value is ' +
          'written only where the shipment field is currently null. Conflicting values are kept on the ' +
          'document and surfaced by the mismatch rule at validation time.',
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  source: { type: 'string', example: 'partner_feed' },
                  payload: { type: 'object', additionalProperties: true },
                },
                required: ['payload'],
              },
              example: { source: 'partner_feed', payload: { invoice_value: 50000 } },
            },
          },
        },
        responses: {
          201: { description: 'Ingest result (mapped / applied / conflict / skipped / unknown fields)' },
          404: errorResponse('Not found (envelope)'),
        },
      },
    },
    '/shipments/{id}/validate': {
      post: {
        tags: ['Validation'],
        summary: 'Run the validation engine',
        description:
          'Runs all rules, persists a validation run + issues, and derives the status ' +
          '(any critical → `blocked`; any high/medium → `requires_review`; otherwise → `ready`).',
        parameters: [idParam],
        responses: {
          200: {
            description: 'Validation run with issues',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    run_id: { type: 'string' },
                    ran_at: { type: 'string' },
                    status: { type: 'string' },
                    issue_count: { type: 'integer' },
                    issues: { type: 'array', items: { $ref: '#/components/schemas/ValidationIssue' } },
                  },
                },
              },
            },
          },
          404: errorResponse('Not found (envelope)'),
          409: errorResponse('Terminal shipment cannot be re-validated (envelope)'),
        },
      },
    },
    '/shipments/{id}/issues': {
      get: {
        tags: ['Validation'],
        summary: 'Issues from the latest run',
        parameters: [
          idParam,
          { name: 'runId', in: 'query', required: false, schema: { type: 'string' }, description: 'Fetch a specific historical run' },
        ],
        responses: {
          200: { description: 'Latest (or specified) run with its issues' },
          409: errorResponse('Never validated (envelope)'),
        },
      },
    },
    '/shipments/{id}/readiness-report': {
      get: {
        tags: ['Reporting'],
        summary: 'Readiness report',
        description: 'A projection of the latest validation run: summary, blockers, warnings, and human-review flag.',
        parameters: [idParam],
        responses: {
          200: { description: 'Readiness report' },
          409: errorResponse('Never validated (envelope)'),
        },
      },
    },
    '/shipments/{id}/audit-log': {
      get: {
        tags: ['Audit'],
        summary: 'Audit trail (oldest first)',
        parameters: [idParam],
        responses: { 200: { description: 'Ordered audit entries' }, 404: errorResponse('Not found (envelope)') },
      },
    },
    '/shipments/{id}/status': {
      patch: {
        tags: ['Decisions'],
        summary: 'Record a human approve / reject decision',
        description: 'Allowed only from `ready` or `requires_review`. Use the `x-actor` header to attribute the decision.',
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { status: { type: 'string', enum: ['approved', 'rejected'] } }, required: ['status'] },
              example: { status: 'approved' },
            },
          },
        },
        responses: {
          200: { description: 'Updated shipment', content: { 'application/json': { schema: { $ref: '#/components/schemas/Shipment' } } } },
          409: errorResponse('Invalid transition (envelope)'),
        },
      },
    },
    '/shipments/import': {
      post: {
        tags: ['Bulk'],
        summary: 'Bulk-create shipments from CSV (bonus)',
        description: 'Send a `text/csv` body. Each row is imported independently; the response reports per-row success/failure.',
        requestBody: {
          required: true,
          content: {
            'text/csv': {
              schema: { type: 'string' },
              example:
                'shipment_reference,exporter,invoice_value,arrival_date,ispm15_certified\n' +
                'SAF-CSV-1,Acme,1000,2026-07-01,true\n' +
                'SAF-CSV-2,Globex,2000,2026-07-02,false\n',
            },
          },
        },
        responses: { 200: { description: 'Per-row import results { total, created, failed, results[] }' } },
      },
    },
  },
  components: {
    schemas: {
      ErrorEnvelope: errorEnvelope,
      Shipment: shipment,
      ValidationIssue: validationIssue,
    },
  },
};
