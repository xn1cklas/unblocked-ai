import type {
  BetterFetchError,
  BetterFetchResponse,
} from '@better-fetch/fetch';
import type { Atom } from 'nanostores';
import type { DeepReadonly, Ref } from 'vue';
import type { BASE_ERROR_CODES } from '../../error/codes';
import type { PrettifyDeep, UnionToIntersection } from '../../types/helper';
import { capitalizeFirstLetter } from '../../utils/misc';
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
import { useStore } from './vue-store';

function getAtomKey(str: string) {
  return `use${capitalizeFirstLetter(str)}`;
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
                    : never]: () => DeepReadonly<
                  Ref<Atoms[key] extends Atom<infer T> ? T : any>
                >;
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
    $store,
    atomListeners,
  } = getClientConfig(options);
  const resolvedHooks: Record<string, any> = {};
  for (const [key, value] of Object.entries(pluginsAtoms)) {
    resolvedHooks[getAtomKey(key)] = () => useStore(value);
  }

  type ClientAPI = InferClientAPI<Option>;

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

  return proxy as UnionToIntersection<InferResolvedHooks<Option>> &
    InferClientAPI<Option> &
    InferActions<Option> & {
      $fetch: typeof $fetch;
      $store: typeof $store;
      $ERROR_CODES: PrettifyDeep<
        InferErrorCodes<Option> & typeof BASE_ERROR_CODES
      >;
    };
}

export type * from '@better-fetch/fetch';
export type * from 'nanostores';
