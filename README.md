# Vortex Fastify 5 SDK

Drop-in Fastify integration for Vortex invitations and JWT functionality. Get up and running in under 2 minutes!

## Features

### Invitation Delivery Types

Vortex supports multiple delivery methods for invitations:

- **`email`** - Email invitations sent by Vortex (includes reminders and nudges)
- **`phone`** - Phone invitations sent by the user/customer
- **`share`** - Shareable invitation links for social sharing
- **`internal`** - Internal invitations managed entirely by your application
  - No email/SMS communication triggered by Vortex
  - Target value can be any customer-defined identifier (UUID, string, number)
  - Useful for in-app invitation flows where you handle the delivery
  - Example use case: In-app notifications, dashboard invites, etc.

## 🚀 Quick Start

```bash
npm install @teamvortexsoftware/vortex-fastify-5-sdk @teamvortexsoftware/vortex-react-provider
```

### Easy Integration (Recommended)

```typescript
import Fastify from 'fastify';
import {
  vortexPlugin,
  configureVortex,
  createAllowAllAccessControl,
} from '@teamvortexsoftware/vortex-fastify-5-sdk';

const fastify = Fastify();

// Configure Vortex with new simplified format (recommended)
configureVortex({
  apiKey: process.env.VORTEX_API_KEY!,

  // Required: How to authenticate users (new simplified format)
  authenticateUser: async (request, reply) => {
    const user = await getCurrentUser(request); // Your auth logic
    return user
      ? {
          userId: user.id,
          userEmail: user.email,
          userName: user.userName,           // Optional: user's display name
          userAvatarUrl: user.userAvatarUrl, // Optional: user's avatar URL
          adminScopes: user.isAdmin ? ['autojoin'] : [], // Optional: grant admin capabilities
        }
      : null;
  },

  // Simple: Allow all operations (customize for production)
  ...createAllowAllAccessControl(),
});

// Add Vortex routes as a plugin
await fastify.register(vortexPlugin, { prefix: '/api/vortex' });

await fastify.listen({ port: 3000 });
```

That's it! Your Fastify app now has all Vortex API endpoints.

## ⚡ What You Get

- **JWT Authentication**: Secure user authentication with Vortex
- **Invitation Management**: Create, accept, and manage invitations
- **Full Node.js SDK Access**: All `@teamvortexsoftware/vortex-node-22-sdk` functionality
- **TypeScript Support**: Fully typed with IntelliSense
- **React Integration**: Works seamlessly with `@teamvortexsoftware/vortex-react-provider`
- **Fastify Plugin Architecture**: Native Fastify plugin for optimal performance

## 📚 API Endpoints

Your app automatically gets these API routes:

| Endpoint                                     | Method     | Description                             |
| -------------------------------------------- | ---------- | --------------------------------------- |
| `/api/vortex/jwt`                            | POST       | Generate JWT for authenticated user     |
| `/api/vortex/invitations`                    | GET        | Get invitations by target (email/phone) |
| `/api/vortex/invitations/accept`             | POST       | Accept multiple invitations             |
| `/api/vortex/invitations/:id`                | GET/DELETE | Get or delete specific invitation       |
| `/api/vortex/invitations/:id/reinvite`       | POST       | Resend invitation                       |
| `/api/vortex/invitation-actions/sync-internal-invitation` | POST       | Sync internal invitation action         |
| `/api/vortex/invitations/by-group/:type/:id` | GET/DELETE | Group-based operations                  |

## 🛠️ Setup Options

### Option 1: Plugin Registration (Easiest)

```typescript
import Fastify from 'fastify';
import { vortexPlugin } from '@teamvortexsoftware/vortex-fastify-5-sdk';

const fastify = Fastify();

// Register as plugin with custom prefix
await fastify.register(vortexPlugin, { prefix: '/api/vortex' });
```

### Option 2: Manual Route Registration

```typescript
import Fastify from 'fastify';
import { registerVortexRoutes } from '@teamvortexsoftware/vortex-fastify-5-sdk';

const fastify = Fastify();

// Register with custom base path
await registerVortexRoutes(fastify, '/api/v1/vortex');
```

### Option 3: Individual Route Handlers

