import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import type { OpenAPIV3 } from 'openapi-types';
import { registerErrorHandler } from './errors.js';
import { openapiDocument } from './openapi.js';

const LANDING_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shipment Compliance Automation API</title>
<style>
  body{font:16px/1.6 system-ui,sans-serif;max-width:52rem;margin:2rem auto;padding:0 1rem;color:#1a1a2e}
  code{background:#f0f0f5;padding:.1rem .35rem;border-radius:4px}
  h1{margin-bottom:.2rem} .sub{color:#555;margin-top:0}
  table{border-collapse:collapse;width:100%;margin:1rem 0} td,th{border:1px solid #ddd;padding:.4rem .6rem;text-align:left;font-size:.9rem}
  pre{background:#1a1a2e;color:#e0e0f0;padding:1rem;border-radius:8px;overflow:auto;font-size:.85rem}
  .tag{display:inline-block;background:#e8f0fe;color:#1a56db;border-radius:4px;padding:.05rem .4rem;font-size:.8rem}
</style></head><body>
<h1>Shipment Compliance Automation</h1>
<p class="sub">Backend demo — ingest shipment data, validate against compliance rules, produce a readiness report, keep an audit trail.</p>
<p><strong>Easiest way to test: open <a href="/docs">/docs</a></strong> — an interactive API explorer. Click any endpoint, hit <em>Try it out</em>, and run it against this live instance (no curl needed). A sample shipment is seeded on boot.</p>
<p><span class="tag">try</span> <a href="/docs">/docs</a> · <a href="/shipments">/shipments</a> · <a href="/health">/health</a></p>
<table><thead><tr><th>Method</th><th>Path</th><th>Purpose</th></tr></thead><tbody>
<tr><td>POST</td><td>/shipments</td><td>Create a shipment</td></tr>
<tr><td>GET</td><td>/shipments</td><td>List shipments</td></tr>
<tr><td>GET</td><td>/shipments/:id</td><td>Fetch one shipment</td></tr>
<tr><td>POST</td><td>/shipments/:id/documents</td><td>Ingest a mock document</td></tr>
<tr><td>POST</td><td>/shipments/:id/validate</td><td>Run the validation engine</td></tr>
<tr><td>GET</td><td>/shipments/:id/issues</td><td>Issues from the latest run</td></tr>
<tr><td>GET</td><td>/shipments/:id/readiness-report</td><td>Readiness report</td></tr>
<tr><td>GET</td><td>/shipments/:id/audit-log</td><td>Audit trail</td></tr>
<tr><td>PATCH</td><td>/shipments/:id/status</td><td>Approve / reject decision</td></tr>
<tr><td>POST</td><td>/shipments/import</td><td>Bulk CSV import</td></tr>
</tbody></table>
<p>Quick end-to-end (replace <code>$BASE</code> with this page's URL):</p>
<pre>SID=$(curl -s $BASE/shipments | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
curl -s -X POST $BASE/shipments/$SID/validate | python3 -m json.tool
curl -s $BASE/shipments/$SID/readiness-report | python3 -m json.tool</pre>
<p style="color:#888;font-size:.85rem">Demo instance — data may reset on redeploy. Source, tests, and architecture notes accompany this submission.</p>
</body></html>`;

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

  // Interactive API docs at /docs. Served as a static OpenAPI document so request
  // validation stays with Zod at the boundary (the docs never affect behaviour).
  // The document is structurally an OpenAPI 3 spec; the plugin types it as a
  // strict union our hand-authored literal can't be proven to match, hence one
  // localized cast.
  await app.register(fastifySwagger, {
    mode: 'static',
    specification: { document: openapiDocument as unknown as OpenAPIV3.Document },
  });
  await app.register(fastifySwaggerUi, { routePrefix: '/docs' });

  // Accept raw CSV bodies for the bulk-import endpoint.
  app.addContentTypeParser('text/csv', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });

  app.get('/health', async () => ({ status: 'ok' }));

  // Friendly landing page so opening the deployed URL in a browser is useful.
  app.get('/', async (_req, reply) => {
    reply.type('text/html').send(LANDING_HTML);
  });

  // Feature routes are registered in later steps.
  const { shipmentRoutes } = await import('./routes/shipments.js');
  await app.register(shipmentRoutes);

  return app;
}
