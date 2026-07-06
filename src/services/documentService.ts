import type { Document } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { mapDocumentPayload } from '../mapping.js';
import { valuesEqual } from '../validation/util.js';
import * as audit from './auditService.js';

export interface IngestResult {
  document: Document;
  mapped: Record<string, unknown>;
  /** Fields actually written onto the shipment (were null before). */
  appliedFields: string[];
  /** Known fields present in the payload but left in place because the shipment already had a value. */
  conflictFields: string[];
  /** Known fields whose values failed to coerce. */
  skipped: string[];
  /** Unrecognised payload keys (kept in raw payload only). */
  unknownKeys: string[];
}

/**
 * Ingest a mock document, map its fields, and apply them to the shipment using
 * a fill-if-missing policy: a mapped value is written only where the shipment
 * field is currently null. Conflicting values are never overwritten — they stay
 * on the document and are surfaced later by the mismatch rule.
 */
export async function ingestDocument(
  shipmentId: string,
  source: string | undefined,
  payload: Record<string, unknown>,
  actor: string,
): Promise<IngestResult> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) {
    throw AppError.notFound(`Shipment ${shipmentId} not found`);
  }

  const { mapped, skipped, unknownKeys } = mapDocumentPayload(payload);

  const shipmentRecord = shipment as unknown as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  const appliedFields: string[] = [];
  const conflictFields: string[] = [];
  for (const [field, value] of Object.entries(mapped)) {
    const current = shipmentRecord[field];
    if (current === null || current === undefined) {
      updates[field] = value;
      appliedFields.push(field);
    } else if (!valuesEqual(current, value)) {
      conflictFields.push(field);
    }
  }

  const transitionToIngested = shipment.status === 'draft';

  return prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        shipmentId,
        source: source ?? 'mock_ocr',
        rawPayload: JSON.stringify(payload),
        mappedFields: JSON.stringify(mapped),
      },
    });

    await audit.record(tx, shipmentId, 'document.ingested', actor, {
      documentId: document.id,
      source: document.source,
      mappedFieldCount: Object.keys(mapped).length,
      appliedFields,
      conflictFields,
      skipped,
      unknownKeys,
    });

    const shipmentUpdate: Record<string, unknown> = { ...updates };
    if (transitionToIngested) {
      shipmentUpdate['status'] = 'documents_ingested';
    }
    if (Object.keys(shipmentUpdate).length > 0) {
      await tx.shipment.update({ where: { id: shipmentId }, data: shipmentUpdate });
    }

    for (const field of appliedFields) {
      await audit.record(tx, shipmentId, 'shipment.field_updated', actor, {
        field,
        from: null,
        to: updates[field],
        source: `document:${document.id}`,
      });
    }

    if (transitionToIngested) {
      await audit.record(tx, shipmentId, 'shipment.status_changed', actor, {
        from: 'draft',
        to: 'documents_ingested',
        trigger: 'document_ingested',
      });
    }

    return { document, mapped, appliedFields, conflictFields, skipped, unknownKeys };
  });
}
