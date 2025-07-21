import type {
  BetterFetchError,
  BetterFetchResponse,
} from '@better-fetch/fetch';
import type { Atom } from 'nanostores';
import type { Accessor } from 'solid-js';
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
import { useStore } from './solid-store';

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
                    : never]: () => Accessor<
                  Atoms[key] extends Atom<infer T> ? T : any
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
    atomListeners,
  } = getClientConfig(options);
  const resolvedHooks: Record<string, any> = {};
  for (const [key, value] of Object.entries(pluginsAtoms)) {
    resolvedHooks[getAtomKey(key)] = () => useStore(value);
  }
  const routes = {
    ...pluginsActions,
    ...resolvedHooks,
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
    InferClientAPI<Option> &
    InferActions<Option> & {
      $fetch: typeof $fetch;
      $ERROR_CODES: PrettifyDeep<
        InferErrorCodes<Option> & typeof BASE_ERROR_CODES
      >;
    };
}

export type * from '@better-fetch/fetch';
export type * from 'nanostores';
