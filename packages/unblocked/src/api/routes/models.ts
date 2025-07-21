import { APIError } from 'better-call';
import { z } from 'zod';
import type { User } from '../../types';
import { createUnblockedEndpoint } from '../call';

/**
 * Filter models based on user entitlements
 */
async function filterModelsByUser(
  models: Array<{
    id: string;
    name: string;
    provider?: string;
    capabilities?: string[];
    contextWindow?: number;
    pricing?: {
      inputTokens: number;
      outputTokens: number;
    };
    deprecated?: boolean;
  }>,
  user: User | null
): Promise<typeof models> {
  // If no user, return empty array (require authentication)
  if (!user) {
    return [];
  }

  // If user has no entitlements, return all models
  if (!user.entitlements?.allowedModels) {
    return models;
  }

  // Filter by allowed models
  return models.filter((m) => user.entitlements!.allowedModels!.includes(m.id));
}

/**
 * Get available AI models
 *
 * Returns the list of available models based on configuration and user entitlements.
 * Also includes default model selections for each feature.
 */
export const getModels = createUnblockedEndpoint(
  '/models',
  {
    method: 'GET',
    query: z
      .object({
        includeDeprecated: z
          .string()
          .optional()
          .transform((v) => v === 'true'),
      })
      .optional(),
  },
  async (ctx) => {
    const includeDeprecated = ctx.query?.includeDeprecated;
    const user = await ctx.context.getUser?.(ctx.request as Request);

    // Collect all models from providers
    const allModels: Array<{
      id: string;
      name: string;
      provider?: string;
      capabilities?: string[];
      contextWindow?: number;
      pricing?: {
        inputTokens: number;
        outputTokens: number;
      };
      deprecated?: boolean;
    }> = [];

    // Get models from providers
    if (ctx.context.options.providers) {
      for (const [providerName, provider] of Object.entries(
        ctx.context.options.providers
      )) {
        if (provider.models) {
          allModels.push(
            ...provider.models.map((m) => ({
              ...m,
              provider: providerName,
            }))
          );
        }
      }
    }

    // Add models from direct configuration
    if (ctx.context.options.models) {
      allModels.push(...ctx.context.options.models);
    }

    // Remove duplicates by id
    const uniqueModels = Array.from(
      new Map(allModels.map((m) => [m.id, m])).values()
    );

    // Filter by user entitlements
    const modelsToFilter = includeDeprecated
      ? uniqueModels
      : uniqueModels.filter((m) => !m.deprecated);
    const availableModels = await filterModelsByUser(
      modelsToFilter,
      user || null
    );

    // Get default models for each feature
    const defaultModels = {
      chat: ctx.context.options.chat?.model,
      documents: ctx.context.options.documents?.model,
      titles: ctx.context.options.titles?.model,
      suggestions: ctx.context.options.suggestions?.model,
      tools: ctx.context.options.tools?.model,
    };

    // If no models configured, return helpful error
    if (availableModels.length === 0 && !ctx.context.options.providers) {
      return ctx.json({
        models: [],
        defaultModels,
        error:
          'No AI providers configured. Please configure providers in UnblockedOptions.',
      });
    }

    return ctx.json({
      models: availableModels,
      defaultModels,
    });
  }
);

/**
 * Get model capabilities
 *
 * Returns detailed information about a specific model's capabilities
 */
export const getModelCapabilities = createUnblockedEndpoint(
  '/models/:modelId',
  {
    method: 'GET',
    params: z.object({
      modelId: z.string(),
    }),
  },
  async (ctx) => {
    const { modelId } = ctx.params;
    const user = await ctx.context.getUser?.(ctx.request as Request);

    // Find the model
    let model = null;

    // Check providers
    if (ctx.context.options.providers) {
      for (const provider of Object.values(ctx.context.options.providers)) {
        if (provider.models) {
          model = provider.models.find((m) => m.id === modelId);
          if (model) break;
        }
      }
    }

    // Check direct models
    if (!model && ctx.context.options.models) {
      model = ctx.context.options.models.find((m) => m.id === modelId);
    }

    if (!model) {
      throw new APIError('NOT_FOUND', {
        message: `Model ${modelId} not found`,
      });
    }

    // Check if user has access
    const userModels = await filterModelsByUser([model], user || null);
    if (userModels.length === 0) {
      throw new APIError('FORBIDDEN', {
        message: `Access denied to model ${modelId}`,
      });
    }

    return ctx.json({
      model,
      features: {
        chat: ctx.context.options.chat?.model === modelId,
        documents: ctx.context.options.documents?.model === modelId,
        titles: ctx.context.options.titles?.model === modelId,
        suggestions: ctx.context.options.suggestions?.model === modelId,
        tools: ctx.context.options.tools?.model === modelId,
      },
    });
  }
);
