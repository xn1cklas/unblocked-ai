import type { BetterFetch, BetterFetchOption } from '@better-fetch/fetch';
import type { Atom, PreinitializedWritableAtom } from 'nanostores';
import type { ProxyRequest } from './path-to-object';
import type { UnblockedClientPlugin } from './types';

function getMethod(
  path: string,
  knownPathMethods: Record<string, 'POST' | 'GET' | 'PATCH' | 'DELETE' | 'PUT'>,
  args:
    | { fetchOptions?: BetterFetchOption; query?: Record<string, any> }
    | undefined
) {
  const method = knownPathMethods[path];
  const { fetchOptions, query, ...body } = args || {};
  if (method) {
    return method;
  }
  if (fetchOptions?.method) {
    return fetchOptions.method;
  }
  if (body && Object.keys(body).length > 0) {
    return 'POST';
  }
  return 'GET';
}

export type AuthProxySignal = {
  atom: PreinitializedWritableAtom<boolean>;
  matcher: (path: string) => boolean;
};

export function createDynamicPathProxy<T extends Record<string, unknown>>(
  routes: T,
  client: BetterFetch,
  knownPathMethods: Record<string, 'POST' | 'GET' | 'PATCH' | 'DELETE' | 'PUT'>,
  atoms: Record<string, Atom>,
  atomListeners: UnblockedClientPlugin['atomListeners']
): T {
  function createProxy(path: string[] = []): T {
    return new Proxy((() => {}) as any, {
      get(target, prop: string) {
        const fullPath = [...path, prop];
        let current: T | unknown = routes;
        for (const segment of fullPath) {
          if (current && typeof current === 'object' && segment in current) {
            current = (current as Record<string, unknown>)[segment];
          } else {
            current = undefined;
            break;
          }
        }
        if (typeof current === 'function') {
          return current;
        }
        // Always return a proxy for unknown paths to support dynamic endpoints
        return createProxy(fullPath);
      },
      apply: async (_, __, args) => {
        const routePath =
          '/' +
          path
            .map((segment) =>
              segment.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
            )
            .join('/');
        const arg = (args[0] || {}) as ProxyRequest;
        const fetchOptions = (args[1] || {}) as BetterFetchOption;
        const { query, fetchOptions: argFetchOptions, ...body } = arg;
        const options = {
          ...fetchOptions,
          ...(argFetchOptions || {}),
        } as BetterFetchOption;
        const method = getMethod(routePath, knownPathMethods, arg);

        return await client(routePath, {
          ...options,
          body:
            method === 'GET'
              ? undefined
              : {
                  ...body,
                  ...(options?.body || {}),
                },
          query: query || options?.query,
          method,
          async onSuccess(context) {
            await options?.onSuccess?.(context);
            /**
             * We trigger listeners
             */
            const matches = atomListeners?.find((s) => s.matcher(routePath));
            if (!matches) return;
            const signal = atoms[matches.signal as keyof typeof atoms];
            if (!signal) return;
            /**
             * To avoid race conditions we set the signal in a setTimeout
             */
            const val = signal.get();
            setTimeout(() => {
              // Only set if the signal is writable
              if ('set' in signal && typeof signal.set === 'function') {
                (signal as any).set(!val);
              }
            }, 10);
          },
        });
      },
    });
  }
  return createProxy() as T;
}
