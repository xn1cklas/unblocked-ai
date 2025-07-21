// copy of the original auth.ts
import { getEndpoints, router } from './api';
import { UnblockedError } from './error';
import { BASE_ERROR_CODES } from './error/codes';
import { init } from './init';
import type {
  FilterActions,
  InferAPI,
  InferPluginErrorCodes,
  InferPluginTypes,
  InferUser,
  UnblockedContext,
} from './types';
import type { Expand, PrettifyDeep } from './types/helper';
import type { UnblockedOptions } from './types/options';
import { getBaseURL, getOrigin } from './utils/url';

export type WithJsDoc<T, D> = Expand<T & D>;

export const unblocked = <O extends UnblockedOptions>(
  options: O & Record<never, never>
) => {
  const unblockedContext = init(options as O);
  const { api } = getEndpoints(unblockedContext, options as O);
  const errorCodes = options.plugins?.reduce((acc, plugin) => {
    if (plugin.$ERROR_CODES) {
      return {
        ...acc,
        ...plugin.$ERROR_CODES,
      };
    }
    return acc;
  }, {});
  return {
    handler: async (request: Request) => {
      const ctx = await unblockedContext;
      const basePath = ctx.options.basePath || '/api/unblocked';
      if (!ctx.options.baseURL) {
        const baseURL = getBaseURL(undefined, basePath, request);
        if (baseURL) {
          ctx.baseURL = baseURL;
          ctx.options.baseURL = getOrigin(ctx.baseURL) || undefined;
        } else {
          throw new UnblockedError(
            'Could not get base URL from request. Please provide a valid base URL.'
          );
        }
      }
      ctx.trustedOrigins = [
        ...(options.trustedOrigins
          ? Array.isArray(options.trustedOrigins)
            ? options.trustedOrigins
            : await options.trustedOrigins(request)
          : []),
        ctx.options.baseURL!,
      ];
      const { handler } = router(ctx, options);
      return handler(request);
    },
    api: api as FilterActions<typeof api>,
    options: options as O,
    $context: unblockedContext,
    $Infer: {} as {
      User: {
        user: PrettifyDeep<InferUser<O>>;
      };
    } & InferPluginTypes<O>,
    $ERROR_CODES: {
      ...errorCodes,
      ...BASE_ERROR_CODES,
    } as InferPluginErrorCodes<O> & typeof BASE_ERROR_CODES,
    // Export raw API for client type inference
    $api: api as typeof api,
  };
};

export type Unblocked<O extends UnblockedOptions = UnblockedOptions> = {
  handler: (request: Request) => Promise<Response>;
  api: FilterActions<ReturnType<typeof getEndpoints>['api']>;
  options: O;
  $ERROR_CODES: InferPluginErrorCodes<O> & typeof BASE_ERROR_CODES;
  $context: Promise<UnblockedContext>;
  $Infer: {
    User: {
      user: PrettifyDeep<InferUser<O>>;
    };
  } & InferPluginTypes<O>;
  $api: ReturnType<typeof getEndpoints>['api'];
};
