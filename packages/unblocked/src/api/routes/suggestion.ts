import { APIError } from 'better-call';
import { z } from 'zod';
import { BASE_ERROR_CODES } from '../../error/codes';
import type { Document, Suggestion } from '../../types';
import { createUnblockedEndpoint } from '../call';

/**
 * Save suggestions for a document (matches demo's saveSuggestions)
 */
export const saveSuggestions = createUnblockedEndpoint(
  '/suggestions',
  {
    method: 'POST',
    body: z.object({
      suggestions: z.array(
        z.object({
          id: z.string().optional(),
          documentId: z.string(),
          documentCreatedAt: z.date().optional(),
          originalText: z.string(),
          suggestedText: z.string(),
          description: z.string().optional(),
          isResolved: z.boolean().default(false).optional(),
          userId: z.string().optional(),
          createdAt: z.date().optional(),
        })
      ),
    }),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    // Verify user has access to create suggestions
    const suggestions = ctx.body.suggestions;
    if (suggestions.length === 0) {
      return ctx.json({ suggestions: [] });
    }

    // Check document access for the first suggestion (assume all belong to same doc)
    const documentId = suggestions[0].documentId;
    const documents = await ctx.context.adapter.findMany<Document>({
      model: 'document',
      where: [{ field: 'id', value: documentId }],
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

    // Create all suggestions
    const createdSuggestions = [];
    for (const suggestionData of suggestions) {
      const createData: Omit<Suggestion, 'id'> & { id?: string } = {
        documentId: suggestionData.documentId,
        originalText: suggestionData.originalText,
        suggestedText: suggestionData.suggestedText,
        description: suggestionData.description,
        isResolved: suggestionData.isResolved ?? false,
        userId: user.id,
        documentCreatedAt: document.createdAt,
        createdAt: suggestionData.createdAt || new Date(),
      };

      if (suggestionData.id) {
        createData.id = suggestionData.id;
      }

      const suggestion = await ctx.context.adapter.create<Suggestion>({
        model: 'suggestion',
        data: createData as any,
      });
      createdSuggestions.push(suggestion);
    }

    return ctx.json({
      suggestions: createdSuggestions,
    });
  }
);

/**
 * Get suggestions for a document (matches demo's getSuggestionsByDocumentId)
 */
export const getSuggestionsByDocumentId = createUnblockedEndpoint(
  '/suggestions',
  {
    method: 'GET',
    query: z.object({
      documentId: z.string(),
    }),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    const { documentId } = ctx.query;

    // Verify user has access to the document
    const documents = await ctx.context.adapter.findMany<Document>({
      model: 'document',
      where: [{ field: 'id', value: documentId }],
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

    const suggestions = await ctx.context.adapter.findMany<Suggestion>({
      model: 'suggestion',
      where: [{ field: 'documentId', value: documentId }],
      sortBy: { field: 'createdAt', direction: 'asc' },
    });

    return ctx.json({
      suggestions,
    });
  }
);

/**
 * Update suggestion status
 */
export const updateSuggestionStatus = createUnblockedEndpoint(
  '/suggestion/:id',
  {
    method: 'PUT',
    params: z.object({
      id: z.string(),
    }),
    body: z.object({
      isResolved: z.boolean().optional(),
      description: z.string().optional(),
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

    // Check if suggestion exists and user owns it
    const suggestions = await ctx.context.adapter.findMany<Suggestion>({
      model: 'suggestion',
      where: [{ field: 'id', value: id }],
    });

    if (suggestions.length === 0) {
      throw new APIError('NOT_FOUND', {
        message: BASE_ERROR_CODES.SUGGESTION_NOT_FOUND,
      });
    }

    const suggestion = suggestions[0];
    if (suggestion.userId !== user.id) {
      throw new APIError('FORBIDDEN', {
        message: BASE_ERROR_CODES.SUGGESTION_ACCESS_DENIED,
      });
    }

    // Update the suggestion
    const updatedSuggestion = await ctx.context.adapter.update<Suggestion>({
      model: 'suggestion',
      where: [{ field: 'id', value: id }],
      update: updates,
    });

    return ctx.json({ suggestion: updatedSuggestion });
  }
);

/**
 * Delete a suggestion
 */
export const deleteSuggestion = createUnblockedEndpoint(
  '/suggestion/:id',
  {
    method: 'DELETE',
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

    const { id } = ctx.params;

    // Check if suggestion exists and user owns it
    const suggestions = await ctx.context.adapter.findMany<Suggestion>({
      model: 'suggestion',
      where: [{ field: 'id', value: id }],
    });

    if (suggestions.length === 0) {
      throw new APIError('NOT_FOUND', {
        message: BASE_ERROR_CODES.SUGGESTION_NOT_FOUND,
      });
    }

    const suggestion = suggestions[0];
    if (suggestion.userId !== user.id) {
      throw new APIError('FORBIDDEN', {
        message: BASE_ERROR_CODES.SUGGESTION_ACCESS_DENIED,
      });
    }

    // Delete the suggestion
    await ctx.context.adapter.delete<Suggestion>({
      model: 'suggestion',
      where: [{ field: 'id', value: id }],
    });

    return ctx.json({ success: true });
  }
);
