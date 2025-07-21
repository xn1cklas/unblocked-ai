import type { BetterFetch } from '@better-fetch/fetch';
import { atom } from 'nanostores';
import type { ModelMessage, StreamTextResult, ToolSet } from '../types/ai';

export interface StreamingState {
  isStreaming: boolean;
  currentMessage: string;
  toolCalls: Array<{
    id: string;
    name: string;
    args: any;
    result?: any;
  }>;
  error?: Error;
}

/**
 * Client-side utility for handling AI streaming responses
 *
 * Expected Server-Sent Events format:
 * ```
 * data: {"type": "text", "content": "Hello"}
 * data: {"type": "text-delta", "delta": " world"}
 * data: {"type": "tool-call", "id": "call_123", "name": "search", "args": {"query": "AI"}}
 * data: {"type": "tool-call-delta", "id": "call_123", "args": {"additional": "data"}}
 * data: {"type": "tool-result", "toolId": "call_123", "result": {"answer": "42"}}
 * data: {"type": "error", "message": "Something went wrong"}
 * data: [DONE]
 * ```
 */
export class StreamingManager {
  private state = atom<StreamingState>({
    isStreaming: false,
    currentMessage: '',
    toolCalls: [],
  });

  private abortController?: AbortController;

  constructor(
    private $fetch: BetterFetch,
    private onEvent?: (event: any) => void
  ) {}

  /**
   * Get the current streaming state
   */
  getState() {
    return this.state;
  }

