import Database from 'better-sqlite3';
import merge from 'deepmerge';
import fsPromises from 'fs/promises';
import { Kysely, MssqlDialect, MysqlDialect, SqliteDialect, sql } from 'kysely';
import { createPool } from 'mysql2/promise';
import path from 'path';
import * as tarn from 'tarn';
import * as tedious from 'tedious';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getMigrations } from '../../../../db/get-migration';
import { getTestInstance } from '../../../../test-utils/test-instance';
import type { UnblockedOptions } from '../../../../types';
import { runAdapterTest } from '../../../test';
import { kyselyAdapter } from '../..';
import { setState } from '../state';

const sqlite = new Database(path.join(__dirname, 'test.db'));
const mysql = createPool('mysql://user:password@localhost:3306/better_auth');
const sqliteKy = new Kysely({
  dialect: new SqliteDialect({
    database: sqlite,
  }),
});
const mysqlKy = new Kysely({
  dialect: new MysqlDialect(mysql),
});
export const opts = ({
  database,
  isNumberIdTest,
}: {
  database: UnblockedOptions['database'];
  isNumberIdTest: boolean;
}) =>
  ({
    database,
    user: {
      getUser: () => ({
        id: 'test-user-id',
        email: 'test@test.com',
        name: 'Test User',
      }),
    },
    advanced: {
      database: {
        useNumberId: isNumberIdTest,
      },
    },
  }) satisfies UnblockedOptions;

describe('adapter test', async () => {
  const mysqlOptions = opts({
    database: {
      db: mysqlKy,
      type: 'mysql',
    },
    isNumberIdTest: false,
  });

  const sqliteOptions = opts({
    database: {
      db: sqliteKy,
      type: 'sqlite',
    },
    isNumberIdTest: false,
  });
  beforeAll(async () => {
    setState('RUNNING');
    console.log('Now running Number ID Kysely adapter test...');
    await (await getMigrations(mysqlOptions)).runMigrations();
    await (await getMigrations(sqliteOptions)).runMigrations();
  });

  afterAll(async () => {
    await mysql.query('DROP DATABASE IF EXISTS better_auth');
    await mysql.query('CREATE DATABASE better_auth');
    await mysql.end();
    await fsPromises.unlink(path.join(__dirname, 'test.db'));
  });

  const mysqlAdapter = kyselyAdapter(mysqlKy, {
    type: 'mysql',
    debugLogs: {
      isRunningAdapterTests: true,
    },
  });
  await runAdapterTest({
    getAdapter: async (customOptions: Partial<UnblockedOptions> = {}) => {
      return mysqlAdapter(
        merge(mysqlOptions, customOptions) as UnblockedOptions
      );
    },
    testPrefix: 'mysql',
  });

  const sqliteAdapter = kyselyAdapter(sqliteKy, {
    type: 'sqlite',
    debugLogs: {
      isRunningAdapterTests: true,
    },
  });
  await runAdapterTest({
    getAdapter: async (customOptions: Partial<UnblockedOptions> = {}) => {
      return sqliteAdapter(
        merge(sqliteOptions, customOptions) as UnblockedOptions
      );
    },
    testPrefix: 'sqlite',
  });
});

describe('mssql', async () => {
  const dialect = new MssqlDialect({
    tarn: {
      ...tarn,
      options: {
        min: 0,
        max: 10,
      },
    },
    tedious: {
      ...tedious,
      connectionFactory: () =>
        new tedious.Connection({
          authentication: {
            options: {
              password: 'Password123!',
              userName: 'sa',
            },
            type: 'default',
          },
          options: {
            port: 1433,
            trustServerCertificate: true,
          },
          server: 'localhost',
        }),
    },
  });
  const opts = {
    database: dialect,
    user: {
      getUser: () => ({
        id: 'test-user-id',
        email: 'test@test.com',
        name: 'Test User',
      }),
    },
  } satisfies UnblockedOptions;
  beforeAll(async () => {
    const { runMigrations, toBeAdded, toBeCreated } = await getMigrations(opts);
    await runMigrations();
    return async () => {
      await resetDB();
      console.log(
        'Normal Kysely adapter test finished. Now allowing number ID Kysely tests to run.'
      );
      setState('IDLE');
    };
  });
  const mssql = new Kysely({
    dialect,
  });
  const getAdapter = kyselyAdapter(mssql, {
    type: 'mssql',
    debugLogs: {
      isRunningAdapterTests: true,
    },
  });

  async function resetDB() {
    await sql`DROP TABLE dbo.session;`.execute(mssql);
    await sql`DROP TABLE dbo.verification;`.execute(mssql);
    await sql`DROP TABLE dbo.account;`.execute(mssql);
    await sql`DROP TABLE dbo.users;`.execute(mssql);
  }

  await runAdapterTest({
    getAdapter: async (customOptions: Partial<UnblockedOptions> = {}) => {
      // const merged = merge( customOptions,opts);
      // merged.database = opts.database;
      return getAdapter(opts);
    },
    disableTests: {
      SHOULD_PREFER_GENERATE_ID_IF_PROVIDED: true,
    },
  });
  // Auth-specific tests removed - Kysely adapter is tested via runAdapterTest above
});

describe('ai-operations (Kysely)', async () => {
  const sqliteAdapter = kyselyAdapter(sqliteKy, {
    type: 'sqlite',
  });

  const { ai, createTestChat, createChatFlow } = await getTestInstance(
    {
      database: sqliteAdapter,
    },
    {
      testWith: 'sqlite',
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
