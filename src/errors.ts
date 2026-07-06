import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

/** Machine-readable error codes returned in the error envelope. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  INVALID_STATE: 409,
  INTERNAL: 500,
};

/**
 * Application error carrying an HTTP-mappable code. Services throw these;
 * the global error handler renders them into the uniform envelope.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details: unknown = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  get statusCode(): number {
    return STATUS_BY_CODE[this.code];
  }

  static notFound(message: string, details: unknown = null): AppError {
    return new AppError('NOT_FOUND', message, details);
  }

  static invalidState(message: string, details: unknown = null): AppError {
    return new AppError('INVALID_STATE', message, details);
  }

  static validation(message: string, details: unknown = null): AppError {
    return new AppError('VALIDATION_ERROR', message, details);
  }
}

interface ErrorEnvelope {
  error: { code: ErrorCode; message: string; details: unknown };
}

function envelope(code: ErrorCode, message: string, details: unknown): ErrorEnvelope {
  return { error: { code, message, details } };
}

/** Registers a single error handler so every failure exits through one envelope. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, _req: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send(envelope(error.code, error.message, error.details));
      return;
    }

    if (error instanceof ZodError) {
      reply
        .status(400)
        .send(envelope('VALIDATION_ERROR', 'Request validation failed', error.issues));
      return;
    }

    // Fastify's own validation / parsing errors carry a statusCode.
    const maybe = error as { statusCode?: number; message?: string; code?: string };
    if (typeof maybe.statusCode === 'number' && maybe.statusCode >= 400 && maybe.statusCode < 500) {
      reply
        .status(maybe.statusCode)
        .send(envelope('VALIDATION_ERROR', maybe.message ?? 'Bad request', maybe.code ?? null));
      return;
    }

    _req.log.error({ err: error }, 'Unhandled error');
    reply.status(500).send(envelope('INTERNAL', 'Internal server error', null));
  });

  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    reply
      .status(404)
      .send(envelope('NOT_FOUND', `Route ${req.method} ${req.url} not found`, null));
  });
}