  /**
   * Start streaming a chat response
   */
  async streamChat(
    chatId: string,
    messages: ModelMessage[],
    options?: {
      model?: string;
      tools?: ToolSet;
      onChunk?: (chunk: string) => void;
      onToolCall?: (toolCall: any) => void;
      onError?: (error: Error) => void;
      onFinish?: (result: any) => void;
    }
  ) {
    // Cancel any existing stream
    this.cancel();

    // Reset state
    this.state.set({
      isStreaming: true,
      currentMessage: '',
      toolCalls: [],
    });

    // Emit stream start event
    this.onEvent?.({
      type: 'stream-start',
      chatId,
    });

    try {
      this.abortController = new AbortController();

      // Get base URL from better-fetch config
      const baseURL =
        (this.$fetch as any).baseURL ||
        (this.$fetch as any).config?.baseURL ||
        '';

      // Use native fetch with manual response handling for streaming
      const response = await fetch(`${baseURL}/chat/${chatId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include any custom headers from better-fetch
          ...((this.$fetch as any).config?.headers || {}),
        },
        body: JSON.stringify({
          messages,
          model: options?.model,
          tools: options?.tools,
        }),
        signal: this.abortController.signal,
        // Include credentials config from better-fetch
        credentials: (this.$fetch as any).config?.credentials || 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available for streaming');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // Helper to process a single SSE line
      const processLine = (line: string) => {
        if (line.trim() === '') return;

        // Handle different SSE field types
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          // Check for end signal
          if (data === '[DONE]' || data === 'DONE') {
            return;
          }

          // Parse JSON data
          try {
            const parsed = JSON.parse(data);
            this.handleStreamEvent(parsed, chatId, options);
          } catch (e) {
            // Try to handle plain text responses
            if (data.trim()) {
              this.handleStreamEvent(
                {
                  type: 'text',
                  content: data,
                },
                chatId,
                options
              );
            } else {
              console.error('Failed to parse stream data:', e, 'Data:', data);
            }
          }
        } else if (line.startsWith('event: ')) {
          // Handle named events if needed
          const eventType = line.slice(7).trim();
          console.log('SSE event type:', eventType);
        } else if (line.startsWith('id: ') || line.startsWith('retry: ')) {
          // Ignore these SSE fields for now
        } else if (line.includes(':')) {
          // Other SSE fields
          const [field, ...valueParts] = line.split(':');
          const value = valueParts.join(':').trim();
          console.log(`SSE field "${field}":`, value);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append new chunk to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          processLine(line);
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        processLine(buffer);
      }

      // Emit stream end event
      this.onEvent?.({
        type: 'stream-end',
        chatId,
        data: this.state.get(),
      });

      options?.onFinish?.(this.state.get());
    } catch (error) {
      const err = error as Error;
      this.state.set({
        ...this.state.get(),
        isStreaming: false,
        error: err,
      });

      this.onEvent?.({
        type: 'error',
        chatId,
        data: err,
      });

      options?.onError?.(err);
      throw err; // Re-throw to allow proper error handling
    } finally {
      this.state.set({
        ...this.state.get(),
        isStreaming: false,
      });
    }
  }

  /**
   * Handle individual stream events
   */
  private handleStreamEvent(event: any, chatId: string, options?: any) {
    const current = this.state.get();

    // Handle text chunks
    if (event.type === 'text' || event.type === 'text-delta') {
      const newMessage =
        current.currentMessage + (event.content || event.delta || '');
      this.state.set({
        ...current,
        currentMessage: newMessage,
      });

      this.onEvent?.({
        type: 'stream-chunk',
        chatId,
        data: event.content || event.delta,
      });

      options?.onChunk?.(event.content || event.delta);
    }

    // Handle tool calls
    else if (event.type === 'tool-call' || event.type === 'tool-call-delta') {
      // Find existing tool call or create new one
      const existingIndex = current.toolCalls.findIndex(
        (tc) => tc.id === event.id
      );

      if (existingIndex >= 0 && event.type === 'tool-call-delta') {
        // Update existing tool call with delta
        const updated = [...current.toolCalls];
        const existing = updated[existingIndex];

        // Merge args if it's a delta update
        if (event.args) {
          existing.args = existing.args
            ? { ...existing.args, ...event.args }
            : event.args;
        }

        this.state.set({
          ...current,
          toolCalls: updated,
        });
      } else {
        // New tool call
        const toolCall = {
          id: event.id,
          name: event.name,
          args: event.args || {},
        };

        this.state.set({
          ...current,
          toolCalls: [...current.toolCalls, toolCall],
        });

        this.onEvent?.({
          type: 'tool-call',
          chatId,
          data: toolCall,
        });

        options?.onToolCall?.(toolCall);
      }
    }

    // Handle tool results
    else if (event.type === 'tool-result') {
      // Update the tool call with its result
      const updated = current.toolCalls.map((tc) =>
        tc.id === event.toolId ? { ...tc, result: event.result } : tc
      );

      this.state.set({
        ...current,
        toolCalls: updated,
      });

      this.onEvent?.({
        type: 'tool-result',
        chatId,
        data: { id: event.toolId, result: event.result },
      });
    }

    // Handle errors
    else if (event.type === 'error') {
      const error = new Error(event.message || 'Stream error');
      this.state.set({
        ...current,
        error,
        isStreaming: false,
      });

      this.onEvent?.({
        type: 'error',
        chatId,
        data: error,
      });

      options?.onError?.(error);
    }
  }

  /**
   * Cancel the current stream
   */
  cancel() {
    this.abortController?.abort();
    this.state.set({
      ...this.state.get(),
      isStreaming: false,
    });
  }

  /**
   * Clear the streaming state
   */
  clear() {
    this.state.set({
      isStreaming: false,
      currentMessage: '',
      toolCalls: [],
    });
  }

  /**
   * Retry streaming with exponential backoff
   */
  async retryStreamChat(
    chatId: string,
    messages: ModelMessage[],
    options?: Parameters<StreamingManager['streamChat']>[2] & {
      maxRetries?: number;
      initialDelay?: number;
    }
  ) {
    const maxRetries = options?.maxRetries || 3;
    const initialDelay = options?.initialDelay || 1000;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Wait before retry (except first attempt)
        if (attempt > 0) {
          const delay = initialDelay * 2 ** (attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // Attempt to stream
        await this.streamChat(chatId, messages, options);
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;
        console.error(`Stream attempt ${attempt + 1} failed:`, error);

        // Check if error is retryable
        if (this.isRetryableError(error)) {
        } else {
          // Non-retryable error, exit immediately
          throw error;
        }
      }
    }

    // All retries exhausted
    throw lastError || new Error('Stream failed after all retries');
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors are retryable (case insensitive)
    if (
      error?.name === 'NetworkError' ||
      error?.message?.toLowerCase().includes('network')
    ) {
      return true;
    }

    // Timeout errors are retryable
    if (
      error?.name === 'AbortError' ||
      error?.message?.toLowerCase().includes('timeout')
    ) {
      return true;
    }

    // HTTP 502, 503, 504 are retryable
    if (error?.status && [502, 503, 504].includes(error.status)) {
      return true;
    }

    // Rate limit errors might be retryable with delay
    if (error?.status === 429) {
      return true;
    }

    // Fetch errors are usually retryable
    if (error?.name === 'FetchError' || error?.name === 'TypeError') {
      return true;
    }

    return false;
  }

  /**
   * Stream chat with automatic fallback to non-streaming
   */
  async streamChatWithFallback(
    chatId: string,
    messages: ModelMessage[],
    options?: Parameters<StreamingManager['streamChat']>[2]
  ) {
    try {
      // Try streaming first
      await this.streamChat(chatId, messages, options);
    } catch (streamError) {
      console.warn(
        'Streaming failed, falling back to non-streaming:',
        streamError
      );

      // Fallback to regular POST request
      try {
        const response = await this.$fetch(`/chat/${chatId}/message`, {
          method: 'POST',
          body: {
            messages,
            model: options?.model,
            tools: options?.tools,
          },
        });

        // Cast response to expected type
        const messageResponse = response as any;

        // Simulate streaming events for consistency
        this.onEvent?.({
          type: 'stream-start',
          chatId,
        });

        if (messageResponse.content || messageResponse.message) {
          const content = messageResponse.content || messageResponse.message;
          this.state.set({
            isStreaming: false,
            currentMessage: content,
            toolCalls: messageResponse.toolCalls || [],
          });

          options?.onChunk?.(content);

          this.onEvent?.({
            type: 'stream-chunk',
            chatId,
            data: content,
          });
        }

        this.onEvent?.({
          type: 'stream-end',
          chatId,
          data: this.state.get(),
        });

        options?.onFinish?.(this.state.get());
      } catch (fallbackError) {
        const error = fallbackError as Error;
        this.state.set({
          ...this.state.get(),
          error,
          isStreaming: false,
        });

        this.onEvent?.({
          type: 'error',
          chatId,
          data: error,
        });

        options?.onError?.(error);
        throw error;
      }
    }
  }
}
