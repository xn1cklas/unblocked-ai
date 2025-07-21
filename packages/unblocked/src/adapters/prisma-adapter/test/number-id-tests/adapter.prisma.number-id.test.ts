import * as fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { getTestInstance } from '../../../../test-utils/test-instance';
import type { UnblockedOptions } from '../../../../types';
import { runNumberIdAdapterTest } from '../../../test';
import { pushPrismaSchema } from '../push-schema';
import { getState, stateFilePath } from '../state';
import { createTestOptions } from '../test-options';

describe('Number Id Adapter Test', async () => {
  beforeAll(async () => {
    await new Promise(async (resolve) => {
      await new Promise((r) => setTimeout(r, 500));
      if (getState() === 'IDLE') {
        resolve(true);
        return;
      }
      console.log('Waiting for state to be IDLE...');
      fs.watch(stateFilePath, () => {
        if (getState() === 'IDLE') {
          resolve(true);
          return;
        }
      });
    });
    console.log('Now running Number ID Prisma adapter test...');
    await pushPrismaSchema('number-id');
    console.log('Successfully pushed number id Prisma Schema using pnpm...');
    const { getAdapter } = await import('./get-adapter');
    const { clearDb } = getAdapter();
    await clearDb();
  }, Number.POSITIVE_INFINITY);

  await runNumberIdAdapterTest({
    getAdapter: async (
      customOptions: Partial<Omit<UnblockedOptions, 'database'>> = {}
    ) => {
      const { getAdapter } = await import('./get-adapter');
      const { adapter } = getAdapter();
      const testOptions = createTestOptions(adapter, true);
      return adapter({
        ...testOptions,
        ...customOptions,
        user: customOptions.user || testOptions.user,
        advanced: {
          ...testOptions.advanced,
          ...customOptions.advanced,
        },
      });
    },
  });
});

describe('ai-operations-with-number-ids', async () => {
  const { getAdapter } = await import('./get-adapter');
  const { adapter } = getAdapter();

  const { ai, createTestChat, createChatFlow } = await getTestInstance(
    {
      database: adapter,
      advanced: {
        database: {
          useNumberId: true,
        },
      },
    },
    {
      testWith: 'sqlite',
    }
  );

  it('should create a chat with number ID', async () => {
    const response = await ai.api.createChat({
      body: {
        title: 'Test Chat with Number ID',
        visibility: 'private',
      },
    });

    expect(response.chat).toBeDefined();
    expect(response.chat.title).toBe('Test Chat with Number ID');
    expect(response.chat.visibility).toBe('private');
    expect(response.chat.userId).toBe('test-user-id');
    // ID should be a string representation of a number
    expect(Number.parseInt(response.chat.id)).toBeGreaterThan(0);
  });

  it('should send a message with number ID', async () => {
    const { chat } = await createTestChat({
      title: 'Message Test Chat Number ID',
    });

    const response = await ai.api.sendMessage({
      params: { chatId: chat.id },
      body: {
        content: 'Hello with number ID!',
        role: 'user',
      },
    });

    expect(response.message).toBeDefined();
    // Parse parts as JSON to check content
    const parts = JSON.parse(response.message.parts);
    expect(parts[0].content).toBe('Hello with number ID!');
    expect(response.message.role).toBe('user');
    expect(response.message.chatId).toBe(chat.id);
    // Message ID should be a string representation of a number
    expect(Number.parseInt(response.message.id)).toBeGreaterThan(0);
  });

  it('should handle votes with number IDs', async () => {
    const { chat, messages } = await createTestChat({
      title: 'Vote Test Chat Number ID',
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

  it('should create incrementing number IDs', async () => {
    const response1 = await ai.api.createChat({
      body: { title: 'First Chat' },
    });
    const response2 = await ai.api.createChat({
      body: { title: 'Second Chat' },
    });

    const id1 = Number.parseInt(response1.chat.id);
    const id2 = Number.parseInt(response2.chat.id);

    expect(id2).toBe(id1 + 1);
  });

  it('should create a complete chat flow with number IDs', async () => {
    const { chat, messages } = await createChatFlow([
      { content: 'Hello', role: 'user' },
      { content: 'Hi there!', role: 'assistant', vote: 'up' },
      { content: 'How are you?', role: 'user' },
      { content: "I'm doing well", role: 'assistant', vote: 'down' },
    ]);

    expect(chat).toBeDefined();
    expect(messages.length).toBe(4);

    // All IDs should be string representations of numbers
    expect(Number.parseInt(chat.id)).toBeGreaterThan(0);
    messages.forEach((msg) => {
      expect(Number.parseInt(msg.id)).toBeGreaterThan(0);
    });

    // Verify votes were applied
    const votes = await ai.api.getVotesByChatId({
      params: { chatId: chat.id },
    });

    expect(votes.length).toBe(2);
    expect(votes.some((vote) => vote.isUpvoted === true)).toBe(true);
    expect(votes.some((vote) => vote.isUpvoted === false)).toBe(true);
  });
});
