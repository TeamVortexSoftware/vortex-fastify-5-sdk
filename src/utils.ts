import { FastifyRequest, FastifyReply } from 'fastify';

export function createApiResponse(reply: FastifyReply, data: unknown, status: number = 200): FastifyReply {
  return reply.status(status).send(data);
}

export function createErrorResponse(reply: FastifyReply, message: string, status: number = 400): FastifyReply {
  return reply.status(status).send({ error: message });
}

export async function parseRequestBody(request: FastifyRequest): Promise<unknown> {
  // In Fastify, the body is already parsed and available on the request
  if (request.body) {
    return request.body;
  }
  throw new Error('Request body is empty or not parsed');
}

export function getQueryParam(request: FastifyRequest, param: string): string | null {
  const query = request.query as Record<string, unknown>;
  const value = query[param];
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return null;
}

export function getRouteParam(request: FastifyRequest, param: string): string | null {
  const params = request.params as Record<string, unknown>;
  const value = params[param];
  return typeof value === 'string' ? value : null;
}

export function validateRequiredFields(data: Record<string, unknown>, fields: string[]): void {
  const missing = fields.filter(field => data[field] === undefined || data[field] === null);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

export function sanitizeInput(input: string | null): string | null {
  if (!input) return null;

  // Basic input sanitization - remove potential XSS/injection characters
  return input
    .trim()
    .replace(/[<>'"]/g, '') // Remove basic XSS characters
    .substring(0, 1000); // Limit length to prevent DoS
}