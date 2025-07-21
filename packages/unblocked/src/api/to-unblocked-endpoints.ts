import {
  APIError,
  type EndpointContext,
  type EndpointOptions,
  type InputContext,
  toResponse,
} from 'better-call';
import defu from 'defu';
import type { HookEndpointContext, UnblockedContext } from '../types';
import type { UnblockedEndpoint, UnblockedMiddleware } from './call';

type InternalContext = InputContext<string, any> &
  EndpointContext<string, any> & {
    asResponse?: boolean;
    context: UnblockedContext & {
      returned?: unknown;
      responseHeaders?: Headers;
    };
  };

export function toUnblockedEndpoints<
  E extends Record<string, UnblockedEndpoint>,
>(endpoints: E, ctx: UnblockedContext | Promise<UnblockedContext>) {
  const api: Record<
    string,
    ((
      context: EndpointContext<string, any> & InputContext<string, any>
    ) => Promise<any>) & {
      path?: string;
      options?: EndpointOptions;
    }
  > = {};

  for (const [key, endpoint] of Object.entries(endpoints)) {
    api[key] = async (context) => {
      const unblockedContext = await ctx;
      let internalContext: InternalContext = {
        ...context,
        context: {
          ...unblockedContext,
          returned: undefined,
          responseHeaders: undefined,
        },
        path: endpoint.path,
        headers: context?.headers ? new Headers(context?.headers) : undefined,
      };
      const { beforeHooks, afterHooks } = getHooks(unblockedContext);
      const before = await runBeforeHooks(internalContext, beforeHooks);
      /**
       * If `before.context` is returned, it should
       * get merged with the original context
       */
      if (
        'context' in before &&
        before.context &&
        typeof before.context === 'object'
      ) {
        const { headers, ...rest } = before.context as {
          headers: Headers;
        };
        /**
         * Headers should be merged differently
         * so the hook doesn't override the whole
         * header
         */
        if (headers) {
          headers.forEach((value, key) => {
            (internalContext.headers as Headers).set(key, value);
          });
        }
        internalContext = defu(rest, internalContext);
      } else if (before) {
        /* Return before hook response if it's anything other than a context return */
        return before;
      }

      internalContext.asResponse = false;
      internalContext.returnHeaders = true;
      const result = (await endpoint(internalContext as any).catch((e: any) => {
        if (e instanceof APIError) {
          /**
           * API Errors from response are caught
           * and returned to hooks
           */
          return {
            response: e,
            headers: e.headers ? new Headers(e.headers) : null,
          };
        }
        throw e;
      })) as {
        headers: Headers;
        response: any;
      };
      internalContext.context.returned = result.response;
      internalContext.context.responseHeaders = result.headers;

      const after = await runAfterHooks(internalContext, afterHooks);

      if (after.response) {
        result.response = after.response;
      }

      if (result.response instanceof APIError && !context?.asResponse) {
        throw result.response;
      }
      const response = context?.asResponse
        ? toResponse(result.response, {
            headers: result.headers,
          })
        : context?.returnHeaders
          ? {
              headers: result.headers,
              response: result.response,
            }
          : result.response;
      return response;
    };
    api[key].path = endpoint.path;
    api[key].options = endpoint.options;
  }
  return api as E;
}

async function runBeforeHooks(
  context: HookEndpointContext,
  hooks: {
    matcher: (context: HookEndpointContext) => boolean;
    handler: UnblockedMiddleware;
  }[]
) {
  let modifiedContext: {
    headers?: Headers;
  } = {};
  for (const hook of hooks) {
    if (hook.matcher(context)) {
      const result = await hook.handler({
        ...context,
        returnHeaders: false,
      });
      if (result && typeof result === 'object') {
        if ('context' in result && typeof result.context === 'object') {
          const { headers, ...rest } = result.context as {
            headers: Headers;
          };
          if (headers instanceof Headers) {
            if (modifiedContext.headers) {
              headers.forEach((value, key) => {
                modifiedContext.headers?.set(key, value);
              });
            } else {
              modifiedContext.headers = headers;
            }
          }
          modifiedContext = defu(rest, modifiedContext);
          continue;
        }
        return result;
      }
    }
  }
  return { context: modifiedContext };
}

async function runAfterHooks(
  context: HookEndpointContext,
  hooks: {
    matcher: (context: HookEndpointContext) => boolean;
    handler: UnblockedMiddleware;
  }[]
) {
  for (const hook of hooks) {
    if (hook.matcher(context)) {
      const result = (await hook.handler(context).catch((e) => {
        if (e instanceof APIError) {
          return {
            response: e,
            headers: e.headers ? new Headers(e.headers) : null,
          };
        }
        throw e;
      })) as {
        response: any;
        headers: Headers;
      };
      if (result.headers) {
        result.headers.forEach((value, key) => {
          if (context.context.responseHeaders) {
            if (key.toLowerCase() === 'set-cookie') {
              context.context.responseHeaders.append(key, value);
            } else {
              context.context.responseHeaders.set(key, value);
            }
          } else {
            context.context.responseHeaders = new Headers({
              [key]: value,
            });
          }
        });
      }
      if (result.response) {
        context.context.returned = result.response;
      }
    }
  }
  return {
    response: context.context.returned,
    headers: context.context.responseHeaders,
  };
}

function getHooks(unblockedContext: UnblockedContext) {
  const plugins = unblockedContext.options.plugins || [];
  const beforeHooks: {
    matcher: (context: HookEndpointContext) => boolean;
    handler: UnblockedMiddleware;
  }[] = [];
  const afterHooks: {
    matcher: (context: HookEndpointContext) => boolean;
    handler: UnblockedMiddleware;
  }[] = [];
  if (unblockedContext.options.hooks?.before) {
    beforeHooks.push({
      matcher: () => true,
      handler: unblockedContext.options.hooks.before,
    });
  }
  if (unblockedContext.options.hooks?.after) {
    afterHooks.push({
      matcher: () => true,
      handler: unblockedContext.options.hooks.after,
    });
  }
  const pluginBeforeHooks = plugins
    .map((plugin) => {
      if (plugin.hooks?.before) {
        return plugin.hooks.before;
      }
    })
    .filter((plugin) => plugin !== undefined)
    .flat();
  const pluginAfterHooks = plugins
    .map((plugin) => {
      if (plugin.hooks?.after) {
        return plugin.hooks.after;
      }
    })
    .filter((plugin) => plugin !== undefined)
    .flat();

  /**
   * Add plugin added hooks at last
   */
  pluginBeforeHooks.length && beforeHooks.push(...pluginBeforeHooks);
  pluginAfterHooks.length && afterHooks.push(...pluginAfterHooks);

  return {
    beforeHooks,
    afterHooks,
  };
}
