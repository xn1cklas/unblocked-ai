import merge from 'deepmerge';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unblocked } from '../../../ai';
import { getMigrations } from '../../../db/get-migration';
import type { UnblockedOptions } from '../../../types';
import { runAdapterTest, runNumberIdAdapterTest } from '../../test';
import { drizzleAdapter } from '..';
import * as schema from './schema';

const TEST_DB_URL = 'postgres://user:password@localhost:5432/better_auth';

const createTestPool = () => new Pool({ connectionString: TEST_DB_URL });

const createKyselyInstance = (pool: Pool) =>
  new Kysely({
    dialect: new PostgresDialect({ pool }),
  });

const cleanupDatabase = async (postgres: Kysely<any>, shouldDestroy = true) => {
  await sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.execute(
    postgres
  );
  if (shouldDestroy) {
    await postgres.destroy();
  }
};

const createTestOptions = (pg: Pool, useNumberId = false) =>
  ({
    database: {
      type: 'postgres' as const,
      db: createKyselyInstance(pg),
    },
    user: {
      getUser: () => ({
        id: 'test-user-id',
        email: 'test@test.com',
        name: 'Test User',
      }),
    },
    advanced: {
      database: {
        useNumberId,
      },
    },
  }) satisfies UnblockedOptions;

describe('Drizzle Adapter Tests', async () => {
  let pg: Pool;
  let postgres: Kysely<any>;
  pg = createTestPool();
  postgres = createKyselyInstance(pg);
  const opts = createTestOptions(pg);
  await cleanupDatabase(postgres, false);
  const { runMigrations } = await getMigrations(opts);
  await runMigrations();

  afterAll(async () => {
    await cleanupDatabase(postgres);
  });
  const db = drizzle(pg);
  const adapter = drizzleAdapter(db, { provider: 'pg', schema });

  await runAdapterTest({
    getAdapter: async (
      customOptions: Omit<UnblockedOptions, 'database'> = {} as any
    ) => {
      return adapter({
        ...customOptions,
        database: opts.database,
        user: customOptions.user || opts.user,
        advanced: customOptions.advanced || opts.advanced,
      } as UnblockedOptions);
    },
  });
});

describe('Drizzle Adapter Authentication Flow Tests', async () => {
  const pg = createTestPool();
  let postgres: Kysely<any>;
  const opts = createTestOptions(pg);
  const testUser = {
    email: 'test-email@email.com',
    password: 'password',
    name: 'Test Name',
  };
  beforeAll(async () => {
    postgres = createKyselyInstance(pg);

    const { runMigrations } = await getMigrations(opts);
    await runMigrations();
  });

  // Auth-specific tests removed - Drizzle adapter is tested via runAdapterTest

  afterAll(async () => {
    await cleanupDatabase(postgres);
  });
});

