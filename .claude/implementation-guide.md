# Vortex Fastify 5 Integration Guide

This guide provides step-by-step instructions for integrating Vortex into a Fastify 5 application using the `@teamvortexsoftware/vortex-fastify-5-sdk`.

## SDK Information

- **Package**: `@teamvortexsoftware/vortex-fastify-5-sdk`
- **Depends on**: `@teamvortexsoftware/vortex-node-22-sdk`
- **Requires**: Fastify 5.0.0+, Node.js 18.0.0+
- **Type**: Backend SDK with native Fastify plugin architecture

## Expected Input Context

This guide expects to receive the following context from the orchestrator:

### Integration Contract
```yaml
Integration Contract:
  API Endpoints:
    Prefix: /api/v1/vortex
    JWT: POST {prefix}/jwt
    Get Invitations: GET {prefix}/invitations
    Get Invitation: GET {prefix}/invitations/:id
    Accept Invitations: POST {prefix}/invitations/accept
  Scope:
    Entity: "workspace"
    Type: "workspace"
    ID Field: "workspace.id"
  File Paths:
    Backend:
      Vortex Config: src/plugins/vortex.ts (or wherever plugins are registered)
      Main App: src/app.ts or src/server.ts
  Authentication:
    Pattern: "JWT Bearer token" (or session-based, etc.)
    User Extraction: "request.user" (or custom decorator)
  Database:
    ORM: "Prisma" | "TypeORM" | "Sequelize" | "Knex" | "Raw SQL"
    User Model: users table/model
    Membership Model: workspaceMembers table/model (or equivalent)
```

### Discovery Data
- Backend technology stack (Fastify version, TypeScript/JavaScript)
- Database ORM/library
- Authentication plugin/decorator in use
- Existing plugin structure
- Environment variable management approach

## Implementation Overview

The Fastify 5 SDK provides three integration methods:

1. **Plugin Registration** (Recommended): `fastify.register(vortexPlugin)` - Native Fastify plugin
2. **Manual Registration**: `registerVortexRoutes(fastify, basePath)` - Register routes individually
3. **Individual Handlers**: `createVortexRoutes()` - Access route handlers directly

All methods require configuration via `configureVortex()` to connect to your authentication and database layer.

## Critical Fastify 5 Specifics

### Key Patterns
- **Plugin Architecture**: Leverages Fastify's native plugin system for encapsulation
- **Lazy Initialization**: Always configure Vortex BEFORE registering plugin/routes
- **Authentication Hook**: `authenticateUser` extracts user from FastifyRequest
- **Access Control**: Optional hooks for authorization (all hooks receive FastifyRequest and FastifyReply)
- **New User Format**: `{ userId, userEmail, adminScopes }` (simplified from legacy format)
- **No Body Parser Needed**: Fastify automatically parses JSON (unlike Express)

### Plugin Pattern (Recommended)
```typescript
import Fastify from 'fastify';
import { configureVortex, vortexPlugin } from '@teamvortexsoftware/vortex-fastify-5-sdk';

// 1. Configure
configureVortex({
  apiKey: process.env.VORTEX_API_KEY!,
  authenticateUser: async (request, reply) => ({
    userId: request.user.id,
    userEmail: request.user.email,
    adminScopes: request.user.isAdmin ? ['autojoin'] : undefined
  })
});

// 2. Register plugin with prefix
await fastify.register(vortexPlugin, { prefix: '/api/v1/vortex' });
```

## Step-by-Step Implementation

### Step 1: Install SDK

```bash
npm install @teamvortexsoftware/vortex-fastify-5-sdk
# or
yarn add @teamvortexsoftware/vortex-fastify-5-sdk
# or
pnpm add @teamvortexsoftware/vortex-fastify-5-sdk
```

### Step 2: Set Up Environment Variables

Add to your `.env` file:

```bash
VORTEX_API_KEY=VRTX.your-api-key-here.secret
```

**IMPORTANT**: Never commit your API key to version control.

### Step 3: Configure Vortex

Create or update your Vortex plugin file (e.g., `src/plugins/vortex.ts`):

