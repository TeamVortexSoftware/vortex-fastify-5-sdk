import { FastifyRequest, FastifyReply } from 'fastify';
import { VortexWebhooks, WebhookHandlers } from '@teamvortexsoftware/vortex-node-22-sdk';

/**
 * Create a Fastify handler for incoming Vortex webhook events.
 *
 * **Important:** Fastify parses JSON by default. To get the raw body for
 * signature verification, add a `rawBody` content-type parser or use
 * Fastify's `addContentTypeParser` to preserve the raw buffer.
 *
 * @param webhooks - A configured `VortexWebhooks` instance
 * @param handlers - Event handler configuration
 * @returns Fastify route handler
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import fastifyRawBody from 'fastify-raw-body';
 * import { VortexWebhooks } from '@teamvortexsoftware/vortex-node-22-sdk';
 * import { createVortexWebhookHandler } from '@teamvortexsoftware/vortex-fastify-5-sdk';
 *
 * const app = Fastify();
 * await app.register(fastifyRawBody);
 *
 * const webhooks = new VortexWebhooks({ secret: process.env.VORTEX_WEBHOOK_SECRET! });
 *
 * app.post('/webhooks/vortex', createVortexWebhookHandler(webhooks, {
 *   on: {
 *     'invitation.accepted': async (event) => {
 *       await db.activateUser(event.data.targetEmail);
 *     },
 *   },
 * }));
 * ```
 */
export function createVortexWebhookHandler(
  webhooks: VortexWebhooks,
  handlers: WebhookHandlers,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const signatureHeader = request.headers['x-vortex-signature'];

    if (Array.isArray(signatureHeader)) {
      reply.status(400).send({ error: 'Multiple X-Vortex-Signature headers are not allowed' });
      return;
    }

    const signature = signatureHeader;

    if (!signature) {
      reply.status(401).send({ error: 'Missing X-Vortex-Signature header' });
      return;
    }

    // Prefer rawBody if available (via fastify-raw-body plugin). Do not attempt to
    // reconstruct the signed payload from a parsed object, as this can change the
    // exact bytes and break signature verification.
    let rawBody: string | Buffer;

    if ((request as any).rawBody != null) {
      rawBody = (request as any).rawBody as string | Buffer;
    } else if (typeof request.body === 'string') {
      rawBody = request.body;
    } else {
      reply
        .status(500)
        .send({
          error:
            'Raw request body not available for signature verification. ' +
            'Ensure fastify-raw-body (or an equivalent raw body parser) is configured.',
        });
      return;
    }

    try {
      const event = webhooks.constructEvent(rawBody, signature);
      await webhooks.handleEvent(event, handlers);
      reply.status(200).send({ received: true });
    } catch (err) {
      const isSignatureError = (err as Error).name === 'VortexWebhookSignatureError';
      if (isSignatureError && handlers.onError) {
        handlers.onError(err as Error);
      }
      reply
        .status(isSignatureError ? 401 : 500)
        .send({ error: isSignatureError ? 'Invalid signature' : 'Webhook handler error' });
    }
  };
}
