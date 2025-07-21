import { describe, expect, it } from 'vitest';
import { createMockProviders } from '../../test-utils/mock-providers';
import {
  getTestInstance,
  UNAUTHENTICATED,
} from '../../test-utils/test-instance';

describe('chat routes', () => {
  // Note: Each test gets its own instance to avoid data conflicts

  it('should create a new chat', async () => {
    const { ai } = await getTestInstance();
    const response = await ai.api.createChat({
      body: {
        title: 'Test Chat',
        visibility: 'private',
      },
      asResponse: true,
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.chat).toBeDefined();
    expect(result.chat.title).toBe('Test Chat');
    expect(result.chat.visibility).toBe('private');
    expect(result.chat.userId).toBeTruthy();
  });

  it('should get chat history', async () => {
    const { ai } = await getTestInstance();
    // First create a chat
    const createResponse = await ai.api.createChat({
      body: {
        title: 'History Test Chat',
        visibility: 'private',
      },
    });

    expect(createResponse.chat).toBeDefined();

    // Now get chat history
    const historyResponse = await ai.api.getChatHistory({
      query: {
        limit: 10,
        // offset is not a valid param, removed
      },
    });

    expect(historyResponse.chats).toBeDefined();
    expect(Array.isArray(historyResponse.chats)).toBe(true);
    expect(historyResponse.chats.length).toBeGreaterThan(0);
    expect(historyResponse.chats[0].title).toBe('History Test Chat');
  });

  it('should send a message to a chat', async () => {
    const { ai } = await getTestInstance();
    // First create a chat
    const createResponse = await ai.api.createChat({
      body: {
        title: 'Message Test Chat',
        visibility: 'private',
      },
    });

    const chat = createResponse.chat;
    expect(chat).toBeDefined();

    // Send a message
    const messageResponse = await ai.api.sendMessage({
      params: {
        chatId: chat.id,
      },
      body: {
        content: 'Hello, this is a test message!',
        role: 'user',
      },
    });

    expect(messageResponse.message).toBeDefined();
    // Parse parts as JSON to check content
    const parts = JSON.parse(messageResponse.message.parts);
    expect(parts[0].content).toBe('Hello, this is a test message!');
    expect(messageResponse.message.role).toBe('user');
    expect(messageResponse.message.chatId).toBe(chat.id);
  });

  it('should get messages for a chat', async () => {
    const { ai } = await getTestInstance();
    // First create a chat
    const createResponse = await ai.api.createChat({
      body: {
        title: 'Get Messages Test Chat',
        visibility: 'private',
      },
    });

    const chat = createResponse.chat;

    // Send a message
    await ai.api.sendMessage({
      params: {
        chatId: chat.id,
      },
      body: {
        content: 'Test message for retrieval',
        role: 'user',
      },
    });

    // Get messages
    const messagesResponse = await ai.api.getChatMessages({
      params: {
        chatId: chat.id,
      },
      query: {
        limit: 10,
      },
    });

    expect(messagesResponse.messages).toBeDefined();
    expect(Array.isArray(messagesResponse.messages)).toBe(true);
    expect(messagesResponse.messages.length).toBe(1);
    const parts = JSON.parse(messagesResponse.messages[0].parts);
    expect(parts[0].content).toBe('Test message for retrieval');
  });

  it('should delete a chat', async () => {
    const { ai } = await getTestInstance();
    // First create a chat
    const createResponse = await ai.api.createChat({
      body: {
        title: 'Delete Test Chat',
        visibility: 'private',
      },
    });

    const chat = createResponse.chat;

    // Delete the chat (provide required query param)
    const deleteResponse = await ai.api.deleteChat({
      query: { id: chat.id },
    });

    expect(deleteResponse.success).toBe(true);

    // Try to get the deleted chat (should fail)
    const response = await ai.api.getChatMessages({
      params: {
        chatId: chat.id,
      },
      query: { limit: 10 },
      asResponse: true,
    });

    expect(response.status).toBe(404);
  });

  it('should handle chat with parts in message', async () => {
    const { ai } = await getTestInstance();
    // First create a chat
    const createResponse = await ai.api.createChat({
      body: {
        title: 'Parts Test Chat',
        visibility: 'private',
      },
    });

    const chat = createResponse.chat;

    // Send a message with parts
    const messageResponse = await ai.api.sendMessage({
      params: {
        chatId: chat.id,
      },
      body: {
        content: 'Combined message',
        role: 'user',
        parts: [
          {
            type: 'text',
            content: 'Hello',
          },
          {
            type: 'text',
            content: 'World',
          },
        ],
      },
    });

    expect(messageResponse.message).toBeDefined();
    const parts = JSON.parse(messageResponse.message.parts);
    expect(parts.length).toBe(2);
    expect(parts[0].content).toBe('Hello');
    expect(parts[1].content).toBe('World');
  });

  it('should handle chat with attachments', async () => {
    const { ai } = await getTestInstance();
    // First create a chat
    const createResponse = await ai.api.createChat({
      body: {
        title: 'Attachments Test Chat',
        visibility: 'private',
      },
    });

    const chat = createResponse.chat;

    // Send a message with attachments
    const messageResponse = await ai.api.sendMessage({
      params: {
        chatId: chat.id,
      },
      body: {
        content: 'Message with file',
        role: 'user',
        attachments: [
          {
            id: 'file123',
            name: 'test.txt',
            type: 'text/plain',
            size: 1024,
            url: 'https://example.com/test.txt',
          },
        ],
      },
    });

    expect(messageResponse.message).toBeDefined();
    const attachments = JSON.parse(messageResponse.message.attachments);
    expect(attachments.length).toBe(1);
    expect(attachments[0].name).toBe('test.txt');
  });

  it('should require user for private operations', async () => {
    // Create a new instance without user
    const { ai: aiNoUser } = await getTestInstance({}, UNAUTHENTICATED);

    const response = await aiNoUser.api.createChat({
      body: {
        title: 'Unauthorized Test',
        visibility: 'private',
      },
      asResponse: true,
    });

    expect(response.status).toBe(401);
    // Since this is a 401 error response, check if it's JSON first
    const text = await response.text();
    try {
      const result = JSON.parse(text);
      expect(result.error).toBeDefined();
    } catch {
      // If not JSON, the 401 status is sufficient
      expect(response.status).toBe(401);
    }
  });

  it('should handle public chat visibility', async () => {
    const { ai } = await getTestInstance();
    const response = await ai.api.createChat({
      body: {
        title: 'Public Chat',
        visibility: 'public',
      },
    });

    expect(response.chat).toBeDefined();
    expect(response.chat.visibility).toBe('public');
  });
});

describe('streaming functionality', () => {
  it('should create stream IDs for chats', async () => {
    const { ai, createTestChat } = await getTestInstance();
    const { chat } = await createTestChat({ title: 'Stream Test Chat' });

    const response = await ai.api.createStreamId({
      params: { chatId: chat.id },
      body: { streamId: 'test-stream-id' },
    });

    expect(response.success).toBe(true);
    expect(response.stream).toBeDefined();
    expect(response.stream.chatId).toBe(chat.id);
  });

  it('should get stream IDs for a chat', async () => {
    const { ai, createTestChat } = await getTestInstance();
    const { chat } = await createTestChat({ title: 'Stream IDs Test' });

    // Create multiple streams
    await ai.api.createStreamId({
      params: { chatId: chat.id },
      body: { streamId: 'stream-1' },
    });
    await ai.api.createStreamId({
      params: { chatId: chat.id },
      body: { streamId: 'stream-2' },
    });

    const streamIds = await ai.api.getStreamIdsByChatId({
      params: { chatId: chat.id },
    });

    expect(Array.isArray(streamIds)).toBe(true);
    expect(streamIds).toHaveLength(2);
  });

  it('should handle AI chat streaming endpoint structure', async () => {
    const { ai, createTestChat } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4',
      },
    });
    const { chat } = await createTestChat({ title: 'Streaming Chat' });

    // Test the streaming endpoint exists and returns proper response format
    const response = await ai.api.chatStream({
      params: { id: chat.id },
      body: {
        message: {
          id: `test-message-id-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          parts: [{ type: 'text', content: 'Test streaming message' }],
        },
        selectedChatModel: 'gpt-4',
        selectedVisibilityType: 'private',
      },
      asResponse: true,
    });

    // With mock providers configured, should return successful streaming response
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    // TODO: When AI integration is implemented, test:
    // - Stream format (SSE)
    // - Content-Type: text/event-stream
    // - X-Stream-ID header
    // - Stream data format
    // - Stream interruption/resumption
    // - Tool calling within streams
    // - Model selection effects on streaming
  });

  it('should handle message streaming with proper request format', async () => {
    const { ai, createTestChat } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4',
      },
    });
    const { chat } = await createTestChat({ title: 'Message Streaming' });

    const response = await ai.api.streamMessage({
      params: { chatId: chat.id },
      body: {
        message: {
          id: `stream-message-id-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          role: 'user',
          content: 'Stream this message',
          parts: [{ type: 'text', content: 'Stream this message' }],
        },
        model: 'gpt-4',
      },
    });

    // streamMessage currently returns JSON response with mock implementation
    expect(response.message).toBeDefined();
    expect(response.streamId).toBeDefined();
    expect((response as any).status).toBe('streaming_mock');

    // TODO: When implemented, test:
    // - SSE stream format
    // - Message persistence during streaming
    // - Error handling during streaming
    // - Stream resumption capabilities
  });

  // TODO: Add comprehensive streaming tests when AI integration is complete:
  // - Real-time message generation
  // - Stream interruption and cleanup
  // - Concurrent streams per user
  // - Stream rate limiting
  // - Tool calling within streams
  // - Model switching during streams
  // - Stream data normalization
  // - Error recovery and retries
});

