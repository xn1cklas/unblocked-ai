import {
  createUnblockedEndpoint,
  type UnblockedMiddleware,
} from '../../api/call';
import type { FieldAttribute } from '../../db/field';
import type { HookEndpointContext, UnblockedContext } from '../../types';
import type { UnblockedPlugin } from '../../types/plugins';

export interface QuotaConfig {
  /**
   * Default quota limits for different resource types
   */
  defaults?: {
    messages?: {
      perDay?: number;
      perHour?: number;
      perMinute?: number;
    };
    tokens?: {
      perDay?: number;
      perMonth?: number;
    };
    storage?: {
      maxChats?: number;
      maxMessagesPerChat?: number;
      maxDocuments?: number;
    };
  };
  /**
   * Anonymous user quota (stricter limits)
   */
  anonymous?: {
    messages?: {
      perDay?: number;
      perHour?: number;
    };
    requireCaptcha?: boolean;
    maxSessionDuration?: number;
  };
  /**
   * Grace period for premium users
   */
  gracePeriod?: {
    enabled: boolean;
    duration: number; // seconds
    allowedOverage: number; // percentage
  };
}

/**
 * Quota plugin for Unblocked
 *
 * Manages user quotas for messages, tokens, and storage.
 * Tracks usage and enforces limits across different time periods.
 *
 * @example
 * ```ts
 * const ai = unblocked({
 *   plugins: [
 *     quotaPlugin({
 *       defaults: {
 *         messages: { perDay: 100, perHour: 20 },
 *         tokens: { perMonth: 100000 }
 *       },
 *       anonymous: {
 *         messages: { perDay: 10 },
 *         requireCaptcha: true
 *       }
 *     })
 *   ]
 * });
 * ```
 */