describe('ai-operations (PostgreSQL)', async () => {
  const { getTestInstance } = await import('../../../test-utils/test-instance');
  const pg = createTestPool();
  const db = drizzle(pg);
  const adapter = drizzleAdapter(db, { provider: 'pg', schema });

  const { ai, createTestChat, createChatFlow } = await getTestInstance(
    {
      database: adapter,
    },
    {
      testWith: 'postgres',
    }
  );

  it('should create a chat', async () => {
    const response = await ai.api.createChat({
      body: {
        title: 'Test Chat',
        visibility: 'private',
      },
    });

    expect(response.chat).toBeDefined();
    expect(response.chat.title).toBe('Test Chat');
    expect(response.chat.visibility).toBe('private');
    expect(response.chat.userId).toBe('test-user-id');
  });

  it('should send a message to a chat', async () => {
    const { chat } = await createTestChat({
      title: 'Message Test Chat',
    });

    const response = await ai.api.sendMessage({
      params: { chatId: chat.id },
      body: {
        content: 'Hello, AI!',
        role: 'user',
      },
    });

    expect(response.message).toBeDefined();
    // Parse parts as JSON to check content
    const parts = JSON.parse(response.message.parts);
    expect(parts[0].content).toBe('Hello, AI!');
    expect(response.message.role).toBe('user');
    expect(response.message.chatId).toBe(chat.id);
  });

  it('should retrieve chat messages', async () => {
    const { chat } = await createTestChat({
      title: 'Messages Test Chat',
      withMessages: [
        { content: 'First message', role: 'user' },
        { content: 'AI response', role: 'assistant' },
      ],
    });

    const response = await ai.api.getChatMessages({
      params: { chatId: chat.id },
      query: { limit: 10 },
    });

    expect(response.messages).toBeDefined();
    expect(response.messages.length).toBe(2);
    const parts1 = JSON.parse(response.messages[0].parts);
    const parts2 = JSON.parse(response.messages[1].parts);
    expect(parts1[0].content).toBe('First message');
    expect(parts2[0].content).toBe('AI response');
  });

  it('should upvote a message', async () => {
    const { chat, messages } = await createTestChat({
      title: 'Vote Test Chat',
      withMessages: [{ content: 'Test message for voting', role: 'assistant' }],
    });

    const response = await ai.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: messages[0].id,
        type: 'up',
      },
      asResponse: true,
    });

    expect(response.status).toBe(200);
  });

  it('should downvote a message', async () => {
    const { chat, messages } = await createTestChat({
      title: 'Downvote Test Chat',
      withMessages: [
        { content: 'Test message for downvoting', role: 'assistant' },
      ],
    });

    const response = await ai.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: messages[0].id,
        type: 'down',
      },
      asResponse: true,
    });

    expect(response.status).toBe(200);
  });

  it('should get chat history', async () => {
    await createTestChat({ title: 'History Chat 1' });
    await createTestChat({ title: 'History Chat 2' });

    const response = await ai.api.getChatHistory({
      query: { limit: 10 },
    });

    expect(response.chats).toBeDefined();
    expect(response.chats.length).toBeGreaterThanOrEqual(2);
    expect(response.chats.some((chat) => chat.title === 'History Chat 1')).toBe(
      true
    );
    expect(response.chats.some((chat) => chat.title === 'History Chat 2')).toBe(
      true
    );
  });

  it('should create a complete chat flow with votes', async () => {
    const { chat, messages } = await createChatFlow([
      { content: 'Hello', role: 'user' },
      { content: 'Hi there!', role: 'assistant', vote: 'up' },
      { content: 'How are you?', role: 'user' },
      { content: "I'm doing well", role: 'assistant', vote: 'down' },
    ]);

    expect(chat).toBeDefined();
    expect(messages.length).toBe(4);

    // Verify votes were applied
    const votes = await ai.api.getVotesByChatId({
      params: { chatId: chat.id },
    });

    expect(votes.length).toBe(2);
    expect(votes.some((vote) => vote.isUpvoted === true)).toBe(true);
    expect(votes.some((vote) => vote.isUpvoted === false)).toBe(true);
  });
});

describe('Drizzle Adapter Number Id Test', async () => {
  let pg: Pool;
  let postgres: Kysely<any>;
  pg = createTestPool();
  postgres = createKyselyInstance(pg);
  const opts = createTestOptions(pg, true);
  beforeAll(async () => {
    await cleanupDatabase(postgres, false);
    const { runMigrations } = await getMigrations(opts);
    await runMigrations();
  });

  afterAll(async () => {
    await cleanupDatabase(postgres);
  });
  const db = drizzle(pg);
  const adapter = drizzleAdapter(db, {
    provider: 'pg',
    schema,
    debugLogs: {
      isRunningAdapterTests: true,
    },
  });

  await runNumberIdAdapterTest({
    getAdapter: async (
      customOptions: Omit<UnblockedOptions, 'database'> = {} as any
    ) => {
      return adapter({
        ...customOptions,
        database: opts.database,
        user: customOptions.user || opts.user,
        advanced: customOptions.advanced || opts.advanced,
      } as UnblockedOptions);
    },
  });
});