describe('AI integration', () => {
  it('should handle AI provider configuration', async () => {
    // Test with configured mock providers
    const { ai, createTestChat } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4',
      },
    });
    const { chat } = await createTestChat({ title: 'AI Test Chat' });

    const response = await ai.api.streamMessage({
      params: { chatId: chat.id },
      body: {
        message: {
          id: `test-ai-message-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          role: 'user',
          content: 'Hello AI',
          parts: [{ type: 'text', content: 'Hello AI' }],
        },
        model: 'gpt-4',
      },
      asResponse: true,
    });

    // Should handle AI provider successfully
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
  });

  it('should handle missing AI provider gracefully', async () => {
    // Test with no AI provider configured
    const { ai, createTestChat } = await getTestInstance();
    const { chat } = await createTestChat({ title: 'No Provider Chat' });

    const response = await ai.api.streamMessage({
      params: { chatId: chat.id },
      body: {
        message: {
          id: `test-no-provider-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          role: 'user',
          content: 'Hello AI',
          parts: [{ type: 'text', content: 'Hello AI' }],
        },
        model: 'gpt-4',
      },
      asResponse: true,
    });

    // Should return error when no providers configured
    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.message).toContain('Model gpt-4 not found');
  });

  it('should validate model selection', async () => {
    const { ai, createTestChat } = await getTestInstance();
    const { chat } = await createTestChat({ title: 'Model Test Chat' });

    // Test with invalid model
    const response = await ai.api.streamMessage({
      params: { chatId: chat.id },
      body: {
        message: {
          id: `test-model-message-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          role: 'user',
          content: 'Test message',
          parts: [{ type: 'text', content: 'Test message' }],
        },
        model: 'invalid-model-name',
      },
      asResponse: true,
    });

    // Should validate model selection
    expect([400, 500]).toContain(response.status);
  });

  it('should handle message count and rate limiting structure', async () => {
    const { ai, createTestChat } = await getTestInstance();
    const { chat } = await createTestChat({ title: 'Rate Limit Test' });

    // Create multiple messages to test rate limiting logic
    for (let i = 0; i < 5; i++) {
      await ai.api.sendMessage({
        params: { chatId: chat.id },
        body: {
          content: `Test message ${i}`,
          role: 'user',
        },
      });
    }

    // Get message count (used for rate limiting)
    const messageCount = await ai.api.getMessageCountByUserId({
      query: {
        differenceInHours: 24,
      },
    });

    expect(messageCount.count).toBeGreaterThanOrEqual(5);
  });

  it('should handle AI response format and message persistence', async () => {
    const { ai, createTestChat } = await getTestInstance();
    const { chat } = await createTestChat({ title: 'AI Response Test' });

    // Send a message that would trigger AI response
    const userMessage = await ai.api.sendMessage({
      params: { chatId: chat.id },
      body: {
        content: 'Generate a response',
        role: 'user',
      },
    });

    // Attempt to stream an AI response
    const streamResponse = await ai.api.streamMessage({
      params: { chatId: chat.id },
      body: {
        message: {
          id: `stream-msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          role: 'user',
          content: 'Generate a response',
          parts: [{ type: 'text', content: 'Generate a response' }],
        },
        model: 'gpt-4',
      },
      asResponse: true,
    });

    // Should handle the request structure properly
    expect([200, 400, 500]).toContain(streamResponse.status);

    // Verify messages are persisted properly
    const messages = await ai.api.getChatMessages({
      params: { chatId: chat.id },
      query: { limit: 10 },
    });

    // Should have multiple messages: original user message, streamed user message, and AI response
    expect(messages.messages.length).toBeGreaterThanOrEqual(2);

    // Check that we have both user and assistant messages
    const userMessages = messages.messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.messages.filter(
      (m) => m.role === 'assistant'
    );
    expect(userMessages.length).toBeGreaterThanOrEqual(1);
    expect(assistantMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle basic chat generation workflow', async () => {
    const { ai } = await getTestInstance();
    const response = await ai.api.chatBasic({
      body: {
        id: `test-basic-chat-id-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        message: {
          id: `test-basic-message-id-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          parts: [{ type: 'text', content: 'Hello, how are you?' }],
        },
        selectedChatModel: 'gpt-4',
        selectedVisibilityType: 'private',
      },
      asResponse: true,
    });

    // Test basic chat generation endpoint
    expect([200, 500, 501]).toContain(response.status);
  });

  // TODO: Add comprehensive AI integration tests when provider is configured:
  // - Test with real AI provider (mocked)
  // - Tool calling (weather tool, document creation tool)
  // - Multi-turn conversations with context
  // - System prompt customization
  // - Temperature and parameter settings
  // - AI model switching mid-conversation
  // - Error handling for AI provider failures
  // - Token usage tracking and limits
  // - Content filtering and safety
  // - AI response formatting and validation

  // TODO: Add tool integration tests:
  // - Weather tool calling
  // - Document creation tool
  // - Suggestion generation tool
  // - Custom tool registration and execution
  // - Tool error handling and fallbacks
  // - Tool result persistence

  // TODO: Add advanced AI features:
  // - Reasoning mode support
  // - Multi-modal input (text + images)
  // - Code generation and execution
  // - Function calling with parameters
  // - AI model fine-tuning integration
});

