import Database from 'better-sqlite3';
import fs from 'fs/promises';
import { Kysely, MysqlDialect, PostgresDialect, sql } from 'kysely';
import { MongoClient } from 'mongodb';
import { createPool } from 'mysql2/promise';
import { Pool } from 'pg';
import { afterAll } from 'vitest';
import { mongodbAdapter } from '../adapters/mongodb-adapter';
import { unblocked } from '../ai';
import { createUnblockedClient } from '../client';
import { generateRandomString } from '../crypto/random';
// No session type needed - external auth handles sessions
import { getMigrations } from '../db/get-migration';
// No cookie utilities needed - external auth handles cookies
import { getAdapter } from '../db/utils';
import type { ClientOptions, UnblockedOptions, User } from '../types';
import { getBaseURL } from '../utils/url';
// AI SDK doesn't use bearer auth - external auth handles tokens

/**
 * Configuration for testing unauthenticated requests.
 * Use this when you want to test scenarios where no user is authenticated.
 *
 * @example
 * const { ai } = await getTestInstance({}, UNAUTHENTICATED);
 */
export const UNAUTHENTICATED = { user: null } as const;

export async function getTestInstance<
  O extends Partial<UnblockedOptions>,
  C extends ClientOptions,
>(
  options?: O,
  config?: {
    clientOptions?: C;
    port?: number;
    disableTestUser?: boolean;
    testUser?: Partial<User>;
    testWith?: 'sqlite' | 'postgres' | 'mongodb' | 'mysql';
    /**
     * Configure test user behavior:
     * - User object: Use this user for all requests
     * - null: Return null from getUser (simulate unauthenticated requests)
     * - undefined: Use default test user behavior
     */
    user?: User | null;
  }
) {
  const testWith = config?.testWith || 'sqlite';
  /**
   * create db folder if not exists
   */
  await fs.mkdir('.db', { recursive: true });
  const randomStr = generateRandomString(4, 'a-z');
  const dbName = `./.db/test-${randomStr}.db`;

  const postgres = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString:
          'postgres://user:password@localhost:5432/unblocked_test',
      }),
    }),
  });

  const mysql = new Kysely({
    dialect: new MysqlDialect(
      createPool('mysql://user:password@localhost:3306/unblocked_test')
    ),
  });

  async function mongodbClient() {
    const dbClient = async (connectionString: string, dbName: string) => {
      const client = new MongoClient(connectionString);
      await client.connect();
      const db = client.db(dbName);
      return db;
    };
    const db = await dbClient('mongodb://127.0.0.1:27017', 'unblocked-test');
    return db;
  }

  // Build user configuration based on test config
  const userConfig = (() => {
    if (config?.user === null) {
      // Explicitly return null for unauthenticated testing
      return {
        getUser: async () => null,
      };
    }
    if (config?.user) {
      // Use provided user object
      return {
        getUser: async () => config.user || null,
      };
    }
    // Default test user behavior
    return {
      getUser: (request: Request) => {
        // Handle case where request is undefined - return valid user for most tests
        if (!(request && request.headers)) {
          return {
            id: 'test-user-id',
            email: 'test@test.com',
            name: 'Test User',
          };
        }

        // Check for authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || authHeader === '' || authHeader === 'Bearer ') {
          return null;
        }

        // Simple test user function for authenticated requests
        return {
          id: 'test-user-id',
          email: 'test@test.com',
          name: 'Test User',
        };
      },
    };
  })();

  const opts = {
    secret: 'unblocked.secret',
    database:
      testWith === 'postgres'
        ? { db: postgres, type: 'postgres' }
        : testWith === 'mongodb'
          ? mongodbAdapter(await mongodbClient())
          : testWith === 'mysql'
            ? { db: mysql, type: 'mysql' }
            : new Database(dbName),
    user: userConfig,
    advanced: {
      // Advanced options if needed
    },
  } satisfies UnblockedOptions;

  const ai = unblocked({
    baseURL: 'http://localhost:' + (config?.port || 3000),
    ...opts,
    ...options,
    advanced: {
      ...options?.advanced,
    },
    plugins: [...(options?.plugins || [])], // AI SDK uses external auth, no bearer plugin needed
  });

  // Test user for AI operations
  const testUser = {
    id: 'test-user-id',
    email: 'test@test.com',
    name: 'Test User',
    ...config?.testUser,
  };

  if (testWith !== 'mongodb') {
    const { runMigrations } = await getMigrations({
      ...ai.options,
      database: opts.database,
    });
    await runMigrations();
  }

  // No need to create test user in database - external auth provides user at runtime

  afterAll(async () => {
    if (testWith === 'mongodb') {
      const db = await mongodbClient();
      await db.dropDatabase();
      return;
    }
    if (testWith === 'postgres') {
      await sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.execute(
        postgres
      );
      await postgres.destroy();
      return;
    }

    if (testWith === 'mysql') {
      await sql`SET FOREIGN_KEY_CHECKS = 0;`.execute(mysql);
      const tables = await mysql.introspection.getTables();
      for (const table of tables) {
        // @ts-expect-error
        await mysql.deleteFrom(table.name).execute();
      }
      await sql`SET FOREIGN_KEY_CHECKS = 1;`.execute(mysql);
      return;
    }

    await fs.unlink(dbName);
  });

  // AI SDK-specific test utilities

  /**
   * Create a test chat with optional messages for AI conversation testing
   */
  async function createTestChat(
    options: {
      title?: string;
      visibility?: 'public' | 'private';
      withMessages?: Array<{
        content: string;
        role: 'user' | 'assistant';
        parts?: Array<{
          type: 'text' | 'image' | 'file';
          content: string;
          metadata?: Record<string, any>;
        }>;
      }>;
    } = {}
  ) {
    const chatResponse = await ai.api.createChat({
      body: {
        title: options.title || 'Test Chat',
        visibility: options.visibility || 'private',
      },
    });

    const chat = chatResponse.chat;
    const messages = [];

    if (options.withMessages) {
      for (const msg of options.withMessages) {
        const messageResponse = await ai.api.sendMessage({
          params: { chatId: chat.id },
          body: {
            content: msg.content,
            role: msg.role,
            parts: msg.parts,
          },
        });
        messages.push(messageResponse.message);
      }
    }

    return { chat, messages };
  }

  /**
   * Create a complete chat conversation flow for testing
   */
  async function createChatFlow(
    messages: Array<{
      content: string;
      role: 'user' | 'assistant';
      vote?: 'up' | 'down';
    }>
  ) {
    const { chat, messages: createdMessages } = await createTestChat({
      withMessages: messages.map((m) => ({ content: m.content, role: m.role })),
    });

    // Apply votes if specified
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].vote) {
        await ai.api.voteMessage({
          body: {
            chatId: chat.id,
            messageId: createdMessages[i].id,
            type: messages[i].vote!,
          },
        });
      }
    }

    return { chat, messages: createdMessages };
  }

  const customFetchImpl = async (
    url: string | URL | Request,
    init?: RequestInit
  ) => {
    // Add default authorization header for AI SDK testing
    const headers = new Headers(init?.headers);
    if (!headers.has('authorization')) {
      headers.set('authorization', 'Bearer test-token');
    }

    const requestInit = {
      ...init,
      headers,
    };

    return ai.handler(new Request(url, requestInit));
  };

  const client = createUnblockedClient({
    ...(config?.clientOptions as C extends undefined ? {} : C),
    baseURL: getBaseURL(
      options?.baseURL || 'http://localhost:' + (config?.port || 3000),
      options?.basePath || '/api/unblocked'
    ),
    fetchOptions: {
      customFetchImpl,
    },
  });
  return {
    ai,
    client,
    testUser,
    customFetchImpl,
    db: await getAdapter(ai.options),
    // AI SDK-specific test utilities
    createTestChat,
    createChatFlow,
  };
}
