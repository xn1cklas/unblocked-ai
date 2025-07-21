import { describe, expect, it } from 'vitest';
import { createMockProviders } from '../test-utils/mock-providers';
import { getTestInstance } from '../test-utils/test-instance';

describe('AI Conversation Integration', () => {
  it('should handle complete conversation flow with mock AI', async () => {
    const { ai } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4',
        systemPrompt: 'You are a helpful AI assistant.',
      },
    });

    // 1. Create a new chat
    const createChatResponse = await ai.api.createChat({
      body: {
        title: 'Integration Test Chat',
        visibility: 'private',
      },
    });

    expect(createChatResponse.chat).toBeDefined();
    const chatId = createChatResponse.chat.id;

    // 2. Send first user message
    const firstMessage = await ai.api.sendMessage({
      params: { chatId },
      body: {
        content: 'Hello, how are you?',
        role: 'user',
      },
    });

    expect(firstMessage.message).toBeDefined();
    expect(firstMessage.message.role).toBe('user');
    expect(firstMessage.message.chatId).toBe(chatId);

    // 3. Get AI response via streaming
    const aiResponse = await ai.api.streamMessage({
      params: { chatId },
      body: {
        message: {
          id: `ai-response-${Date.now()}`,
          role: 'user',
          content: 'Please respond to my greeting',
          parts: [{ type: 'text', content: 'Please respond to my greeting' }],
        },
        model: 'gpt-4',
      },
    });

    expect(aiResponse.message).toBeDefined();
    expect(aiResponse.streamId).toBeDefined();
    expect((aiResponse as any).status).toBe('streaming_mock');

    // 4. Verify chat history
    const chatHistory = await ai.api.getChatMessages({
      params: { chatId },
      query: { limit: 10 },
    });

    expect(chatHistory.messages).toBeDefined();
    expect(chatHistory.messages.length).toBeGreaterThanOrEqual(2);

    // Should have user messages and AI response
    const userMessages = chatHistory.messages.filter((m) => m.role === 'user');
    const assistantMessages = chatHistory.messages.filter(
      (m) => m.role === 'assistant'
    );

    expect(userMessages.length).toBeGreaterThanOrEqual(1);
    expect(assistantMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle multi-turn conversation with context', async () => {
    const { ai } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'claude-3-opus',
        systemPrompt: 'You are a helpful AI assistant with excellent memory.',
      },
    });

    // Create chat and send multiple messages
    const createResponse = await ai.api.createChat({
      body: {
        title: 'Multi-turn Chat',
        visibility: 'private',
      },
    });
    const chatId = createResponse.chat.id;

    // Turn 1: Initial question
    await ai.api.sendMessage({
      params: { chatId },
      body: {
        content: "My name is John. What's your name?",
        role: 'user',
      },
    });

    // Turn 2: Follow-up that requires context
    await ai.api.sendMessage({
      params: { chatId },
      body: {
        content: 'Do you remember my name?',
        role: 'user',
      },
    });

    // Generate AI response with full context
    const contextResponse = await ai.api.streamMessage({
      params: { chatId },
      body: {
        message: {
          id: `context-test-${Date.now()}`,
          role: 'user',
          content: 'What was my first question?',
          parts: [{ type: 'text', content: 'What was my first question?' }],
        },
        model: 'claude-3-opus',
      },
    });

    expect(contextResponse.message).toBeDefined();

    // Verify all messages are in chat history
    const history = await ai.api.getChatMessages({
      params: { chatId },
      query: { limit: 20 },
    });

    expect(history.messages.length).toBeGreaterThanOrEqual(3);
  });

  it('should handle different AI models correctly', async () => {
    const { ai } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4', // Default model
      },
    });

    const createResponse = await ai.api.createChat({
      body: {
        title: 'Model Switching Test',
        visibility: 'private',
      },
    });
    const chatId = createResponse.chat.id;

    // Test different models
    const models = [
      'gpt-4',
      'gpt-3.5-turbo',
      'claude-3-opus',
      'claude-3-sonnet',
    ];

    for (const model of models) {
      const response = await ai.api.streamMessage({
        params: { chatId },
        body: {
          message: {
            id: `model-test-${model}-${Date.now()}`,
            role: 'user',
            content: `Test message with ${model}`,
            parts: [{ type: 'text', content: `Test message with ${model}` }],
          },
          model,
        },
      });

      expect(response.message).toBeDefined();
      expect((response as any).status).toBe('streaming_mock');
    }
  });

  it('should handle conversation with attachments', async () => {
    const { ai } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4',
      },
    });

    const createResponse = await ai.api.createChat({
      body: {
        title: 'Attachment Test',
        visibility: 'private',
      },
    });
    const chatId = createResponse.chat.id;

    // Send message with attachments
    const messageWithAttachment = await ai.api.sendMessage({
      params: { chatId },
      body: {
        content: 'Please analyze this file',
        role: 'user',
        attachments: [
          {
            id: 'file-123',
            name: 'test-document.pdf',
            type: 'application/pdf',
            size: 1024,
            url: 'https://example.com/file.pdf',
          },
        ],
      },
    });

    expect(messageWithAttachment.message).toBeDefined();

    // Verify attachment is stored
    const storedAttachments = JSON.parse(
      messageWithAttachment.message.attachments
    );
    expect(storedAttachments).toHaveLength(1);
    expect(storedAttachments[0].name).toBe('test-document.pdf');
  });

  it('should handle conversation voting and feedback', async () => {
    const { ai } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4',
      },
    });

    const createResponse = await ai.api.createChat({
      body: {
        title: 'Voting Test',
        visibility: 'private',
      },
    });
    const chatId = createResponse.chat.id;

    // Send message and get AI response
    await ai.api.sendMessage({
      params: { chatId },
      body: {
        content: 'Tell me a joke',
        role: 'user',
      },
    });

    await ai.api.streamMessage({
      params: { chatId },
      body: {
        message: {
          id: `joke-response-${Date.now()}`,
          role: 'user',
          content: 'Generate a joke',
          parts: [{ type: 'text', content: 'Generate a joke' }],
        },
        model: 'gpt-4',
      },
    });

    // Vote on the AI response
    const history = await ai.api.getChatMessages({
      params: { chatId },
      query: { limit: 10 },
    });

    const assistantMessage = history.messages.find(
      (m) => m.role === 'assistant'
    );
    expect(assistantMessage).toBeDefined();

    const voteResponse = await ai.api.voteMessage({
      body: {
        chatId,
        messageId: assistantMessage!.id,
        type: 'up',
      },
    });

    expect(voteResponse.vote).toBeDefined();
    expect(voteResponse.vote.vote).toBe('up');

    // Get votes for the message
    const votes = await ai.api.getMessageVotes({
      params: { messageId: assistantMessage!.id },
    });

    expect(votes.votes).toHaveLength(1);
    expect(votes.stats.up).toBe(1);
    expect(votes.stats.down).toBe(0);
  });

  it('should handle conversation persistence and retrieval', async () => {
    const { ai } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4',
      },
    });

    // Create multiple chats
    const chats = [];
    for (let i = 0; i < 3; i++) {
      const createResponse = await ai.api.createChat({
        body: {
          title: `Persistence Test Chat ${i + 1}`,
          visibility: 'private',
        },
      });
      chats.push(createResponse.chat);

      // Add messages to each chat
      await ai.api.sendMessage({
        params: { chatId: createResponse.chat.id },
        body: {
          content: `Test message in chat ${i + 1}`,
          role: 'user',
        },
      });
    }

    // Verify chat history retrieval
    const chatHistory = await ai.api.getChatHistory({
      query: { limit: 10 },
    });

    expect(chatHistory.chats).toHaveLength(3);

    // Verify each chat has the correct title and messages
    for (let i = 0; i < 3; i++) {
      const chat = chatHistory.chats.find(
        (c) => c.title === `Persistence Test Chat ${i + 1}`
      );
      expect(chat).toBeDefined();

      const messages = await ai.api.getChatMessages({
        params: { chatId: chat!.id },
        query: { limit: 10 },
      });

      expect(messages.messages).toHaveLength(1);
      expect(JSON.parse(messages.messages[0].parts)[0].content).toBe(
        `Test message in chat ${i + 1}`
      );
    }
  });
});
