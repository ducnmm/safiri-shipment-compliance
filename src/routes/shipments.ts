import type { FastifyInstance } from 'fastify';
import { getActor } from '../http.js';
import { createShipmentBodySchema, toShipmentWriteData } from '../schemas.js';
import { toShipmentDetailResponse, toShipmentResponse } from '../serializers.js';
import * as shipmentService from '../services/shipmentService.js';

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
}
