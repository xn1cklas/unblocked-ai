//@ts-expect-error - we need to import this to get the type of the database
import type { Database as BunDatabase } from 'bun:sqlite';
// Import AI SDK callback types for compatibility
import type {
  LanguageModelUsage,
  StreamTextOnChunkCallback,
  StreamTextOnErrorCallback,
  StreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback,
  TextPart,
  Tool,
  ToolCallPart,
} from 'ai';
import type { CookieOptions } from 'better-call';
import type { Database } from 'better-sqlite3';
import type { Dialect, Kysely, MysqlPool, PostgresPool } from 'kysely';
import type { AdapterDebugLogs } from '../adapters';
import type { KyselyDatabaseType } from '../adapters/kysely-adapter/types';
import type { UnblockedMiddleware } from '../plugins';
import type { Models, RateLimit, User } from '../types';
import type { Logger } from '../utils';
import type { UnblockedContext } from '.';
import type { AdapterInstance, SecondaryStorage } from './adapter';
import type { LiteralUnion } from './helper';
import type { UnblockedPlugin } from './plugins';

// Helper types for type-safe model selection
type ExtractModelIds<T> = T extends Array<{ id: infer ID }> ? ID : never;

type ExtractProviderModels<T> = T extends Record<string, { models?: infer M }>
  ? M extends Array<{ id: infer ID }>
    ? ID
    : never
  : never;

// Helper type for automatic model inference from configuration
export type InferModels<T extends UnblockedOptions> = T extends {
  models: infer M;
}
  ? ExtractModelIds<M>
  : T extends { providers: infer P }
    ? ExtractProviderModels<P>
    : string;

// Export type for AI providers
export type UnblockedProviders = {
  [key: string]: {
    /**
     * Get a language model by name
     */
    getModel: (modelName: string) => unknown; // Return type varies by provider
    /**
     * List of models provided by this provider
     */
    models?: Array<{
      id: string;
      name: string;
      provider?: string;
      capabilities?: string[];
      contextWindow?: number;
      pricing?: {
        inputTokens: number;
        outputTokens: number;
      };
    }>;
    /**
     * Provider metadata
     */
    metadata?: any;
  };
};

