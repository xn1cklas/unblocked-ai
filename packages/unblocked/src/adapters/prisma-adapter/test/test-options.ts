import type { Adapter, UnblockedOptions } from '../../../types';

export const createTestOptions = (
  adapter: (options: UnblockedOptions) => Adapter,
  useNumberId = false
) =>
  ({
    database: adapter,
    user: {
      getUser: () => ({
        id: 'test-user-id',
        email: 'test@test.com',
        name: 'Test User',
      }),
    },
    advanced: {
      database: {
        useNumberId,
      },
    },
  }) satisfies UnblockedOptions;
