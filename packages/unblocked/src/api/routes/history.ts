import { APIError } from 'better-call';
import { z } from 'zod';
import { BASE_ERROR_CODES } from '../../error/codes';
import type { Chat, Where } from '../../types';
import { createUnblockedEndpoint } from '../call';

/**
 * Get chat history for the current user
 * Matches demo's /api/history endpoint with cursor-based pagination
 */
export const getChatHistory = createUnblockedEndpoint(
  '/history',
  {
    method: 'GET',
    query: z.object({
      limit: z.coerce.number().min(1).max(100).default(10).optional(),
      starting_after: z.string().optional(),
      ending_before: z.string().optional(),
    }),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    const { limit = 10, starting_after, ending_before } = ctx.query;

    if (starting_after && ending_before) {
      throw new APIError('BAD_REQUEST', {
        message: BASE_ERROR_CODES.INVALID_REQUEST,
      });
    }

    const extendedLimit = limit + 1;
    const where: Where[] = [{ field: 'userId', value: user.id }];

    // Handle cursor-based pagination using createdAt timestamps
    if (starting_after) {
      // Find the reference chat to get its createdAt timestamp
      const selectedChat = await ctx.context.adapter.findOne<Chat>({
        model: 'chat',
        where: [{ field: 'id', value: starting_after }],
      });

      if (!selectedChat) {
        throw new APIError('NOT_FOUND', {
          message: BASE_ERROR_CODES.CHAT_NOT_FOUND,
        });
      }

      where.push({
        field: 'createdAt',
        value: selectedChat.createdAt.toISOString(),
        operator: 'gt',
      });
    } else if (ending_before) {
      // Find the reference chat to get its createdAt timestamp
      const selectedChat = await ctx.context.adapter.findOne<Chat>({
        model: 'chat',
        where: [{ field: 'id', value: ending_before }],
      });

      if (!selectedChat) {
        throw new APIError('NOT_FOUND', {
          message: BASE_ERROR_CODES.CHAT_NOT_FOUND,
        });
      }

      where.push({
        field: 'createdAt',
        value: selectedChat.createdAt.toISOString(),
        operator: 'lt',
      });
    }

    // Fetch chats based on filters
    const chats = await ctx.context.adapter.findMany<Chat>({
      model: 'chat',
      where,
      sortBy: { field: 'createdAt', direction: 'desc' },
      limit: extendedLimit,
    });

    const hasMore = chats.length > limit;
    const resultChats = hasMore ? chats.slice(0, limit) : chats;

    return ctx.json({
      chats: resultChats,
      hasMore,
    });
  }
);
