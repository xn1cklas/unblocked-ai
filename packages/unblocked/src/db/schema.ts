import { APIError } from 'better-call';
import { z } from 'zod';
import type {
  Chat,
  Document,
  Message,
  Stream,
  Suggestion,
  Vote,
} from '../types';
import type { UnblockedOptions } from '../types/options';
import type { PluginSchema } from '../types/plugins';
import type { FieldAttribute } from '.';

export const chatSchema = z.object({
  id: z.string(),
  createdAt: z.date().default(() => new Date()),
  title: z.string(),
  userId: z.string(),
  visibility: z.enum(['public', 'private']).default('private'),
});

export const messageSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  role: z.string(),
  parts: z.string(), // JSON serialized
  attachments: z.string(), // JSON serialized
  createdAt: z.date().default(() => new Date()),
});

export const voteSchema = z.object({
  chatId: z.string(),
  messageId: z.string(),
  isUpvoted: z.boolean(),
});

export const documentSchema = z.object({
  id: z.string(),
  createdAt: z.date().default(() => new Date()),
  title: z.string(),
  content: z.string().nullish(),
  kind: z.enum(['text', 'code', 'image', 'sheet']).default('text'),
  userId: z.string(),
});

export const suggestionSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  documentCreatedAt: z.date(),
  originalText: z.string(),
  suggestedText: z.string(),
  description: z.string().nullish(),
  isResolved: z.boolean().default(false),
  userId: z.string(),
  createdAt: z.date().default(() => new Date()),
});

export const streamSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  createdAt: z.date().default(() => new Date()),
});

export function parseOutputData<T extends Record<string, any>>(
  data: T,
  schema: {
    fields: Record<string, FieldAttribute>;
  }
) {
  const fields = schema.fields;
  const parsedData: Record<string, any> = {};
  for (const key in data) {
    const field = fields[key];
    if (!field) {
      parsedData[key] = data[key];
      continue;
    }
    if (field.returned === false) {
      continue;
    }
    parsedData[key] = data[key];
  }
  return parsedData as T;
}

export function getAllFields(options: UnblockedOptions, table: string) {
  let schema: Record<string, FieldAttribute> = {};
  for (const plugin of options.plugins || []) {
    if (plugin.schema && plugin.schema[table]) {
      schema = {
        ...schema,
        ...plugin.schema[table].fields,
      };
    }
  }
  return schema;
}

export function parseChatOutput(options: UnblockedOptions, chat: Chat) {
  const schema = getAllFields(options, 'chat');
  return parseOutputData(chat, { fields: schema });
}

export function parseMessageOutput(
  options: UnblockedOptions,
  message: Message
) {
  const schema = getAllFields(options, 'message');
  return parseOutputData(message, { fields: schema });
}

export function parseDocumentOutput(
  options: UnblockedOptions,
  document: Document
) {
  const schema = getAllFields(options, 'document');
  return parseOutputData(document, { fields: schema });
}

export function parseInputData<T extends Record<string, any>>(
  data: T,
  schema: {
    fields: Record<string, FieldAttribute>;
    action?: 'create' | 'update';
  }
) {
  const action = schema.action || 'create';
  const fields = schema.fields;
  const parsedData: Record<string, any> = {};
  for (const key in fields) {
    if (key in data) {
      if (fields[key].input === false) {
        if (fields[key].defaultValue) {
          parsedData[key] = fields[key].defaultValue;
          continue;
        }
        continue;
      }
      if (fields[key].validator?.input && data[key] !== undefined) {
        parsedData[key] = fields[key].validator.input.parse(data[key]);
        continue;
      }
      if (fields[key].transform?.input && data[key] !== undefined) {
        parsedData[key] = fields[key].transform?.input(data[key]);
        continue;
      }
      parsedData[key] = data[key];
      continue;
    }

    if (fields[key].defaultValue && action === 'create') {
      parsedData[key] = fields[key].defaultValue;
      continue;
    }

    if (fields[key].required && action === 'create') {
      throw new APIError('BAD_REQUEST', {
        message: `${key} is required`,
      });
    }
  }
  return parsedData as Partial<T>;
}

export function parseChatInput(
  options: UnblockedOptions,
  chat?: Record<string, any>,
  action?: 'create' | 'update'
) {
  const schema = getAllFields(options, 'chat');
  return parseInputData(chat || {}, { fields: schema, action });
}

export function parseMessageInput(
  options: UnblockedOptions,
  message?: Record<string, any>,
  action?: 'create' | 'update'
) {
  const schema = getAllFields(options, 'message');
  return parseInputData(message || {}, { fields: schema, action });
}

export function parseDocumentInput(
  options: UnblockedOptions,
  document?: Record<string, any>,
  action?: 'create' | 'update'
) {
  const schema = getAllFields(options, 'document');
  return parseInputData(document || {}, { fields: schema, action });
}

export function mergeSchema<S extends PluginSchema>(
  schema: S,
  newSchema?: {
    [K in keyof S]?: {
      modelName?: string;
      fields?: {
        [P: string]: string;
      };
    };
  }
) {
  if (!newSchema) {
    return schema;
  }
  for (const table in newSchema) {
    const newModelName = newSchema[table]?.modelName;
    if (newModelName) {
      schema[table].modelName = newModelName;
    }
    for (const field in schema[table].fields) {
      const newField = newSchema[table]?.fields?.[field];
      if (!newField) {
        continue;
      }
      schema[table].fields[field].fieldName = newField;
    }
  }
  return schema;
}
