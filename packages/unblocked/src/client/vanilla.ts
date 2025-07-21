import type {
  BetterFetchError,
  BetterFetchResponse,
} from '@better-fetch/fetch';
import type { Atom } from 'nanostores';
import type { BASE_ERROR_CODES } from '../error/codes';
import type { PrettifyDeep, UnionToIntersection } from '../types/helper';
import { capitalizeFirstLetter } from '../utils/misc';
import { getClientConfig } from './config';
import { createDynamicPathProxy } from './proxy';
import type {
  ClientOptions,
  InferActions,
  InferClientAPI,
  InferErrorCodes,
  IsSignal,
  UnblockedClientPlugin,
} from './types';

// Dynamic endpoints will be inferred from the API

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
                    : never]: Atoms[key];
              }
            : {}
          : {}
        : {}
    >
  : {};

export function createUnblockedClient<Option extends ClientOptions>(
  options?: Option
) {
  const {
    pluginPathMethods,
    pluginsActions,
    pluginsAtoms,
    $fetch,
    atomListeners,
    $store,
  } = getClientConfig(options);
  const resolvedHooks: Record<string, any> = {};
  for (const [key, value] of Object.entries(pluginsAtoms)) {
    resolvedHooks[`use${capitalizeFirstLetter(key)}`] = value;
  }
  const routes = {
    ...pluginsActions,
    ...resolvedHooks,
    $fetch,
    $store,
  };
  // Create a dynamic proxy using better-auth pattern
  const endpointProxy = createDynamicPathProxy(
    routes,
    $fetch,
    pluginPathMethods,
    pluginsAtoms,
    atomListeners
  );

  const proxy = endpointProxy;
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
