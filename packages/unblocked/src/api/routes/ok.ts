import { HIDE_METADATA } from '../../utils/hide-metadata';
import { createUnblockedEndpoint } from '../call';

export const ok = createUnblockedEndpoint(
  '/ok',
  {
    method: 'GET',
    metadata: {
      ...HIDE_METADATA,
      openapi: {
        description: 'Check if the API is working',
        responses: {
          '200': {
            description: 'API is working',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: {
                      type: 'boolean',
                      description: 'Indicates if the API is working',
                    },
                  },
                  required: ['ok'],
                },
              },
            },
          },
        },
      },
    },
  },
  async (ctx) => {
    return ctx.json({
      ok: true,
    });
  }
);