```typescript
import { configureVortex, createAllowAllAccessControl } from '@teamvortexsoftware/vortex-fastify-5-sdk';

// Configure Vortex with your authentication logic
configureVortex({
  apiKey: process.env.VORTEX_API_KEY!,

  // Required: Extract authenticated user from request
  authenticateUser: async (request, reply) => {
    // Adjust based on your authentication decorator/plugin
    // Examples:
    // - Fastify JWT plugin: request.user (from @fastify/jwt)
    // - Custom decorator: request.currentUser
    // - Session plugin: request.session.user

    const user = request.user; // Adjust to your auth pattern

    if (!user) {
      return null; // Not authenticated
    }

    // Return new simplified format
    return {
      userId: user.id,           // Your user's unique ID
      userEmail: user.email,     // User's email address
      adminScopes: user.isAdmin ? ['autojoin'] : undefined  // Optional admin scopes
    };
  },

  // Optional: Access control hooks
  // If not provided, use createAllowAllAccessControl() for development
  ...createAllowAllAccessControl(),

  // Or implement custom access control:
  // canAccessInvitationsByTarget: async (request, reply, user) => {
  //   return user !== null; // Only authenticated users
  // },
  // canAcceptInvitations: async (request, reply, user, resource) => {
  //   // resource contains: { invitationIds, target }
  //   return true;
  // },
  // canDeleteInvitation: async (request, reply, user, resource) => {
  //   // resource contains: { invitationId }
  //   // Only admins can delete
  //   return user?.adminScopes?.includes('autojoin') || false;
  // },
  // ... other hooks as needed
});
```

### Step 4: Register Vortex Plugin

**Option A: Plugin Registration (Recommended)**

In your main app file (e.g., `src/app.ts` or `src/server.ts`):

```typescript
import Fastify from 'fastify';
import { vortexPlugin } from '@teamvortexsoftware/vortex-fastify-5-sdk';
import './plugins/vortex'; // Import configuration

const fastify = Fastify({
  logger: true
});

// Register authentication plugin FIRST (example with @fastify/jwt)
await fastify.register(import('@fastify/jwt'), {
  secret: process.env.JWT_SECRET!
});

// Decorate request with user (example)
fastify.decorateRequest('user', null);

// Add authentication hook
fastify.addHook('onRequest', async (request, reply) => {
  try {
    await request.jwtVerify();
    // request.user is now populated by @fastify/jwt
  } catch (err) {
    // Not authenticated - that's ok, authenticateUser will return null
  }
});

// Register Vortex plugin at the prefix from the integration contract
await fastify.register(vortexPlugin, { prefix: '/api/v1/vortex' });

// Your other routes...

await fastify.listen({ port: 3000 });
```

**Option B: Manual Route Registration**

```typescript
import Fastify from 'fastify';
import { registerVortexRoutes } from '@teamvortexsoftware/vortex-fastify-5-sdk';
import './plugins/vortex';

const fastify = Fastify();

// Set up authentication first...

// Register routes with base path
await registerVortexRoutes(fastify, '/api/v1/vortex');
```

**Option C: Individual Route Handlers (Advanced)**

```typescript
import Fastify from 'fastify';
import { createVortexRoutes, VORTEX_ROUTES } from '@teamvortexsoftware/vortex-fastify-5-sdk';
import './plugins/vortex';

const fastify = Fastify();

const routes = createVortexRoutes();
const prefix = '/api/v1/vortex';

// Register individual handlers
fastify.post(`${prefix}${VORTEX_ROUTES.JWT}`, routes.jwt);
fastify.get(`${prefix}${VORTEX_ROUTES.INVITATIONS}`, routes.invitations);
fastify.get(`${prefix}${VORTEX_ROUTES.INVITATION}`, routes.invitation.get);
fastify.delete(`${prefix}${VORTEX_ROUTES.INVITATION}`, routes.invitation.delete);
fastify.post(`${prefix}${VORTEX_ROUTES.INVITATIONS_ACCEPT}`, routes.invitationsAccept);
fastify.get(`${prefix}${VORTEX_ROUTES.INVITATIONS_BY_GROUP}`, routes.invitationsByGroup.get);
fastify.delete(`${prefix}${VORTEX_ROUTES.INVITATIONS_BY_GROUP}`, routes.invitationsByGroup.delete);
fastify.post(`${prefix}${VORTEX_ROUTES.INVITATION_REINVITE}`, routes.invitationReinvite);
```

