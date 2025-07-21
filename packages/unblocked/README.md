# Unblocked AI SDK

<p align="center">
  <h2 align="center">
    The most comprehensive AI SDK for TypeScript
  </h2>

  <p align="center">
    Drop-in AI solution with great defaults, database integration, and type safety
    <br />
    <a href="https://github.com/unblocked/unblocked"><strong>Learn more »</strong></a>
    <br />
    <br />
    <a href="https://github.com/unblocked/unblocked">GitHub</a>
    ·
    <a href="https://github.com/unblocked/unblocked/issues">Issues</a>
    ·
    <a href="https://github.com/unblocked/unblocked/discussions">Discussions</a>
  </p>
</p>

## Features

- 🚀 **Drop-in Solution** - Integrate AI features in minutes with a single catch-all route
- 🎯 **Great Defaults** - Opinionated choices that work out of the box
- 🔐 **External Auth** - Works with your existing authentication system
- 💾 **Database Handled** - Built-in conversation storage with multiple adapters
- 🌊 **Real-time Streaming** - Production-ready AI streaming with tool execution
- 🛠️ **Multi-Provider** - OpenAI, Anthropic, Google, Mistral support built-in
- 🔧 **Tool Execution** - Function calling with hooks and UI components
- 📝 **Type Safe** - Full TypeScript support with AI SDK DTOs

## Getting Started

```bash
npm install unblocked
# or
pnpm add unblocked
# or
yarn add unblocked
```

## Quick Start

### 1. Create the AI instance

```typescript
import { unblocked } from "unblocked";
import { createProviders } from "unblocked/providers";
import { db } from "./db"; // Your database instance

export const ai = unblocked({
  database: db,
  user: {
    getUser: async (request) => {
      // Your authentication logic
      const session = await getSession(request);
      return session?.user || null;
    },
  },
  // Built-in AI providers
  providers: createProviders({
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  }),
  // Chat configuration
  chat: {
    model: "gpt-4o-mini", // Fast and cost-effective
    systemPrompt: "You are a helpful AI assistant.",
    temperature: 0.7,
    streaming: {
      enabled: true,
    },
  },
});
```

### 2. Add API Route (Next.js Example)

```typescript
// app/api/ai/[...unblocked]/route.ts
import { ai } from "@/lib/unblocked";
import { toNextJsHandler } from "unblocked/next-js";

export const { GET, POST } = toNextJsHandler(ai);
```

That's it! All AI endpoints are now available at `/api/ai/*`.

### 3. Use Streaming Chat

```typescript
import { createUnblockedClient } from "unblocked/client";

const client = createUnblockedClient({
  baseURL: "http://localhost:3000",
  basePath: "/api/ai",
});

// Create a chat
const chat = await client.createChat({
  body: {
    title: "New Chat",
    visibility: "private",
  },
});

// Stream AI responses
const response = await client.chatStream({
  params: { id: chat.id },
  body: {
    message: {
      id: "msg_1",
      parts: [{ type: "text", content: "Hello!" }],
    },
    selectedChatModel: "gpt-4o-mini",
    selectedVisibilityType: "private",
  },
});

// Handle streaming response
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  console.log(chunk); // Process AI response chunks
}
```

## Database Adapters

Unblocked supports multiple database adapters:

```typescript
// Drizzle
import { drizzleAdapter } from "unblocked/adapters/drizzle";
const adapter = drizzleAdapter(db);

// Prisma
import { prismaAdapter } from "unblocked/adapters/prisma";
const adapter = prismaAdapter(prisma);

// Kysely
import { kyselyAdapter } from "unblocked/adapters/kysely";
const adapter = kyselyAdapter(db);

// MongoDB
import { mongodbAdapter } from "unblocked/adapters/mongodb";
const adapter = mongodbAdapter(db);
```

## AI Provider Integration

```typescript
import { unblocked } from "unblocked";
import { createProviders } from "unblocked/providers";
import { tool } from "ai";

const ai = unblocked({
  database: db,
  user: { getUser },

  // Multiple AI providers
  providers: createProviders({
    openai: { apiKey: process.env.OPENAI_API_KEY },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    google: { apiKey: process.env.GOOGLE_API_KEY },
    mistral: { apiKey: process.env.MISTRAL_API_KEY },
  }),

  // Feature-specific configuration
  chat: {
    model: "gpt-4o-mini",
    systemPrompt: "You are a helpful AI assistant.",
    temperature: 0.7,
    streaming: { enabled: true },
    rateLimiting: { enabled: true, messagesPerDay: 100 },
  },

  // Tool execution with hooks
  tools: {
    registry: {
      weather: tool({
        description: "Get weather information",
        parameters: z.object({ location: z.string() }),
        execute: async ({ location }) => {
          return { temperature: 72, condition: "sunny" };
        },
      }),
    },
    config: {
      weather: {
        hooks: {
          beforeCall: async (args, user) => {
            console.log(`${user.name} checking weather for ${args.location}`);
            return args;
          },
        },
      },
    },
  },
});
```

