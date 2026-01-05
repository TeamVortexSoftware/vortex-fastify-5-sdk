# Vortex Fastify 5 Implementation Guide

**Package:** `@teamvortexsoftware/vortex-fastify-5-sdk`
**Depends on:** `@teamvortexsoftware/vortex-node-22-sdk`
**Requires:** Fastify 5.0.0+, Node.js 18.0.0+

## Prerequisites
From integration contract you need: API endpoint prefix, scope entity, authentication pattern
From discovery data you need: Auth plugin/decorator pattern, database ORM, plugin structure

## Key Facts
- Configure Vortex BEFORE registering plugin
- Auth hook must run before Vortex plugin and populate `request.user`
- Accept invitations endpoint requires custom database logic (must override)
- New simplified user format: `{ userId, userEmail, adminScopes }`
- Fastify automatically parses JSON (no body parser needed)

---

## Step 1: Install

```bash
npm install @teamvortexsoftware/vortex-fastify-5-sdk
# or
pnpm add @teamvortexsoftware/vortex-fastify-5-sdk
```

---

## Step 2: Set Environment Variable

Add to `.env`:

```bash
VORTEX_API_KEY=VRTX.your-api-key-here.secret
```

**Never commit API key to version control.**

---

## Step 3: Configure Vortex

Create `src/plugins/vortex.ts` (or similar):

```typescript
import { configureVortex, createAllowAllAccessControl } from '@teamvortexsoftware/vortex-fastify-5-sdk';

configureVortex({
  apiKey: process.env.VORTEX_API_KEY!,

  // Required: Extract authenticated user from request
  authenticateUser: async (request, reply) => {
    const user = request.user; // Adapt to your auth decorator

    if (!user) {
      return null; // Not authenticated
    }

    return {
      userId: user.id,
      userEmail: user.email,
      adminScopes: user.isAdmin ? ['autojoin'] : undefined
    };
  },

  // Optional: Access control hooks
  // Use createAllowAllAccessControl() for development, or implement custom:
  ...createAllowAllAccessControl(),

  // Or custom access control:
  // canAccessInvitationsByTarget: async (request, reply, user) => user !== null,
  // canAcceptInvitations: async (request, reply, user, resource) => true,
  // canDeleteInvitation: async (request, reply, user, resource) => {
  //   return user?.adminScopes?.includes('autojoin') || false;
  // },
});
```

**Adapt to their patterns:**
- Match their auth decorator (request.user, request.currentUser, request.session.user, etc.)
- Match their user ID field (user.id, user._id, user.userId, etc.)
- Match their admin role check (user.isAdmin, user.role === 'admin', etc.)

---

## Step 4: Register Plugin and Override Accept Endpoint

In main app file (e.g., `src/app.ts` or `src/server.ts`):

