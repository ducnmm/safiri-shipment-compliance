import type { FastifyInstance } from 'fastify';
import { parseCsv } from '../csv.js';
import { AppError } from '../errors.js';
import { getActor } from '../http.js';
import {
  createShipmentBodySchema,
  csvShipmentRowSchema,
  ingestDocumentBodySchema,
  listShipmentsQuerySchema,
  patchStatusBodySchema,
  toShipmentWriteData,
} from '../schemas.js';
import {
  toAuditResponse,
  toIngestResponse,
  toRunResponse,
  toShipmentDetailResponse,
  toShipmentResponse,
  toValidationResultResponse,
} from '../serializers.js';
import * as documentService from '../services/documentService.js';
import * as reportService from '../services/reportService.js';
import * as shipmentService from '../services/shipmentService.js';
import * as validationService from '../services/validationService.js';

interface IdParams {
  id: string;
}

/**
 * All shipment-related endpoints, registered as a Fastify plugin.
 * The public API speaks snake_case; mapping to the internal camelCase model
 * happens in the schema/serializer layer.
 */
export async function shipmentRoutes(app: FastifyInstance): Promise<void> {
  // Create a shipment record.
  app.post('/shipments', async (req, reply) => {
    const body = createShipmentBodySchema.parse(req.body);
    const shipment = await shipmentService.createShipment(toShipmentWriteData(body), getActor(req));
    return reply.status(201).send(toShipmentResponse(shipment));
  });

  // List shipments (newest first) with bounded pagination (?limit=&offset=).
  // The body stays a plain array (GitHub-style); the full count and paging window
  // are returned as headers so existing clients aren't broken.
  app.get('/shipments', async (req, reply) => {
    const { limit, offset } = listShipmentsQuerySchema.parse(req.query);
    const { shipments, total } = await shipmentService.listShipments({ limit, offset });
    reply.header('X-Total-Count', String(total));
    reply.header('X-Limit', String(limit));
    reply.header('X-Offset', String(offset));
    return shipments.map(toShipmentResponse);
  });

  // Bulk import from CSV (bonus). Send a text/csv body with a snake_case header row.
  // Each row is imported independently; the response reports per-row success/failure.
  app.post('/shipments/import', async (req) => {
    const csv = typeof req.body === 'string' ? req.body : '';
    const rows = parseCsv(csv);
    if (rows.length === 0) {
      throw AppError.validation('CSV body must contain a header row and at least one data row.');
    }

    const actor = getActor(req);
    const results: Array<Record<string, unknown>> = [];
    let created = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const parsed = csvShipmentRowSchema.safeParse(rows[i]);
      if (!parsed.success) {
        results.push({ row: i + 1, ok: false, error: parsed.error.issues });
        continue;
      }
      try {
        const shipment = await shipmentService.createShipment(
          toShipmentWriteData(parsed.data),
          actor,
        );
        created += 1;
        results.push({
          row: i + 1,
          ok: true,
          shipment_id: shipment.id,
          shipment_reference: shipment.reference,
        });
      } catch (err) {
        results.push({ row: i + 1, ok: false, error: (err as Error).message });
      }
    }

    return { total: rows.length, created, failed: rows.length - created, results };
  });

  // Fetch one shipment with document count and latest validation summary.
  app.get<{ Params: IdParams }>('/shipments/:id', async (req) => {
    const detail = await shipmentService.getShipmentDetail(req.params.id);
    return toShipmentDetailResponse(detail.shipment, {
      documentCount: detail.documentCount,
      latestRun: detail.latestRun,
    });
  });

  // Ingest a mock document and map its fields onto the shipment.
  app.post<{ Params: IdParams }>('/shipments/:id/documents', async (req, reply) => {
    const body = ingestDocumentBodySchema.parse(req.body);
    const result = await documentService.ingestDocument(
      req.params.id,
      body.source,
      body.payload,
      getActor(req),
    );
    return reply.status(201).send(toIngestResponse(result));
  });

  // Run the validation engine and record a validation run.
  app.post<{ Params: IdParams }>('/shipments/:id/validate', async (req) => {
    const result = await validationService.validate(req.params.id, getActor(req));
    return toValidationResultResponse(result.run, result.issues, result.status);
  });

  // Fetch the issues from the latest (or a specific) validation run.
  app.get<{ Params: IdParams; Querystring: { runId?: string } }>(
    '/shipments/:id/issues',
    async (req) => {
      const { run, issues } = await validationService.getIssues(req.params.id, req.query.runId);
      return toRunResponse(run, issues);
    },
  );

  // Generate the readiness report from the latest validation run.
  app.get<{ Params: IdParams }>('/shipments/:id/readiness-report', async (req) => {
    return reportService.generateReport(req.params.id, getActor(req));
  });

  // Record a human approve/reject decision.
  app.patch<{ Params: IdParams }>('/shipments/:id/status', async (req) => {
    const body = patchStatusBodySchema.parse(req.body);
    const shipment = await shipmentService.changeStatus(req.params.id, body.status, getActor(req));
    return toShipmentResponse(shipment);
  });

  // Fetch the full audit trail (oldest first).
  app.get<{ Params: IdParams }>('/shipments/:id/audit-log', async (req) => {
    const entries = await shipmentService.getAuditLog(req.params.id);
    return entries.map(toAuditResponse);
  });
}
