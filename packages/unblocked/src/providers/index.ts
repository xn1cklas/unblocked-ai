/**
 * Bundled AI providers for Unblocked
 *
 * This module provides pre-configured AI providers with smart defaults
 * for common use cases. Users can either use these bundled providers
 * or bring their own custom providers.
 *
 * Note: This is a simplified implementation that focuses on the core functionality
 * needed by unblocked. The AI SDK provider constructors in 2.0.0-beta have different
 * APIs that require more complex configuration.
 */

import { NoSuchModelError } from '@ai-sdk/provider';
import type {
  EmbeddingModelV2,
  ImageModelV2,
  LanguageModelV2,
  UnblockedAIProvider,
} from '../types/ai';

/**
 * Pre-configured OpenAI provider with smart defaults
 */
export const openai = (config?: {
  apiKey?: string;
  baseURL?: string;
  organization?: string;
  project?: string;
}): UnblockedAIProvider => {
  // Import OpenAI provider dynamically to avoid bundle issues
  let openaiProvider: any;
  try {
    openaiProvider = require('@ai-sdk/openai');
  } catch (error) {
    console.warn(
      'OpenAI provider not available. Install @ai-sdk/openai to use OpenAI models.'
    );
  }

  return {
    // ProviderV2 required methods
    languageModel: (modelId: string): LanguageModelV2 => {
      if (!openaiProvider) {
        throw new NoSuchModelError({ modelId, modelType: 'languageModel' });
      }

      const openaiInstance = openaiProvider.createOpenAI({
        apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
        baseURL: config?.baseURL,
        organization: config?.organization,
        project: config?.project,
      });

      return openaiInstance.languageModel(modelId);
    },
    textEmbeddingModel: (modelId: string): EmbeddingModelV2<string> => {
      if (!openaiProvider) {
        throw new NoSuchModelError({
          modelId,
          modelType: 'textEmbeddingModel',
        });
      }

      const openaiInstance = openaiProvider.createOpenAI({
        apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
        baseURL: config?.baseURL,
        organization: config?.organization,
        project: config?.project,
      });

      return openaiInstance.textEmbeddingModel(modelId);
    },
    imageModel: (modelId: string): ImageModelV2 => {
      if (!openaiProvider) {
        throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
      }

      const openaiInstance = openaiProvider.createOpenAI({
        apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
        baseURL: config?.baseURL,
        organization: config?.organization,
        project: config?.project,
      });

      return openaiInstance.imageModel(modelId);
    },

    // Unblocked-specific methods
    getModel: (modelName: string) => {
      if (!openaiProvider) {
        throw new NoSuchModelError({
          modelId: modelName,
          modelType: 'languageModel',
        });
      }

      const openaiInstance = openaiProvider.createOpenAI({
        apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
        baseURL: config?.baseURL,
        organization: config?.organization,
        project: config?.project,
      });

      return openaiInstance.languageModel(modelName);
    },
    metadata: {
      provider: 'openai',
      website: 'https://openai.com',
      documentation: 'https://platform.openai.com/docs',
      models: [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          capabilities: ['chat', 'tools', 'vision'],
          contextWindow: 128_000,
          pricing: { inputTokens: 2.5, outputTokens: 10 },
        },
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o Mini',
          capabilities: ['chat', 'tools', 'vision'],
          contextWindow: 128_000,
          pricing: { inputTokens: 0.15, outputTokens: 0.6 },
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          capabilities: ['chat', 'tools', 'vision'],
          contextWindow: 128_000,
          pricing: { inputTokens: 10, outputTokens: 30 },
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          capabilities: ['chat', 'tools'],
          contextWindow: 16_385,
          pricing: { inputTokens: 0.5, outputTokens: 1.5 },
        },
      ],
    },
  };
};

/**
 * Pre-configured Anthropic provider with smart defaults
 */