### Step 5: Implement Accept Invitations Endpoint (CRITICAL)

The accept invitations endpoint requires custom business logic to add users to your database. You MUST override this endpoint:

```typescript
import Fastify from 'fastify';
import { vortexPlugin } from '@teamvortexsoftware/vortex-fastify-5-sdk';
import { VortexClient } from '@teamvortexsoftware/vortex-node-22-sdk';
import './plugins/vortex';

const fastify = Fastify();

// Register Vortex plugin first
await fastify.register(vortexPlugin, { prefix: '/api/v1/vortex' });

// Override accept invitations endpoint with custom logic
fastify.post('/api/v1/vortex/invitations/accept', async (request, reply) => {
  try {
    const { invitationIds, target } = request.body as {
      invitationIds: string[];
      target: { type: string; value: string };
    };

    // 1. Extract authenticated user
    const user = request.user; // Adjust based on your auth decorator
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // 2. Accept invitation via Vortex API
    const vortex = new VortexClient(process.env.VORTEX_API_KEY!);
    const result = await vortex.acceptInvitations(invitationIds, target);

    // 3. Add user to your database for each group
    // Adjust based on your database ORM/library

    // Example with Prisma:
    for (const group of result.groups) {
      await prisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: group.groupId, // Customer's group ID
          role: 'member',
          joinedAt: new Date()
        }
      });
    }

    // Example with TypeORM:
    // for (const group of result.groups) {
    //   const member = workspaceMemberRepository.create({
    //     userId: user.id,
    //     workspaceId: group.groupId,
    //     role: 'member',
    //     joinedAt: new Date()
    //   });
    //   await workspaceMemberRepository.save(member);
    // }

    // Example with Sequelize:
    // for (const group of result.groups) {
    //   await WorkspaceMember.create({
    //     userId: user.id,
    //     workspaceId: group.groupId,
    //     role: 'member',
    //     joinedAt: new Date()
    //   });
    // }

    // Example with Raw SQL:
    // for (const group of result.groups) {
    //   await db.query(
    //     'INSERT INTO workspace_members (user_id, workspace_id, role, joined_at) VALUES (?, ?, ?, ?)',
    //     [user.id, group.groupId, 'member', new Date()]
    //   );
    // }

    // 4. Return success
    return reply.send(result);
  } catch (error) {
    fastify.log.error(error);
    return reply.code(500).send({ error: 'Failed to accept invitations', code: 'INTERNAL_ERROR' });
  }
});
```

### Step 6: Add CORS Configuration (If Needed)

If your frontend is on a different domain:

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

### Step 7: Verify Authentication Decorator

Ensure your authentication runs BEFORE Vortex routes and populates `request.user`:

```typescript
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { vortexPlugin } from '@teamvortexsoftware/vortex-fastify-5-sdk';
import './plugins/vortex';

const fastify = Fastify();

// Register JWT plugin
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET!
});

// Decorate request
fastify.decorateRequest('user', null);

// Add authentication hook (runs for all routes)
fastify.addHook('onRequest', async (request, reply) => {
  try {
    await request.jwtVerify();
    // request.user is now populated
  } catch (err) {
    // Not authenticated - let authenticateUser handle it
  }
});

// Register Vortex plugin
await fastify.register(vortexPlugin, { prefix: '/api/v1/vortex' });
```

## Build and Validation

### Build Your Application

```bash
# TypeScript projects
npm run build
# or
tsc

# JavaScript projects - no build needed
```

### Test the Integration

Start your server and test each endpoint:

```bash
# Start server
npm start

# Test JWT endpoint
curl -X POST http://localhost:3000/api/v1/vortex/jwt \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Test get invitations
curl -X GET "http://localhost:3000/api/v1/vortex/invitations?targetType=email&targetValue=user@example.com" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Test accept invitations
curl -X POST http://localhost:3000/api/v1/vortex/invitations/accept \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invitationIds": ["invitation-id-1"],
    "target": { "type": "email", "value": "user@example.com" }
  }'
```

### Validation Checklist

- [ ] SDK installed successfully
- [ ] Environment variable `VORTEX_API_KEY` is set
- [ ] `configureVortex()` is called before plugin registration
- [ ] Vortex plugin is registered at the correct prefix
- [ ] JWT endpoint returns valid JWT (POST /api/v1/vortex/jwt)
- [ ] Accept invitations endpoint adds users to database
- [ ] Authentication decorator populates request.user
- [ ] CORS is configured (if frontend on different domain)

## Implementation Report

After completing the integration, provide this summary:

```markdown
## Fastify 5 Integration Complete

### Files Modified/Created
- `src/plugins/vortex.ts` - Vortex configuration with authenticateUser hook
- `src/app.ts` - Registered Vortex plugin at /api/v1/vortex
- `.env` - Added VORTEX_API_KEY environment variable

### Endpoints Registered
- POST /api/v1/vortex/jwt - Generate JWT for authenticated user
- GET /api/v1/vortex/invitations - Get invitations by target
- GET /api/v1/vortex/invitations/:id - Get invitation by ID
- POST /api/v1/vortex/invitations/accept - Accept invitations (custom logic)
- DELETE /api/v1/vortex/invitations/:id - Revoke invitation
- POST /api/v1/vortex/invitations/:id/reinvite - Resend invitation
- GET /api/v1/vortex/invitations/by-group/:type/:id - Get invitations for group
- DELETE /api/v1/vortex/invitations/by-group/:type/:id - Delete invitations for group

### Database Integration
- ORM: [Prisma/TypeORM/Sequelize/etc.]
- Accept invitations adds users to: [table name]
- Group association field: [workspaceId/teamId/etc.]

### Authentication
- Pattern: [JWT/Session/Custom]
- User extraction: request.user
- Admin scope detection: user.isAdmin
- Plugin: [@fastify/jwt / @fastify/session / custom]

### Next Steps for Frontend
The backend now exposes these endpoints for the frontend to consume:
1. Call POST /api/v1/vortex/jwt to get JWT for Vortex widget
2. Pass JWT to Vortex widget component
3. Widget will handle invitation sending
4. Accept invitations via POST /api/v1/vortex/invitations/accept
```

## Common Issues and Solutions

### Issue: "Cannot find module '@teamvortexsoftware/vortex-fastify-5-sdk'"
**Solution**: Ensure the SDK is installed and TypeScript can resolve it:
```bash
npm install @teamvortexsoftware/vortex-fastify-5-sdk
# If using TypeScript, restart your editor/TS server
```

### Issue: "configureVortex is not a function"
**Solution**: Make sure you're importing from the correct package and that configuration is called before plugin registration:
```typescript
import { configureVortex } from '@teamvortexsoftware/vortex-fastify-5-sdk';
```

### Issue: "request.user is undefined in authenticateUser"
**Solution**: Ensure your authentication hook runs BEFORE Vortex plugin and populates `request.user`:
```typescript
fastify.addHook('onRequest', async (request, reply) => {
  await request.jwtVerify(); // Populates request.user
});

await fastify.register(vortexPlugin, { prefix: '/api/v1/vortex' });
```

### Issue: "Cannot read property 'userId' of null"
**Solution**: `authenticateUser` returned null. Ensure the user is authenticated before accessing Vortex endpoints.

### Issue: "Plugin registration fails"
**Solution**: Ensure you're using `await fastify.register()` with async/await:
```typescript
await fastify.register(vortexPlugin, { prefix: '/api/v1/vortex' });
```

### Issue: "CORS error when calling from frontend"
**Solution**: Add CORS plugin:
```bash
npm install @fastify/cors
```
```typescript
import cors from '@fastify/cors';
await fastify.register(cors, {
  origin: process.env.FRONTEND_URL,
  credentials: true
});
```