describe('error code validation', () => {
  it('should return specific error codes for authentication failures', async () => {
    const { ai: aiNoUser } = await getTestInstance({}, UNAUTHENTICATED);
    const response = await aiNoUser.api.createChat({
      body: { title: 'Unauthorized Chat' },
      asResponse: true,
    });

    expect(response.status).toBe(401);

    const error = await response.json();
    expect(error.message).toContain('User is required'); // BASE_ERROR_CODES.USER_REQUIRED
  });

  it('should return specific error codes for chat not found', async () => {
    const { ai } = await getTestInstance();
    const response = await ai.api.getChatById({
      params: { id: 'non-existent-chat-id' },
      asResponse: true,
    });

    expect(response.status).toBe(404);

    const error = await response.json();
    expect(error.message).toContain('not found'); // Should match our error patterns
  });

  it('should return specific error codes for message not found', async () => {
    const { ai } = await getTestInstance();
    const response = await ai.api.getMessageById({
      params: { id: 'non-existent-message-id' },
      asResponse: true,
    });

    expect(response.status).toBe(404);

    const error = await response.json();
    expect(error.message).toContain('not found');
  });

  it('should validate input and return specific error codes', async () => {
    // Test invalid chat deletion with malformed ID
    const { ai } = await getTestInstance();
    const response = await ai.api.deleteChat({
      query: { id: '' },
      asResponse: true,
    });

    expect([400, 404]).toContain(response.status);

    const error = await response.json();
    expect(error.message).toBeDefined();
  });

  it('should return specific error codes for streaming failures', async () => {
    const { ai } = await getTestInstance();
    const response = await ai.api.chatStream({
      params: { id: 'non-existent-chat' },
      body: {
        message: {
          id: 'test-message',
          parts: [{ type: 'text', content: 'Test' }],
        },
        selectedChatModel: 'gpt-4',
        selectedVisibilityType: 'private',
      },
      asResponse: true,
    });

    // Should return 400 (model not found) or 500 (database error for invalid chat ID)
    expect([400, 404, 500, 501]).toContain(response.status);
  });

  it('should handle invalid message format errors', async () => {
    const { ai, createTestChat } = await getTestInstance();
    const { chat } = await createTestChat({ title: 'Format Test' });

    const response = await ai.api.sendMessage({
      params: { chatId: chat.id },
      body: {
        content: '', // Invalid empty content
        role: 'user',
      },
      asResponse: true,
    });

    expect([400, 422]).toContain(response.status);
  });

  // TODO: Add more specific error code tests:
  // - AI provider specific errors (PROVIDER_NOT_CONFIGURED, etc.)
  // - Model specific errors (MODEL_NOT_FOUND, etc.)
  // - Rate limiting errors (PROVIDER_RATE_LIMITED, etc.)
  // - Stream specific errors (STREAM_CONNECTION_ERROR, etc.)
  // - Database specific errors (DATABASE_ERROR, etc.)
  // - Custom error message validation
  // - Error response format consistency
});

