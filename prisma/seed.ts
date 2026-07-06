import { prisma } from '../src/db.js';
import { createShipmentBodySchema, toShipmentWriteData } from '../src/schemas.js';
import * as documentService from '../src/services/documentService.js';
import * as shipmentService from '../src/services/shipmentService.js';

/**
 * Seeds the exact sample shipment from the assignment, then ingests it as a mock
 * document. Idempotent: re-running removes the previous sample first. The seeded
 * shipment intentionally still contains the sample's issues (uncertified wood
 * packaging, invalid container check digit, stale arrival date) so a reviewer
 * can immediately POST /validate and see the engine at work.
 */
const SAMPLE = {
  shipment_reference: 'SAF-IMP-2026-0007',
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
  bill_of_lading: 'BL-SHA-7788',
  packaging_type: 'wooden crates',
  ispm15_certified: null,
  arrival_date: '2026-06-20',
} as const;

async function main(): Promise<void> {
  const actor = 'seed-script';

  // Idempotency: cascade-deletes documents, runs, issues, and audit entries.
  await prisma.shipment.deleteMany({ where: { reference: SAMPLE.shipment_reference } });

  const body = createShipmentBodySchema.parse(SAMPLE);
  const shipment = await shipmentService.createShipment(toShipmentWriteData(body), actor);

  await documentService.ingestDocument(shipment.id, 'mock_ocr', { ...SAMPLE }, actor);

  console.log(`Seeded shipment ${shipment.reference} (id: ${shipment.id})`);
  console.log('Next: POST /shipments/%s/validate to run the compliance engine.', shipment.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