```typescript
import Fastify from 'fastify';
import { createVortexRoutes } from '@teamvortexsoftware/vortex-fastify-5-sdk';

const fastify = Fastify();
const routes = createVortexRoutes();

// Register individual routes with full control
fastify.post('/api/vortex/jwt', routes.jwt);
fastify.get('/api/vortex/invitations', routes.invitations);
fastify.get('/api/vortex/invitations/:invitationId', routes.invitation.get);
fastify.delete('/api/vortex/invitations/:invitationId', routes.invitation.delete);
// ... etc
```

## ⚙️ Configuration

### 1. Environment Variables

Add to your `.env`:

```bash
VORTEX_API_KEY=your_api_key_here
```

### 2. Basic Configuration

#### New Simplified Format (Recommended)

```typescript
import {
  configureVortex,
  createAllowAllAccessControl,
} from '@teamvortexsoftware/vortex-fastify-5-sdk';

configureVortex({
  apiKey: process.env.VORTEX_API_KEY!,

  // Required: How to authenticate users (new simplified format)
  authenticateUser: async (request, reply) => {
    const user = await getCurrentUser(request); // Your auth logic
    return user
      ? {
          userId: user.id,
          userEmail: user.email,
          userName: user.userName,           // Optional: user's display name
          userAvatarUrl: user.userAvatarUrl, // Optional: user's avatar URL
          adminScopes: user.isAdmin ? ['autojoin'] : [], // Optional: grant admin capabilities
        }
      : null;
  },

  // Simple: Allow all operations (customize for production)
  ...createAllowAllAccessControl(),
});
```

#### Legacy Format (Deprecated)

The legacy format is still supported for backward compatibility:

```typescript
configureVortex({
  apiKey: process.env.VORTEX_API_KEY!,

  authenticateUser: async (request, reply) => {
    const user = await getCurrentUser(request);
    return user
      ? {
          userId: user.id,
          identifiers: [{ type: 'email', value: user.email }],
          groups: user.groups, // [{ type: 'team', groupId: '123', name: 'My Team' }]
          role: user.role, // Optional
        }
      : null;
  },

  ...createAllowAllAccessControl(),
});
```

### 3. Lazy Configuration (Advanced)

Use this if your configuration depends on database connections or other async setup:

```typescript
import { configureVortexLazy } from '@teamvortexsoftware/vortex-fastify-5-sdk';

configureVortexLazy(async () => ({
  apiKey: process.env.VORTEX_API_KEY!,

  authenticateUser: async (request, reply) => {
    // This can make database calls, etc.
    const user = await getUserFromDatabase(request);
    return user
      ? {
          userId: user.id,
          userEmail: user.email,
          userName: user.userName,           // Optional: user's display name
          userAvatarUrl: user.userAvatarUrl, // Optional: user's avatar URL
          adminScopes: (await checkUserAdminStatus(user.id)) ? ['autojoin'] : [],
        }
      : null;
  },

  ...createAllowAllAccessControl(),
}));
```

## 🔧 Production Security

For production apps, replace `createAllowAllAccessControl()` with proper authorization:

```typescript
configureVortex({
  apiKey: process.env.VORTEX_API_KEY!,
  authenticateUser: async (request, reply) => {
    /* your auth */
  },

  // Custom access control
  canDeleteInvitation: async (request, reply, user, resource) => {
    return user?.role === 'admin'; // Only admins can delete
  },

  canAccessInvitationsByGroup: async (request, reply, user, resource) => {
    return user?.groups.some(
      (g) => g.type === resource?.groupType && g.groupId === resource?.groupId
    );
  },

  // ... other access control hooks
});
```

## 🎯 Frontend Integration

### React: Get User's JWT

```typescript
import { useVortexJWT } from '@teamvortexsoftware/vortex-react-provider';

function MyComponent() {
  const { jwt, isLoading } = useVortexJWT();

  if (isLoading) return <div>Loading...</div>;
  if (!jwt) return <div>Not authenticated</div>;

  return <div>Authenticated! JWT: {jwt.substring(0, 20)}...</div>;
}
```

### React: Setup Provider

```typescript
// In your app root
import { VortexProvider } from '@teamvortexsoftware/vortex-react-provider';

function App() {
  return (
    <VortexProvider config={{ apiBaseUrl: '/api/vortex' }}>
      {/* Your app */}
    </VortexProvider>
  );
}
```

### Manage Invitations

