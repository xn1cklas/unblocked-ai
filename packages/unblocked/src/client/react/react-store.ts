import type { Store, StoreValue } from 'nanostores';
import { listenKeys } from 'nanostores';
import type { DependencyList } from 'react';
import { useCallback, useRef, useSyncExternalStore } from 'react';

type StoreKeys<T> = T extends { setKey: (k: infer K, v: unknown) => unknown }
  ? K
  : never;

export interface UseStoreOptions<SomeStore> {
  /**
   * @default
   * ```ts
   * [store, options.keys]
   * ```
   */
  deps?: DependencyList;

  /**
   * Will re-render components only on specific key changes.
   */
  keys?: StoreKeys<SomeStore>[];
}

/**
 * Subscribe to store changes and get store's value.
 *
 * Can be user with store builder too.
 *
 * ```js
 * import { useStore } from 'nanostores/react'
 *
 * import { router } from '../store/router'
 *
 * export const Layout = () => {
 *   let page = useStore(router)
 *   if (page.route === 'home') {
 *     return <HomePage />
 *   } else {
 *     return <Error404 />
 *   }
 * }
 * ```
 *
 * @param store Store instance.
 * @returns Store value.
 */
export function useStore<SomeStore extends Store>(
  store: SomeStore,
  options: UseStoreOptions<SomeStore> = {}
): StoreValue<SomeStore> {
  const snapshotRef = useRef<StoreValue<SomeStore>>(store.get());

  const { keys, deps = [store, keys] } = options;

  const subscribe = useCallback((onChange: () => void) => {
    const emitChange = (value: StoreValue<SomeStore>) => {
      if (snapshotRef.current === value) return;
      snapshotRef.current = value;
      onChange();
    };

    emitChange(store.value);
    if (keys?.length) {
      return listenKeys(
        store as Store & { setKey: (k: unknown, v: unknown) => void },
        keys,
        emitChange
      );
    }
    return store.listen(emitChange);
  }, deps);

  const get = () => snapshotRef.current as StoreValue<SomeStore>;

  return useSyncExternalStore(subscribe, get, get);
}
