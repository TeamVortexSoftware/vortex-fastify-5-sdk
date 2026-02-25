import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createVortexWebhookHandler } from '../../src/handlers/webhooks';
import { VortexWebhooks, VortexWebhookEvent } from '@teamvortexsoftware/vortex-node-22-sdk';
import crypto from 'node:crypto';

const TEST_SECRET = 'whsec_test_secret_key_1234567890';

function sign(payload: string, secret: string = TEST_SECRET): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

const sampleWebhookEvent: VortexWebhookEvent = {
  id: 'evt_123',
  type: 'invitation.accepted',
  timestamp: '2026-02-25T12:00:00Z',
  accountId: 'acc_456',
  environmentId: 'env_789',
  sourceTable: 'invitations',
  operation: 'update',
  data: {
    invitationId: 'inv_abc',
    targetEmail: 'user@example.com',
  },
};

describe('createVortexWebhookHandler', () => {
  let webhooks: VortexWebhooks;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    webhooks = new VortexWebhooks({ secret: TEST_SECRET });
    
    mockRequest = {
      headers: {},
      body: '',
    };

    mockReply = {
      status: jest.fn().mockReturnThis() as any,
      send: jest.fn().mockReturnThis() as any,
    };
  });

  it('returns 401 when X-Vortex-Signature header is missing', async () => {
    const handler = createVortexWebhookHandler(webhooks, {});
    
    await handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.status).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({ error: 'Missing X-Vortex-Signature header' });
  });

  it('returns 400 when X-Vortex-Signature header is an array', async () => {
    mockRequest.headers = {
      'x-vortex-signature': ['sig1', 'sig2'] as any,
    };
    (mockRequest as any).rawBody = Buffer.from(JSON.stringify(sampleWebhookEvent));

    const handler = createVortexWebhookHandler(webhooks, {});
    
    await handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.status).toHaveBeenCalledWith(400);
    expect(mockReply.send).toHaveBeenCalledWith({ error: 'Multiple X-Vortex-Signature headers are not allowed' });
  });

  it('returns 500 when rawBody is not available', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockRequest.headers = {
      'x-vortex-signature': sign(payload),
    };
    mockRequest.body = JSON.parse(payload); // Parsed object, no rawBody

    const handler = createVortexWebhookHandler(webhooks, {});
    
    await handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.status).toHaveBeenCalledWith(500);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Raw request body'),
      })
    );
  });

  it('returns 401 when signature is invalid', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockRequest.headers = {
      'x-vortex-signature': 'invalid_signature',
    };
    (mockRequest as any).rawBody = Buffer.from(payload);

    const handler = createVortexWebhookHandler(webhooks, {});
    
    await handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockReply.status).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({ error: 'Invalid signature' });
  });

  it('successfully processes valid webhook with rawBody as Buffer', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockRequest.headers = {
      'x-vortex-signature': sign(payload),
    };
    (mockRequest as any).rawBody = Buffer.from(payload);

    const onEventMock = jest.fn();
    const handler = createVortexWebhookHandler(webhooks, {
      onEvent: onEventMock,
    });
    
    await handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(onEventMock).toHaveBeenCalledWith(sampleWebhookEvent);
    expect(mockReply.status).toHaveBeenCalledWith(200);
    expect(mockReply.send).toHaveBeenCalledWith({ received: true });
  });

  it('successfully processes valid webhook with rawBody as string', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockRequest.headers = {
      'x-vortex-signature': sign(payload),
    };
    (mockRequest as any).rawBody = payload; // String rawBody

    const onEventMock = jest.fn();
    const handler = createVortexWebhookHandler(webhooks, {
      onEvent: onEventMock,
    });
    
    await handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(onEventMock).toHaveBeenCalledWith(sampleWebhookEvent);
    expect(mockReply.status).toHaveBeenCalledWith(200);
    expect(mockReply.send).toHaveBeenCalledWith({ received: true });
  });

  it('successfully processes valid webhook with body as string when rawBody not available', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockRequest.headers = {
      'x-vortex-signature': sign(payload),
    };
    mockRequest.body = payload; // String body, no rawBody

    const onEventMock = jest.fn();
    const handler = createVortexWebhookHandler(webhooks, {
      onEvent: onEventMock,
    });
    
    await handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(onEventMock).toHaveBeenCalledWith(sampleWebhookEvent);
    expect(mockReply.status).toHaveBeenCalledWith(200);
    expect(mockReply.send).toHaveBeenCalledWith({ received: true });
  });

  it('calls type-specific handler when provided', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockRequest.headers = {
      'x-vortex-signature': sign(payload),
    };
    (mockRequest as any).rawBody = Buffer.from(payload);

    const typeHandlerMock = jest.fn();
    const handler = createVortexWebhookHandler(webhooks, {
      on: {
        'invitation.accepted': typeHandlerMock,
      },
    });
    
    await handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(typeHandlerMock).toHaveBeenCalledWith(sampleWebhookEvent);
    expect(mockReply.status).toHaveBeenCalledWith(200);
  });

  it('calls onError handler when handler throws', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockRequest.headers = {
      'x-vortex-signature': sign(payload),
    };
    (mockRequest as any).rawBody = Buffer.from(payload);

    const testError = new Error('Handler error');
    const onErrorMock = jest.fn();
    const handler = createVortexWebhookHandler(webhooks, {
      onEvent: jest.fn().mockRejectedValue(testError),
      onError: onErrorMock,
    });
    
    await handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(onErrorMock).toHaveBeenCalledWith(testError);
    expect(mockReply.status).toHaveBeenCalledWith(500);
    expect(mockReply.send).toHaveBeenCalledWith({ error: 'Webhook handler error' });
  });

  it('calls onError handler when signature verification fails', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockRequest.headers = {
      'x-vortex-signature': 'invalid_signature',
    };
    (mockRequest as any).rawBody = Buffer.from(payload);

    const onErrorMock = jest.fn();
    const handler = createVortexWebhookHandler(webhooks, {
      onError: onErrorMock,
    });
    
    await handler(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(onErrorMock).toHaveBeenCalled();
    const error = (onErrorMock.mock.calls[0] as any)[0];
    expect(error.name).toBe('VortexWebhookSignatureError');
    expect(mockReply.status).toHaveBeenCalledWith(401);
  });
});
