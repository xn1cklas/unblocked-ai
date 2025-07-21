import type { z } from 'zod';
import type { Unblocked } from '../ai';
import type { InferFieldsFromPlugins } from '../db';
import type {
  chatSchema,
  documentSchema,
  messageSchema,
  streamSchema,
  suggestionSchema,
  voteSchema,
} from '../db/schema';
import type { StripEmptyObjects, UnionToIntersection } from './helper';
import type { UnblockedOptions } from './options';
import type { UnblockedPlugin } from './plugins';

export type Models =
  | 'chat'
  | 'message'
  | 'vote'
  | 'document'
  | 'suggestion'
  | 'stream'
  | 'rate-limit';

export type AdditionalChatFieldsInput<Options extends UnblockedOptions> =
  InferFieldsFromPlugins<Options, 'chat', 'input'>;

export type AdditionalChatFieldsOutput<Options extends UnblockedOptions> =
  InferFieldsFromPlugins<Options, 'chat'>;

export type AdditionalMessageFieldsInput<Options extends UnblockedOptions> =
  InferFieldsFromPlugins<Options, 'message', 'input'>;

export type AdditionalMessageFieldsOutput<Options extends UnblockedOptions> =
  InferFieldsFromPlugins<Options, 'message'>;

export type InferChat<O extends UnblockedOptions | Unblocked> =
  UnionToIntersection<
    StripEmptyObjects<
      Chat &
        (O extends UnblockedOptions
          ? AdditionalChatFieldsOutput<O>
          : O extends Unblocked
            ? AdditionalChatFieldsOutput<O['options']>
            : {})
    >
  >;

export type InferMessage<O extends UnblockedOptions | Unblocked> =
  UnionToIntersection<
    StripEmptyObjects<
      Message &
        (O extends UnblockedOptions
          ? AdditionalMessageFieldsOutput<O>
          : O extends Unblocked
            ? AdditionalMessageFieldsOutput<O['options']>
            : {})
    >
  >;

export type InferPluginTypes<O extends UnblockedOptions> =
  O['plugins'] extends Array<infer P>
    ? UnionToIntersection<
        P extends UnblockedPlugin
          ? P['$Infer'] extends Record<string, any>
            ? P['$Infer']
            : {}
          : {}
      >
    : {};

interface RateLimit {
  /**
   * The key to use for rate limiting
   */
  key: string;
  /**
   * The number of requests made
   */
  count: number;
  /**
   * The last request time in milliseconds
   */
  lastRequest: number;
}

export type Chat = z.infer<typeof chatSchema>;
export type Message = z.infer<typeof messageSchema>;
export type Vote = z.infer<typeof voteSchema>;
export type Document = z.infer<typeof documentSchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
export type Stream = z.infer<typeof streamSchema>;
export type { RateLimit };

// Infer User type from options
export type InferUser<O extends UnblockedOptions | Unblocked> =
  O extends UnblockedOptions
    ? O['user'] extends {
        getUser: (...args: any[]) => infer U | Promise<infer U>;
      }
      ? U extends { id: string }
        ? U
        : { id: string; [key: string]: any }
      : { id: string; [key: string]: any }
    : O extends Unblocked
      ? O['options']['user'] extends {
          getUser: (...args: any[]) => infer U | Promise<infer U>;
        }
        ? U extends { id: string }
          ? U
          : { id: string; [key: string]: any }
        : { id: string; [key: string]: any }
      : { id: string; [key: string]: any };
