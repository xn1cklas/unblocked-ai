import type { UnblockedOptions } from '../types';
import type { FieldAttribute } from '.';

export type UnblockedDbSchema = Record<
  string,
  {
    /**
     * The name of the table in the database
     */
    modelName: string;
    /**
     * The fields of the table
     */
    fields: Record<string, FieldAttribute>;
    /**
     * Whether to disable migrations for this table
     * @default false
     */
    disableMigrations?: boolean;
    /**
     * The order of the table
     */
    order?: number;
  }
>;

export const getAITables = (options: UnblockedOptions): UnblockedDbSchema => {
  const pluginSchema = options.plugins?.reduce(
    (acc, plugin) => {
      const schema = plugin.schema;
      if (!schema) return acc;
      for (const [key, value] of Object.entries(schema)) {
        acc[key] = {
          fields: {
            ...acc[key]?.fields,
            ...value.fields,
          },
          modelName: value.modelName || key,
        };
      }
      return acc;
    },
    {} as Record<
      string,
      { fields: Record<string, FieldAttribute>; modelName: string }
    >
  );

  const shouldAddRateLimitTable = options.rateLimit?.storage === 'database';
  const rateLimitTable = {
    rateLimit: {
      modelName: options.rateLimit?.modelName || 'rateLimit',
      fields: {
        key: {
          type: 'string',
          fieldName: options.rateLimit?.fields?.key || 'key',
        },
        count: {
          type: 'number',
          fieldName: options.rateLimit?.fields?.count || 'count',
        },
        lastRequest: {
          type: 'number',
          bigint: true,
          fieldName: options.rateLimit?.fields?.lastRequest || 'lastRequest',
        },
      },
    },
  } satisfies UnblockedDbSchema;

  const { ...pluginTables } = pluginSchema || {};

  return {
    // Chat conversations
    chat: {
      modelName: 'Chat',
      fields: {
        createdAt: {
          type: 'date',
          required: true,
          defaultValue: () => new Date(),
        },
        title: {
          type: 'string',
          required: true,
        },
        userId: {
          type: 'string',
          required: true,
        },
        visibility: {
          type: ['public', 'private'] as const,
          required: true,
          defaultValue: 'private',
        },
      },
      order: 1,
    },

    // Messages in conversations
    message: {
      modelName: 'Message',
      fields: {
        chatId: {
          type: 'string',
          required: true,
          references: {
            model: 'Chat',
            field: 'id',
            onDelete: 'cascade',
          },
        },
        role: {
          type: 'string',
          required: true,
        },
        parts: {
          type: 'string', // JSON serialized
          required: true,
        },
        attachments: {
          type: 'string', // JSON serialized
          required: true,
        },
        createdAt: {
          type: 'date',
          required: true,
          defaultValue: () => new Date(),
        },
      },
      order: 2,
    },

    // Message voting/feedback
    vote: {
      modelName: 'Vote',
      fields: {
        chatId: {
          type: 'string',
          required: true,
          references: {
            model: 'Chat',
            field: 'id',
            onDelete: 'cascade',
          },
        },
        messageId: {
          type: 'string',
          required: true,
          references: {
            model: 'Message',
            field: 'id',
            onDelete: 'cascade',
          },
        },
        isUpvoted: {
          type: 'boolean',
          required: true,
        },
      },
      order: 3,
    },

    // AI-generated documents
    document: {
      modelName: 'Document',
      fields: {
        createdAt: {
          type: 'date',
          required: true,
          defaultValue: () => new Date(),
        },
        title: {
          type: 'string',
          required: true,
        },
        content: {
          type: 'string',
          required: false,
        },
        kind: {
          type: ['text', 'code', 'image', 'sheet'] as const,
          required: true,
          defaultValue: 'text',
        },
        userId: {
          type: 'string',
          required: true,
        },
      },
      order: 4,
    },

    // Document edit suggestions
    suggestion: {
      modelName: 'Suggestion',
      fields: {
        documentId: {
          type: 'string',
          required: true,
        },
        documentCreatedAt: {
          type: 'date',
          required: true,
        },
        originalText: {
          type: 'string',
          required: true,
        },
        suggestedText: {
          type: 'string',
          required: true,
        },
        description: {
          type: 'string',
          required: false,
        },
        isResolved: {
          type: 'boolean',
          required: true,
          defaultValue: false,
        },
        userId: {
          type: 'string',
          required: true,
        },
        createdAt: {
          type: 'date',
          required: true,
          defaultValue: () => new Date(),
        },
      },
      order: 5,
    },

    // Streaming sessions
    stream: {
      modelName: 'Stream',
      fields: {
        chatId: {
          type: 'string',
          required: true,
          references: {
            model: 'Chat',
            field: 'id',
            onDelete: 'cascade',
          },
        },
        createdAt: {
          type: 'date',
          required: true,
          defaultValue: () => new Date(),
        },
      },
      order: 6,
    },

    ...pluginTables,
    ...(shouldAddRateLimitTable ? rateLimitTable : {}),
  } satisfies UnblockedDbSchema;
};
