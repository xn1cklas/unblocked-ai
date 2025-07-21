/**
 * React client for Unblocked - Following unblocked patterns
 *
 * This file provides the React-specific client that automatically generates
 * hooks from atoms registered by plugins.
 */

import type { Atom } from 'nanostores';
import type { BASE_ERROR_CODES } from '../../error/codes';
import type { PrettifyDeep, UnionToIntersection } from '../../types/helper';
import { getClientConfig } from '../config';
import { createDynamicPathProxy } from '../proxy';
import type {
  ClientOptions,
  InferActions,
  InferClientAPI,
  InferErrorCodes,
  IsSignal,
  UnblockedClientPlugin,
} from '../types';
import { useStore } from './react-store';

function getAtomKey(str: string) {
  return `use${capitalizeFirstLetter(str)}`;
}

export function capitalizeFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

type InferResolvedHooks<O extends ClientOptions> = O['plugins'] extends Array<
  infer Plugin
>
  ? UnionToIntersection<
      Plugin extends UnblockedClientPlugin
        ? Plugin['getAtoms'] extends (fetch: unknown) => infer Atoms
          ? Atoms extends Record<string, unknown>
            ? {
                [key in keyof Atoms as IsSignal<key> extends true
                  ? never
                  : key extends string
                    ? `use${Capitalize<key>}`
                    : never]: () => Atoms[key] extends Atom<infer T> ? T : any;
              }
            : {}
          : {}
        : {}
    >
  : {};

/**
 * Create an Unblocked React client with automatically generated hooks
 *
 * @example
 * ```typescript
 * import { createUnblockedClient } from "unblocked/client/react";
 * import { aiPlugin } from "unblocked/client/plugins";
 *
 * const client = createUnblockedClient({
 *   baseURL: "http://localhost:3000",
 *   plugins: [
 *     aiPlugin()
 *   ]
 * });
 *
 * // In your components:
 * function MyComponent() {
 *   const user = client.useUser();
 *   const chat = client.useChat();
 *   const isAuthenticated = client.useIsAuthenticated();
 *
 *   // Actions are available directly on the client
 *   const handleCreateChat = async () => {
 *     await client.createChat({ title: "New Chat" });
 *   };
 * }
 * ```
 */
export function createUnblockedClient<Option extends ClientOptions>(
  options?: Option
) {
  const {
    pluginPathMethods,
    pluginsActions,
    pluginsAtoms,
    $fetch,
    $store,
    atomListeners,
  } = getClientConfig(options);

  // Generate hooks from atoms
  const resolvedHooks: Record<string, any> = {};
  for (const [key, value] of Object.entries(pluginsAtoms)) {
    resolvedHooks[getAtomKey(key)] = () => useStore(value);
  }

  const routes = {
    ...pluginsActions,
    ...resolvedHooks,
    $fetch,
    $store,
  };

  const proxy = createDynamicPathProxy(
    routes,
    $fetch,
    pluginPathMethods,
    pluginsAtoms,
    atomListeners
  );

  type ClientAPI = InferClientAPI<Option>;
  return proxy as UnionToIntersection<InferResolvedHooks<Option>> &
    ClientAPI &
    InferActions<Option> & {
      $fetch: typeof $fetch;
      $store: typeof $store;
      $ERROR_CODES: PrettifyDeep<
        InferErrorCodes<Option> & typeof BASE_ERROR_CODES
      >;
    };
}

export { useStore };
export type * from '@better-fetch/fetch';
export type * from 'nanostores';