export type UnblockedOptions<TModel extends string = string> = {
  /**
   * The name of the application
   *
   * process.env.APP_NAME
   *
   * @default "Unblocked"
   */
  appName?: string;
  /**
   * Base URL for Unblocked. This is typically the
   * root URL where your application server is hosted.
   * If not explicitly set,
   * the system will check the following environment variable:
   *
   * process.env.UNBLOCKED_URL
   *
   * If not set it will throw an error.
   */
  baseURL?: string;
  /**
   * Base path for Unblocked. This is typically
   * the path where the Unblocked routes are mounted.
   *
   * @default "/api/unblocked"
   */
  basePath?: string;
  /**
   * The secret to use for encryption,
   * signing and hashing.
   *
   * By default Unblocked will look for
   * the following environment variables:
   * process.env.UNBLOCKED_SECRET,
   * process.env.AI_SECRET
   * If none of these environment
   * variables are set,
   * unblocked will use a default secret.
   * Make sure to set this in production.
   */
  secret?: string;
  /**
   * Database configuration
   */
  database?:
    | PostgresPool
    | MysqlPool
    | Database
    | Dialect
    | AdapterInstance
    | BunDatabase
    | {
        dialect: Dialect;
        type: KyselyDatabaseType;
        /**
         * casing for table names
         *
         * @default "camel"
         */
        casing?: 'snake' | 'camel';
        /**
         * Enable debug logs for the adapter
         *
         * @default false
         */
        debugLogs?: AdapterDebugLogs;
      }
    | {
        /**
         * Kysely instance
         */
        db: Kysely<any>; // Keep as any - database schema is user-defined
        /**
         * Database type between postgres, mysql and sqlite
         */
        type: KyselyDatabaseType;
        /**
         * casing for table names
         *
         * @default "camel"
         */
        casing?: 'snake' | 'camel';
        /**
         * Enable debug logs for the adapter
         *
         * @default false
         */
        debugLogs?: AdapterDebugLogs;
      };
  /**
   * Secondary storage configuration
   *
   * This is used to store session and rate limit data.
   */
  secondaryStorage?: SecondaryStorage;
  /**
   * User context provider
   *
   * This function is called to get the user context
   * from the request. It should return a user object
   * or null if no user is found.
   */
  user: {
    /**
     * Function to get user from request
     */
    getUser: (request: Request) => Promise<User | null> | User | null;
    /**
     * Whether user is required for all operations
     * @default true
     */
    required?: boolean;
    /**
     * Whether to allow anonymous users
     * @default false
     */
    allowAnonymous?: boolean;
  };
  /**
   * A list of plugins to use
   */
  plugins?: UnblockedPlugin[];
  /**
   * List of trusted origins.
   */
  trustedOrigins?:
    | string[]
    | ((request: Request) => string[] | Promise<string[]>);
  /**
   * Rate limiting configuration
   */
  rateLimit?: {
    /**
     * By default, rate limiting is only
     * enabled on production.
     */
    enabled?: boolean;
    /**
     * Default window to use for rate limiting. The value
     * should be in seconds.
     *
     * @default 10 seconds
     */
    window?: number;
    /**
     * The default maximum number of requests allowed within the window.
     *
     * @default 100 requests
     */
    max?: number;
    /**
     * Custom rate limit rules to apply to
     * specific paths.
     */
    customRules?: {
      [key: string]:
        | {
            /**
             * The window to use for the custom rule.
             */
            window: number;
            /**
             * The maximum number of requests allowed within the window.
             */
            max: number;
          }
        | ((request: Request) =>
            | { window: number; max: number }
            | Promise<{
                window: number;
                max: number;
              }>);
    };
    /**
     * Storage configuration
     *
     * By default, rate limiting is stored in memory. If you passed a
     * secondary storage, rate limiting will be stored in the secondary
     * storage.
     *
     * @default "memory"
     */
    storage?: 'memory' | 'database' | 'secondary-storage';
    /**
     * If database is used as storage, the name of the table to
     * use for rate limiting.
     *
     * @default "rateLimit"
     */
    modelName?: string;
    /**
     * Custom field names for the rate limit table
     */
    fields?: Record<keyof RateLimit, string>;
    /**
     * custom storage configuration.
     *
     * NOTE: If custom storage is used storage
     * is ignored
     */
    customStorage?: {
      get: (key: string) => Promise<RateLimit | undefined>;
      set: (key: string, value: RateLimit) => Promise<void>;
    };
  };
  /**
   * Advanced options
   */
  advanced?: {
    /**
     * Ip address configuration
     */
    ipAddress?: {
      /**
       * List of headers to use for ip address
       *
       * Ip address is used for rate limiting and session tracking
       *
       * @example ["x-client-ip", "x-forwarded-for", "cf-connecting-ip"]
       *
       * @default
       * @link https://github.com/unblocked/unblocked/blob/main/packages/unblocked/src/utils/get-request-ip.ts#L8
       */
      ipAddressHeaders?: string[];
      /**
       * Disable ip tracking
       *
       * ⚠︎ This is a security risk and it may expose your application to abuse
       */
      disableIpTracking?: boolean;
    };
    /**
     * Use secure cookies
     *
     * @default false
     */
    useSecureCookies?: boolean;
    /**
     * Disable trusted origins check
     *
     * ⚠︎ This is a security risk and it may expose your application to CSRF attacks
     */
    disableCSRFCheck?: boolean;
    /**
     * Configure cookies to be cross subdomains
     */
    crossSubDomainCookies?: {
      /**
       * Enable cross subdomain cookies
       */
      enabled: boolean;
      /**
       * Additional cookies to be shared across subdomains
       */
      additionalCookies?: string[];
      /**
       * The domain to use for the cookies
       *
       * By default, the domain will be the root
       * domain from the base URL.
       */
      domain?: string;
    };
    /*
     * Allows you to change default cookie names and attributes
     *
     * default cookie names:
     * - "session_token"
     * - "session_data"
     * - "dont_remember"
     *
     * plugins can also add additional cookies
     */
    cookies?: {
      [key: string]: {
        name?: string;
        attributes?: CookieOptions;
      };
    };
    defaultCookieAttributes?: CookieOptions;
    /**
     * Prefix for cookies. If a cookie name is provided
     * in cookies config, this will be overridden.
     *
     * @default
     * ```txt
     * "appName" -> which defaults to "unblocked"
     * ```
     */
    cookiePrefix?: string;
    /**
     * Database configuration.
     */
    database?: {
      /**
       * The default number of records to return from the database
       * when using the `findMany` adapter method.
       *
       * @default 100
       */
      defaultFindManyLimit?: number;
      /**
       * If your database auto increments number ids, set this to `true`.
       *
       * Note: If enabled, we will not handle ID generation (including if you use `generateId`), and it would be expected that your database will provide the ID automatically.
       *
       * @default false
       */
      useNumberId?: boolean;
      /**
       * Custom generateId function.
       *
       * If not provided, random ids will be generated.
       * If set to false, the database's auto generated id will be used.
       */
      generateId?:
        | ((options: {
            model: LiteralUnion<Models, string>;
            size?: number;
          }) => string)
        | false;
    };
    /**
     * Custom generateId function.
     *
     * If not provided, random ids will be generated.
     * If set to false, the database's auto generated id will be used.
     *
     * @deprecated Please use `database.generateId` instead. This will be potentially removed in future releases.
     */
    generateId?:
      | ((options: {
          model: LiteralUnion<Models, string>;
          size?: number;
        }) => string)
      | false;
  };
  logger?: Logger;
  /**
   * allows you to define custom hooks that can be
   * executed during lifecycle of core database
   * operations.
   */
  databaseHooks?: Record<
    string,
    Record<
      string,
      Record<
        string,
        (
          data: any,
          context?: any
        ) =>
          | Promise<{ data: any } | boolean | void>
          | { data: any }
          | boolean
          | void
      >
    >
  >;
  /**
   * API error handling
   */
  onAPIError?: {
    /**
     * Throw an error on API error
     *
     * @default false
     */
    throw?: boolean;
    /**
     * Custom error handler
     *
     * @param error
     * @param ctx - Auth context
     */
    onError?: (error: unknown, ctx: UnblockedContext) => void | Promise<void>;
    /**
     * The URL to redirect to on error
     *
     * When errorURL is provided, the error will be added to the URL as a query parameter
     * and the user will be redirected to the errorURL.
     *
     * @default - "/api/auth/error"
     */
    errorURL?: string;
  };
  /**
   * Global hooks for cross-cutting concerns only
   */
  hooks?: {
    /**
     * Before a request is processed
     */
    before?: UnblockedMiddleware;
    /**
     * After a request is processed
     */
    after?: UnblockedMiddleware;
    /**
     * Global error handler
     */
    error?: (context: {
      error: unknown;
      feature: 'chat' | 'documents' | 'titles' | 'suggestions' | 'tools';
      context: UnblockedContext;
    }) => Promise<void>;
  };
  /**
   * AI Provider Configuration
   */
  providers?: {
    [key: string]: {
      /**
       * Get a language model by name
       */
      getModel: (modelName: string) => unknown; // Return type varies by provider
      /**
       * List of models provided by this provider
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
  };
  /**
   * Available models for the application
   */
  models?: Array<{
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
  }>;
  /**
   * Chat-specific configuration
   */
  chat?: {
    model?: TModel;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    streaming?: {
      enabled: boolean;
      onChunk?: StreamTextOnChunkCallback<any>;
      onFinish?: StreamTextOnFinishCallback<any>;
      onError?: StreamTextOnErrorCallback;
      onStepFinish?: StreamTextOnStepFinishCallback<any>;
    };
    rateLimiting?: {
      enabled: boolean;
      messagesPerDay?: number;
      messagesPerHour?: number;
    };
  };
  /**
   * Document generation configuration
   */
  documents?: {
    model?: TModel;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    streaming?: {
      enabled: boolean;
      onChunk?: StreamTextOnChunkCallback<any>;
      onFinish?: StreamTextOnFinishCallback<any>;
      onError?: StreamTextOnErrorCallback;
      onStepFinish?: StreamTextOnStepFinishCallback<any>;
    };
  };
  /**
   * Title generation configuration
   */
  titles?: {
    model?: TModel;
    maxTokens?: number;
    temperature?: number;
    onGenerate?: (context: {
      title: string;
      chatId: string;
      originalMessage: string;
    }) => Promise<void>;
    onError?: (context: { error: unknown; chatId: string }) => Promise<void>;
  };
  /**
   * Suggestions configuration
   */
  suggestions?: {
    model?: TModel;
    temperature?: number;
    maxTokens?: number;
    streaming?: {
      enabled: boolean;
      onChunk?: StreamTextOnChunkCallback<any>;
      onFinish?: StreamTextOnFinishCallback<any>;
      onError?: StreamTextOnErrorCallback;
      onStepFinish?: StreamTextOnStepFinishCallback<any>;
    };
  };
  /**
   * Tools configuration
   */
  tools?: {
    model?: TModel;
    registry?: Record<string, Tool>;
    streaming?: {
      enabled: boolean;
      onChunk?: StreamTextOnChunkCallback<any>;
      onFinish?: StreamTextOnFinishCallback<any>;
      onError?: StreamTextOnErrorCallback;
      onStepFinish?: StreamTextOnStepFinishCallback<any>;
    };
    /**
     * Tool-specific configuration
     */
    config?: {
      [toolName: string]: {
        /**
         * Override model for this specific tool
         */
        model?: TModel;
        /**
         * Tool-specific hooks
         */
        hooks?: {
          beforeCall?: (args: any, user: User) => Promise<any>;
          afterCall?: (result: any, user: User) => Promise<void>;
          onError?: (error: unknown, user: User) => Promise<void>;
        };
        /**
         * UI component configuration (V2 feature)
         */
        ui?: {
          component?: string | (() => any);
          props?: Record<string, any>;
          placement?: 'inline' | 'modal' | 'sidebar';
        };
      };
    };
  };
  /**
   * Disabled paths
   *
   * Paths you want to disable.
   */
  disabledPaths?: string[];
};

/**
 * Example usage with type-safe model configuration:
 *
 * ```typescript
 * import { unblocked } from "unblocked";
 * import { quotaPlugin } from "unblocked/plugins";
 * import { tool } from "ai";
 *
 * // Type-safe configuration with explicit model types
 * const ai = unblocked<"gpt-4" | "gpt-3.5-turbo" | "claude-3-sonnet">({
 *   database: drizzleDb,
 *   user: {
 *     getUser: async (request) => await getSession(request),
 *   },
 *
 *   // Model providers define available models
 *   providers: {
 *     openai: {
 *       getModel: (name) => openai(name),
 *       models: [
 *         { id: "gpt-4", name: "GPT-4", capabilities: ["chat", "tools"] },
 *         { id: "gpt-3.5-turbo", name: "GPT-3.5", capabilities: ["chat"] }
 *       ]
 *     },
 *     anthropic: {
 *       getModel: (name) => anthropic(name),
 *       models: [
 *         { id: "claude-3-sonnet", name: "Claude 3 Sonnet", capabilities: ["chat", "tools"] }
 *       ]
 *     }
 *   },
 *
 *   // Now model properties are type-safe - IDE will autocomplete available models
 *   chat: {
 *     model: "gpt-4", // ✅ Type-safe - must be one of the configured models
 *     streaming: {
 *       enabled: true,
 *       onChunk: async ({ chunk, messageId }) => {
 *         await updateChatUI(messageId, chunk);
 *       },
 *       onFinish: async ({ message, usage }) => {
 *         await saveChatMetrics(usage);
 *       }
 *     }
 *   },
 *
 *   // Document generation
 *   documents: {
 *     model: "claude-3-sonnet", // ✅ Type-safe
 *     streaming: {
 *       enabled: true,
 *       onProgress: async ({ percent }) => {
 *         await updateProgressBar(percent);
 *       }
 *     }
 *   },
 *
 *   // Title generation (no streaming)
 *   titles: {
 *     model: "gpt-3.5-turbo", // ✅ Type-safe
 *     maxTokens: 20,
 *     onGenerate: async ({ title, chatId }) => {
 *       await updateChatTitle(chatId, title);
 *     }
 *   },
 *
 *   // Tools with type-safe model selection
 *   tools: {
 *     model: "gpt-4", // ✅ Type-safe
 *     registry: {
 *       search: searchTool,
 *       imageGenerator: imageGeneratorTool,
 *     },
 *     config: {
 *       imageGenerator: {
 *         model: "claude-3-sonnet", // ✅ Type-safe per-tool override
 *         hooks: {
 *           beforeCall: async (args, user) => {
 *             if (!user.features?.includes("image_generation")) {
 *               throw new Error("Feature not enabled");
 *             }
 *             return args;
 *           }
 *         }
 *       }
 *     }
 *   },
 *
 *   // Global hooks
 *   hooks: {
 *     before: async (ctx) => {
 *       // Global rate limiting
 *     },
 *     error: async ({ error, feature }) => {
 *       console.error(`Error in ${feature}:`, error);
 *     }
 *   }
 * });
 *
 * // Alternative: Auto-infer types from provider configuration
 * const aiWithInferredTypes = unblocked({
 *   providers: {
 *     openai: {
 *       getModel: (name) => openai(name),
 *       models: [
 *         { id: "gpt-4o-mini", name: "GPT-4o Mini" }
 *       ]
 *     }
 *   },
 *   chat: {
 *     model: "gpt-4o-mini" // ✅ Auto-inferred from providers.openai.models
 *   }
 * });
 * ```
 */
