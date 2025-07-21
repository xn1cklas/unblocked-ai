import { describe } from 'vitest';
import type { UnblockedOptions } from '../../types';
import { runAdapterTest, runNumberIdAdapterTest } from '../test';
import { memoryAdapter } from './memory-adapter';

describe('adapter test', async () => {
  const db = {
    user: [],
    session: [],
    account: [],
  };
  const adapter = memoryAdapter(db, {
    debugLogs: {
      isRunningAdapterTests: true,
    },
  });
  await runAdapterTest({
    getAdapter: async (customOptions: Partial<UnblockedOptions> = {}) => {
      return adapter({
        ...customOptions,
        user: customOptions.user || {
          getUser: () => ({
            id: 'test-user-id',
            email: 'test@test.com',
            name: 'Test User',
          }),
        },
      });
    },
  });
});

describe('Number Id Adapter Test', async () => {
  const db = {
    user: [],
    session: [],
    account: [],
  };
  const adapter = memoryAdapter(db, {
    debugLogs: {
      isRunningAdapterTests: true,
    },
  });
  await runNumberIdAdapterTest({
    getAdapter: async (customOptions: Partial<UnblockedOptions> = {}) => {
      return adapter({
        ...customOptions,
        user: customOptions.user || {
          getUser: () => ({
            id: 'test-user-id',
            email: 'test@test.com',
            name: 'Test User',
          }),
        },
      });
    },
  });
});
