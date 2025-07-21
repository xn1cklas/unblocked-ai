import Database from 'better-sqlite3';
import { SqliteDialect } from 'kysely';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { init } from '../init';
import { getTestInstance } from '../test-utils/test-instance';
import type { UnblockedOptions, UnblockedPlugin } from '../types';
import { getMigrations } from './get-migration';

describe('adapter test', async () => {
  const sqliteDialect = new SqliteDialect({
    database: new Database(':memory:'),
  });
  const map = new Map();
  let id = 1;
  const hookChatCreateBefore = vi.fn();
  const hookChatCreateAfter = vi.fn();
  const pluginHookChatCreateBefore = vi.fn();
  const pluginHookChatCreateAfter = vi.fn();
  const opts = {
    database: new Database(':memory:'),
    user: {
      getUser: () => ({
        id: 'test-user-id',
        email: 'test@test.com',
        name: 'Test User',
      }),
    },
    secondaryStorage: {
      set(key, value, ttl) {
        map.set(key, value);
      },
      get(key) {
        return map.get(key);
      },
      delete(key) {
        map.delete(key);
      },
    },
    advanced: {
      database: {
        generateId() {
          return (id++).toString();
        },
      },
    },
    databaseHooks: {},
    plugins: [
      {
        id: 'test-plugin',
        init(ctx) {
          return {};
        },
      } satisfies UnblockedPlugin,
    ],
  } satisfies UnblockedOptions;
  beforeAll(async () => {
    (await getMigrations(opts)).runMigrations();
  });
  afterEach(async () => {
    vi.clearAllMocks();
  });
  const ctx = await init(opts);
  const adapter = ctx.adapter;

  it('should create chat with custom generate id', async () => {
    const chat = await adapter.create({
      model: 'chat',
      data: {
        title: 'Test Chat',
        userId: 'test-user-id',
        visibility: 'private',
      },
    });
    expect(chat).toMatchObject({
      id: '1',
      title: 'Test Chat',
      userId: 'test-user-id',
      visibility: 'private',
      createdAt: expect.any(Date),
    });
  });
  it('should find chat by id', async () => {
    const chat = await adapter.create({
      model: 'chat',
      data: {
        title: 'Test Chat 2',
        userId: 'test-user-id',
        visibility: 'public',
      },
    });
    const found = await adapter.findOne({
      model: 'chat',
      where: [{ field: 'id', value: chat.id }],
    });
    expect(found).toMatchObject({
      id: chat.id,
      title: 'Test Chat 2',
    });
  });

  it('should create and find messages', async () => {
    const chat = await adapter.create({
      model: 'chat',
      data: {
        title: 'Message Test Chat',
        userId: 'test-user-id',
        visibility: 'private',
      },
    });

    const message = await adapter.create({
      model: 'message',
      data: {
        chatId: chat.id,
        role: 'user',
        parts: JSON.stringify([{ type: 'text', content: 'Hello AI!' }]),
        attachments: JSON.stringify([]),
      },
    });

    expect(message).toMatchObject({
      chatId: chat.id,
      role: 'user',
    });

    const messages = await adapter.findMany({
      model: 'message',
      where: [{ field: 'chatId', value: chat.id }],
    });

    expect(Array.isArray(messages)).toBe(true);
    expect(messages).toHaveLength(1);
    expect((messages[0] as { id: string }).id).toBe(message.id);
  });
});