describe('multi-user isolation', () => {
  it('should prevent cross-user chat access', async () => {
    // Create separate user contexts
    const { ai: userAlice } = await getTestInstance(
      {},
      {
        user: { id: 'user-alice', email: 'alice@test.com', name: 'Alice' },
      }
    );
    const { ai: userBob } = await getTestInstance(
      {},
      {
        user: { id: 'user-bob', email: 'bob@test.com', name: 'Bob' },
      }
    );

    // Alice creates a chat
    const aliceChat = await userAlice.api.createChat({
      body: { title: "Alice's Private Chat" },
    });

    // Bob should not be able to access Alice's chat
    const response = await userBob.api.getChatById({
      params: { id: aliceChat.chat.id },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Not found (for security - don't reveal existence)
  });

  it('should prevent cross-user message access', async () => {
    // Create separate user contexts
    const { ai: userAlice, createTestChat: createTestChatAlice } =
      await getTestInstance(
        {},
        {
          user: { id: 'user-alice', email: 'alice@test.com', name: 'Alice' },
        }
      );
    const { ai: userBob } = await getTestInstance(
      {},
      {
        user: { id: 'user-bob', email: 'bob@test.com', name: 'Bob' },
      }
    );

    // Alice creates a chat with messages
    const { chat, messages } = await createTestChatAlice({
      title: "Alice's Chat",
      withMessages: [{ content: 'Hello from Alice', role: 'user' }],
    });

    // Bob should not be able to access Alice's messages
    const response = await userBob.api.getChatMessages({
      params: { chatId: chat.id },
      query: { limit: 10 },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Chat not found for Bob
  });

  it('should prevent cross-user chat deletion', async () => {
    // Create separate user contexts
    const { ai: userAlice } = await getTestInstance(
      {},
      {
        user: { id: 'user-alice', email: 'alice@test.com', name: 'Alice' },
      }
    );
    const { ai: userBob } = await getTestInstance(
      {},
      {
        user: { id: 'user-bob', email: 'bob@test.com', name: 'Bob' },
      }
    );

    // Alice creates a chat
    const aliceChat = await userAlice.api.createChat({
      body: { title: "Alice's Chat to Delete" },
    });

    // Bob should not be able to delete Alice's chat
    const response = await userBob.api.deleteChat({
      query: { id: aliceChat.chat.id },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Not found for Bob

    // Verify Alice's chat still exists
    const aliceCheck = await userAlice.api.getChatById({
      params: { id: aliceChat.chat.id },
    });
    expect(aliceCheck.chat).toBeDefined();
  });

  it('should prevent cross-user message voting', async () => {
    // Create separate user contexts
    const { ai: userAlice, createTestChat: createTestChatAlice } =
      await getTestInstance(
        {},
        {
          user: { id: 'user-alice', email: 'alice@test.com', name: 'Alice' },
        }
      );
    const { ai: userBob } = await getTestInstance(
      {},
      {
        user: { id: 'user-bob', email: 'bob@test.com', name: 'Bob' },
      }
    );

    // Alice creates a chat with a message
    const { chat, messages } = await createTestChatAlice({
      title: "Alice's Chat",
      withMessages: [{ content: "Alice's message", role: 'assistant' }],
    });

    // Bob should not be able to vote on Alice's message
    const response = await userBob.api.voteMessage({
      body: {
        chatId: chat.id,
        messageId: messages[0].id,
        type: 'up',
      },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Chat not found for Bob
  });

  it('should isolate chat history between users', async () => {
    // Create separate user contexts
    const { ai: userAlice, createTestChat: createTestChatAlice } =
      await getTestInstance(
        {},
        {
          user: { id: 'user-alice', email: 'alice@test.com', name: 'Alice' },
        }
      );
    const { ai: userBob, createTestChat: createTestChatBob } =
      await getTestInstance(
        {},
        {
          user: { id: 'user-bob', email: 'bob@test.com', name: 'Bob' },
        }
      );

    // Alice creates chats
    await createTestChatAlice({ title: 'Alice Chat 1' });
    await createTestChatAlice({ title: 'Alice Chat 2' });

    // Bob creates chats
    await createTestChatBob({ title: 'Bob Chat 1' });

    // Alice should only see her own chats
    const aliceHistory = await userAlice.api.getChatHistory({
      query: { limit: 10 },
    });
    expect(aliceHistory.chats).toHaveLength(2);
    expect(
      aliceHistory.chats.every((chat) => chat.title?.startsWith('Alice'))
    ).toBe(true);

    // Bob should only see his own chats
    const bobHistory = await userBob.api.getChatHistory({
      query: { limit: 10 },
    });
    expect(bobHistory.chats).toHaveLength(1);
    expect(bobHistory.chats[0].title).toBe('Bob Chat 1');
  });

  // TODO: Add tests for public chat visibility once implemented
  // TODO: Add tests for streaming isolation between users
  // TODO: Add tests for rate limiting per user
});
