import { describe, expect, it, vi } from 'vitest';
import {
  createErrorProvider,
  createMockProviders,
} from '../test-utils/mock-providers';
import { getTestInstance } from '../test-utils/test-instance';
import type { UnblockedProviders } from '../types';

describe('Provider Failover Integration', () => {
  it('should handle provider errors gracefully', async () => {
    const errorProvider = createErrorProvider(
      new Error('Provider temporarily unavailable')
    );

    const { ai, createTestChat } = await getTestInstance({
      providers: errorProvider,
    });

    const { chat } = await createTestChat({ title: 'Error Handling Test' });

    const response = await ai.api.chatStream({
      params: { id: chat.id },
      body: {
        message: {
          id: `error-test-${Date.now()}`,
          parts: [
            { type: 'text', content: 'This should trigger provider error' },
          ],
        },
        selectedChatModel: 'error-model',
        selectedVisibilityType: 'private',
      },
      asResponse: true,
    });

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.message).toContain('not found');
  });

  it('should handle multiple provider configuration', async () => {
    const providers = createMockProviders();

    const { ai } = await getTestInstance({
      providers,
      chat: {
        model: 'gpt-4',
      },
    });

    // Test getting models from all providers
    const modelsResponse = await ai.api.getModels();

    expect(modelsResponse.models.length).toBeGreaterThan(2);

    // Should have models from both OpenAI and Anthropic
    const openaiModels = modelsResponse.models.filter(
      (m) => m.provider === 'openai'
    );
    const anthropicModels = modelsResponse.models.filter(
      (m) => m.provider === 'anthropic'
    );

    expect(openaiModels.length).toBe(2); // gpt-4, gpt-3.5-turbo
    expect(anthropicModels.length).toBe(2); // claude-3-opus, claude-3-sonnet
  });

  it('should handle model selection across providers', async () => {
    const { ai, createTestChat } = await getTestInstance({
      providers: createMockProviders(),
    });

    const { chat } = await createTestChat({ title: 'Multi-Provider Test' });

    // Test different models from different providers
    const testCases = [
      { model: 'gpt-4', provider: 'openai' },
      { model: 'claude-3-opus', provider: 'anthropic' },
      { model: 'gpt-3.5-turbo', provider: 'openai' },
      { model: 'claude-3-sonnet', provider: 'anthropic' },
    ];

    for (const testCase of testCases) {
      const response = await ai.api.streamMessage({
        params: { chatId: chat.id },
        body: {
          message: {
            id: `multi-provider-${testCase.model}-${Date.now()}`,
            role: 'user',
            content: `Test with ${testCase.model}`,
            parts: [{ type: 'text', content: `Test with ${testCase.model}` }],
          },
          model: testCase.model,
        },
      });

      expect(response.message).toBeDefined();
      expect((response as any).status).toBe('streaming_mock');
    }
  });

  it('should handle provider getModel errors', async () => {
    // Create providers where getModel throws for specific models
    const faultyProviders: UnblockedProviders = {
      faulty: {
        getModel: vi.fn().mockImplementation((modelId: string) => {
          if (modelId === 'broken-model') {
            throw new Error('Model initialization failed');
          }
          return createMockProviders().openai.getModel('gpt-4');
        }),
        models: [
          {
            id: 'broken-model',
            name: 'Broken Model',
            provider: 'faulty',
            capabilities: ['chat'] as const,
          },
          {
            id: 'working-model',
            name: 'Working Model',
            provider: 'faulty',
            capabilities: ['chat'] as const,
          },
        ],
        metadata: {
          provider: 'faulty',
          models: [],
        } as any,
      },
    };

    const { ai, createTestChat } = await getTestInstance({
      providers: faultyProviders,
    });

    const { chat } = await createTestChat({ title: 'Faulty Provider Test' });

    // Test with broken model
    const brokenResponse = await ai.api.streamMessage({
      params: { chatId: chat.id },
      body: {
        message: {
          id: `broken-model-test-${Date.now()}`,
          role: 'user',
          content: 'Test with broken model',
          parts: [{ type: 'text', content: 'Test with broken model' }],
        },
        model: 'broken-model',
      },
      asResponse: true,
    });

    expect(brokenResponse.status).toBe(400);

    // Test with working model
    const workingResponse = await ai.api.streamMessage({
      params: { chatId: chat.id },
      body: {
        message: {
          id: `working-model-test-${Date.now()}`,
          role: 'user',
          content: 'Test with working model',
          parts: [{ type: 'text', content: 'Test with working model' }],
        },
        model: 'working-model',
      },
    });

    expect(workingResponse.message).toBeDefined();
  });

  it('should handle rate limiting per provider', async () => {
    const { ai, createTestChat } = await getTestInstance({
      providers: createMockProviders(),
      chat: {
        model: 'gpt-4',
        rateLimiting: {
          enabled: true,
          messagesPerDay: 1,
        },
      },
    });

    const { chat } = await createTestChat({ title: 'Provider Rate Limit' });

    // First message should succeed
    const firstResponse = await ai.api.chatStream({
      params: { id: chat.id },
      body: {
        message: {
          id: `rate-1-${Date.now()}`,
          parts: [{ type: 'text', content: 'First message' }],
        },
        selectedChatModel: 'gpt-4',
        selectedVisibilityType: 'private',
      },
      asResponse: true,
    });

    expect(firstResponse.status).toBe(200);

    // Second message should hit rate limit
    const secondResponse = await ai.api.chatStream({
      params: { id: chat.id },
      body: {
        message: {
          id: `rate-2-${Date.now()}`,
          parts: [{ type: 'text', content: 'Second message' }],
        },
        selectedChatModel: 'gpt-4',
        selectedVisibilityType: 'private',
      },
      asResponse: true,
    });

    expect(secondResponse.status).toBe(429);
  });

  it('should handle invalid model selections', async () => {
    const { ai, createTestChat } = await getTestInstance({
      providers: createMockProviders(),
    });

    const { chat } = await createTestChat({ title: 'Invalid Model Test' });

    // Test with completely invalid model
    const invalidResponse = await ai.api.streamMessage({
      params: { chatId: chat.id },
      body: {
        message: {
          id: `invalid-model-${Date.now()}`,
          role: 'user',
          content: 'Test invalid model',
          parts: [{ type: 'text', content: 'Test invalid model' }],
        },
        model: 'totally-fake-model',
      },
      asResponse: true,
    });

    expect(invalidResponse.status).toBe(400);
    const error = await invalidResponse.json();
    expect(error.message).toContain('not found');
  });

  it('should handle provider metadata correctly', async () => {
    const { ai } = await getTestInstance({
      providers: createMockProviders(),
    });

    const modelsResponse = await ai.api.getModels();

    // Verify each model has correct provider metadata
    modelsResponse.models.forEach((model) => {
      expect(model.provider).toBeDefined();
      expect(model.id).toBeDefined();
      expect(model.name).toBeDefined();
      expect(model.capabilities).toBeDefined();
      expect(Array.isArray(model.capabilities)).toBe(true);
    });

    // Verify OpenAI models
    const gpt4 = modelsResponse.models.find((m) => m.id === 'gpt-4');
    expect(gpt4?.provider).toBe('openai');
    expect(gpt4?.capabilities).toContain('chat');
    expect(gpt4?.capabilities).toContain('tools');

    // Verify Anthropic models
    const claude = modelsResponse.models.find((m) => m.id === 'claude-3-opus');
    expect(claude?.provider).toBe('anthropic');
    expect(claude?.capabilities).toContain('chat');
    expect(claude?.capabilities).toContain('tools');
    expect(claude?.capabilities).toContain('vision');
  });

  it('should handle provider configuration validation', async () => {
    // Test with empty providers
    const { ai } = await getTestInstance({
      providers: {},
    });

    const emptyResponse = await ai.api.getModels();
    expect(emptyResponse.models).toEqual([]);
    if ((emptyResponse as any).error) {
      expect((emptyResponse as any).error).toContain(
        'No AI providers configured'
      );
    }

    // Test with invalid provider structure
    const invalidProviders = {
      invalid: {
        // Missing required properties
        models: [],
      },
    } as any;

    const { ai: invalidAi } = await getTestInstance({
      providers: invalidProviders,
    });

    const invalidModelsResponse = await invalidAi.api.getModels();
    expect(invalidModelsResponse.models).toEqual([]);
    // Error property may be present but is optional
    if ('error' in invalidModelsResponse) {
      expect(typeof invalidModelsResponse.error).toBe('string');
    }
  });
});
