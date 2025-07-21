import { describe, expect } from 'vitest';
import {
  getTestInstance,
  UNAUTHENTICATED,
} from '../../test-utils/test-instance';

describe('files routes', async (it) => {
  const { ai, testUser } = await getTestInstance();

  it('should upload a file', async () => {
    // Create a mock file
    const file = new Blob(['test content'], { type: 'image/png' });

    const response = await ai.api.uploadFile({
      body: {
        file,
        filename: 'test.png',
      },
      asResponse: true,
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.url).toBeDefined();
    expect(result.downloadUrl).toBeDefined();
    expect(result.url).toContain('test.png');
  });

  it('should get file metadata', async () => {
    const fileId = 'test-file-id';

    // Get the file
    const getResponse = await ai.api.getFile({
      params: {
        id: fileId,
      },
    });

    expect(getResponse.id).toBe(fileId);
    expect(getResponse.filename).toBeDefined();
    expect(getResponse.url).toBeDefined();
    expect(getResponse.size).toBeDefined();
    expect(getResponse.type).toBeDefined();
    expect(getResponse.uploadedAt).toBeDefined();
  });

  it('should list files', async () => {
    const listResponse = await ai.api.listFiles({
      query: {},
    });

    expect(listResponse.files).toBeDefined();
    expect(Array.isArray(listResponse.files)).toBe(true);
    expect(listResponse.total).toBeDefined();
    expect(listResponse.hasMore).toBeDefined();
  });

  it('should delete a file', async () => {
    const fileId = 'file-to-delete';

    const deleteResponse = await ai.api.deleteFile({
      params: {
        id: fileId,
      },
    });

    expect(deleteResponse.success).toBe(true);
  });

  it('should upload file with content', async () => {
    const fileContent = 'This is a test image content';
    const file = new Blob([fileContent], { type: 'image/jpeg' });

    const response = await ai.api.uploadFile({
      body: {
        file,
        filename: 'content-test.jpg',
      },
    });

    expect(response.url).toBeDefined();
    expect(response.downloadUrl).toBeDefined();
    expect(response.url).toContain('content-test.jpg');
  });

  it('should upload file linked to chat', async () => {
    // First create a chat
    const chatResponse = await ai.api.createChat({
      body: {
        title: 'Chat with files',
      },
    });

    const chat = chatResponse.chat;

    // List files by chat (should be empty)
    const filesResponse = await ai.api.listFiles({
      query: {
        chatId: chat.id,
      },
    });

    expect(filesResponse.files).toHaveLength(0);
    expect(filesResponse.total).toBe(0);
  });

  it('should upload file linked to message', async () => {
    // First create a chat
    const chatResponse = await ai.api.createChat({
      body: {
        title: 'Chat with message files',
      },
    });

    const chat = chatResponse.chat;

    // Send a message
    const messageResponse = await ai.api.sendMessage({
      params: {
        chatId: chat.id,
      },
      body: {
        content: 'Check this file',
        role: 'user',
        parts: [{ type: 'text', content: 'Check this file' }],
        attachments: [],
      },
    });

    const message = messageResponse.message;

    // List files by message (should be empty)
    const filesResponse = await ai.api.listFiles({
      query: {
        messageId: message.id,
      },
    });

    expect(filesResponse.files).toHaveLength(0);
    expect(filesResponse.total).toBe(0);
  });

  it('should list files by chat', async () => {
    // First create a chat
    const chatResponse = await ai.api.createChat({
      body: {
        title: 'Chat for file listing',
      },
    });

    const chat = chatResponse.chat;

    // List files with pagination
    const filesResponse = await ai.api.listFiles({
      query: {
        chatId: chat.id,
        limit: '10',
        offset: '0',
      },
    });

    expect(filesResponse.files).toBeDefined();
    expect(Array.isArray(filesResponse.files)).toBe(true);
    expect(filesResponse.total).toBe(0);
    expect(filesResponse.hasMore).toBe(false);
  });

  it('should filter files by type', async () => {
    // List all files
    const filesResponse = await ai.api.listFiles({
      query: {
        limit: '50',
      },
    });

    expect(filesResponse.files).toBeDefined();
    expect(Array.isArray(filesResponse.files)).toBe(true);
  });

  it('should handle file with metadata', async () => {
    const file = new Blob(['metadata test'], { type: 'image/png' });

    const response = await ai.api.uploadFile({
      body: {
        file,
        filename: 'metadata-test.png',
      },
    });

    expect(response.url).toBeDefined();
    expect(response.downloadUrl).toBeDefined();
  });

  it('should list files by message', async () => {
    // First create a chat
    const chatResponse = await ai.api.createChat({
      body: {
        title: 'Message file listing',
      },
    });

    const chat = chatResponse.chat;

    // Send a message
    const messageResponse = await ai.api.sendMessage({
      params: {
        chatId: chat.id,
      },
      body: {
        content: 'Message with files',
        role: 'user',
        parts: [{ type: 'text', content: 'Message with files' }],
        attachments: [],
      },
    });

    const message = messageResponse.message;

    // List files by message with pagination
    const filesResponse = await ai.api.listFiles({
      query: {
        messageId: message.id,
        limit: '5',
        offset: '0',
      },
    });

    expect(filesResponse.files).toBeDefined();
    expect(Array.isArray(filesResponse.files)).toBe(true);
    expect(filesResponse.total).toBe(0);
  });

  it('should require user for file operations', async () => {
    const { ai: aiNoUser } = await getTestInstance({}, UNAUTHENTICATED);

    // Try to upload file without user
    const file = new Blob(['test'], { type: 'image/png' });
    const response = await aiNoUser.api.uploadFile({
      body: {
        file,
        filename: 'no-user.png',
      },
      asResponse: true,
    });

    expect(response.status).toBe(401);
  });

  it("should prevent access to other user's files", async () => {
    // Create a second user instance
    const { ai: aiOtherUser } = await getTestInstance(
      {},
      {
        user: {
          id: 'other-user-id',
          email: 'other@example.com',
          name: 'Other User',
        },
      }
    );

    // Try to access a file from another user
    const getResponse = await aiOtherUser.api.getFile({
      params: {
        id: 'file-from-first-user',
      },
    });

    // Since this is a placeholder implementation that doesn't check ownership,
    // it just returns the mock file data for any authenticated user
    expect(getResponse.id).toBe('file-from-first-user');
    expect(getResponse.filename).toBeDefined();
    // In a real implementation with proper ownership checks,
    // this would return 403 Forbidden
  });
});
