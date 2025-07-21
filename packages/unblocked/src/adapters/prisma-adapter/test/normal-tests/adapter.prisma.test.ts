import { beforeAll, describe, expect, it } from 'vitest';
import { getTestInstance } from '../../../../test-utils/test-instance';
import type { UnblockedOptions } from '../../../../types';
import { runAdapterTest } from '../../../test';
import { pushPrismaSchema } from '../push-schema';
import { setState } from '../state';
import { createTestOptions } from '../test-options';

describe('Adapter tests', async () => {
  beforeAll(async () => {
    setState('RUNNING');
    await pushPrismaSchema('normal');
    console.log('Successfully pushed normal Prisma Schema using pnpm...');
    const { getAdapter } = await import('./get-adapter');
    const { clearDb } = getAdapter();
    await clearDb();
    return () => {
      console.log(
        'Normal Prisma adapter test finished. Now allowing number ID prisma tests to run.'
      );
      setState('IDLE');
    };
  });

  await runAdapterTest({
    getAdapter: async (customOptions: Partial<UnblockedOptions> = {}) => {
      const { getAdapter } = await import('./get-adapter');
      const { adapter } = getAdapter();
      const { advanced, database, user } = createTestOptions(adapter);
      return adapter({
        ...customOptions,
        user: customOptions.user || user,
        advanced: {
          ...advanced,
          ...customOptions.advanced,
        },
        database,
      });
    },
  });
});

describe('ai-operations', async () => {
  const { getAdapter } = await import('./get-adapter');
  const { adapter } = getAdapter();

  const { ai, createTestChat, createChatFlow } = await getTestInstance(
    {
      database: adapter,
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
