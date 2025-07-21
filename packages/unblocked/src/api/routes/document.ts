import { APIError } from 'better-call';
import { z } from 'zod';
import { BASE_ERROR_CODES } from '../../error/codes';
import type { Document, Suggestion } from '../../types';
import { createUnblockedEndpoint } from '../call';

/**
 * Save document (matches demo's saveDocument)
 */
export const saveDocument = createUnblockedEndpoint(
  '/document',
  {
    method: 'POST',
    body: z.object({
      title: z.string().min(1, 'Title cannot be empty'),
      kind: z.enum(['text', 'code', 'image', 'sheet']),
      content: z.string(),
    }),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    const { title, kind, content } = ctx.body;

    const document = await ctx.context.adapter.create<Document>({
      model: 'document',
      data: {
        title,
        kind,
        content,
        userId: user.id,
        createdAt: new Date(),
      },
    });

    return ctx.json({ document });
  }
);

/**
 * Get documents by ID (matches demo's getDocumentsById)
 */
export const getDocumentsById = createUnblockedEndpoint(
  '/documents',
  {
    method: 'GET',
    query: z.object({
      id: z.string(),
    }),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    // Split comma-separated IDs
    const ids = ctx.query.id
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id);

    const documents = await ctx.context.adapter.findMany<Document>({
      model: 'document',
      where: [{ field: 'id', operator: 'in', value: ids }],
      sortBy: { field: 'createdAt', direction: 'asc' },
    });

    if (documents.length === 0) {
      throw new APIError('NOT_FOUND', {
        message: BASE_ERROR_CODES.DOCUMENT_NOT_FOUND,
      });
    }

    // Filter documents by user access
    const userDocuments = documents.filter((doc) => doc.userId === user.id);

    if (userDocuments.length === 0) {
      throw new APIError('FORBIDDEN', {
        message: BASE_ERROR_CODES.DOCUMENT_ACCESS_DENIED,
      });
    }

    return ctx.json({
      documents: userDocuments,
    });
  }
);

/**
 * Get a single document by ID (matches demo's getDocumentById)
 */
export const getDocumentById = createUnblockedEndpoint(
  '/document/:id',
  {
    method: 'GET',
    params: z.object({
      id: z.string(),
    }),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    const documents = await ctx.context.adapter.findMany<Document>({
      model: 'document',
      where: [{ field: 'id', value: ctx.params.id }],
      sortBy: { field: 'createdAt', direction: 'desc' },
    });

    if (documents.length === 0) {
      throw new APIError('NOT_FOUND', {
        message: BASE_ERROR_CODES.DOCUMENT_NOT_FOUND,
      });
    }

    const document = documents[0];

    if (document.userId !== user.id) {
      throw new APIError('FORBIDDEN', {
        message: BASE_ERROR_CODES.DOCUMENT_ACCESS_DENIED,
      });
    }

    return ctx.json({
      document,
    });
  }
);

/**
 * Update a document
 */
export const updateDocument = createUnblockedEndpoint(
  '/document/:id',
  {
    method: 'PUT',
    params: z.object({
      id: z.string(),
    }),
    body: z.object({
      title: z.string().optional(),
      content: z.string().optional(),
      kind: z.enum(['text', 'code', 'image', 'sheet']).optional(),
    }),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    const { id } = ctx.params;
    const updates = ctx.body;

    // Check if document exists and user owns it
    const documents = await ctx.context.adapter.findMany<Document>({
      model: 'document',
      where: [{ field: 'id', value: id }],
    });

    if (documents.length === 0) {
      throw new APIError('NOT_FOUND', {
        message: BASE_ERROR_CODES.DOCUMENT_NOT_FOUND,
      });
    }

    const document = documents[0];
    if (document.userId !== user.id) {
      throw new APIError('FORBIDDEN', {
        message: BASE_ERROR_CODES.DOCUMENT_ACCESS_DENIED,
      });
    }

    // Update the document
    const updatedDocument = await ctx.context.adapter.update<Document>({
      model: 'document',
      where: [{ field: 'id', value: id }],
      update: updates,
    });

    return ctx.json({ document: updatedDocument });
  }
);

/**
 * Delete documents by ID after timestamp (matches demo's deleteDocumentsByIdAfterTimestamp)
 */
export const deleteDocumentsByIdAfterTimestamp = createUnblockedEndpoint(
  '/documents/:id/after/:timestamp',
  {
    method: 'DELETE',
    params: z.object({
      id: z.string(),
      timestamp: z.string().transform((val) => new Date(val)),
    }),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    const { id, timestamp } = ctx.params;

    // Check if document exists and user owns it
    const documents = await ctx.context.adapter.findMany<Document>({
      model: 'document',
      where: [{ field: 'id', value: id }],
    });

    if (documents.length === 0) {
      throw new APIError('NOT_FOUND', {
        message: BASE_ERROR_CODES.DOCUMENT_NOT_FOUND,
      });
    }

    const document = documents[0];
    if (document.userId !== user.id) {
      throw new APIError('FORBIDDEN', {
        message: BASE_ERROR_CODES.DOCUMENT_ACCESS_DENIED,
      });
    }

    // Delete associated suggestions first
    const suggestionsToDelete = await ctx.context.adapter.findMany<Suggestion>({
      model: 'suggestion',
      where: [
        { field: 'documentId', value: id },
        {
          field: 'documentCreatedAt',
          value: timestamp,
          operator: 'gt' as const,
        },
      ],
    });

    for (const suggestion of suggestionsToDelete) {
      await ctx.context.adapter.delete<Suggestion>({
        model: 'suggestion',
        where: [{ field: 'id', value: suggestion.id }],
      });
    }

    // Delete documents after timestamp
    const documentsToDelete = await ctx.context.adapter.findMany<Document>({
      model: 'document',
      where: [
        { field: 'id', value: id },
        { field: 'createdAt', value: timestamp, operator: 'gt' as const },
      ],
    });

    const deletedDocuments = [];
    for (const doc of documentsToDelete) {
      await ctx.context.adapter.delete<Document>({
        model: 'document',
        where: [{ field: 'id', value: doc.id }],
      });
      deletedDocuments.push(doc);
    }

    return ctx.json({
      documents: deletedDocuments,
      count: deletedDocuments.length,
    });
  }
);
