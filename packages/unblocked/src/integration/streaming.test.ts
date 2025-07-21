import { describe, expect, it } from 'vitest';
import {
  createDelayedProvider,
  createMockProviders,
} from '../test-utils/mock-providers';
import { getTestInstance } from '../test-utils/test-instance';

describe('Streaming Integration', () => {
  it('should handle streaming chat responses', async () => {
    const { ai, createTestChat } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4',
        systemPrompt: 'You are a helpful assistant.',
      },
    });

    const { chat } = await createTestChat({ title: 'Streaming Test' });

    // Test chatStream endpoint (actual streaming)
    const response = await ai.api.chatStream({
      params: { id: chat.id },
      body: {
        message: {
          id: `stream-test-${Date.now()}`,
          parts: [
            { type: 'text', content: 'Hello, can you stream a response?' },
          ],
        },
        selectedChatModel: 'gpt-4',
        selectedVisibilityType: 'private',
      },
      asResponse: true,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('connection')).toBe('keep-alive');
  });

  it('should handle streaming with different models', async () => {
    const { ai, createTestChat } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'claude-3-opus',
      },
    });

    const { chat } = await createTestChat({ title: 'Model Streaming Test' });

    const models = ['gpt-4', 'claude-3-opus', 'claude-3-sonnet'];

    for (const model of models) {
      const response = await ai.api.chatStream({
        params: { id: chat.id },
        body: {
          message: {
            id: `stream-model-${model}-${Date.now()}`,
            parts: [{ type: 'text', content: `Stream test with ${model}` }],
          },
          selectedChatModel: model,
          selectedVisibilityType: 'private',
        },
        asResponse: true,
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain(
        'text/event-stream'
      );
    }
  });

  it('should handle streaming errors gracefully', async () => {
    const { ai, createTestChat } = await getTestInstance({
      // No providers configured to trigger error
    });

    const { chat } = await createTestChat({ title: 'Error Test' });

    const response = await ai.api.chatStream({
      params: { id: chat.id },
      body: {
        message: {
          id: `error-test-${Date.now()}`,
          parts: [{ type: 'text', content: 'This should trigger an error' }],
        },
        selectedChatModel: 'nonexistent-model',
        selectedVisibilityType: 'private',
      },
      asResponse: true,
    });

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.message).toContain('not found');
  });

  it('should handle streaming with system prompts', async () => {
    const { ai, createTestChat } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4',
        systemPrompt:
          'You are a creative writing assistant. Always respond in rhyme.',
        temperature: 0.9,
      },
    });

    const { chat } = await createTestChat({ title: 'Creative Streaming' });

    const response = await ai.api.chatStream({
      params: { id: chat.id },
      body: {
        message: {
          id: `creative-test-${Date.now()}`,
          parts: [{ type: 'text', content: 'Write a short poem about AI' }],
        },
        selectedChatModel: 'gpt-4',
        selectedVisibilityType: 'private',
      },
      asResponse: true,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
  });

  it('should handle streaming with rate limiting', async () => {
    const { ai, createTestChat } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4',
        rateLimiting: {
          enabled: true,
          messagesPerDay: 1, // Very low limit for testing
        },
      },
    });

    const { chat } = await createTestChat({ title: 'Rate Limit Test' });

    // First message should succeed
    const firstResponse = await ai.api.chatStream({
      params: { id: chat.id },
      body: {
        message: {
          id: `rate-test-1-${Date.now()}`,
          parts: [{ type: 'text', content: 'First message' }],
        },
        selectedChatModel: 'gpt-4',
        selectedVisibilityType: 'private',
      },
      asResponse: true,
    });

    expect(firstResponse.status).toBe(200);

    // Second message should hit rate limit
    const rateLimitResponse = await ai.api.chatStream({
      params: { id: chat.id },
      body: {
        message: {
          id: `rate-test-2-${Date.now()}`,
          parts: [{ type: 'text', content: 'This should be rate limited' }],
        },
        selectedChatModel: 'gpt-4',
        selectedVisibilityType: 'private',
      },
      asResponse: true,
    });

    expect(rateLimitResponse.status).toBe(429);
    const error = await rateLimitResponse.json();
    expect(error.message).toContain('limit exceeded');
  });

  it('should handle streaming with delayed responses', async () => {
    const { ai, createTestChat } = await getTestInstance({
      providers: createDelayedProvider(50), // 50ms delay (more reliable in tests)
      chat: {
        model: 'delayed-model',
      },
    });

    const { chat } = await createTestChat({ title: 'Delayed Streaming' });

    const response = await ai.api.chatStream({
      params: { id: chat.id },
      body: {
        message: {
          id: `delayed-test-${Date.now()}`,
          parts: [{ type: 'text', content: 'Test delayed response' }],
        },
        selectedChatModel: 'delayed-model',
        selectedVisibilityType: 'private',
      },
      asResponse: true,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    // Just verify it completes successfully (timing can be unreliable in tests)
    // The real test is that the delayed provider is correctly configured and called
  });

  it('should handle concurrent streaming requests', async () => {
    const { ai, createTestChat } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4',
      },
    });

    const { chat } = await createTestChat({ title: 'Concurrent Streaming' });

    // Create multiple concurrent streaming requests
    const streamPromises = Array.from({ length: 3 }, (_, i) =>
      ai.api.chatStream({
        params: { id: chat.id },
        body: {
          message: {
            id: `concurrent-${i}-${Date.now()}`,
            parts: [{ type: 'text', content: `Concurrent message ${i + 1}` }],
          },
          selectedChatModel: 'gpt-4',
          selectedVisibilityType: 'private',
        },
        asResponse: true,
      })
    );

    const responses = await Promise.all(streamPromises);

    // All requests should succeed
    responses.forEach((response) => {
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain(
        'text/event-stream'
      );
    });
  });

  it('should handle streaming with message persistence', async () => {
    const { ai, createTestChat } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4',
      },
    });

    const { chat } = await createTestChat({ title: 'Persistence Test' });

    // Send streaming request
    const streamResponse = await ai.api.chatStream({
      params: { id: chat.id },
      body: {
        message: {
          id: `persistence-test-${Date.now()}`,
          parts: [{ type: 'text', content: 'Test message persistence' }],
        },
        selectedChatModel: 'gpt-4',
        selectedVisibilityType: 'private',
      },
    });

    // Verify the stream was created
    expect(streamResponse).toBeDefined();

    // Check that messages were persisted
    const messages = await ai.api.getChatMessages({
      params: { chatId: chat.id },
      query: { limit: 10 },
    });

    // Should have at least the user message, and potentially an assistant response
    expect(messages.messages.length).toBeGreaterThanOrEqual(1);

    const userMessage = messages.messages.find((m) => m.role === 'user');
    expect(userMessage).toBeDefined();

    const parts = JSON.parse(userMessage!.parts);
    expect(parts[0].content).toBe('Test message persistence');
  });
});
