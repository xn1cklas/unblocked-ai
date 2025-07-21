import { APIError } from 'better-call';
import { z } from 'zod';
import { BASE_ERROR_CODES } from '../../error/codes';
import type { Chat, Message, Vote } from '../../types';
import { createUnblockedEndpoint } from '../call';

/**
 * Get votes for a chat (matches demo's getVotesByChatId)
 */
export const getVotesByChatId = createUnblockedEndpoint(
  '/chat/:chatId/votes',
  {
    method: 'GET',
    params: z.object({
      chatId: z.string(),
    }),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    // Verify chat exists and user has access
    const chat = await ctx.context.adapter.findOne<Chat>({
      model: 'chat',
      where: [{ field: 'id', value: ctx.params.chatId }],
    });

    if (!chat) {
      throw new APIError('NOT_FOUND', {
        message: BASE_ERROR_CODES.CHAT_NOT_FOUND,
      });
    }

    if (chat.userId !== user.id) {
      throw new APIError('FORBIDDEN', {
        message: BASE_ERROR_CODES.CHAT_ACCESS_DENIED,
      });
    }

    const votes = await ctx.context.adapter.findMany<Vote>({
      model: 'vote',
      where: [{ field: 'chatId', value: ctx.params.chatId }],
    });

    return ctx.json(votes);
  }
);

/**
 * Vote on a message (matches demo's voteMessage)
 */
export const voteMessage = createUnblockedEndpoint(
  '/vote',
  {
    method: 'PATCH',
    body: z.object({
      chatId: z.string(),
      messageId: z.string(),
      type: z.enum(['up', 'down']),
    }),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    const { chatId, messageId, type } = ctx.body;

    // Verify chat exists and user has access
    const chat = await ctx.context.adapter.findOne<Chat>({
      model: 'chat',
      where: [{ field: 'id', value: chatId }],
    });

    if (!chat) {
      throw new APIError('NOT_FOUND', {
        message: BASE_ERROR_CODES.CHAT_NOT_FOUND,
      });
    }

    if (chat.userId !== user.id) {
      throw new APIError('FORBIDDEN', {
        message: BASE_ERROR_CODES.CHAT_ACCESS_DENIED,
      });
    }

    // Check if vote already exists (using composite key)
    const existingVote = await ctx.context.adapter.findOne<Vote>({
      model: 'vote',
      where: [
        { field: 'chatId', value: chatId },
        { field: 'messageId', value: messageId },
      ],
    });

    let voteResult: Vote | null;

    if (existingVote) {
      // Update existing vote
      voteResult = await ctx.context.adapter.update<Vote>({
        model: 'vote',
        where: [
          { field: 'chatId', value: chatId },
          { field: 'messageId', value: messageId },
        ],
        update: {
          isUpvoted: type === 'up',
        },
      });
      if (!voteResult) {
        throw new APIError('NOT_FOUND', {
          message: BASE_ERROR_CODES.VOTE_NOT_FOUND,
        });
      }
    } else {
      // Create new vote
      voteResult = await ctx.context.adapter.create<Vote>({
        model: 'vote',
        data: {
          chatId,
          messageId,
          isUpvoted: type === 'up',
        },
      });
    }

    return ctx.json({
      vote: {
        id:
          (voteResult as any).id ||
          `${voteResult.chatId}_${voteResult.messageId}`,
        chatId: voteResult.chatId,
        messageId: voteResult.messageId,
        vote: voteResult.isUpvoted ? 'up' : 'down',
        votedAt: (voteResult as any).createdAt || new Date(),
      },
    });
  }
);

/**
 * Get votes for a message
 */
export const getMessageVotes = createUnblockedEndpoint(
  '/message/:messageId/votes',
  {
    method: 'GET',
    params: z.object({
      messageId: z.string(),
    }),
    query: z
      .object({
        vote: z.enum(['up', 'down']).optional(),
      })
      .optional(),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    const { messageId } = ctx.params;
    const { vote } = ctx.query || {};

    // Verify message exists and get chat info
    const message = await ctx.context.adapter.findOne<Message>({
      model: 'message',
      where: [{ field: 'id', value: messageId }],
    });

    if (!message) {
      throw new APIError('NOT_FOUND', {
        message: BASE_ERROR_CODES.MESSAGE_NOT_FOUND,
      });
    }

    // Verify chat exists and user has access
    const chat = await ctx.context.adapter.findOne<Chat>({
      model: 'chat',
      where: [{ field: 'id', value: message.chatId }],
    });

    if (!chat) {
      throw new APIError('NOT_FOUND', {
        message: BASE_ERROR_CODES.CHAT_NOT_FOUND,
      });
    }

    if (chat.userId !== user.id) {
      throw new APIError('FORBIDDEN', {
        message: BASE_ERROR_CODES.CHAT_ACCESS_DENIED,
      });
    }

    // Get votes for the message
    const votes = await ctx.context.adapter.findMany<Vote>({
      model: 'vote',
      where: [{ field: 'messageId', value: messageId }],
    });

    // Filter by vote type if specified
    let filteredVotes = votes;
    if (vote) {
      filteredVotes = votes.filter(
        (v) =>
          (vote === 'up' && v.isUpvoted) || (vote === 'down' && !v.isUpvoted)
      );
    }

    // Convert to expected format
    const responseVotes = filteredVotes.map((v) => ({
      ...v,
      vote: v.isUpvoted ? 'up' : 'down',
    }));

    // Calculate stats
    const stats = {
      up: votes.filter((v) => v.isUpvoted).length,
      down: votes.filter((v) => !v.isUpvoted).length,
      total: votes.length,
    };

    return ctx.json({ votes: responseVotes, stats });
  }
);

/**
 * Remove a vote
 * Note: Since we're using composite keys (chatId + messageId),
 * this endpoint takes both parameters in the body
 */
export const removeVote = createUnblockedEndpoint(
  '/vote',
  {
    method: 'DELETE',
    body: z.object({
      chatId: z.string(),
      messageId: z.string(),
    }),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    const { chatId, messageId } = ctx.body;

    // Verify chat exists and user owns it
    const chat = await ctx.context.adapter.findOne<Chat>({
      model: 'chat',
      where: [{ field: 'id', value: chatId }],
    });

    if (!chat) {
      throw new APIError('NOT_FOUND', {
        message: BASE_ERROR_CODES.CHAT_NOT_FOUND,
      });
    }

    if (chat.userId !== user.id) {
      throw new APIError('FORBIDDEN', {
        message: BASE_ERROR_CODES.CHAT_ACCESS_DENIED,
      });
    }

    // Verify vote exists
    const vote = await ctx.context.adapter.findOne<Vote>({
      model: 'vote',
      where: [
        { field: 'chatId', value: chatId },
        { field: 'messageId', value: messageId },
      ],
    });

    if (!vote) {
      throw new APIError('NOT_FOUND', {
        message: BASE_ERROR_CODES.VOTE_NOT_FOUND,
      });
    }

    // Delete the vote
    await ctx.context.adapter.delete<Vote>({
      model: 'vote',
      where: [
        { field: 'chatId', value: chatId },
        { field: 'messageId', value: messageId },
      ],
    });

    return ctx.json({ success: true });
  }
);
