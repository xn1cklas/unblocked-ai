import type { Store, StoreValue } from 'nanostores';
import {
  type DeepReadonly,
  getCurrentInstance,
  getCurrentScope,
  onScopeDispose,
  readonly,
  type ShallowRef,
  shallowRef,
  type UnwrapNestedRefs,
} from 'vue';

export function registerStore(store: Store) {
  const instance = getCurrentInstance();
  if (instance && instance.proxy) {
    const vm = instance.proxy as { _nanostores?: Store[] };
    const cache = '_nanostores' in vm ? vm._nanostores! : (vm._nanostores = []);
    cache.push(store);
  }
}

export function useStore<
  SomeStore extends Store,
  Value extends StoreValue<SomeStore>,
>(store: SomeStore): DeepReadonly<UnwrapNestedRefs<ShallowRef<Value>>> {
  const state = shallowRef();

  const unsubscribe = store.subscribe((value) => {
    state.value = value;
  });

  getCurrentScope() && onScopeDispose(unsubscribe);

  if (process.env.NODE_ENV !== 'production') {
    registerStore(store);
    return readonly(state);
  }
  return state;
}
