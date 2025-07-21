import { APIError } from 'better-call';
import { z } from 'zod';
import { BASE_ERROR_CODES } from '../../error/codes';
import { createUnblockedEndpoint } from '../call';

/**
 * Upload a file (matches demo's implementation)
 *
 * Note: This is a placeholder implementation for V2 file upload functionality.
 * File metadata should be stored in the message.attachments field as JSON.
 */
export const uploadFile = createUnblockedEndpoint(
  '/files/upload',
  {
    method: 'POST',
    body: z.object({
      file: z
        .instanceof(Blob)
        .refine((file) => file.size <= 5 * 1024 * 1024, {
          message: 'File size should be less than 5MB',
        })
        .refine((file) => ['image/jpeg', 'image/png'].includes(file.type), {
          message: 'File type should be JPEG or PNG',
        }),
      filename: z.string(),
    }),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    const { file, filename } = ctx.body;

    // TODO: Implement file upload logic
    // This would typically involve:
    // 1. Validating the file
    // 2. Storing it in cloud storage (S3, GCS, etc.)
    // 3. Returning the public URL
    // 4. File metadata should be stored in message.attachments as JSON

    // For now, return a placeholder response that matches Vercel Blob API
    const mockFileUrl = `https://example.com/uploads/${filename}`;

    return ctx.json({
      url: mockFileUrl,
      downloadUrl: mockFileUrl,
    });
  }
);

/**
 * Get file metadata by ID
 */
export const getFile = createUnblockedEndpoint(
  '/file/:id',
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

    const { id } = ctx.params;

    // TODO: Implement file retrieval logic
    // This would typically involve:
    // 1. Looking up file metadata in database
    // 2. Verifying user has access to the file
    // 3. Returning file metadata and signed URL if needed

    // For now, return a placeholder response
    return ctx.json({
      id,
      filename: 'example.png',
      url: `https://example.com/uploads/${id}`,
      size: 1024,
      type: 'image/png',
      uploadedAt: new Date().toISOString(),
    });
  }
);

/**
 * List files for the current user
 */
export const listFiles = createUnblockedEndpoint(
  '/file',
  {
    method: 'GET',
    query: z.object({
      chatId: z.string().optional(),
      messageId: z.string().optional(),
      limit: z
        .string()
        .transform((val) => Number.parseInt(val, 10))
        .optional(),
      offset: z
        .string()
        .transform((val) => Number.parseInt(val, 10))
        .optional(),
    }),
  },
  async (ctx) => {
    const user = await ctx.context.getUser?.(ctx.request as Request);
    if (!user) {
      throw new APIError('UNAUTHORIZED', {
        message: BASE_ERROR_CODES.USER_REQUIRED,
      });
    }

    const { chatId, messageId, limit = 20, offset = 0 } = ctx.query;

    // TODO: Implement file listing logic
    // This would typically involve:
    // 1. Querying file metadata from database
    // 2. Filtering by chatId or messageId if provided
    // 3. Implementing pagination
    // 4. Verifying user has access to the files

    // For now, return a placeholder response
    return ctx.json({
      files: [],
      total: 0,
      hasMore: false,
    });
  }
);

/**
 * Delete a file
 */
export const deleteFile = createUnblockedEndpoint(
  '/file/:id',
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

    // TODO: Implement file deletion logic
    // This would typically involve:
    // 1. Looking up file metadata in database
    // 2. Verifying user owns the file
    // 3. Deleting the file from storage (S3, GCS, etc.)
    // 4. Removing metadata from database

    // For now, return a placeholder response
    return ctx.json({
      success: true,
      message: 'File deleted successfully',
    });
  }
);
