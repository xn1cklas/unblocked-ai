import type {
  BetterFetchOption,
  BetterFetchResponse,
} from '@better-fetch/fetch';
import type { Endpoint, InputContext } from 'better-call';
import type {
  HasRequiredKeys,
  Prettify,
  UnionToIntersection,
} from '../types/helper';
import type {
  ClientOptions,
  InferAdditionalFromClient,
  InferUserFromClient,
} from './types';

export type CamelCase<S extends string> =
  S extends `${infer P1}-${infer P2}${infer P3}`
    ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
    : Lowercase<S>;

export type PathToObject<
  T extends string,
  Fn extends (...args: unknown[]) => unknown,
> = T extends `/${infer Segment}/${infer Rest}`
  ? { [K in CamelCase<Segment>]: PathToObject<`/${Rest}`, Fn> }
  : T extends `/${infer Segment}`
    ? { [K in CamelCase<Segment>]: Fn }
    : never;

export type InferCtx<
  C extends InputContext<any, any>,
  FetchOptions extends BetterFetchOption,
> = C['body'] extends Record<string, any>
  ? C['body'] & {
      fetchOptions?: FetchOptions;
    }
  : C['query'] extends Record<string, any>
    ? {
        query: C['query'];
        fetchOptions?: FetchOptions;
      }
    : C['query'] extends Record<string, any> | undefined
      ? {
          query?: C['query'];
          fetchOptions?: FetchOptions;
        }
      : {
          fetchOptions?: FetchOptions;
        };

export type MergeRoutes<T> = UnionToIntersection<T>;

export type InferRoute<API, COpts extends ClientOptions> = API extends Record<
  string,
  infer T
>
  ? T extends Endpoint
    ? T['options']['metadata'] extends
        | {
            isAction: false;
          }
        | {
            SERVER_ONLY: true;
          }
      ? {}
      : PathToObject<
          T['path'],
          T extends (ctx: infer C) => infer R
            ? C extends InputContext<any, any>
              ? <
                  FetchOptions extends BetterFetchOption<
                    Partial<C['body']> & Record<string, any>,
                    Partial<C['query']> & Record<string, any>,
                    C['params']
                  >,
                >(
                  ...data: HasRequiredKeys<
                    InferCtx<C, FetchOptions>
                  > extends true
                    ? [Prettify<InferCtx<C, FetchOptions>>, FetchOptions?]
                    : [Prettify<InferCtx<C, FetchOptions>>?, FetchOptions?]
                ) => Promise<
                  BetterFetchResponse<
                    T['options']['metadata'] extends {
                      CUSTOM_SESSION: boolean;
                    }
                      ? NonNullable<Awaited<R>>
                      : NonNullable<Awaited<R>>,
                    {
                      code?: string;
                      message?: string;
                    },
                    FetchOptions['throw'] extends true
                      ? true
                      : COpts['fetchOptions'] extends { throw: true }
                        ? true
                        : false
                  >
                >
              : never
            : never
        >
    : {}
  : never;

export type InferRoutes<
  API extends Record<string, Endpoint>,
  ClientOpts extends ClientOptions,
> = MergeRoutes<InferRoute<API, ClientOpts>>;

export type ProxyRequest = {
  options?: BetterFetchOption;
  query?: Record<string, unknown>;
  [key: string]: unknown;
};
