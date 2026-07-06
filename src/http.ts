import type { FastifyRequest } from 'fastify';

/**
 * Resolve the acting principal for audit entries from the optional `x-actor`
 * header. In production this would come from an authenticated session; here it
 * is a documented simplification. Defaults to "system".
 */
export function getActor(req: FastifyRequest): string {
  const header = req.headers['x-actor'];
  const value = Array.isArray(header) ? header[0] : header;
  return value && value.trim() ? value.trim() : 'system';
}
