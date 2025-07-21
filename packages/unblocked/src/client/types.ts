import type {
  BetterFetch,
  BetterFetchOption,
  BetterFetchPlugin,
} from '@better-fetch/fetch';
import type { Atom, WritableAtom } from 'nanostores';
import type { Unblocked } from '../ai';
import type { InferFieldsInputClient, InferFieldsOutput } from '../db';
import type { UnblockedOptions, User } from '../types';
import type {
  LiteralString,
  StripEmptyObjects,
  UnionToIntersection,
} from '../types/helper';
import type { UnblockedPlugin } from '../types/plugins';

export type AtomListener = {
  matcher: (path: string) => boolean;
  signal: '$userSignal' | Omit<string, '$userSignal'>;
};

export interface Store {
  notify: (signal: string) => void;
  listen: (signal: string, listener: () => void) => void;
  atoms: Record<string, WritableAtom<any>>;
}

export interface UnblockedClientPlugin {
  id: LiteralString;
  /**
   * only used for type inference. don't pass the
   * actual plugin
   */
  $InferServerPlugin?: UnblockedPlugin;
  /**
   * Called when the plugin is initialized
   */
  onInit?: (context: {
    $fetch: BetterFetch;
    $store: Store;
    options: ClientOptions | undefined;
  }) => void | Promise<void>;
  /**
   * Called when the plugin is destroyed/cleaned up
   */
  onDestroy?: () => void | Promise<void>;
  /**
   * Custom actions
   */
  getActions?: (
    $fetch: BetterFetch,
    $store: Store,
    /**
     * unblocked client options
     */
    options: ClientOptions | undefined
  ) => Record<string, any>;
  /**
   * State atoms that'll be resolved by each framework
   * auth store.
   */
  getAtoms?: ($fetch: BetterFetch) => Record<string, Atom<any>>;
  /**
   * specify path methods for server plugin inferred
   * endpoints to force a specific method.
   */
  pathMethods?: Record<string, 'POST' | 'GET' | 'PATCH' | 'DELETE' | 'PUT'>;
  /**
   * Better fetch plugins
   */
  fetchPlugins?: BetterFetchPlugin[];
  /**
   * a list of recaller based on a matcher function.
   * The signal name needs to match a signal in this
   * plugin or any plugin the user might have added.
   */
  atomListeners?: AtomListener[];
  /**
   * Called when an AI event occurs (streaming, tool calls, etc)
   */
  onAIEvent?: (event: {
    type:
      | 'stream-start'
      | 'stream-chunk'
      | 'stream-end'
      | 'tool-call'
      | 'tool-result'
      | 'error';
    chatId?: string;
    messageId?: string;
    data?: any;
  }) => void;
}

export interface ClientOptions {
  fetchOptions?: BetterFetchOption;
  plugins?: UnblockedClientPlugin[];
  baseURL?: string;
  basePath?: string;
  disableDefaultFetchPlugins?: boolean;
  $InferAI?:
    | UnblockedOptions
    | { $api: Record<string, unknown>; options: UnblockedOptions };
}

// Import better-call types for proper endpoint inference
import type { Endpoint } from 'better-call';
// Import dynamic API types
import type { FilterActions, InferAPI } from '../types/api';

// Enhanced endpoint method inference with proper parameter extraction
export type InferEndpointMethod<E> = E extends Endpoint
  ? E extends {
      handler: (...args: any[]) => Promise<infer R>;
      body?: infer B;
      query?: infer Q;
      params?: infer P;
    }
    ? (args?: {
        body?: B;
        query?: Q;
        params?: P;
        asResponse?: boolean;
        fetchOptions?: BetterFetchOption;
      }) => Promise<R>
    : E extends (...args: any[]) => Promise<infer R>
      ? (args?: {
          body?: any;
          query?: any;
          params?: any;
          asResponse?: boolean;
          fetchOptions?: BetterFetchOption;
        }) => Promise<R>
      : never
  : E extends (...args: any[]) => Promise<infer R>
    ? (args?: {
        body?: any;
        query?: any;
        params?: any;
        asResponse?: boolean;
        fetchOptions?: BetterFetchOption;
      }) => Promise<R>
    : (...args: any[]) => Promise<any>; // Strategic any for dynamic behavior

// Type for dynamic unblocked endpoints from $InferAI
export type InferUnblockedEndpoints<O extends ClientOptions> =
  O['$InferAI'] extends { api: infer API }
    ? { [K in keyof API]: InferEndpointMethod<API[K]> }
    : O['$InferAI'] extends { $api: infer API }
      ? { [K in keyof FilterActions<API>]: InferEndpointMethod<API[K]> }
      : O['$InferAI'] extends UnblockedOptions
        ? FilterActions<InferAPI<O['$InferAI']>>
        : Record<string, any>; // Strategic any - no server types provided

export type InferClientAPI<O extends ClientOptions> =
  InferUnblockedEndpoints<O> &
    (O['plugins'] extends Array<infer Pl>
      ? UnionToIntersection<
          Pl extends {
            $InferServerPlugin: infer Plug;
          }
            ? Plug extends {
                endpoints: infer Endpoints;
              }
              ? {
                  [K in keyof Endpoints]: InferEndpointMethod<Endpoints[K]>;
                }
              : {}
            : {}
        >
      : {});

export type InferActions<O extends ClientOptions> = O['plugins'] extends Array<
  infer Plugin
>
  ? UnionToIntersection<
      Plugin extends UnblockedClientPlugin
        ? Plugin['getActions'] extends (...args: unknown[]) => infer Actions
          ? Actions
          : {}
        : {}
    >
  : {};

export type InferErrorCodes<O extends ClientOptions> =
  O['plugins'] extends Array<infer Plugin>
    ? UnionToIntersection<
        Plugin extends UnblockedClientPlugin
          ? Plugin['$InferServerPlugin'] extends UnblockedPlugin
            ? Plugin['$InferServerPlugin']['$ERROR_CODES']
            : {}
          : {}
      >
    : {};
/**
 * signals are just used to recall a computed value.
 * as a convention they start with "$"
 */
export type IsSignal<T> = T extends `$${infer _}` ? true : false;

export type InferPluginsFromClient<O extends ClientOptions> =
  O['plugins'] extends Array<UnblockedClientPlugin>
    ? Array<O['plugins'][number]['$InferServerPlugin']>
    : undefined;

// User type from external auth provider - unblocked uses Chats for AI conversations
export type InferUserFromClient<O extends ClientOptions> = StripEmptyObjects<
  User & UnionToIntersection<InferAdditionalFromClient<O, 'user', 'output'>>
>;

export type InferAdditionalFromClient<
  Options extends ClientOptions,
  Key extends string,
  Format extends 'input' | 'output' = 'output',
> = Options['plugins'] extends Array<infer T>
  ? T extends UnblockedClientPlugin
    ? T['$InferServerPlugin'] extends {
        schema: {
          [key in Key]: {
            fields: infer Field;
          };
        };
      }
      ? Format extends 'input'
        ? InferFieldsInputClient<Field>
        : InferFieldsOutput<Field>
      : {}
    : {}
  : {};
