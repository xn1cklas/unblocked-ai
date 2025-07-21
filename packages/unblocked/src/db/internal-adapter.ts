import type {
  Adapter,
  Chat,
  Document,
  GenericEndpointContext,
  Message,
  Stream,
  Suggestion,
  UnblockedContext,
  UnblockedOptions,
  Vote,
  Where,
} from '../types';
import { generateId } from '../utils';
import { getDate } from '../utils/date';
import { getIp } from '../utils/get-request-ip';
import { safeJSONParse } from '../utils/json';
import {
  parseChatOutput,
  parseDocumentOutput,
  parseMessageOutput,
} from './schema';
import { getWithHooks } from './with-hooks';

export const createInternalAdapter = (
  adapter: Adapter,
  ctx: {
    options: UnblockedOptions;
    hooks: Exclude<UnblockedOptions['databaseHooks'], undefined>[];
    generateId: UnblockedContext['generateId'];
  }
) => {
  const options = ctx.options;
  const secondaryStorage = options.secondaryStorage;
  const { createWithHooks, updateWithHooks, updateManyWithHooks } =
    getWithHooks(adapter, ctx);

  return {
    // Chat operations
    createChat: async <T>(
      chat: Omit<Chat, 'id' | 'createdAt'> &
        Partial<Chat> &
        Record<string, any>,
      context?: GenericEndpointContext
    ) => {
      const createdChat = await createWithHooks(
        {
          createdAt: new Date(),
          ...chat,
        },
        'chat',
        undefined,
        context
      );
      return createdChat as T & Chat;
    },

    findChat: async <T>(
      chatId: string,
      context?: GenericEndpointContext
    ): Promise<T | null> => {
      const chat = await adapter.findOne<T>({
        model: 'chat',
        where: [
          {
            field: 'id',
            value: chatId,
          },
        ],
      });
      return chat;
    },

    findChatsByUser: async <T>(
      userId: string,
      context?: GenericEndpointContext
    ): Promise<T[]> => {
      const chats = await adapter.findMany<T>({
        model: 'chat',
        where: [
          {
            field: 'userId',
            value: userId,
          },
        ],
        sortBy: {
          field: 'createdAt',
          direction: 'desc',
        },
      });
      return chats;
    },

    findChats: async <T>(params: {
      where?: Where[];
      limit?: number;
      offset?: number;
      sortBy?: {
        field: string;
        direction: 'asc' | 'desc';
      };
    }): Promise<T[]> => {
      const chats = await adapter.findMany<T>({
        model: 'chat',
        where: params.where || [],
        limit: params.limit,
        offset: params.offset,
        sortBy: params.sortBy || {
          field: 'createdAt',
          direction: 'desc',
        },
      });
      return chats;
    },

    updateChat: async <T>(
      chatId: string,
      update: Partial<Chat>,
      context?: GenericEndpointContext
    ): Promise<T | null> => {
      const updatedChat = await updateWithHooks(
        update,
        [
          {
            field: 'id',
            value: chatId,
          },
        ],
        'chat',
        undefined,
        context
      );
      return updatedChat as T | null;
    },

    deleteChat: async (
      chatId: string,
      context?: GenericEndpointContext
    ): Promise<void> => {
      await adapter.delete({
        model: 'chat',
        where: [
          {
            field: 'id',
            value: chatId,
          },
        ],
      });
    },

    // Message operations
    createMessage: async <T>(
      message: Omit<Message, 'id' | 'createdAt'> &
        Partial<Message> &
        Record<string, any>,
      context?: GenericEndpointContext
    ) => {
      const createdMessage = await createWithHooks(
        {
          createdAt: new Date(),
          ...message,
        },
        'message',
        undefined,
        context
      );
      return createdMessage as T & Message;
    },

    findMessage: async <T>(
      messageId: string,
      context?: GenericEndpointContext
    ): Promise<T | null> => {
      const message = await adapter.findOne<T>({
        model: 'message',
        where: [
          {
            field: 'id',
            value: messageId,
          },
        ],
      });
      return message;
    },

    findMessagesByChat: async <T>(
      chatId: string,
      context?: GenericEndpointContext
    ): Promise<T[]> => {
      const messages = await adapter.findMany<T>({
        model: 'message',
        where: [
          {
            field: 'chatId',
            value: chatId,
          },
        ],
        sortBy: {
          field: 'createdAt',
          direction: 'asc',
        },
      });
      return messages;
    },

    findMessages: async <T>(params: {
      where?: Where[];
      limit?: number;
      offset?: number;
      sortBy?: {
        field: string;
        direction: 'asc' | 'desc';
      };
    }): Promise<T[]> => {
      const messages = await adapter.findMany<T>({
        model: 'message',
        where: params.where || [],
        limit: params.limit,
        offset: params.offset,
        sortBy: params.sortBy || {
          field: 'createdAt',
          direction: 'asc',
        },
      });
      return messages;
    },

    updateMessage: async <T>(
      messageId: string,
      update: Partial<Message>,
      context?: GenericEndpointContext
    ): Promise<T | null> => {
      const updatedMessage = await updateWithHooks(
        update,
        [
          {
            field: 'id',
            value: messageId,
          },
        ],
        'message',
        undefined,
        context
      );
      return updatedMessage as T | null;
    },

    deleteMessage: async (
      messageId: string,
      context?: GenericEndpointContext
    ): Promise<void> => {
      await adapter.delete({
        model: 'message',
        where: [
          {
            field: 'id',
            value: messageId,
          },
        ],
      });
    },

    // Document operations
    createDocument: async <T>(
      document: Omit<Document, 'id' | 'createdAt'> &
        Partial<Document> &
        Record<string, any>,
      context?: GenericEndpointContext
    ) => {
      const createdDocument = await createWithHooks(
        {
          createdAt: new Date(),
          ...document,
        },
        'document',
        undefined,
        context
      );
      return createdDocument as T & Document;
    },

    findDocument: async <T>(
      documentId: string,
      context?: GenericEndpointContext
    ): Promise<T | null> => {
      const document = await adapter.findOne<T>({
        model: 'document',
        where: [
          {
            field: 'id',
            value: documentId,
          },
        ],
      });
      return document;
    },

    findDocumentsByUser: async <T>(
      userId: string,
      context?: GenericEndpointContext
    ): Promise<T[]> => {
      const documents = await adapter.findMany<T>({
        model: 'document',
        where: [
          {
            field: 'userId',
            value: userId,
          },
        ],
        sortBy: {
          field: 'createdAt',
          direction: 'desc',
        },
      });
      return documents;
    },

    findDocuments: async <T>(params: {
      where?: Where[];
      limit?: number;
      offset?: number;
      sortBy?: {
        field: string;
        direction: 'asc' | 'desc';
      };
    }): Promise<T[]> => {
      const documents = await adapter.findMany<T>({
        model: 'document',
        where: params.where || [],
        limit: params.limit,
        offset: params.offset,
        sortBy: params.sortBy || {
          field: 'createdAt',
          direction: 'desc',
        },
      });
      return documents;
    },

    updateDocument: async <T>(
      documentId: string,
      update: Partial<Document>,
      context?: GenericEndpointContext
    ): Promise<T | null> => {
      const updatedDocument = await updateWithHooks(
        update,
        [
          {
            field: 'id',
            value: documentId,
          },
        ],
        'document',
        undefined,
        context
      );
      return updatedDocument as T | null;
    },

    deleteDocument: async (
      documentId: string,
      context?: GenericEndpointContext
    ): Promise<void> => {
      await adapter.delete({
        model: 'document',
        where: [
          {
            field: 'id',
            value: documentId,
          },
        ],
      });
    },

    // Vote operations
    createVote: async <T>(
      vote: Omit<Vote, 'id' | 'createdAt'> &
        Partial<Vote> &
        Record<string, any>,
      context?: GenericEndpointContext
    ) => {
      const createdVote = await createWithHooks(
        {
          createdAt: new Date(),
          ...vote,
        },
        'vote',
        undefined,
        context
      );
      return createdVote as T & Vote;
    },

    findVote: async <T>(
      voteId: string,
      context?: GenericEndpointContext
    ): Promise<T | null> => {
      const vote = await adapter.findOne<T>({
        model: 'vote',
        where: [
          {
            field: 'id',
            value: voteId,
          },
        ],
      });
      return vote;
    },

    findVotesByMessage: async <T>(
      messageId: string,
      context?: GenericEndpointContext
    ): Promise<T[]> => {
      const votes = await adapter.findMany<T>({
        model: 'vote',
        where: [
          {
            field: 'messageId',
            value: messageId,
          },
        ],
      });
      return votes;
    },

    updateVote: async <T>(
      voteId: string,
      update: Partial<Vote>,
      context?: GenericEndpointContext
    ): Promise<T | null> => {
      const updatedVote = await updateWithHooks(
        update,
        [
          {
            field: 'id',
            value: voteId,
          },
        ],
        'vote',
        undefined,
        context
      );
      return updatedVote as T | null;
    },

    deleteVote: async (
      voteId: string,
      context?: GenericEndpointContext
    ): Promise<void> => {
      await adapter.delete({
        model: 'vote',
        where: [
          {
            field: 'id',
            value: voteId,
          },
        ],
      });
    },

    // Suggestion operations
    createSuggestion: async <T>(
      suggestion: Omit<Suggestion, 'id' | 'createdAt'> &
        Partial<Suggestion> &
        Record<string, any>,
      context?: GenericEndpointContext
    ) => {
      const createdSuggestion = await createWithHooks(
        {
          createdAt: new Date(),
          ...suggestion,
        },
        'suggestion',
        undefined,
        context
      );
      return createdSuggestion as T & Suggestion;
    },

    findSuggestion: async <T>(
      suggestionId: string,
      context?: GenericEndpointContext
    ): Promise<T | null> => {
      const suggestion = await adapter.findOne<T>({
        model: 'suggestion',
        where: [
          {
            field: 'id',
            value: suggestionId,
          },
        ],
      });
      return suggestion;
    },

    findSuggestionsByDocument: async <T>(
      documentId: string,
      context?: GenericEndpointContext
    ): Promise<T[]> => {
      const suggestions = await adapter.findMany<T>({
        model: 'suggestion',
        where: [
          {
            field: 'documentId',
            value: documentId,
          },
        ],
        sortBy: {
          field: 'createdAt',
          direction: 'desc',
        },
      });
      return suggestions;
    },

    updateSuggestion: async <T>(
      suggestionId: string,
      update: Partial<Suggestion>,
      context?: GenericEndpointContext
    ): Promise<T | null> => {
      const updatedSuggestion = await updateWithHooks(
        update,
        [
          {
            field: 'id',
            value: suggestionId,
          },
        ],
        'suggestion',
        undefined,
        context
      );
      return updatedSuggestion as T | null;
    },

    // Stream operations
    createStream: async <T>(
      stream: Omit<Stream, 'id' | 'createdAt'> &
        Partial<Stream> &
        Record<string, any>,
      context?: GenericEndpointContext
    ) => {
      const createdStream = await createWithHooks(
        {
          createdAt: new Date(),
          ...stream,
        },
        'stream',
        undefined,
        context
      );
      return createdStream as T & Stream;
    },

    findStream: async <T>(
      streamId: string,
      context?: GenericEndpointContext
    ): Promise<T | null> => {
      const stream = await adapter.findOne<T>({
        model: 'stream',
        where: [
          {
            field: 'id',
            value: streamId,
          },
        ],
      });
      return stream;
    },

    updateStream: async <T>(
      streamId: string,
      update: Partial<Stream>,
      context?: GenericEndpointContext
    ): Promise<T | null> => {
      const updatedStream = await updateWithHooks(
        update,
        [
          {
            field: 'id',
            value: streamId,
          },
        ],
        'stream',
        undefined,
        context
      );
      return updatedStream as T | null;
    },

    deleteStream: async (
      streamId: string,
      context?: GenericEndpointContext
    ): Promise<void> => {
      await adapter.delete({
        model: 'stream',
        where: [
          {
            field: 'id',
            value: streamId,
          },
        ],
      });
    },

    // Rate limiting (reusable from auth)
    createRateLimit: async (
      key: string,
      expiry: number,
      context?: GenericEndpointContext
    ) => {
      const rateLimit = await adapter.create({
        model: 'rateLimit',
        data: {
          key,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + expiry * 1000),
        },
      });
      return rateLimit;
    },

    findRateLimit: async (key: string, context?: GenericEndpointContext) => {
      const rateLimit = await adapter.findOne({
        model: 'rateLimit',
        where: [
          {
            field: 'key',
            value: key,
          },
        ],
      });
      return rateLimit;
    },

    deleteRateLimit: async (key: string, context?: GenericEndpointContext) => {
      await adapter.delete({
        model: 'rateLimit',
        where: [
          {
            field: 'key',
            value: key,
          },
        ],
      });
    },
  };
};
