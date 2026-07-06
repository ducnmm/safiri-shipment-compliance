import type { FastifyInstance } from 'fastify';
import { getActor } from '../http.js';
import {
  createShipmentBodySchema,
  ingestDocumentBodySchema,
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

  // List shipments (newest first).
  app.get('/shipments', async () => {
    const shipments = await shipmentService.listShipments();
    return shipments.map(toShipmentResponse);
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