export const anthropic = (config?: {
  apiKey?: string;
  baseURL?: string;
}): UnblockedAIProvider => {
  // Import Anthropic provider dynamically to avoid bundle issues
  let anthropicProvider: any;
  try {
    anthropicProvider = require('@ai-sdk/anthropic');
  } catch (error) {
    console.warn(
      'Anthropic provider not available. Install @ai-sdk/anthropic to use Anthropic models.'
    );
  }

  return {
    // ProviderV2 required methods
    languageModel: (modelId: string): LanguageModelV2 => {
      if (!anthropicProvider) {
        throw new NoSuchModelError({ modelId, modelType: 'languageModel' });
      }

      const anthropicInstance = anthropicProvider.createAnthropic({
        apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
        baseURL: config?.baseURL,
      });

      return anthropicInstance.languageModel(modelId);
    },
    textEmbeddingModel: (modelId: string): EmbeddingModelV2<string> => {
      // Anthropic doesn't provide text embedding models
      throw new NoSuchModelError({ modelId, modelType: 'textEmbeddingModel' });
    },
    imageModel: (modelId: string): ImageModelV2 => {
      // Anthropic doesn't provide image generation models
      throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
    },

    // Unblocked-specific methods
    getModel: (modelName: string) => {
      if (!anthropicProvider) {
        throw new NoSuchModelError({
          modelId: modelName,
          modelType: 'languageModel',
        });
      }

      const anthropicInstance = anthropicProvider.createAnthropic({
        apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
        baseURL: config?.baseURL,
      });

      return anthropicInstance.languageModel(modelName);
    },
    metadata: {
      provider: 'anthropic',
      website: 'https://anthropic.com',
      documentation: 'https://docs.anthropic.com',
      models: [
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          capabilities: ['chat', 'tools', 'vision'],
          contextWindow: 200_000,
          pricing: { inputTokens: 3, outputTokens: 15 },
        },
        {
          id: 'claude-3-5-haiku-20241022',
          name: 'Claude 3.5 Haiku',
          capabilities: ['chat', 'tools', 'vision'],
          contextWindow: 200_000,
          pricing: { inputTokens: 0.8, outputTokens: 4 },
        },
        {
          id: 'claude-3-opus-20240229',
          name: 'Claude 3 Opus',
          capabilities: ['chat', 'tools', 'vision'],
          contextWindow: 200_000,
          pricing: { inputTokens: 15, outputTokens: 75 },
        },
      ],
    },
  };
};

/**
 * Pre-configured Google provider with smart defaults
 */
export const google = (config?: {
  apiKey?: string;
  baseURL?: string;
}): UnblockedAIProvider => {
  return {
    // ProviderV2 required methods
    languageModel: (modelId: string): LanguageModelV2 => {
      // TODO: Implement proper Google language model creation
      throw new NoSuchModelError({ modelId, modelType: 'languageModel' });
    },
    textEmbeddingModel: (modelId: string): EmbeddingModelV2<string> => {
      // TODO: Implement proper Google text embedding model creation
      throw new NoSuchModelError({ modelId, modelType: 'textEmbeddingModel' });
    },
    imageModel: (modelId: string): ImageModelV2 => {
      // TODO: Implement proper Google image model creation
      throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
    },

    // Unblocked-specific methods
    getModel: (modelName: string) => {
      return { modelId: modelName, provider: 'google' } as any;
    },
    metadata: {
      provider: 'google',
      website: 'https://ai.google.dev',
      documentation: 'https://ai.google.dev/docs',
      models: [
        {
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          capabilities: ['chat', 'tools', 'vision'],
          contextWindow: 2_097_152,
          pricing: { inputTokens: 1.25, outputTokens: 5 },
        },
        {
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          capabilities: ['chat', 'tools', 'vision'],
          contextWindow: 1_048_576,
          pricing: { inputTokens: 0.075, outputTokens: 0.3 },
        },
        {
          id: 'gemini-1.5-flash-8b',
          name: 'Gemini 1.5 Flash-8B',
          capabilities: ['chat', 'tools', 'vision'],
          contextWindow: 1_048_576,
          pricing: { inputTokens: 0.0375, outputTokens: 0.15 },
        },
      ],
    },
  };
};

/**
 * Pre-configured Mistral provider with smart defaults
 */
