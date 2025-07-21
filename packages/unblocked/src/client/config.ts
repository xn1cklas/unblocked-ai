import { createFetch } from '@better-fetch/fetch';
import type { WritableAtom } from 'nanostores';
import { getBaseURL } from '../utils/url';
import { createAIActions, getAIAtoms } from './ai-atoms';
import { redirectPlugin } from './fetch-plugins';
import { parseJSON } from './parser';
import type {
  AtomListener,
  ClientOptions,
  UnblockedClientPlugin,
} from './types';

export const getClientConfig = (options?: ClientOptions) => {
  /* check if the credentials property is supported. Useful for cf workers */
  const isCredentialsSupported = 'credentials' in Request.prototype;
  const baseURL = getBaseURL(options?.baseURL, options?.basePath);
  const pluginsFetchPlugins =
    options?.plugins
      ?.flatMap((plugin) => plugin.fetchPlugins)
      .filter((pl) => pl !== undefined) || [];
  const $fetch = createFetch({
    baseURL,
    ...(isCredentialsSupported ? { credentials: 'include' } : {}),
    method: 'GET',
    jsonParser(text) {
      if (!text) {
        return null;
      }
      return parseJSON(text, {
        strict: false,
      });
    },
    customFetchImpl: async (input, init) => {
      try {
        return await fetch(input, init);
      } catch (error) {
        return Response.error();
      }
    },
    ...options?.fetchOptions,
    plugins: options?.disableDefaultFetchPlugins
      ? [...(options?.fetchOptions?.plugins || []), ...pluginsFetchPlugins]
      : [
          redirectPlugin,
          ...(options?.fetchOptions?.plugins || []),
          ...pluginsFetchPlugins,
        ],
  });
  const plugins = options?.plugins || [];
  const pluginsActions = {} as Record<string, any>;
  // Start with built-in AI atoms - pass $fetch like unblocked
  const aiAtoms = getAIAtoms($fetch);
  const pluginsAtoms = aiAtoms as Record<string, any>;
  const pluginPathMethods: Record<
    string,
    'POST' | 'GET' | 'PATCH' | 'DELETE' | 'PUT'
  > = {};
  const atomListeners: AtomListener[] = [];

  // Add core AI endpoint methods
  const corePathMethods = {
    '/vote': 'PATCH' as const,
    '/history': 'GET' as const,
    '/chat': 'POST' as const,
    '/chat/:chatId/message': 'POST' as const,
    '/chat/:chatId': 'GET' as const,
    '/chat/:chatId/delete': 'DELETE' as const,
    '/document': 'POST' as const,
    '/document/:id': 'GET' as const,
    '/document/:id/update': 'PUT' as const,
    '/document/:id/delete': 'DELETE' as const,
    '/models': 'GET' as const,
    '/models/:modelId': 'GET' as const,
  };
  Object.assign(pluginPathMethods, corePathMethods);

  // Collect AI event handlers
  const aiEventHandlers: Array<(event: any) => void> = [];

  for (const plugin of plugins) {
    if (plugin.getAtoms) {
      Object.assign(pluginsAtoms, plugin.getAtoms?.($fetch));
    }
    if (plugin.pathMethods) {
      Object.assign(pluginPathMethods, plugin.pathMethods);
    }
    if (plugin.atomListeners) {
      atomListeners.push(...plugin.atomListeners);
    }
    if (plugin.onAIEvent) {
      aiEventHandlers.push(plugin.onAIEvent);
    }
  }

  const $store = {
    notify: (signal: string) => {
      if (pluginsAtoms[signal as keyof typeof pluginsAtoms]) {
        pluginsAtoms[signal as keyof typeof pluginsAtoms].set(
          !pluginsAtoms[signal as keyof typeof pluginsAtoms].get()
        );
      }
    },
    listen: (
      signal: string,
      listener: (value: boolean, oldValue?: boolean | undefined) => void
    ) => {
      if (pluginsAtoms[signal as keyof typeof pluginsAtoms]) {
        pluginsAtoms[signal as keyof typeof pluginsAtoms].subscribe(listener);
      }
    },
    atoms: pluginsAtoms,
  };

  // Add built-in AI actions - pass atoms like in ai-atoms.ts
  Object.assign(pluginsActions, createAIActions($fetch, aiAtoms));

  for (const plugin of plugins) {
    if (plugin.getActions) {
      Object.assign(
        pluginsActions,
        plugin.getActions?.($fetch, $store, options)
      );
    }
  }

  // Call onInit hooks
  const initPromises: Promise<void>[] = [];
  for (const plugin of plugins) {
    if (plugin.onInit) {
      const result = plugin.onInit({ $fetch, $store, options });
      if (result instanceof Promise) {
        initPromises.push(result);
      }
    }
  }

  // Wait for all init hooks to complete
  if (initPromises.length > 0) {
    Promise.all(initPromises).catch((error) => {
      console.error('Plugin initialization error:', error);
    });
  }

  // Function to emit AI events to all handlers
  const emitAIEvent = (
    event: Parameters<NonNullable<UnblockedClientPlugin['onAIEvent']>>[0]
  ) => {
    aiEventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('AI event handler error:', error);
      }
    });
  };

  return {
    pluginsActions,
    pluginsAtoms,
    pluginPathMethods,
    atomListeners,
    $fetch,
    $store,
    emitAIEvent,
    plugins,
  };
};
