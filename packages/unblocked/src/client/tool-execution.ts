import { atom } from 'nanostores';
import type { Tool } from '../types/ai';

// Tool set type matching AI SDK
export type ToolSet<TName extends string = string> = Record<
  TName,
  Tool<any, any>
>;

export interface ToolExecutionState {
  executingTools: Array<{
    id: string;
    name: string;
    args: any;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    result?: any;
    error?: Error;
    startTime: number;
    endTime?: number;
  }>;
  toolHistory: Array<{
    id: string;
    name: string;
    args: any;
    result?: any;
    error?: Error;
    duration: number;
    timestamp: number;
  }>;
}

export interface ToolExecutionOptions {
  timeout?: number;
  retryOnError?: boolean;
  maxRetries?: number;
  onStart?: (toolCall: { id: string; name: string; args: any }) => void;
  onComplete?: (toolCall: {
    id: string;
    name: string;
    args: any;
    result: any;
  }) => void;
  onError?: (toolCall: {
    id: string;
    name: string;
    args: any;
    error: Error;
  }) => void;
}

/**
 * Client-side utility for executing AI tools
 */
export class ToolExecutor {
  private state = atom<ToolExecutionState>({
    executingTools: [],
    toolHistory: [],
  });

  private tools: ToolSet;
  private defaultOptions: ToolExecutionOptions;

  constructor(
    tools: ToolSet = {},
    defaultOptions: ToolExecutionOptions = {
      timeout: 30_000,
      retryOnError: false,
      maxRetries: 3,
    }
  ) {
    this.tools = tools;
    this.defaultOptions = defaultOptions;
  }

  /**
   * Register a new tool
   */
  registerTool(name: string, tool: Tool<any, any>) {
    this.tools[name] = tool;
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string) {
    delete this.tools[name];
  }

  /**
   * Get the current execution state
   */
  getState() {
    return this.state;
  }

  /**
   * Execute a single tool call
   */
  async executeTool(
    toolCall: { id: string; name: string; args: any },
    options?: ToolExecutionOptions
  ): Promise<{ result?: any; error?: Error }> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    // Update state to show tool is executing
    this.updateToolStatus(toolCall.id, 'executing', { startTime });

    // Emit start event
    opts.onStart?.(toolCall);

    try {
      const tool = this.tools[toolCall.name];
      if (!tool) {
        throw new Error(`Tool "${toolCall.name}" not found`);
      }

      // Create abort controller for this execution
      const executionController = new AbortController();

      // Execute with timeout
      const result = await this.executeWithTimeout(
        () =>
          tool.execute?.(toolCall.args, {
            toolCallId: toolCall.id,
            messages: [],
            abortSignal: executionController.signal,
          }),
        opts.timeout || 30_000
      );

      // Update state with success
      const endTime = Date.now();
      this.updateToolStatus(toolCall.id, 'completed', { result, endTime });

      // Add to history
      this.addToHistory({
        ...toolCall,
        result,
        duration: endTime - startTime,
        timestamp: startTime,
      });

      // Emit complete event
      opts.onComplete?.({ ...toolCall, result });

      return { result };
    } catch (error) {
      const err = error as Error;
      const endTime = Date.now();

      // Handle retry logic
      if (opts.retryOnError && (opts.maxRetries || 0) > 0) {
        const retryOptions = {
          ...opts,
          maxRetries: (opts.maxRetries || 1) - 1,
        };
        return this.executeTool(toolCall, retryOptions);
      }

      // Update state with failure
      this.updateToolStatus(toolCall.id, 'failed', { error: err, endTime });

      // Add to history
      this.addToHistory({
        ...toolCall,
        error: err,
        duration: endTime - startTime,
        timestamp: startTime,
      });

      // Emit error event
      opts.onError?.({ ...toolCall, error: err });

      return { error: err };
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async executeTools(
    toolCalls: Array<{ id: string; name: string; args: any }>,
    options?: ToolExecutionOptions
  ): Promise<Array<{ id: string; result?: any; error?: Error }>> {
    const promises = toolCalls.map((toolCall) =>
      this.executeTool(toolCall, options).then((result) => ({
        id: toolCall.id,
        ...result,
      }))
    );

    return Promise.all(promises);
  }

  /**
   * Execute tool calls sequentially
   */
  async executeToolsSequentially(
    toolCalls: Array<{ id: string; name: string; args: any }>,
    options?: ToolExecutionOptions
  ): Promise<Array<{ id: string; result?: any; error?: Error }>> {
    const results = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeTool(toolCall, options);
      results.push({ id: toolCall.id, ...result });

      // Stop on error unless configured to continue
      if (result.error && !options?.retryOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Clear execution history
   */
  clearHistory() {
    this.state.set({
      ...this.state.get(),
      toolHistory: [],
    });
  }

  /**
   * Get tool execution metrics
   */
  getMetrics() {
    const history = this.state.get().toolHistory;

    if (history.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        toolUsage: {},
      };
    }

    const successful = history.filter((h) => !h.error).length;
    const totalDuration = history.reduce((sum, h) => sum + h.duration, 0);

    const toolUsage = history.reduce(
      (acc, h) => {
        acc[h.name] = (acc[h.name] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalExecutions: history.length,
      successRate: (successful / history.length) * 100,
      averageDuration: totalDuration / history.length,
      toolUsage,
    };
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
      ),
    ]);
  }

  /**
   * Update tool execution status
   */
  private updateToolStatus(
    id: string,
    status: 'pending' | 'executing' | 'completed' | 'failed',
    data?: Partial<ToolExecutionState['executingTools'][0]>
  ) {
    const current = this.state.get();
    const toolIndex = current.executingTools.findIndex((t) => t.id === id);

    if (status === 'executing' && toolIndex === -1) {
      // Add new executing tool
      this.state.set({
        ...current,
        executingTools: [
          ...current.executingTools,
          {
            id,
            name: data?.name || '',
            args: data?.args || {},
            status,
            startTime: data?.startTime || Date.now(),
          },
        ],
      });
    } else if (toolIndex !== -1) {
      // Update existing tool
      const updated = [...current.executingTools];
      updated[toolIndex] = {
        ...updated[toolIndex],
        status,
        ...data,
      };

      // Remove from executing if completed or failed
      if (status === 'completed' || status === 'failed') {
        updated.splice(toolIndex, 1);
      }

      this.state.set({
        ...current,
        executingTools: updated,
      });
    }
  }

  /**
   * Add tool execution to history
   */
  private addToHistory(entry: ToolExecutionState['toolHistory'][0]) {
    const current = this.state.get();
    this.state.set({
      ...current,
      toolHistory: [...current.toolHistory, entry],
    });
  }
}

/**
 * Create a tool executor with framework integration
 */
export function createToolExecutor(
  tools?: ToolSet,
  options?: ToolExecutionOptions
): ToolExecutor {
  return new ToolExecutor(tools, options);
}
