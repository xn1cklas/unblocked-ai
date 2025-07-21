import type { BetterFetchPlugin } from '@better-fetch/fetch';

export const redirectPlugin = {
  id: 'redirect',
  name: 'Redirect',
  hooks: {
    onSuccess(context) {
      if (
        context.data?.url &&
        context.data?.redirect &&
        typeof window !== 'undefined' &&
        window.location &&
        window.location
      ) {
        try {
          window.location.href = context.data.url;
        } catch {}
      }
    },
  },
} satisfies BetterFetchPlugin;
