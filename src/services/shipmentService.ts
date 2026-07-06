import type { Shipment, ValidationRun } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import type { ShipmentWriteData } from '../schemas.js';
import * as audit from './auditService.js';

/** Create a shipment and record the creation event in the same transaction. */
export async function createShipment(data: ShipmentWriteData, actor: string): Promise<Shipment> {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.create({
      data: { ...data, status: 'draft' },
    });
    await audit.record(tx, shipment.id, 'shipment.created', actor, {
      reference: shipment.reference,
    });
    return shipment;
  });
}

/** Fetch a shipment or throw a 404 AppError. */
export async function getShipmentOrThrow(id: string): Promise<Shipment> {
  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment) {
    throw AppError.notFound(`Shipment ${id} not found`);
  }
  return shipment;
}

/** List all shipments, newest first. Pagination omitted (documented simplification). */
export async function listShipments(): Promise<Shipment[]> {
  return prisma.shipment.findMany({ orderBy: { createdAt: 'desc' } });
}

export interface ShipmentDetail {
  shipment: Shipment;
  documentCount: number;
  latestRun: ValidationRun | null;
}

/** Fetch a shipment plus its document count and latest validation run summary. */
export async function getShipmentDetail(id: string): Promise<ShipmentDetail> {
  const shipment = await getShipmentOrThrow(id);
  const [documentCount, latestRun] = await Promise.all([
    prisma.document.count({ where: { shipmentId: id } }),
    prisma.validationRun.findFirst({
      where: { shipmentId: id },
      orderBy: { ranAt: 'desc' },
    }),
  ]);
  return { shipment, documentCount, latestRun };
}
