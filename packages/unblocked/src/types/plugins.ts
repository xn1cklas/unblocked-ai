import type { Endpoint, Middleware } from 'better-call';
import type { Migration } from 'kysely';
import type { UnblockedMiddleware } from '../api/call';
import type { FieldAttribute } from '../db/field';
import type {
  DeepPartial,
  LiteralString,
  UnionToIntersection,
} from '../types/helper';
import type {
  HookEndpointContext,
  UnblockedContext,
  UnblockedOptions,
} from '.';

export type PluginSchema = {
  [table in string]: {
    fields: {
      [field in string]: FieldAttribute;
    };
    disableMigration?: boolean;
    modelName?: string;
  };
};

// BetterAuthPlugin removed - use UnblockedPlugin instead

export type InferOptionSchema<S extends PluginSchema> = S extends Record<
  string,
  { fields: infer Fields }
>
  ? {
      [K in keyof S]?: {
        modelName?: string;
        fields?: {
          [P in keyof Fields]?: string;
        };
      };
    }
  : never;

export type InferPluginErrorCodes<O extends UnblockedOptions> =
  O['plugins'] extends Array<infer P>
    ? UnionToIntersection<
        P extends UnblockedPlugin
          ? P['$ERROR_CODES'] extends Record<string, any>
            ? P['$ERROR_CODES']
            : {}
          : {}
      >
    : {};

// Unblocked Plugin Types
export type UnblockedPlugin = {
  id: LiteralString;
  /**
   * The init function is called when the plugin is initialized.
   */
  init?: (ctx: UnblockedContext) => {
    context?: DeepPartial<Omit<UnblockedContext, 'options'>> &
      Record<string, any>;
    options?: Partial<UnblockedOptions>;
  } | void;
  endpoints?: {
    [key: string]: Endpoint;
  };
  middlewares?: {
    path: string;
    middleware: Middleware;
  }[];
  onRequest?: (
    request: Request,
    ctx: UnblockedContext
  ) => Promise<
    | {
        response: Response;
      }
    | {
        request: Request;
      }
    | void
  >;
  onResponse?: (
    response: Response,
    ctx: UnblockedContext
  ) => Promise<{
    response: Response;
  } | void>;
  hooks?: {
    before?: {
      matcher: (context: HookEndpointContext) => boolean;
      handler: UnblockedMiddleware;
    }[];
    after?: {
      matcher: (context: HookEndpointContext) => boolean;
      handler: UnblockedMiddleware;
    }[];
  };
  schema?: PluginSchema;
  migrations?: Record<string, Migration>;
  options?: Record<string, any>;
  $Infer?: Record<string, any>;
  rateLimit?: {
    window: number;
    max: number;
    pathMatcher: (path: string) => boolean;
  }[];
  $ERROR_CODES?: Record<string, string>;
};
