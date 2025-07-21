import type { Tool } from 'ai';
import type { UnblockedContext, User } from '../../types';

// Type for tool configuration with hooks
type ToolConfig = {
  tool?: Tool;
  hooks?: {
    beforeCall?: (args: any, user: User) => Promise<any>;
    afterCall?: (result: any, user: User) => Promise<void>;
    onError?: (error: unknown, user: User) => Promise<void>;
  };
};

// Type guard to check if a tool configuration has hooks
function isToolConfigWithHooks(
  config: any
): config is ToolConfig & { hooks: NonNullable<ToolConfig['hooks']> } {
  return (
    config && typeof config === 'object' && 'hooks' in config && config.hooks
  );
}

/**
 * Tool execution wrapper that handles hooks
 *
 * This will be implemented in V2 when AI streaming is added.
 * It wraps tool execution to call beforeCall, afterCall, and onError hooks.
 */
export async function executeToolWithHooks(
  toolName: string,
  tool: Tool,
  args: any,
  user: User,
  context: UnblockedContext
): Promise<any> {
  const toolConfig = context.options.tools?.config?.[toolName];

  try {
    // Call beforeCall hook if defined
    let processedArgs = args;
    if (isToolConfigWithHooks(toolConfig) && toolConfig.hooks.beforeCall) {
      processedArgs = await toolConfig.hooks.beforeCall(args, user);
    }

    // Execute the tool - tools always have execute method
    // Note: AI SDK tools expect specific parameters, we'll use a minimal set
    const result = await tool.execute!(processedArgs, {
      messages: [], // Required by AI SDK
      toolCallId: `${toolName}-${Date.now()}`, // Required by AI SDK
      abortSignal: new AbortController().signal,
    });

    // Call afterCall hook if defined
    if (isToolConfigWithHooks(toolConfig) && toolConfig.hooks.afterCall) {
      await toolConfig.hooks.afterCall(result, user);
    }

    return result;
  } catch (error) {
    // Call onError hook if defined
    if (isToolConfigWithHooks(toolConfig) && toolConfig.hooks.onError) {
      await toolConfig.hooks.onError(error, user);
    }
    throw error;
  }
}

/**
 * Get all available tools including registry and custom tools
 *
 * This will be used by the AI SDK when setting up streamText/generateText
 */
export function getAvailableTools(
  context: UnblockedContext
): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  // Add tools from registry
  if (context.options.tools?.registry) {
    Object.assign(tools, context.options.tools.registry);
  }

  // Add custom tools
  if (context.options.tools) {
    for (const [name, config] of Object.entries(context.options.tools)) {
      if (name !== 'registry' && isToolConfigWithHooks(config) && config.tool) {
        tools[name] = config.tool;
      }
    }
  }

  return tools;
}

/**
 * Example usage in V2 AI streaming:
 *
 * ```typescript
 * import { streamText } from "ai";
 *
 * const tools = getAvailableTools(context);
 * const wrappedTools = Object.entries(tools).reduce((acc, [name, tool]) => {
 *   acc[name] = {
 *     ...tool,
 *     execute: (args) => executeToolWithHooks(name, tool, args, user, context)
 *   };
 *   return acc;
 * }, {} as Record<string, Tool>);
 *
 * const result = await streamText({
 *   model: aiModel, // Get from providers
 *   messages,
 *   tools: wrappedTools,
 *   onChunk: context.options.tools?.streaming?.onChunk,
 *   onFinish: context.options.tools?.streaming?.onFinish,
 *   onError: context.options.tools?.streaming?.onError,
 * });
 * ```
 */
