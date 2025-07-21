// TODO this is kind of useless right now, we do need to ensure we can test important db queries here like creating chats and retrieving messages
import { describe, expect, it } from 'vitest';
import { getTestInstance } from '../test-utils/test-instance';
import type { Message } from '../types';

describe('db', async () => {
  it('should work with database operations for AI models', async () => {
    const { client, db } = await getTestInstance();

    // Create a chat
    const chat = await db.create({
      model: 'chat',
      data: {
        id: 'test-chat-id',
        userId: 'test-user-id',
        title: 'Test Chat',
        visibility: 'private',
        createdAt: new Date(),
      },
    });

    // Create a message
    const message = await db.create({
      model: 'message',
      data: {
        id: 'test-message-id',
        chatId: chat.id,
        role: 'user',
        parts: JSON.stringify([{ type: 'text', content: 'Hello AI!' }]),
        createdAt: new Date(),
      },
    });

    // Find chats
    const chats = await db.findMany({
      model: 'chat',
      where: [{ field: 'userId', value: 'test-user-id' }],
    });

    // Find messages
    const messages = await db.findMany({
      model: 'message',
      where: [{ field: 'chatId', value: chat.id }],
    });

    expect(chat).toBeDefined();
    expect(message).toBeDefined();
    expect(chats).toHaveLength(1);
    expect(messages).toHaveLength(1);
  });

  it('db hooks for AI models', async () => {
    let hookCalled = false;
    const { ai, db } = await getTestInstance({
      databaseHooks: {
        chat: {
          create: {
            async before(data: any) {
              hookCalled = true;
              return {
                data: {
                  ...data,
                  title: data.title || 'Default Title',
                },
              };
            },
          },
        },
      },
    });

    const chat = await db.create({
      model: 'chat',
      data: {
        id: 'hook-test-chat',
        userId: 'test-user-id',
        visibility: 'private',
        createdAt: new Date(),
      },
    });

    expect(hookCalled).toBe(true);
    expect(chat.title).toBe('Default Title');
  });

  it('should handle JSON serialization for message parts', async () => {
    const { ai, db } = await getTestInstance();

    const messageParts = [
      { type: 'text', content: 'Hello' },
      { type: 'image', content: 'data:image/png;base64,...' },
    ];

    const message = await db.create({
      model: 'message',
      data: {
        id: 'json-test-message',
        chatId: 'test-chat',
        role: 'user',
        parts: JSON.stringify(messageParts),
        createdAt: new Date(),
      },
    });

    const retrieved = await db.findOne<Message>({
      model: 'message',
      where: [{ field: 'id', value: message.id }],
    });

    expect(retrieved).toBeDefined();
    const parsedParts = JSON.parse(retrieved!.parts);
    expect(parsedParts).toHaveLength(2);
    expect(parsedParts[0].type).toBe('text');
    expect(parsedParts[1].type).toBe('image');
  });
});
