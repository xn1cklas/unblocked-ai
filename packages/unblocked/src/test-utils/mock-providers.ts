import type { LanguageModelV2 } from '@ai-sdk/provider';
import { vi } from 'vitest';
import type { UnblockedProviders } from '../types';

/**
 * Creates a mock stream response for testing AI streaming functionality
 */
function createMockStream(chunks: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield {
          type: 'text-delta' as const,
          textDelta: chunk,
        };
      }
    },
  };
}

/**
 * Mock language model for testing
 */
export function createMockLanguageModel(modelId: string): LanguageModelV2 {
  return {
    provider: 'mock-provider',
    modelId,
    // Required AI SDK v2 properties
    specificationVersion: 'v2',
    supportedUrls: {},
    // Required methods
    doGenerate: vi.fn().mockImplementation(async () => {
      return {
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        text: 'Mock response from ' + modelId,
        toolCalls: [],
        warnings: [],
      };
    }),
    doStream: vi.fn().mockImplementation(async () => {
      const chunks = ['Hello', ' from', ' mock', ' ', modelId];
      return {
        stream: createMockStream(chunks),
        warnings: [],
      };
    }),
    // Optional properties
    supportsStructuredOutputs: true,
    defaultObjectGenerationMode: 'json',
    supportsImageUrls: false,
  } as LanguageModelV2;
}

/**
 * Creates mock AI providers for testing
 */
export function createMockProviders(): UnblockedProviders {
  const openaiModels = [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'openai',
      capabilities: ['chat', 'tools'],
      contextWindow: 8192,
      pricing: { inputTokens: 0.03, outputTokens: 0.06 },
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      capabilities: ['chat'],
      contextWindow: 4096,
      pricing: { inputTokens: 0.001, outputTokens: 0.002 },
    },
  ];

  const anthropicModels = [
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      capabilities: ['chat', 'tools', 'vision'],
      contextWindow: 200_000,
      pricing: { inputTokens: 0.015, outputTokens: 0.075 },
    },
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      capabilities: ['chat', 'tools'],
      contextWindow: 200_000,
      pricing: { inputTokens: 0.003, outputTokens: 0.015 },
    },
  ];

  return {
    openai: {
      getModel: vi.fn().mockImplementation((modelId: string) => {
        if (!openaiModels.find((m) => m.id === modelId)) {
          throw new Error(`Model ${modelId} not found in OpenAI provider`);
        }
        return createMockLanguageModel(modelId);
      }),
      models: openaiModels,
      metadata: {
        provider: 'openai',
        models: openaiModels,
      } as any,
    },
    anthropic: {
      getModel: vi.fn().mockImplementation((modelId: string) => {
        if (!anthropicModels.find((m) => m.id === modelId)) {
          throw new Error(`Model ${modelId} not found in Anthropic provider`);
        }
        return createMockLanguageModel(modelId);
      }),
      models: anthropicModels,
      metadata: {
        provider: 'anthropic',
        models: anthropicModels,
      } as any,
    },
  };
}

/**
 * Creates a mock provider that simulates errors
 */
export function createErrorProvider(error: Error): UnblockedProviders {
  return {
    error: {
      getModel: vi.fn().mockImplementation(() => {
        throw error;
      }),
      models: [],
      metadata: {
        provider: 'error',
        models: [],
      } as any,
    },
  };
}

/**
 * Creates a mock provider with configurable delays
 */
export function createDelayedProvider(delayMs: number): UnblockedProviders {
  const delayedModel = createMockLanguageModel('delayed-model');

  // Add actual delay to the doStream method
  delayedModel.doStream = vi.fn().mockImplementation(async () => {
    // Add the delay before processing
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Return the original stream with delay
    const chunks = ['Delayed', ' response', ' from', ' mock'];
    return {
      stream: {
        async *[Symbol.asyncIterator]() {
          for (const chunk of chunks) {
            // Add small delay between chunks
            await new Promise((resolve) =>
              setTimeout(resolve, delayMs / chunks.length)
            );
            yield {
              type: 'text-delta' as const,
              textDelta: chunk,
            };
          }
        },
      },
      warnings: [],
    };
  });

  return {
    delayed: {
      getModel: vi.fn().mockImplementation((modelId: string) => {
        if (modelId !== 'delayed-model') {
          throw new Error(`Model ${modelId} not found in delayed provider`);
        }
        return delayedModel;
      }),
      models: [
        {
          id: 'delayed-model',
          name: 'Delayed Model',
          provider: 'delayed',
          capabilities: ['chat'],
        },
      ],
      metadata: {
        provider: 'delayed',
        models: [
          {
            id: 'delayed-model',
            name: 'Delayed Model',
            provider: 'delayed',
            capabilities: ['chat'],
          },
        ],
      } as any,
    },
  };
}
