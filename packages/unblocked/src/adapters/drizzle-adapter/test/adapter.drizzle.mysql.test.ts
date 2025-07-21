import merge from 'deepmerge';
import { drizzle } from 'drizzle-orm/mysql2';
import { Kysely, MysqlDialect } from 'kysely';
import { createPool, type Pool } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unblocked } from '../../../ai';
import { getMigrations } from '../../../db/get-migration';
import type { UnblockedOptions } from '../../../types';
import { runAdapterTest, runNumberIdAdapterTest } from '../../test';
import { drizzleAdapter } from '..';
import * as schema from './schema.mysql';

const TEST_DB_MYSQL_URL = 'mysql://user:password@localhost:3306/better_auth';

const createTestPool = () => createPool(TEST_DB_MYSQL_URL);

const createKyselyInstance = (pool: any) =>
  new Kysely({
    dialect: new MysqlDialect({ pool }),
  });

const cleanupDatabase = async (mysql: Pool, shouldDestroy = true) => {
  try {
    await mysql.query('DROP DATABASE IF EXISTS better_auth');
    await mysql.query('CREATE DATABASE better_auth');
    await mysql.query('USE better_auth');
  } catch (error) {
    console.log(error);
  }
  if (shouldDestroy) {
    await mysql.end();
  } else {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

const createTestOptions = (pool: any, useNumberId = false) =>
  ({
    database: pool,
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

describe('Drizzle Adapter Tests (MySQL)', async () => {
  let pool: any;
  let mysql: Kysely<any>;

  pool = createTestPool();
  mysql = createKyselyInstance(pool);
  const opts = createTestOptions(pool);
  const { runMigrations } = await getMigrations(opts);
  await runMigrations();

  const db = drizzle({
    client: pool,
  });
  const adapter = drizzleAdapter(db, {
    provider: 'mysql',
    schema,
    debugLogs: {
      isRunningAdapterTests: true,
    },
  });

  await runAdapterTest({
    getAdapter: async (
      customOptions: Omit<UnblockedOptions, 'database'> = {} as any
    ) => {
      const db = opts.database;
      const baseOpts = {
        database: db,
        user: opts.user,
        advanced: opts.advanced,
      };
      const merged = merge(baseOpts, customOptions) as UnblockedOptions;
      return adapter(merged);
    },
  });
});

describe('Drizzle Adapter Authentication Flow Tests (MySQL)', async () => {
  const pool = createTestPool();
  const opts = createTestOptions(pool);
  const testUser = {
    email: 'test-email@email.com',
    password: 'password',
    name: 'Test Name',
  };

  beforeAll(async () => {
    const { runMigrations } = await getMigrations(opts);
    await runMigrations();
  });

  // Auth-specific tests removed - MySQL Drizzle adapter is tested via runAdapterTest
});

describe('ai-operations (MySQL)', async () => {
  const { getTestInstance } = await import('../../../test-utils/test-instance');
  const pool = createTestPool();
  const db = drizzle({
    client: pool,
  });
  const adapter = drizzleAdapter(db, {
    provider: 'mysql',
    schema,
  });

  const { ai, createTestChat, createChatFlow } = await getTestInstance(
    {
      database: adapter,
    },
    {
      testWith: 'mysql',
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

describe('Drizzle Adapter Number Id Test (MySQL)', async () => {
  let pool: any;
  let mysql: Kysely<any>;

  pool = createTestPool();
  mysql = createKyselyInstance(pool);
  const opts = createTestOptions(pool, true);

  beforeAll(async () => {
    await cleanupDatabase(pool, false);
    const { runMigrations } = await getMigrations(opts);
    await runMigrations();
  });

  afterAll(async () => {
    await cleanupDatabase(pool);
  });

  const db = drizzle({
    client: pool,
  });
  const adapter = drizzleAdapter(db, {
    provider: 'mysql',
    schema,
    debugLogs: {
      isRunningAdapterTests: true,
    },
  });

  await runNumberIdAdapterTest({
    getAdapter: async (
      customOptions: Omit<UnblockedOptions, 'database'> = {} as any
    ) => {
      const db = opts.database;
      const baseOpts = {
        database: db,
        user: opts.user,
        advanced: opts.advanced,
      };
      const merged = merge(baseOpts, customOptions) as UnblockedOptions;
      return adapter(merged);
    },
  });
});
