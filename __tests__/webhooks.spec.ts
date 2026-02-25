import crypto from 'node:crypto';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createVortexWebhookHandler } from '../src/handlers/webhooks';
import { VortexWebhooks, WebhookHandlers, VortexWebhookEvent } from '@teamvortexsoftware/vortex-node-22-sdk';

const TEST_SECRET = 'whsec_test_secret';

function sign(payload: string): string {
  return crypto.createHmac('sha256', TEST_SECRET).update(payload).digest('hex');
}

const sampleEvent: VortexWebhookEvent = {
  id: 'evt_1',
  type: 'invitation.accepted',
  timestamp: '2026-02-25T12:00:00Z',
  accountId: 'acc_1',
  environmentId: null,
  sourceTable: 'invitations',
  operation: 'update',
  data: { targetEmail: 'user@test.com' },
};

function mockRequest(overrides: Record<string, any> = {}) {
  const rawBody = overrides.rawBody ?? JSON.stringify(sampleEvent);
  return {
    headers: overrides.headers ?? { 'x-vortex-signature': sign(rawBody) },
    body: overrides.body ?? JSON.parse(rawBody),
    rawBody: overrides.rawBody !== undefined ? overrides.rawBody : rawBody,
    ...overrides,
  } as any;
}

function mockReply() {
  const reply: any = {};
  reply.status = jest.fn().mockReturnValue(reply);
  reply.send = jest.fn().mockReturnValue(reply);
  return reply;
}

describe('createVortexWebhookHandler (Fastify)', () => {
  let webhooks: VortexWebhooks;

  beforeEach(() => {
    webhooks = new VortexWebhooks({ secret: TEST_SECRET });
  });

  it('returns 200 and calls handler on valid request', async () => {
    const calls: string[] = [];
    const handlers: WebhookHandlers = {
      on: { 'invitation.accepted': async () => { calls.push('accepted'); } },
    };
    const handler = createVortexWebhookHandler(webhooks, handlers);
    const req = mockRequest();
    const reply = mockReply();
    await handler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ received: true });
    expect(calls).toEqual(['accepted']);
  });

  it('returns 401 when signature header is missing', async () => {
    const handler = createVortexWebhookHandler(webhooks, {});
    const req = mockRequest({ headers: {} });
    const reply = mockReply();
    await handler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 when multiple signature headers are present', async () => {
    const handler = createVortexWebhookHandler(webhooks, {});
    const req = mockRequest({ headers: { 'x-vortex-signature': ['sig1', 'sig2'] } });
    const reply = mockReply();
    await handler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it('returns 401 for invalid signature', async () => {
    const handler = createVortexWebhookHandler(webhooks, {});
    const req = mockRequest({ headers: { 'x-vortex-signature': 'bad' } });
    const reply = mockReply();
    await handler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it('returns 500 when rawBody is not available and body is parsed object', async () => {
    const handler = createVortexWebhookHandler(webhooks, {});
    const req = mockRequest({
      rawBody: undefined,
      body: { id: 'evt_1' },
      headers: { 'x-vortex-signature': 'anything' },
    });
    // Explicitly remove rawBody to simulate missing plugin
    delete req.rawBody;
    const reply = mockReply();
    await handler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('Raw request body not available'),
    }));
  });

  it('falls back to string body when rawBody is missing', async () => {
    const bodyStr = JSON.stringify(sampleEvent);
    const handler = createVortexWebhookHandler(webhooks, {});
    const req = {
      headers: { 'x-vortex-signature': sign(bodyStr) },
      body: bodyStr,
    } as any;
    const reply = mockReply();
    await handler(req, reply);
    expect(reply.status).toHaveBeenCalledWith(200);
  });
});