## Advanced Features

### Hooks

```typescript
const ai = unblocked({
  hooks: {
    chat: {
      beforeCreate: async ({ user, title, visibility }) => {
        // Validate or modify before chat creation
      },
      afterMessage: async ({ message, user }) => {
        // Analytics, logging, etc.
      },
    },
    generation: {
      onFinish: async (result) => {
        console.log("Tokens used:", result.usage?.totalTokens);
      },
    },
  },
});
```

### Plugins

```typescript
import { quotaPlugin } from "unblocked/plugins";

const ai = unblocked({
  plugins: [
    quotaPlugin({
      defaults: {
        messages: { perDay: 100 },
        tokens: { perMonth: 100000 },
      },
    }),
  ],
});
```

## API Endpoints

Unblocked provides 35+ production-ready endpoints:

### **Chat & Streaming**

- `POST /chat` - Create new chat conversation
- `POST /chat/:id/stream` - **Real-time AI streaming with tool execution**
- `GET /chat/:id` - Get chat by ID
- `GET /history` - Get chat history with pagination
- `DELETE /chat` - Delete chat conversation

### **Messages & Voting**

- `POST /chat/:id/message` - Send message to chat
- `GET /chat/:id/messages` - Get chat messages
- `POST /vote` - Vote on messages (upvote/downvote)
- `GET /votes` - Get votes for chat or message
- `DELETE /vote` - Remove vote

### **Documents & AI Generation**

- `POST /document` - Create AI-generated document
- `GET /document/:id` - Get document by ID
- `PUT /document/:id` - Update document
- `POST /suggestions` - Generate document suggestions
- `GET /suggestions` - Get document suggestions

### **Models & Providers**

- `GET /models` - Get available AI models with capabilities
- `GET /models/:id` - Get model details and pricing

### **Files & Attachments**

- `POST /file` - Upload file attachment
- `GET /file/:id` - Download file
- `DELETE /file/:id` - Delete file

All endpoints include:

- ✅ **Full type safety** with TypeScript
- ✅ **User authentication** and access control
- ✅ **Rate limiting** and quota management
- ✅ **Error handling** with specific error codes
- ✅ **Streaming support** where applicable

## Framework Support

- ✅ Next.js (App & Pages Router)
- ✅ SvelteKit
- ✅ Solid Start
- ✅ Node.js
- 🚧 Remix (coming soon)
- 🚧 Nuxt (coming soon)

## Why Unblocked?

### **vs Vercel AI SDK**

- ✅ Built-in database & conversation management
- ✅ 35+ production-ready endpoints
- ✅ External auth integration
- ✅ Rate limiting & quota management
- ✅ UI components (coming soon)

### **vs Langchain**

- ✅ Simpler, more opinionated API
- ✅ Better TypeScript support
- ✅ Faster setup (3 lines vs 100s)
- ✅ Production-ready out of the box

### **vs Direct OpenAI**

- ✅ Multi-provider support (OpenAI, Anthropic, Google, Mistral)
- ✅ Full-stack solution with database
- ✅ Streaming & tool execution built-in
- ✅ Rate limiting & user management

### **vs Custom Solution**

- ✅ Save weeks of development time
- ✅ Battle-tested architecture
- ✅ Comprehensive feature set
- ✅ Continuous updates & maintenance

## License

MIT

## Acknowledgements

We would like to thank the following projects that have inspired and contributed to Unblocked:

- **[Vercel AI SDK](https://github.com/vercel/ai)** - We extensively use the Vercel AI SDK as our foundation for AI integrations, streaming capabilities, and provider abstractions. Their excellent work on standardizing AI interactions has been invaluable.

- **[Better Auth](https://github.com/unblocked/unblocked)** - We drew architectural inspiration from Better Auth for our configuration setup, client/server implementations, and framework/database agnostic approach. Their excellent patterns for building developer-friendly SDKs served as a benchmark for our project structure.
