/**
 * AI SDK type imports and re-exports for unblocked
 *
 * This file centralizes all AI SDK imports to ensure we're using
 * the correct types from the v5 beta SDK.
 */

import type { ProviderV2 } from '@ai-sdk/provider';

// Re-export provider types from @ai-sdk/provider
export type {
  EmbeddingModelV2,
  ImageModelV2,
  LanguageModelV2,
  LanguageModelV2Usage,
  ProviderV2,
  TranscriptionModelV2,
} from '@ai-sdk/provider';
// Core types for messages and models
export type {
  CoreAssistantMessage,
  CoreSystemMessage,
  CoreToolMessage,
  CoreUserMessage,
  EmbeddingModel,
  FinishReason,
  GenerateObjectResult,
  // Result types
  GenerateTextResult,
  ImageModel,
  // Other utility types
  JSONValue,
  // Model types
  LanguageModel,
  LanguageModelRequestMetadata,
  LanguageModelResponseMetadata,
  // Metadata types
  LanguageModelUsage,
  // Message types
  ModelMessage,
  SpeechModel,
  StepResult,
  StreamObjectOnFinishCallback,
  StreamObjectResult,
  // Callback types
  StreamTextOnChunkCallback,
  StreamTextOnErrorCallback,
  StreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback,
  StreamTextResult,
  TelemetrySettings,
  // Tool types
  Tool,
  ToolCallUnion,
  ToolChoice,
  ToolErrorUnion,
  ToolResultUnion,
  ToolSet,
  TranscriptionModel,
  UIMessage,
  UIMessagePart,
  // Stream types
  UIMessageStreamOptions,
  UIMessageStreamPart,
  UIMessageStreamWriter,
} from 'ai';
// Error types from AI SDK
// Function exports we'll use
export {
  // Base error
  AISDKError,
  // API errors
  APICallError,
  // Conversion functions
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  DownloadError,
  EmptyResponseBodyError,
  // Utility functions
  generateId,
  generateObject,
  // Generation functions
  generateText,
  // Validation errors
  InvalidArgumentError,
  InvalidDataContentError,
  InvalidMessageRoleError,
  InvalidPromptError,
  InvalidResponseDataError,
  // Stream errors
  InvalidStreamPartError,
  InvalidToolInputError,
  JSONParseError,
  // Transform
  JsonToSseTransformStream,
  LoadAPIKeyError,
  // Other errors
  MessageConversionError,
  // Generation errors
  NoContentGeneratedError,
  NoImageGeneratedError,
  NoObjectGeneratedError,
  NoOutputSpecifiedError,
  // Model/Provider errors
  NoSuchModelError,
  NoSuchProviderError,
  NoSuchToolError,
  parsePartialJson,
  pipeUIMessageStreamToResponse,
  RetryError,
  smoothStream,
  streamObject,
  // Stream functions
  streamText,
  // Tool errors
  ToolCallRepairError,
  TypeValidationError,
  // Tool functions
  tool,
  UnsupportedFunctionalityError,
} from 'ai';

// Types for request hints (geolocation)
export interface RequestHints {
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  region?: string;
}

// Custom types for unblocked - extends AI SDK ProviderV2 interface with unblocked-specific fields
export interface UnblockedAIProvider extends ProviderV2 {
  /**
   * Get a language model by name (convenience method)
   */
  getModel?: (modelName: string) => any;

  /**
   * Provider metadata - unblocked-specific fields for UI and documentation
   */
  metadata?: {
    /**
     * Provider name (e.g., "openai", "anthropic")
     */
    provider: string;
    /**
     * Provider website URL
     */
    website?: string;
    /**
     * Provider documentation URL
     */
    documentation?: string;
    /**
     * Available models with capabilities and pricing
     */
    models?: Array<{
      id: string;
      name: string;
      capabilities?: string[];
      contextWindow?: number;
      pricing?: {
        inputTokens: number;
        outputTokens: number;
      };
    }>;
  };
}

// User entitlements type
export interface UserEntitlements {
  maxMessagesPerDay: number;
  maxTokensPerMessage?: number;
  allowedModels?: string[];
  allowedTools?: string[];
}
