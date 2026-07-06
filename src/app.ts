import Fastify, { type FastifyInstance } from 'fastify';
import { registerErrorHandler } from './errors.js';

export interface BuildAppOptions {
  /** Fastify logger toggle; tests turn it off to keep output quiet. */
  logger?: boolean;
}

/**
 * Constructs the Fastify app with error handling and routes registered but
 * without binding a port. Tests use `app.inject()` against this instance;
 * `server.ts` calls `.listen()` on it.
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    ajv: { customOptions: { allErrors: true } },
  });

  registerErrorHandler(app);

  // Accept raw CSV bodies for the bulk-import endpoint.
  app.addContentTypeParser('text/csv', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });

  app.get('/health', async () => ({ status: 'ok' }));

  // Feature routes are registered in later steps.
  const { shipmentRoutes } = await import('./routes/shipments.js');
  await app.register(shipmentRoutes);

  return app;
}
