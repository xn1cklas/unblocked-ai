import { describe, expect, it, vi } from 'vitest';
import { getTestInstance } from '../../test-utils/test-instance';

describe('models', () => {
  describe('getModels', () => {
    it('should return empty array when no providers configured', async () => {
      const { ai } = await getTestInstance({
        secret: 'test',
      });

      const response = await ai.api.getModels({
        asResponse: true,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.models).toEqual([]);
      expect(data.error).toBe(
        'No AI providers configured. Please configure providers in UnblockedOptions.'
      );
    });

    it('should return models from providers', async () => {
      const { ai } = await getTestInstance({
        secret: 'test',
        providers: {
          openai: {
            getModel: vi.fn(),
            models: [
              { id: 'gpt-4', name: 'GPT-4', capabilities: ['chat', 'tools'] },
              { id: 'gpt-3.5-turbo', name: 'GPT-3.5', capabilities: ['chat'] },
            ],
          },
          anthropic: {
            getModel: vi.fn(),
            models: [
              {
                id: 'claude-3',
                name: 'Claude 3',
                capabilities: ['chat', 'tools'],
              },
            ],
          },
        },
        chat: {
          model: 'gpt-4',
        },
        titles: {
          model: 'gpt-3.5-turbo',
        },
      });

      const response = await ai.api.getModels();

      expect(response.models).toHaveLength(3);
      expect(response.models[0]).toMatchObject({
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
      });
      expect(response.defaultModels).toEqual({
        chat: 'gpt-4',
        documents: undefined,
        titles: 'gpt-3.5-turbo',
        suggestions: undefined,
        tools: undefined,
      });
    });

    it('should filter models by user entitlements', async () => {
      const { ai } = await getTestInstance({
        secret: 'test',
        providers: {
          openai: {
            getModel: vi.fn(),
            models: [
              { id: 'gpt-4', name: 'GPT-4', capabilities: ['chat', 'tools'] },
              { id: 'gpt-3.5-turbo', name: 'GPT-3.5', capabilities: ['chat'] },
            ],
          },
        },
        user: {
          getUser: async () => ({
            id: 'test-user',
            name: 'Test User',
            entitlements: {
              allowedModels: ['gpt-3.5-turbo'],
              maxMessagesPerDay: 100,
            },
          }),
        },
      });

      const response = await ai.api.getModels();

      expect(response.models).toHaveLength(1);
      expect(response.models[0].id).toBe('gpt-3.5-turbo');
    });

    it('should exclude deprecated models by default', async () => {
      const { ai } = await getTestInstance({
        secret: 'test',
        models: [
          { id: 'gpt-4', name: 'GPT-4' },
          { id: 'gpt-3', name: 'GPT-3', deprecated: true },
          { id: 'claude-2', name: 'Claude 2' },
        ],
      });

      const response = await ai.api.getModels();

      expect(response.models).toHaveLength(2);
      expect(response.models.map((m) => m.id)).toEqual(['gpt-4', 'claude-2']);
    });

    it('should include deprecated models when requested', async () => {
      const { ai } = await getTestInstance({
        secret: 'test',
        models: [
          { id: 'gpt-4', name: 'GPT-4' },
          { id: 'gpt-3', name: 'GPT-3', deprecated: true },
        ],
      });

      const response = await ai.api.getModels({
        query: { includeDeprecated: 'true' },
      });

      expect(response.models).toHaveLength(2);
      expect(response.models.map((m) => m.id).sort()).toEqual([
        'gpt-3',
        'gpt-4',
      ]);
    });

    it('should return empty array for unauthenticated users', async () => {
      const { ai } = await getTestInstance({
        secret: 'test',
        models: [{ id: 'gpt-4', name: 'GPT-4' }],
        user: {
          getUser: async () => null,
        },
      });

      const response = await ai.api.getModels();

      expect(response.models).toEqual([]);
    });
  });

  describe('getModelCapabilities', () => {
    it('should return model details', async () => {
      const { ai } = await getTestInstance({
        secret: 'test',
        providers: {
          openai: {
            getModel: vi.fn(),
            models: [
              {
                id: 'gpt-4',
                name: 'GPT-4',
                capabilities: ['chat', 'tools'],
                contextWindow: 8192,
                pricing: { inputTokens: 0.03, outputTokens: 0.06 },
              },
            ],
          },
        },
        chat: { model: 'gpt-4' },
        tools: { model: 'gpt-4' },
      });

      const response = await ai.api.getModelCapabilities({
        params: { modelId: 'gpt-4' },
      });

      expect(response.model).toMatchObject({
        id: 'gpt-4',
        name: 'GPT-4',
        capabilities: ['chat', 'tools'],
        contextWindow: 8192,
      });
      expect(response.features).toEqual({
        chat: true,
        documents: false,
        titles: false,
        suggestions: false,
        tools: true,
      });
    });

    it('should throw error for unknown model', async () => {
      const { ai } = await getTestInstance({
        secret: 'test',
      });

      const response = await ai.api.getModelCapabilities({
        params: { modelId: 'unknown-model' },
        asResponse: true,
      });

      expect(response.status).toBe(404);
      const error = await response.json();
      expect(error.message).toContain('Model unknown-model not found');
    });

    it('should throw error if user lacks access', async () => {
      const { ai } = await getTestInstance({
        secret: 'test',
        models: [{ id: 'gpt-4', name: 'GPT-4' }],
        user: {
          getUser: async () => ({
            id: 'test-user',
            name: 'Test User',
            entitlements: {
              allowedModels: ['gpt-3.5-turbo'],
              maxMessagesPerDay: 100,
            },
          }),
        },
      });

      const response = await ai.api.getModelCapabilities({
        params: { modelId: 'gpt-4' },
        asResponse: true,
      });

      expect(response.status).toBe(403);
      const error = await response.json();
      expect(error.message).toContain('Access denied to model gpt-4');
    });
  });
});