export const quotaPlugin = (config?: QuotaConfig): UnblockedPlugin => ({
  id: 'quota',

  schema: {
    quota: {
      fields: {
        id: { type: 'string', primary: true } as FieldAttribute,
        userId: { type: 'string', required: true } as FieldAttribute,
        type: { type: 'string', required: true } as FieldAttribute, // "messages", "tokens", "storage"
        period: { type: 'string', required: true } as FieldAttribute, // "day", "hour", "minute", "month"
        limit: { type: 'number', required: true } as FieldAttribute,
        used: {
          type: 'number',
          required: true,
          defaultValue: 0,
        } as FieldAttribute,
        resetAt: { type: 'date', required: true } as FieldAttribute,
        metadata: { type: 'string' } as FieldAttribute, // JSON serialized
        createdAt: { type: 'date', required: true } as FieldAttribute,
        updatedAt: { type: 'date', required: true } as FieldAttribute,
      },
    },
    quotaUsage: {
      fields: {
        id: { type: 'string', primary: true } as FieldAttribute,
        userId: { type: 'string', required: true } as FieldAttribute,
        quotaId: { type: 'string', required: true } as FieldAttribute,
        amount: { type: 'number', required: true } as FieldAttribute,
        operation: { type: 'string', required: true } as FieldAttribute,
        metadata: { type: 'string' } as FieldAttribute, // JSON serialized
        timestamp: { type: 'date', required: true } as FieldAttribute,
      },
    },
  },

  init: (ctx: UnblockedContext) => {
    // Initialize quota tracking for new users
    return {
      options: {
        databaseHooks: {
          user: {
            create: {
              after: async (user: any) => {
                // Create default quotas for new user
                if (config?.defaults) {
                  const now = new Date();
                  const quotas = [];

                  // Message quotas
                  if (config.defaults.messages?.perDay) {
                    quotas.push({
                      userId: user.id,
                      type: 'messages',
                      period: 'day',
                      limit: config.defaults.messages.perDay,
                      used: 0,
                      resetAt: getNextReset(now, 'day'),
                      createdAt: now,
                      updatedAt: now,
                    });
                  }

                  // Token quotas
                  if (config.defaults.tokens?.perMonth) {
                    quotas.push({
                      userId: user.id,
                      type: 'tokens',
                      period: 'month',
                      limit: config.defaults.tokens.perMonth,
                      used: 0,
                      resetAt: getNextReset(now, 'month'),
                      createdAt: now,
                      updatedAt: now,
                    });
                  }

                  // Batch create quotas
                  for (const quota of quotas) {
                    await ctx.adapter.create({
                      model: 'quota',
                      data: quota,
                    });
                  }
                }
              },
            },
          },
        },
      },
    };
  },

  hooks: {
    before: [
      {
        matcher: (context) => context.path.includes('/chat/send-message'),
        handler: (async (context: any) => {
          const { context: unblockedContext } = context;
          const { adapter } = unblockedContext;
          const user = await unblockedContext.getUser?.(
            context.request as Request
          );

          // Skip quota check for system/admin users
          if (user?.role === 'admin') return;

          const userId = user?.id || 'anonymous';
          const isAnonymous = !user?.id;

          // Get message quota
          const quota = await adapter.findOne({
            model: 'quota',
            where: [
              { field: 'userId', value: userId },
              { field: 'type', value: 'messages' },
              { field: 'period', value: 'day' },
            ],
          });

          // Check if quota exists and is exceeded
          if (quota) {
            // Reset quota if needed
            if (new Date() > (quota as any).resetAt) {
              await adapter.update({
                model: 'quota',
                where: [{ field: 'id', value: (quota as any).id }],
                update: {
                  used: 0,
                  resetAt: getNextReset(new Date(), (quota as any).period),
                  updatedAt: new Date(),
                },
              });
              (quota as any).used = 0;
            }

            // Check limit
            if ((quota as any).used >= (quota as any).limit) {
              // Check grace period for premium users
              if (config?.gracePeriod?.enabled && user?.plan === 'premium') {
                const allowedOverage = Math.ceil(
                  (quota as any).limit *
                    (config.gracePeriod.allowedOverage / 100)
                );
                if (
                  (quota as any).used <
                  (quota as any).limit + allowedOverage
                ) {
                  // Log grace period usage
                  await adapter.create({
                    model: 'quotaUsage',
                    data: {
                      userId,
                      quotaId: (quota as any).id,
                      amount: 1,
                      operation: 'grace_period',
                      metadata: { gracePeriodUsed: true },
                      timestamp: new Date(),
                    },
                  });
                  return;
                }
              }

              throw new Error('QUOTA_EXCEEDED', {
                cause: {
                  type: 'messages',
                  limit: (quota as any).limit,
                  used: (quota as any).used,
                  resetAt: (quota as any).resetAt,
                },
              });
            }
          } else if (isAnonymous && config?.anonymous) {
            // Create temporary quota for anonymous user
            const limit = config.anonymous.messages?.perDay || 5;
            await adapter.create({
              model: 'quota',
              data: {
                userId: 'anonymous',
                type: 'messages',
                period: 'day',
                limit,
                used: 0,
                resetAt: getNextReset(new Date(), 'day'),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        }) as UnblockedMiddleware,
      },
    ],
    after: [
      {
        matcher: (context) => context.path.includes('/chat/send-message'),
        handler: (async (context: any) => {
          const { context: unblockedContext } = context;
          const { adapter } = unblockedContext;
          const user = await unblockedContext.getUser?.(
            context.request as Request
          );
          const userId = user?.id || 'anonymous';
          const data = (context.context as any).returned;

          // Update quota usage
          const quota = await adapter.findOne({
            model: 'quota',
            where: [
              { field: 'userId', value: userId },
              { field: 'type', value: 'messages' },
              { field: 'period', value: 'day' },
            ],
          });

          if (quota) {
            // Increment usage
            await adapter.update({
              model: 'quota',
              where: [{ field: 'id', value: (quota as any).id }],
              update: {
                used: (quota as any).used + 1,
                updatedAt: new Date(),
              },
            });

            // Log usage
            await adapter.create({
              model: 'quotaUsage',
              data: {
                userId,
                quotaId: (quota as any).id,
                amount: 1,
                operation: 'send_message',
                metadata: {
                  messageId: data?.messageId,
                  model: data?.model,
                },
                timestamp: new Date(),
              },
            });
          }
        }) as UnblockedMiddleware,
      },
    ],
  },

  endpoints: {
    '/quota/usage': createUnblockedEndpoint(
      '/quota/usage',
      {
        method: 'GET',
      },
      async (ctx) => {
        const { context } = ctx;
        const { adapter } = context;
        const user = await context.getUser?.(ctx.request as Request);

        if (!user) {
          throw new Error('UNAUTHORIZED');
        }

        const quotas = await adapter.findMany({
          model: 'quota',
          where: [{ field: 'userId', value: user.id }],
        });

        return ctx.json({
          quotas: quotas.map((quota: any) => ({
            type: (quota as any).type,
            period: (quota as any).period,
            limit: (quota as any).limit,
            used: (quota as any).used,
            remaining: Math.max(0, (quota as any).limit - (quota as any).used),
            resetAt: (quota as any).resetAt,
          })),
        });
      }
    ),
    '/quota/reset': createUnblockedEndpoint(
      '/quota/reset',
      {
        method: 'POST',
      },
      async (ctx) => {
        const { context, body } = ctx;
        const { adapter } = context;
        const user = await context.getUser?.(ctx.request as Request);

        // Admin only endpoint
        if (user?.role !== 'admin') {
          throw new Error('FORBIDDEN');
        }

        const { userId, type } = body as { userId: string; type: string };

        const quota = await adapter.findOne({
          model: 'quota',
          where: [
            { field: 'userId', value: userId },
            { field: 'type', value: type },
          ],
        });

        if (quota) {
          await adapter.update({
            model: 'quota',
            where: [{ field: 'id', value: (quota as any).id }],
            update: {
              used: 0,
              updatedAt: new Date(),
            },
          });
        }

        return ctx.json({ success: true });
      }
    ),
  },
});

/**
 * Calculate next reset time based on period
 */
function getNextReset(from: Date, period: string): Date {
  const next = new Date(from);

  switch (period) {
    case 'minute':
      next.setMinutes(next.getMinutes() + 1, 0, 0);
      break;
    case 'hour':
      next.setHours(next.getHours() + 1, 0, 0, 0);
      break;
    case 'day':
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      break;
    case 'month':
      next.setMonth(next.getMonth() + 1, 1);
      next.setHours(0, 0, 0, 0);
      break;
    default:
      throw new Error(`Invalid period: ${period}`);
  }

  return next;
}

export default quotaPlugin;
