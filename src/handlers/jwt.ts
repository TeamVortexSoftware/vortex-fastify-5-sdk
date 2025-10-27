import { FastifyRequest, FastifyReply } from 'fastify';
import { Vortex } from '@teamvortexsoftware/vortex-node-22-sdk';
import { getVortexConfig } from '../config';
import { createApiResponse, createErrorResponse } from '../utils';

export async function handleJwtGeneration(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (request.method !== 'POST') {
      return createErrorResponse(reply, 'Method not allowed', 405);
    }

    const config = await getVortexConfig();

    if (!config.authenticateUser) {
      return createErrorResponse(reply, 'JWT generation requires authentication configuration. Please configure authenticateUser hook.', 500);
    }

    const authenticatedUser = await config.authenticateUser(request, reply);

    if (!authenticatedUser) {
      return createErrorResponse(reply, 'Unauthorized', 401);
    }

    const vortex = new Vortex(config.apiKey);

    const jwt = vortex.generateJwt({
      userId: authenticatedUser.userId,
      identifiers: authenticatedUser.identifiers,
      groups: authenticatedUser.groups,
      role: authenticatedUser.role,
    });

    return createApiResponse(reply, { jwt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    return createErrorResponse(reply, message, 500);
  }
}