export const mistral = (config?: {
  apiKey?: string;
  baseURL?: string;
}): UnblockedAIProvider => {
  return {
    // ProviderV2 required methods
    languageModel: (modelId: string): LanguageModelV2 => {
      // TODO: Implement proper Mistral language model creation
      throw new NoSuchModelError({ modelId, modelType: 'languageModel' });
    },
    textEmbeddingModel: (modelId: string): EmbeddingModelV2<string> => {
      // TODO: Implement proper Mistral text embedding model creation
      throw new NoSuchModelError({ modelId, modelType: 'textEmbeddingModel' });
    },
    imageModel: (modelId: string): ImageModelV2 => {
      // TODO: Implement proper Mistral image model creation
      throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
    },

    // Unblocked-specific methods
    getModel: (modelName: string) => {
      return { modelId: modelName, provider: 'mistral' } as any;
    },
    metadata: {
      provider: 'mistral',
      website: 'https://mistral.ai',
      documentation: 'https://docs.mistral.ai',
      models: [
        {
          id: 'mistral-large-latest',
          name: 'Mistral Large',
          capabilities: ['chat', 'tools'],
          contextWindow: 128_000,
          pricing: { inputTokens: 2, outputTokens: 6 },
        },
        {
          id: 'mistral-small-latest',
          name: 'Mistral Small',
          capabilities: ['chat', 'tools'],
          contextWindow: 128_000,
          pricing: { inputTokens: 0.2, outputTokens: 0.6 },
        },
        {
          id: 'open-mistral-nemo',
          name: 'Mistral Nemo',
          capabilities: ['chat'],
          contextWindow: 128_000,
          pricing: { inputTokens: 0.15, outputTokens: 0.15 },
        },
      ],
    },
  };
};

/**
 * Pre-configured xAI (Grok) provider with smart defaults
 */
export const xai = (config?: {
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
}): UnblockedAIProvider => {
  // Import xAI provider dynamically to avoid bundle issues
  let xaiProvider: any;
  try {
    xaiProvider = require('@ai-sdk/xai');
  } catch (error) {
    console.warn(
      'xAI provider not available. Install @ai-sdk/xai to use Grok models.'
    );
  }

  return {
    // ProviderV2 required methods
    languageModel: (modelId: string): LanguageModelV2 => {
      if (!xaiProvider) {
        throw new NoSuchModelError({ modelId, modelType: 'languageModel' });
      }

      const xaiInstance = xaiProvider.createXai({
        apiKey: config?.apiKey || process.env.XAI_API_KEY,
        baseURL: config?.baseURL,
        headers: config?.headers,
      });

      return xaiInstance.languageModel(modelId);
    },
    textEmbeddingModel: (modelId: string): EmbeddingModelV2<string> => {
      // xAI doesn't provide text embedding models
      throw new NoSuchModelError({ modelId, modelType: 'textEmbeddingModel' });
    },
    imageModel: (modelId: string): ImageModelV2 => {
      // xAI doesn't provide image generation models
      throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
    },

    // Unblocked-specific methods
    getModel: (modelName: string) => {
      if (!xaiProvider) {
        throw new NoSuchModelError({
          modelId: modelName,
          modelType: 'languageModel',
        });
      }

      const xaiInstance = xaiProvider.createXai({
        apiKey: config?.apiKey || process.env.XAI_API_KEY,
        baseURL: config?.baseURL,
        headers: config?.headers,
      });

      return xaiInstance.languageModel(modelName);
    },
    metadata: {
      provider: 'xai',
      website: 'https://x.ai',
      documentation: 'https://docs.x.ai',
      models: [
        {
          id: 'grok-3',
          name: 'Grok 3',
          capabilities: ['chat', 'tools'],
          contextWindow: 131_072,
        },
        {
          id: 'grok-3-fast',
          name: 'Grok 3 Fast',
          capabilities: ['chat', 'tools'],
          contextWindow: 131_072,
        },
        {
          id: 'grok-3-mini',
          name: 'Grok 3 Mini',
          capabilities: ['chat', 'tools'],
          contextWindow: 131_072,
        },
        {
          id: 'grok-3-mini-fast',
          name: 'Grok 3 Mini Fast',
          capabilities: ['chat', 'tools'],
          contextWindow: 131_072,
        },
        {
          id: 'grok-2-1212',
          name: 'Grok 2 1212',
          capabilities: ['chat', 'tools'],
          contextWindow: 131_072,
        },
        {
          id: 'grok-2-vision-1212',
          name: 'Grok 2 Vision 1212',
          capabilities: ['chat', 'tools', 'vision'],
          contextWindow: 32_768,
        },
        {
          id: 'grok-beta',
          name: 'Grok Beta',
          capabilities: ['chat', 'tools'],
          contextWindow: 131_072,
        },
        {
          id: 'grok-vision-beta',
          name: 'Grok Vision Beta',
          capabilities: ['chat', 'tools', 'vision'],
          contextWindow: 32_768,
        },
      ],
    },
  };
};

