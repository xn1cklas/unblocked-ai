import type { UnblockedOptions, UnblockedPlugin } from '../types';
import type { UnblockedClientPlugin } from './types';

export * from './query';
export * from './streaming';
export * from './tool-execution';
export * from './types';
export * from './vanilla';

export const InferPlugin = <T extends UnblockedPlugin>() => {
  return {
    id: 'infer-server-plugin',
    $InferServerPlugin: {} as T,
  } satisfies UnblockedClientPlugin;
};

export function InferAI<O extends { options: UnblockedOptions }>() {
  return {} as O['options'];
}

export type * from '@better-fetch/fetch';
//@ts-expect-error
export type * from 'nanostores';