### Issue: "Accept invitations succeeds but user not added to database"
**Solution**: You must implement the accept invitations endpoint with custom database logic (see Step 5), ensuring you do not register a conflicting route for the same method and URL as any existing plugin route.

### Issue: "Route already exists"
**Solution**: Fastify does not allow overriding an existing route with the same method and URL; attempting to register it twice will throw an error. Avoid registering conflicting routes (for example, by disabling or not registering the plugin’s route when providing your own, or by using Fastify features like `onRoute` to customize behavior).

## Best Practices

### 1. Environment Variables
Store sensitive configuration in `.env`:
```bash
VORTEX_API_KEY=VRTX.your-key.secret
JWT_SECRET=your-jwt-secret
NODE_ENV=production
FRONTEND_URL=https://your-app.com
```

### 2. Error Handling
Use Fastify's error handler:
```typescript
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(error.statusCode || 500).send({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message,
    code: error.code || 'INTERNAL_ERROR'
  });
});
```

### 3. Admin Scopes
Only grant `autojoin` scope to administrators:
```typescript
configureVortex({
  authenticateUser: async (request, reply) => {
    const user = request.user;
    return {
      userId: user.id,
      userEmail: user.email,
      adminScopes: user.role === 'admin' ? ['autojoin'] : undefined
    };
  }
});
```

### 4. Database Transactions
Wrap database operations in transactions:
```typescript
// Prisma example
await prisma.$transaction(async (tx) => {
  for (const group of result.groups) {
    await tx.workspaceMember.create({
      data: { userId: user.id, workspaceId: group.groupId, role: 'member' }
    });
  }
});
```

### 5. Logging
Fastify has built-in logging:
```typescript
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

// Log Vortex operations
fastify.addHook('onRequest', async (request, reply) => {
  if (request.url.startsWith('/api/v1/vortex')) {
    fastify.log.info(`[Vortex] ${request.method} ${request.url}`);
  }
});
```

### 6. Rate Limiting
Add rate limiting with @fastify/rate-limit:
```bash
npm install @fastify/rate-limit
```

```typescript
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '15 minutes'
});
```

### 7. Plugin Encapsulation
Use Fastify's plugin encapsulation for better organization:
```typescript
// src/plugins/vortex.ts
import fp from 'fastify-plugin';
import { vortexPlugin, configureVortex } from '@teamvortexsoftware/vortex-fastify-5-sdk';

export default fp(async function (fastify, opts) {
  configureVortex({
    apiKey: process.env.VORTEX_API_KEY!,
    authenticateUser: async (request, reply) => {
      // Your auth logic
    }
  });

  await fastify.register(vortexPlugin, { prefix: '/api/v1/vortex' });
});

// src/app.ts
import vortex from './plugins/vortex';
await fastify.register(vortex);
```

## Fastify-Specific Advantages

### Performance Benefits
- **Native Plugin System**: Clean encapsulation and initialization
- **Automatic JSON Parsing**: No need for body-parser middleware (unlike Express)
- **High-Performance Router**: Optimized request handling
- **Schema Validation**: Optional JSON schema validation for requests/responses
- **Request Lifecycle**: Powerful hooks system for cross-cutting concerns

### Architecture Comparison
```typescript
// Express Pattern
app.use('/api/v1/vortex', createVortexRouter());

// Fastify Pattern (cleaner, more idiomatic)
await fastify.register(vortexPlugin, { prefix: '/api/v1/vortex' });
```

## Additional Resources

- [Fastify 5 SDK Documentation](https://docs.vortexsoftware.com/sdks/fastify-5)
- [Node.js SDK Documentation](https://docs.vortexsoftware.com/sdks/node-22)
- [Fastify Documentation](https://www.fastify.io/)
- [Vortex API Reference](https://api.vortexsoftware.com/api)
- [Integration Examples](https://github.com/teamvortexsoftware/vortex-examples)

## Support

For questions or issues:
- GitHub Issues: https://github.com/teamvortexsoftware/vortex-fastify-5-sdk/issues
- Email: support@vortexsoftware.com
- Documentation: https://docs.vortexsoftware.com