/**
 * Helper function to create a simple provider configuration
 *
 * @example
 * ```typescript
 * const ai = unblocked({
 *   providers: createProviders({
 *     openai: { apiKey: "sk-..." },
 *     anthropic: { apiKey: "sk-ant-..." },
 *   }),
 *   chat: {
 *     model: "gpt-4o-mini", // Will use OpenAI provider
 *   }
 * });
 * ```
 */
export const createProviders = (config: {
  openai?: Parameters<typeof openai>[0];
  anthropic?: Parameters<typeof anthropic>[0];
  google?: Parameters<typeof google>[0];
  mistral?: Parameters<typeof mistral>[0];
  xai?: Parameters<typeof xai>[0];
}) => {
  const providers: Record<string, UnblockedAIProvider> = {};

  if (config.openai !== undefined) {
    providers.openai = openai(config.openai);
  }
  if (config.anthropic !== undefined) {
    providers.anthropic = anthropic(config.anthropic);
  }
  if (config.google !== undefined) {
    providers.google = google(config.google);
  }
  if (config.mistral !== undefined) {
    providers.mistral = mistral(config.mistral);
  }
  if (config.xai !== undefined) {
    providers.xai = xai(config.xai);
  }

  return providers;
};

/**
 * Get all available models from all providers
 */
export const getAllModels = (
  providers: Record<string, UnblockedAIProvider>
) => {
  return Object.entries(providers).flatMap(
    ([providerName, provider]) =>
      provider.metadata?.models?.map((model: any) => ({
        ...model,
        provider: providerName,
      })) || []
  );
};

/**
 * Get recommended models for different use cases
 */
export const getRecommendedModels = () => ({
  chat: {
    fast: 'gpt-4o-mini',
    balanced: 'claude-3-5-haiku-20241022',
    powerful: 'claude-3-5-sonnet-20241022',
  },
  documents: {
    fast: 'gemini-1.5-flash-8b',
    balanced: 'gpt-4o-mini',
    powerful: 'claude-3-5-sonnet-20241022',
  },
  tools: {
    fast: 'gpt-4o-mini',
    balanced: 'gpt-4o',
    powerful: 'claude-3-5-sonnet-20241022',
  },
  vision: {
    fast: 'gpt-4o-mini',
    balanced: 'gpt-4o',
    powerful: 'claude-3-5-sonnet-20241022',
  },
});

/**
 * TODO: Implement proper AI SDK provider integration
 *
 * This implementation now correctly extends ProviderV2 but still needs actual
 * AI SDK provider constructor integration. The ProviderV2 methods currently
 * throw NoSuchModelError as placeholders.
 *
 * The key functionality needed:
 * 1. languageModel() should return actual AI SDK model instances (e.g., OpenAI, Anthropic)
 * 2. textEmbeddingModel() should return actual embedding model instances
 * 3. imageModel() should return actual image model instances
 * 4. Provider configuration should be passed through properly
 * 5. Support for streaming, tools, and other AI SDK features
 *
 * Once the 2.0.0-beta API is stable, we can replace the placeholder implementations
 * with actual provider constructors like createOpenAI(), createAnthropic(), etc.
 */