```typescript
// Get invitations
const response = await fetch('/api/vortex/invitations/by-group/team/my-team-id');
const { invitations } = await response.json();

// Delete invitation
await fetch(`/api/vortex/invitations/${invitationId}`, { method: 'DELETE' });
```

## 🚀 Fastify-Specific Features

### Plugin Architecture

The Fastify SDK leverages Fastify's native plugin system for optimal performance and encapsulation:

```typescript
// Clean plugin registration
await fastify.register(vortexPlugin, {
  prefix: '/api/vortex',
});

// Or with encapsulation
await fastify.register(async function (fastify) {
  await fastify.register(vortexPlugin);

  // Add custom routes in the same context
  fastify.get('/custom', async () => ({ custom: 'route' }));
});
```

### Performance Benefits

- **Native Fastify Integration**: Uses FastifyRequest and FastifyReply directly
- **Automatic JSON Parsing**: Body parsing handled by Fastify automatically
- **Optimized Routing**: Leverages Fastify's high-performance router
- **Plugin Encapsulation**: Clean separation of concerns

## 🔄 Comparison with Other SDKs

| Feature                  | Fastify SDK                      | Express SDK                     | Next.js SDK          |
| ------------------------ | -------------------------------- | ------------------------------- | -------------------- |
| **Setup**                | `fastify.register(vortexPlugin)` | `app.use(createVortexRouter())` | Multiple route files |
| **Architecture**         | Plugin-based                     | Middleware-based                | File-based routing   |
| **Performance**          | High (Fastify native)            | Good                            | Good                 |
| **Config**               | Same API                         | Same API                        | Same API             |
| **Access Control**       | Same API                         | Same API                        | Same API             |
| **Frontend Integration** | Same React Provider              | Same React Provider             | Same React Provider  |

## 📦 Direct SDK Usage

All Node.js SDK functionality is available:

```typescript
import { Vortex } from '@teamvortexsoftware/vortex-fastify-5-sdk';

// All Node.js SDK functionality is available
const vortex = new Vortex(process.env.VORTEX_API_KEY!);
const invitations = await vortex.getInvitationsByGroup('team', 'team-123');
```

## 🛠️ Advanced: Custom Handlers

Need custom logic? Use individual handlers:

```typescript
import Fastify from 'fastify';
import { handleGetInvitation, createErrorResponse } from '@teamvortexsoftware/vortex-fastify-5-sdk';

const fastify = Fastify();

fastify.get('/api/custom-invitation/:invitationId', async (request, reply) => {
  // Add custom validation
  const user = await validateUser(request);
  if (!user.isAdmin) {
    return createErrorResponse(reply, 'Admin required', 403);
  }

  // Use SDK handler
  return handleGetInvitation(request, reply);
});
```

## 📋 Requirements

- **Fastify**: 5.0.0 or higher
- **Node.js**: 18.0.0 or higher
- **TypeScript**: 5.0.0 or higher (for TypeScript projects)

## 🆘 Troubleshooting

### Common Issues

**Configuration errors**

- Ensure you're calling `configureVortex()` or `configureVortexLazy()` before registering the plugin
- Check that your `.env` has `VORTEX_API_KEY`

**Plugin registration issues**

- Make sure you're using `await fastify.register(vortexPlugin)`
- Verify the prefix doesn't conflict with other routes

**Authentication Issues**

- Verify your `authenticateUser` function returns the correct format
- Check that your authentication middleware is working
- Make sure JWT requests include authentication cookies/headers

**TypeScript Errors**

- All types are exported from the main package
- Resource parameters are fully typed for access control hooks

## 📦 What's Included

This SDK re-exports everything from `@teamvortexsoftware/vortex-node-22-sdk`, so you get:

- ✅ `Vortex` class for direct API access
- ✅ All invitation management methods
- ✅ JWT generation utilities
- ✅ TypeScript definitions
- ✅ Fastify optimized route handlers
- ✅ Native plugin architecture

## 🔗 Links

- [Node.js SDK Documentation](../vortex-node-22-sdk/README.md)
- [Express SDK Documentation](../vortex-express-5-sdk/README.md)
- [Next.js SDK Documentation](../vortex-nextjs-15-sdk/README.md)
- [React Provider Documentation](../vortex-react-provider/README.md)

---

**Need help?** Open an issue or check the Express/Next.js SDK examples for reference patterns.
