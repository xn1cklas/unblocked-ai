import { atom, computed } from 'nanostores';
import { createUnblockedEndpoint } from '../api/call';
import type { UnblockedPlugin } from '../types/plugins';
import { useAIQuery } from './query';
import type { UnblockedClientPlugin } from './types';

const serverPlugin = {
  id: 'test',
  endpoints: {
    test: createUnblockedEndpoint(
      '/test',
      {
        method: 'GET',
      },
      async (c) => {
        return {
          data: 'test',
        };
      }
    ),
    testSignOut2: createUnblockedEndpoint(
      '/test-2/sign-out',
      {
        method: 'POST',
      },
      async (c) => {
        return null;
      }
    ),
  },
  schema: {
    user: {
      fields: {
        testField: {
          type: 'string',
          required: false,
        },
        testField2: {
          type: 'number',
          required: false,
        },
        testField3: {
          type: 'string',
          returned: false,
        },
        testField4: {
          type: 'string',
          defaultValue: 'test',
        },
      },
    },
  },
} satisfies UnblockedPlugin;

export const testClientPlugin = () => {
  const $test = atom(false);
  let testValue = 0;
  const computedAtom = computed($test, () => {
    return testValue++;
  });
  return {
    id: 'test' as const,
    getActions($fetch) {
      return {
        setTestAtom(value: boolean) {
          $test.set(value);
        },
      };
    },
    getAtoms($fetch) {
      const $signal = atom(false);
      const queryAtom = useAIQuery<any>($signal, '/test', $fetch, {
        method: 'GET',
      });
      return {
        $test,
        $signal,
        computedAtom,
        queryAtom,
      };
    },
    $InferServerPlugin: {} as typeof serverPlugin,
    atomListeners: [
      {
        matcher: (path) => path === '/test',
        signal: '$test',
      },
      {
        matcher: (path) => path === '/test2/sign-out',
        signal: '$userSignal',
      },
    ],
  } satisfies UnblockedClientPlugin;
};
export const testClientPlugin2 = () => {
  const $test2 = atom(false);
  let testValue = 0;
  const anotherAtom = computed($test2, () => {
    return testValue++;
  });
  return {
    id: 'test',
    getAtoms($fetch) {
      return {
        $test2,
        anotherAtom,
      };
    },
    atomListeners: [
      {
        matcher: (path) => path === '/test',
        signal: '$test',
      },
      {
        matcher: (path) => path === '/test2/sign-out',
        signal: '$userSignal',
      },
    ],
  } satisfies UnblockedClientPlugin;
};
