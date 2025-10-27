import { FastifyRequest, FastifyReply } from 'fastify';
import { Vortex } from '@teamvortexsoftware/vortex-node-22-sdk';
import { getVortexConfig, authenticateRequest } from '../config';
import { createApiResponse, createErrorResponse, parseRequestBody, validateRequiredFields, getQueryParam, getRouteParam, sanitizeInput } from '../utils';

export async function handleGetInvitationsByTarget(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (request.method !== 'GET') {
      return createErrorResponse(reply, 'Method not allowed', 405);
    }

    // Get configuration and authenticate user
    const config = await getVortexConfig();
    const user = await authenticateRequest(request, reply);

    // Check access control if hook is configured
    if (config.canAccessInvitationsByTarget) {
      const hasAccess = await config.canAccessInvitationsByTarget(request, reply, user);
      if (!hasAccess) {
        return createErrorResponse(reply, 'Access denied', 403);
      }
    } else if (!user) {
      // If no access control hook is configured, require authentication
      return createErrorResponse(reply, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const targetType = sanitizeInput(getQueryParam(request, 'targetType')) as 'email' | 'username' | 'phoneNumber';
    const targetValue = sanitizeInput(getQueryParam(request, 'targetValue'));

    if (!targetType || !targetValue) {
      return createErrorResponse(reply, 'targetType and targetValue query parameters are required', 400);
    }

    if (!['email', 'username', 'phoneNumber'].includes(targetType)) {
      return createErrorResponse(reply, 'targetType must be email, username, or phoneNumber', 400);
    }

    const vortex = new Vortex(config.apiKey);
    const invitations = await vortex.getInvitationsByTarget(targetType, targetValue);
    return createApiResponse(reply, { invitations });
  } catch (error) {
    console.error('Error in handleGetInvitationsByTarget:', error);
    return createErrorResponse(reply, 'An error occurred while processing your request', 500);
  }
}

export async function handleGetInvitation(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (request.method !== 'GET') {
      return createErrorResponse(reply, 'Method not allowed', 405);
    }

    const invitationId = getRouteParam(request, 'invitationId');
    const sanitizedId = sanitizeInput(invitationId);
    if (!sanitizedId) {
      return createErrorResponse(reply, 'Invalid invitation ID', 400);
    }

    // Get configuration and authenticate user
    const config = await getVortexConfig();
    const user = await authenticateRequest(request, reply);

    // Check access control if hook is configured
    if (config.canAccessInvitation) {
      const hasAccess = await config.canAccessInvitation(request, reply, user, { invitationId: sanitizedId });
      if (!hasAccess) {
        return createErrorResponse(reply, 'Access denied', 403);
      }
    } else if (!user) {
      return createErrorResponse(reply, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const vortex = new Vortex(config.apiKey);
    const invitation = await vortex.getInvitation(sanitizedId);
    return createApiResponse(reply, invitation);
  } catch (error) {
    console.error('Error in handleGetInvitation:', error);
    return createErrorResponse(reply, 'An error occurred while processing your request', 500);
  }
}

export async function handleRevokeInvitation(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (request.method !== 'DELETE') {
      return createErrorResponse(reply, 'Method not allowed', 405);
    }

    const invitationId = getRouteParam(request, 'invitationId');
    const sanitizedId = sanitizeInput(invitationId);
    if (!sanitizedId) {
      return createErrorResponse(reply, 'Invalid invitation ID', 400);
    }

    const config = await getVortexConfig();
    const user = await authenticateRequest(request, reply);

    if (config.canDeleteInvitation) {
      const hasAccess = await config.canDeleteInvitation(request, reply, user, { invitationId: sanitizedId });
      if (!hasAccess) {
        return createErrorResponse(reply, 'Access denied', 403);
      }
    } else if (!user) {
      return createErrorResponse(reply, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const vortex = new Vortex(config.apiKey);
    await vortex.revokeInvitation(sanitizedId);
    return createApiResponse(reply, { success: true });
  } catch (error) {
    console.error('Error in handleRevokeInvitation:', error);
    return createErrorResponse(reply, 'An error occurred while processing your request', 500);
  }
}

export async function handleAcceptInvitations(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (request.method !== 'POST') {
      return createErrorResponse(reply, 'Method not allowed', 405);
    }

    const body = await parseRequestBody(request) as Record<string, unknown>;
    validateRequiredFields(body, ['invitationIds', 'target']);

    const { invitationIds, target } = body;

    if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
      return createErrorResponse(reply, 'invitationIds must be a non-empty array', 400);
    }

    // Sanitize invitation IDs
    const sanitizedIds: string[] = invitationIds.map((id: string) => sanitizeInput(id)).filter((id): id is string => Boolean(id));
    if (sanitizedIds.length !== invitationIds.length) {
      return createErrorResponse(reply, 'Invalid invitation IDs provided', 400);
    }

    // Type assertion for target since we validate it below
    const targetObj = target as { type?: string; value?: string };

    if (!targetObj.type || !targetObj.value) {
      return createErrorResponse(reply, 'target must have type and value properties', 400);
    }

    if (!['email', 'username', 'phoneNumber'].includes(targetObj.type)) {
      return createErrorResponse(reply, 'target.type must be email, username, or phoneNumber', 400);
    }

    // Now we know type and value are defined
    const validatedTarget = { type: targetObj.type, value: targetObj.value } as { type: 'email' | 'username' | 'phoneNumber'; value: string };

    const config = await getVortexConfig();
    const user = await authenticateRequest(request, reply);

    if (config.canAcceptInvitations) {
      const hasAccess = await config.canAcceptInvitations(request, reply, user, { invitationIds: sanitizedIds, target: validatedTarget });
      if (!hasAccess) {
        return createErrorResponse(reply, 'Access denied', 403);
      }
    } else if (!user) {
      return createErrorResponse(reply, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const vortex = new Vortex(config.apiKey);
    const result = await vortex.acceptInvitations(sanitizedIds, {
      type: validatedTarget.type,
      value: sanitizeInput(validatedTarget.value) || validatedTarget.value
    });
    return createApiResponse(reply, result);
  } catch (error) {
    console.error('Error in handleAcceptInvitations:', error);
    return createErrorResponse(reply, 'An error occurred while processing your request', 500);
  }
}

export async function handleGetInvitationsByGroup(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (request.method !== 'GET') {
      return createErrorResponse(reply, 'Method not allowed', 405);
    }

    const groupType = getRouteParam(request, 'groupType');
    const groupId = getRouteParam(request, 'groupId');
    const sanitizedGroupType = sanitizeInput(groupType);
    const sanitizedGroupId = sanitizeInput(groupId);

    if (!sanitizedGroupType || !sanitizedGroupId) {
      return createErrorResponse(reply, 'Invalid group parameters', 400);
    }

    const config = await getVortexConfig();
    const user = await authenticateRequest(request, reply);

    if (config.canAccessInvitationsByGroup) {
      const hasAccess = await config.canAccessInvitationsByGroup(request, reply, user, {
        groupType: sanitizedGroupType,
        groupId: sanitizedGroupId
      });
      if (!hasAccess) {
        return createErrorResponse(reply, 'Access denied', 403);
      }
    } else if (!user) {
      return createErrorResponse(reply, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const vortex = new Vortex(config.apiKey);
    const invitations = await vortex.getInvitationsByGroup(sanitizedGroupType, sanitizedGroupId);
    return createApiResponse(reply, { invitations });
  } catch (error) {
    console.error('Error in handleGetInvitationsByGroup:', error);
    return createErrorResponse(reply, 'An error occurred while processing your request', 500);
  }
}

export async function handleDeleteInvitationsByGroup(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (request.method !== 'DELETE') {
      return createErrorResponse(reply, 'Method not allowed', 405);
    }

    const groupType = getRouteParam(request, 'groupType');
    const groupId = getRouteParam(request, 'groupId');
    const sanitizedGroupType = sanitizeInput(groupType);
    const sanitizedGroupId = sanitizeInput(groupId);

    if (!sanitizedGroupType || !sanitizedGroupId) {
      return createErrorResponse(reply, 'Invalid group parameters', 400);
    }

    const config = await getVortexConfig();
    const user = await authenticateRequest(request, reply);

    if (config.canDeleteInvitationsByGroup) {
      const hasAccess = await config.canDeleteInvitationsByGroup(request, reply, user, {
        groupType: sanitizedGroupType,
        groupId: sanitizedGroupId
      });
      if (!hasAccess) {
        return createErrorResponse(reply, 'Access denied', 403);
      }
    } else if (!user) {
      return createErrorResponse(reply, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const vortex = new Vortex(config.apiKey);
    await vortex.deleteInvitationsByGroup(sanitizedGroupType, sanitizedGroupId);
    return createApiResponse(reply, { success: true });
  } catch (error) {
    console.error('Error in handleDeleteInvitationsByGroup:', error);
    return createErrorResponse(reply, 'An error occurred while processing your request', 500);
  }
}

export async function handleReinvite(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (request.method !== 'POST') {
      return createErrorResponse(reply, 'Method not allowed', 405);
    }

    const invitationId = getRouteParam(request, 'invitationId');
    const sanitizedId = sanitizeInput(invitationId);
    if (!sanitizedId) {
      return createErrorResponse(reply, 'Invalid invitation ID', 400);
    }

    const config = await getVortexConfig();
    const user = await authenticateRequest(request, reply);

    if (config.canReinvite) {
      const hasAccess = await config.canReinvite(request, reply, user, { invitationId: sanitizedId });
      if (!hasAccess) {
        return createErrorResponse(reply, 'Access denied', 403);
      }
    } else if (!user) {
      return createErrorResponse(reply, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const vortex = new Vortex(config.apiKey);
    const invitation = await vortex.reinvite(sanitizedId);
    return createApiResponse(reply, invitation);
  } catch (error) {
    console.error('Error in handleReinvite:', error);
    return createErrorResponse(reply, 'An error occurred while processing your request', 500);
  }
}