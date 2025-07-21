import { createEndpoint, createMiddleware } from 'better-call';
import type { UnblockedContext } from '../init';

export const optionsMiddleware = createMiddleware(async () => {
  /**
   * This will be passed on the instance of
   * the context. Used to infer the type
   * here.
   */
  return {} as UnblockedContext;
});

export const createUnblockedMiddleware = createMiddleware.create({
  use: [
    optionsMiddleware,
    /**
     * Only use for post hooks
     */
    createMiddleware(async () => {
      return {} as {
        returned?: unknown;
        responseHeaders?: Headers;
      };
    }),
  ],
});

export const createUnblockedEndpoint = createEndpoint.create({
  use: [optionsMiddleware],
});

export type UnblockedEndpoint = ReturnType<typeof createUnblockedEndpoint>;
export type UnblockedMiddleware = ReturnType<typeof createUnblockedMiddleware>;

// Legacy aliases for backward compatibility - to be removed
export const createAuthEndpoint = createUnblockedEndpoint;
export const createAuthMiddleware = createUnblockedMiddleware;
