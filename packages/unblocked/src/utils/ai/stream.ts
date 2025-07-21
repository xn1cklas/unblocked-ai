import type { LanguageModel, ModelMessage } from 'ai';
import { generateText, streamText } from 'ai';
import type { UnblockedContext, User } from '../../types';
import { executeToolWithHooks, getAvailableTools } from './tool-execution';

export interface StreamOptions {
  messages: ModelMessage[];
  model: LanguageModel;
  user: User;
  context: UnblockedContext;
  streaming?: boolean;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  feature?: 'chat' | 'documents' | 'titles' | 'suggestions' | 'tools';
}

/**
 * Stream or generate text with proper hook integration
 *
 * This function handles both streaming and non-streaming responses,
 * automatically applying the configured hooks from UnblockedOptions.
 */
export async function generateAIResponse(options: StreamOptions) {
  const {
    messages,
    model,
    user,
    context,
    streaming = true,
    feature = 'chat',
  } = options;

  // Get available tools and wrap them with hooks
  const tools = getAvailableTools(context);
  const wrappedTools = Object.entries(tools).reduce(
    (acc, [name, tool]) => {
      acc[name] = {
        ...tool,
        execute: (args: any) =>
          executeToolWithHooks(name, tool, args, user, context),
      };
      return acc;
    },
    {} as Record<string, any>
  );

  // Get feature-specific config
  const featureConfig = context.options[feature];
  const streamingHooks =
    featureConfig && 'streaming' in featureConfig
      ? featureConfig.streaming
      : undefined;

  // Common options for both streaming and non-streaming
  const commonOptions = {
    model,
    messages,
    tools: Object.keys(wrappedTools).length > 0 ? wrappedTools : undefined,
    system:
      options.systemPrompt ||
      (featureConfig && 'systemPrompt' in featureConfig
        ? featureConfig.systemPrompt
        : undefined),
    maxTokens:
      options.maxTokens ||
      (featureConfig && 'maxTokens' in featureConfig
        ? featureConfig.maxTokens
        : undefined),
    temperature:
      options.temperature ||
      (featureConfig && 'temperature' in featureConfig
        ? featureConfig.temperature
        : undefined),
  };

  if (streaming) {
    // Use streamText with feature-specific hooks
    return streamText({
      ...commonOptions,
      // Pass feature-specific streaming hooks directly to the AI SDK
      onChunk: streamingHooks?.onChunk,
      onFinish: streamingHooks?.onFinish,
      onStepFinish: streamingHooks?.onStepFinish,
      // onError is handled differently - AI SDK will throw
    });
  }
  // Use generateText for non-streaming responses
  const result = await generateText({
    ...commonOptions,
    // generateText has onStepFinish but not onChunk/onFinish
    onStepFinish: streamingHooks?.onStepFinish,
  });

  // For non-streaming, we can manually call onFinish if needed
  if (streamingHooks?.onFinish) {
    // Convert generateText result to match streamText onFinish format
    await streamingHooks.onFinish({
      finishReason: result.finishReason,
      usage: result.usage,
      text: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
      // response is the actual property, not rawResponse
      response: result.response,
      warnings: result.warnings,
    } as any);
  }

  return result;
}

/**
 * Example usage in chat.ts endpoint:
 *
 * ```typescript
 * try {
 *   const result = await generateAIResponse({
 *     messages: coreMessages,
 *     model: aiModel,
 *     user,
 *     context: ctx.context,
 *     streaming: true,
 *     feature: 'chat', // Specify which feature's hooks to use
 *   });
 *
 *   // Handle streaming response
 *   for await (const chunk of result.textStream) {
 *     // Send chunk to client
 *   }
 * } catch (error) {
 *   // Error hook is called via try/catch
 *   if (ctx.context.options.chat?.streaming?.onError) {
 *     await ctx.context.options.chat.streaming.onError({ error, chatId });
 *   }
 *   throw error;
 * }
 * ```
 */
