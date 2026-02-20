import { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import { handleJwtGeneration } from './handlers/jwt';
import {
  handleGetInvitationsByTarget,
  handleGetInvitation,
  handleRevokeInvitation,
  handleAcceptInvitations,
  handleGetInvitationsByGroup,
  handleDeleteInvitationsByGroup,
  handleReinvite,
  handleSyncInternalInvitation,
} from './handlers/invitations';

/**
 * Expected route paths that match the React provider's API calls
 * This ensures the Fastify routes and React provider stay in sync
 */
export const VORTEX_ROUTES = {
  JWT: '/jwt',
  INVITATIONS: '/invitations',
  INVITATION: '/invitations/:invitationId',
  INVITATIONS_ACCEPT: '/invitations/accept',
  INVITATIONS_BY_GROUP: '/invitations/by-group/:groupType/:groupId',
  INVITATION_REINVITE: '/invitations/:invitationId/reinvite',
  SYNC_INTERNAL_INVITATION: '/invitation-actions/sync-internal-invitation',
} as const;

/**
 * Utility to create the full API path based on base URL
 */
export function createVortexApiPath(baseUrl: string, route: keyof typeof VORTEX_ROUTES): string {
  return `${baseUrl.replace(/\/$/, '')}${VORTEX_ROUTES[route]}`;
}

/**
 * Creates individual route handlers for JWT endpoint
 */
export function createVortexJwtRoute() {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    return handleJwtGeneration(request, reply);
  };
}

/**
 * Creates individual route handlers for invitations endpoint
 */
export function createVortexInvitationsRoute() {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    return handleGetInvitationsByTarget(request, reply);
  };
}

/**
 * Creates individual route handlers for single invitation endpoint
 */
export function createVortexInvitationRoute() {
  return {
    get: async function(request: FastifyRequest, reply: FastifyReply) {
      return handleGetInvitation(request, reply);
    },
    delete: async function(request: FastifyRequest, reply: FastifyReply) {
      return handleRevokeInvitation(request, reply);
    },
  };
}

/**
 * Creates individual route handlers for invitations accept endpoint
 */
export function createVortexInvitationsAcceptRoute() {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    return handleAcceptInvitations(request, reply);
  };
}

/**
 * Creates individual route handlers for invitations by group endpoint
 */
export function createVortexInvitationsByGroupRoute() {
  return {
    get: async function(request: FastifyRequest, reply: FastifyReply) {
      return handleGetInvitationsByGroup(request, reply);
    },
    delete: async function(request: FastifyRequest, reply: FastifyReply) {
      return handleDeleteInvitationsByGroup(request, reply);
    },
  };
}

/**
 * Creates individual route handlers for reinvite endpoint
 */
export function createVortexReinviteRoute() {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    return handleReinvite(request, reply);
  };
}

/**
 * Creates individual route handlers for sync internal invitation endpoint
 */
export function createVortexSyncInternalInvitationRoute() {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    return handleSyncInternalInvitation(request, reply);
  };
}

/**
 * Creates all Vortex routes for manual registration
 * This provides individual handlers that can be attached to specific routes
 */
export function createVortexRoutes() {
  return {
    jwt: createVortexJwtRoute(),
    invitations: createVortexInvitationsRoute(),
    invitation: createVortexInvitationRoute(),
    invitationsAccept: createVortexInvitationsAcceptRoute(),
    invitationsByGroup: createVortexInvitationsByGroupRoute(),
    invitationReinvite: createVortexReinviteRoute(),
    syncInternalInvitation: createVortexSyncInternalInvitationRoute(),
  };
}

/**
 * Creates a Fastify plugin with all Vortex routes configured
 * This is the easiest way to integrate Vortex into a Fastify app
 *
 * Usage:
 * ```typescript
 * import Fastify from 'fastify';
 * import { vortexPlugin } from '@teamvortexsoftware/vortex-fastify-5-sdk';
 *
 * const fastify = Fastify();
 * await fastify.register(vortexPlugin, { prefix: '/api/vortex' });
 * ```
 */
export const vortexPlugin: FastifyPluginAsync = async function vortexPlugin(
  fastify: FastifyInstance
) {
  const routes = createVortexRoutes();

  // Register all routes
  fastify.post(VORTEX_ROUTES.JWT, routes.jwt);
  fastify.get(VORTEX_ROUTES.INVITATIONS, routes.invitations);
  fastify.get(VORTEX_ROUTES.INVITATION, routes.invitation.get);
  fastify.delete(VORTEX_ROUTES.INVITATION, routes.invitation.delete);
  fastify.post(VORTEX_ROUTES.INVITATIONS_ACCEPT, routes.invitationsAccept);
  fastify.get(VORTEX_ROUTES.INVITATIONS_BY_GROUP, routes.invitationsByGroup.get);
  fastify.delete(VORTEX_ROUTES.INVITATIONS_BY_GROUP, routes.invitationsByGroup.delete);
  fastify.post(VORTEX_ROUTES.INVITATION_REINVITE, routes.invitationReinvite);
  fastify.post(VORTEX_ROUTES.SYNC_INTERNAL_INVITATION, routes.syncInternalInvitation);
};

/**
 * Manual route registration helper for more control
 * Use this if you want to register routes individually or with custom logic
 *
 * Usage:
 * ```typescript
 * import Fastify from 'fastify';
 * import { registerVortexRoutes } from '@teamvortexsoftware/vortex-fastify-5-sdk';
 *
 * const fastify = Fastify();
 *
 * // Register with custom prefix
 * await registerVortexRoutes(fastify, '/api/v1/vortex');
 * ```
 */
export async function registerVortexRoutes(fastify: FastifyInstance, basePath: string = '/api/vortex'): Promise<void> {
  const routes = createVortexRoutes();
  const cleanBasePath = basePath.replace(/\/$/, '');

  // Register all routes with the base path
  fastify.post(`${cleanBasePath}${VORTEX_ROUTES.JWT}`, routes.jwt);
  fastify.get(`${cleanBasePath}${VORTEX_ROUTES.INVITATIONS}`, routes.invitations);
  fastify.get(`${cleanBasePath}${VORTEX_ROUTES.INVITATION}`, routes.invitation.get);
  fastify.delete(`${cleanBasePath}${VORTEX_ROUTES.INVITATION}`, routes.invitation.delete);
  fastify.post(`${cleanBasePath}${VORTEX_ROUTES.INVITATIONS_ACCEPT}`, routes.invitationsAccept);
  fastify.get(`${cleanBasePath}${VORTEX_ROUTES.INVITATIONS_BY_GROUP}`, routes.invitationsByGroup.get);
  fastify.delete(`${cleanBasePath}${VORTEX_ROUTES.INVITATIONS_BY_GROUP}`, routes.invitationsByGroup.delete);
  fastify.post(`${cleanBasePath}${VORTEX_ROUTES.INVITATION_REINVITE}`, routes.invitationReinvite);
  fastify.post(`${cleanBasePath}${VORTEX_ROUTES.SYNC_INTERNAL_INVITATION}`, routes.syncInternalInvitation);
}

/**
 * Type definitions for Fastify plugin options
 */
export interface VortexPluginOptions {
  prefix?: string;
}