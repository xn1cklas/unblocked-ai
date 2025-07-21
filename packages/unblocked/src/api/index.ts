import { APIError, createRouter, type Middleware } from 'better-call';
import type { UnblockedContext } from '../init';
import type { UnblockedOptions } from '../types';
import type { UnionToIntersection } from '../types/helper';
import type { UnblockedPlugin } from '../types/plugins';
import { logger } from '../utils/logger';
import { originCheckMiddleware } from './middlewares/origin-check';
import {
  chatBasic,
  chatStream,
  // Chat routes
  createChat,
  createStreamId,
  deleteChat,
  deleteDocumentsByIdAfterTimestamp,
  deleteFile,
  deleteMessagesByChatIdAfterTimestamp,
  deleteSuggestion,
  getChatById,
  getChatHistory,
  getChatMessages,
  getDocumentById,
  getDocumentsById,
  getFile,
  getMessageById,
  getMessageCountByUserId,
  getMessageVotes,
  getModelCapabilities,
  // Model routes
  getModels,
  getStreamIdsByChatId,
  getSuggestionsByDocumentId,
  // Vote routes
  getVotesByChatId,
  listFiles,
  removeVote,
  // Document routes
  saveDocument,
  saveMessages,
  // Suggestion routes
  saveSuggestions,
  sendMessage,
  streamMessage,
  updateChatVisibility,
  updateDocument,
  updateSuggestionStatus,
  // File routes
  uploadFile,
  voteMessage,
} from './routes';
import { error } from './routes/error';
import { ok } from './routes/ok';
import { toUnblockedEndpoints } from './to-unblocked-endpoints';

export function getEndpoints<
  C extends UnblockedContext,
  Option extends UnblockedOptions,
>(ctx: Promise<C> | C, options: Option) {
  const pluginEndpoints = options.plugins?.reduce(
    (acc, plugin) => {
      return {
        ...acc,
        ...plugin.endpoints,
      };
    },
    {} as Record<string, any>
  );

  type PluginEndpoint = UnionToIntersection<
    Option['plugins'] extends Array<infer T>
      ? T extends UnblockedPlugin
        ? T extends {
            endpoints: infer E;
          }
          ? E
          : {}
        : {}
      : {}
  >;

  const middlewares =
    options.plugins
      ?.map((plugin) =>
        plugin.middlewares?.map((m) => {
          const middleware = (async (context: any) => {
            return m.middleware({
              ...context,
              context: {
                ...ctx,
                ...context.context,
              },
            });
          }) as Middleware;
          middleware.options = m.middleware.options;
          return {
            path: m.path,
            middleware,
          };
        })
      )
      .filter((plugin) => plugin !== undefined)
      .flat() || [];

  const baseEndpoints = {
    // Chat endpoints
    createChat,
    getChatHistory,
    chatStream,
    chatBasic,
    sendMessage,
    getChatMessages,
    getChatById,
    updateChatVisibility,
    deleteChat,
    saveMessages,
    getMessageById,
    deleteMessagesByChatIdAfterTimestamp,
    getMessageCountByUserId,
    createStreamId,
    getStreamIdsByChatId,
    streamMessage,

    // Document endpoints
    saveDocument,
    getDocumentsById,
    getDocumentById,
    updateDocument,
    deleteDocumentsByIdAfterTimestamp,

    // Vote endpoints
    getVotesByChatId,
    voteMessage,
    getMessageVotes,
    removeVote,

    // Suggestion endpoints
    saveSuggestions,
    getSuggestionsByDocumentId,
    updateSuggestionStatus,
    deleteSuggestion,

    // File endpoints
    uploadFile,
    getFile,
    listFiles,
    deleteFile,

    // Model endpoints
    getModels,
    getModelCapabilities,
  };

  const endpoints = {
    ...baseEndpoints,
    ...pluginEndpoints,
    ok,
    error,
  };

  const api = toUnblockedEndpoints(endpoints, ctx);
  return {
    api: api as typeof endpoints & PluginEndpoint,
    middlewares,
  };
}

export const router = <
  C extends UnblockedContext,
  Option extends UnblockedOptions,
>(
  ctx: C,
  options: Option
) => {
  const { api, middlewares } = getEndpoints(ctx, options);
  const basePath = new URL(ctx.baseURL).pathname;

  return createRouter(api, {
    routerContext: ctx,
    openapi: {
      disabled: true,
    },
    basePath,
    routerMiddleware: [
      {
        path: '/**',
        middleware: originCheckMiddleware,
      },
      ...middlewares,
    ],
    async onRequest(req) {
      // Handle disabled paths
      const disabledPaths = ctx.options.disabledPaths || [];
      const path = new URL(req.url).pathname.replace(basePath, '');
      if (disabledPaths.includes(path)) {
        return new Response('Not Found', { status: 404 });
      }

      // Plugin onRequest hooks
      for (const plugin of ctx.options.plugins || []) {
        if (plugin.onRequest) {
          const response = await plugin.onRequest(req, ctx);
          if (response && 'response' in response) {
            return response.response;
          }
        }
      }

      // Rate limiting would go here when implemented
      // return onRequestRateLimit(req, ctx);
      return;
    },
    async onResponse(res) {
      // Plugin onResponse hooks
      for (const plugin of ctx.options.plugins || []) {
        if (plugin.onResponse) {
          const response = await plugin.onResponse(res, ctx);
          if (response) {
            return response.response;
          }
        }
      }
      return res;
    },
    onError(e) {
      if (e instanceof APIError && e.status === 'FOUND') {
        return;
      }
      if (options.onAPIError?.throw) {
        throw e;
      }
      if (options.onAPIError?.onError) {
        options.onAPIError.onError(e, ctx);
        return;
      }

      const optLogLevel = options.logger?.level;
      const log =
        optLogLevel === 'error' ||
        optLogLevel === 'warn' ||
        optLogLevel === 'debug'
          ? logger
          : undefined;
      if (options.logger?.disabled !== true) {
        if (
          e &&
          typeof e === 'object' &&
          'message' in e &&
          typeof e.message === 'string' &&
          (e.message.includes('no column') ||
            e.message.includes('column') ||
            e.message.includes('relation') ||
            e.message.includes('table') ||
            e.message.includes('does not exist'))
        ) {
          ctx.logger?.error(e.message);
          return;
        }

        if (e instanceof APIError) {
          if (e.status === 'INTERNAL_SERVER_ERROR') {
            ctx.logger.error(e.status, e);
          }
          log?.error(e.message);
        } else {
          ctx.logger?.error(
            e && typeof e === 'object' && 'name' in e ? (e.name as string) : '',
            e
          );
        }
      }
    },
  });
};

export { APIError } from 'better-call';
export * from './call';
export * from './middlewares';
export * from './routes';