```typescript
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { vortexPlugin } from '@teamvortexsoftware/vortex-fastify-5-sdk';
import { VortexClient } from '@teamvortexsoftware/vortex-node-22-sdk';
import './plugins/vortex'; // Import configuration

const fastify = Fastify({ logger: true });

// CRITICAL: Auth must run first and populate request.user
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET!
});

fastify.decorateRequest('user', null);

fastify.addHook('onRequest', async (request, reply) => {
  try {
    await request.jwtVerify();
    // request.user now populated by @fastify/jwt
  } catch (err) {
    // Not authenticated - authenticateUser will return null
  }
});

// Register Vortex plugin at prefix from integration contract
await fastify.register(vortexPlugin, { prefix: '/api/v1/vortex' });

// Override accept invitations with custom database logic
fastify.post('/api/v1/vortex/invitations/accept', async (request, reply) => {
  try {
    const { invitationIds, user: acceptUser } = request.body as {
      invitationIds: string[];
      user: { email?: string; phone?: string };
    };

    const user = request.user; // Adapt
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // Accept via Vortex API
    const vortex = new VortexClient(process.env.VORTEX_API_KEY!);
    const result = await vortex.acceptInvitations(invitationIds, acceptUser);

    // Add user to database - adapt to your ORM
    // Prisma example:
    for (const group of result.groups) {
      await prisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: group.groupId, // Adapt field names
          role: 'member',
          joinedAt: new Date()
        }
      });
    }

    // TypeORM example:
    // for (const group of result.groups) {
    //   const member = workspaceMemberRepository.create({
    //     userId: user.id,
    //     workspaceId: group.groupId,
    //     role: 'member',
    //     joinedAt: new Date()
    //   });
    //   await workspaceMemberRepository.save(member);
    // }

    // Sequelize example:
    // for (const group of result.groups) {
    //   await WorkspaceMember.create({
    //     userId: user.id,
    //     workspaceId: group.groupId,
    //     role: 'member',
    //     joinedAt: new Date()
    //   });
    // }

    // Raw SQL example:
    // for (const group of result.groups) {
    //   await db.query(
    //     'INSERT INTO workspace_members (user_id, workspace_id, role, joined_at) VALUES (?, ?, ?, ?)',
    //     [user.id, group.groupId, 'member', new Date()]
    //   );
    // }

    return reply.send(result);
  } catch (error) {
    fastify.log.error(error);
    return reply.code(500).send({ error: 'Failed to accept invitations', code: 'INTERNAL_ERROR' });
  }
});

// Your other routes...

await fastify.listen({ port: 3000 });

export default fastify;
```

**Critical - Adapt database logic:**
- Use their actual table/model names (from discovery)
- Use their actual column/field names
- Use their database ORM/library pattern
- Handle duplicate memberships if needed

**Important note on route overriding:**
Fastify does not allow registering the same route (method + URL) twice. The code above works because you register the custom route AFTER the plugin, which effectively overrides the plugin's route handler.

---

## Step 5: Add CORS (If Needed)

If frontend on different domain:

```bash
npm install @fastify/cors
```

```typescript
import cors from '@fastify/cors';

await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
});
```

---

## Step 6: Build and Test

```bash
# TypeScript projects
npm run build

# Start server
npm start

# Test JWT endpoint
curl -X POST http://localhost:3000/api/v1/vortex/jwt \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

Expected response:
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## Common Errors

**"Cannot find module vortex-fastify-5-sdk"** → Run `npm install @teamvortexsoftware/vortex-fastify-5-sdk`

**"request.user is undefined"** → Ensure auth hook runs before Vortex plugin and populates `request.user`

**"User not added to database"** → Must override accept endpoint with custom DB logic (see Step 4)

**"configureVortex is not a function"** → Import configuration file before using plugin

**"Plugin registration fails"** → Use `await fastify.register()` with async/await

**"Route already exists"** → Fastify doesn't allow duplicate routes. Register custom route AFTER plugin to override.

**CORS errors** → Install and configure @fastify/cors

---

## After Implementation Report

List files created/modified:
- Configuration: src/plugins/vortex.ts
- Routes: src/app.ts (registered Vortex plugin)
- Environment: .env (VORTEX_API_KEY)
- Database: Accept endpoint creates memberships in [table name]

Confirm:
- `configureVortex()` called before plugin registered
- Vortex plugin registered at correct prefix
- Accept invitations endpoint overridden with DB logic
- JWT endpoint returns valid JWT
- Auth hook runs before Vortex plugin
- Build succeeds

## Endpoints Registered

All endpoints mounted at prefix (e.g., `/api/v1/vortex`):
- `POST /jwt` - Generate JWT for authenticated user
- `GET /invitations` - Get invitations by target
- `GET /invitations/:id` - Get invitation by ID
- `POST /invitations/accept` - Accept invitations (custom DB logic)
- `DELETE /invitations/:id` - Revoke invitation
- `POST /invitations/:id/reinvite` - Resend invitation
- `GET /invitations/by-group/:type/:id` - Get invitations for group
- `DELETE /invitations/by-group/:type/:id` - Delete invitations for group
