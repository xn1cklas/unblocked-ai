import { describe, expectTypeOf } from 'vitest';
import { getTestInstance } from '../test-utils/test-instance';
import type { Chat, Document, Message, Suggestion, Vote } from '../types';

describe('general types', async (it) => {
  it('should infer base user type', async () => {
    const { ai } = await getTestInstance();
    expectTypeOf(ai.options.user.getUser).toBeFunction();
  });

  it('should infer AI model types', async () => {
    // Test the Chat type
    expectTypeOf<Chat>().toEqualTypeOf<{
      id: string;
      createdAt: Date;
      title: string;
      userId: string;
      visibility: 'public' | 'private';
    }>();

    // Test the Message type
    expectTypeOf<Message>().toEqualTypeOf<{
      id: string;
      chatId: string;
      role: string;
      parts: string; // JSON serialized
      attachments: string; // JSON serialized
      createdAt: Date;
    }>();

    // Test the Vote type
    expectTypeOf<Vote>().toEqualTypeOf<{
      chatId: string;
      messageId: string;
      isUpvoted: boolean;
    }>();
  });

  it('should infer document types', async () => {
    // Test the Document type structure

    // Document should have these properties
    const mockDocument = {} as Document;
    // Type test - verify Document has expected structure
    expectTypeOf(mockDocument).toHaveProperty('id');
    expectTypeOf(mockDocument).toHaveProperty('createdAt');
    expectTypeOf(mockDocument).toHaveProperty('title');
    expectTypeOf(mockDocument).toHaveProperty('content');
    expectTypeOf(mockDocument).toHaveProperty('kind');
    expectTypeOf(mockDocument).toHaveProperty('userId');

    // Test the Suggestion type structure

    // Suggestion should have these properties
    const mockSuggestion = {} as Suggestion;
    // Type test - verify Suggestion has expected structure
    expectTypeOf(mockSuggestion).toHaveProperty('id');
    expectTypeOf(mockSuggestion).toHaveProperty('documentId');
    expectTypeOf(mockSuggestion).toHaveProperty('documentCreatedAt');
    expectTypeOf(mockSuggestion).toHaveProperty('originalText');
    expectTypeOf(mockSuggestion).toHaveProperty('suggestedText');
    expectTypeOf(mockSuggestion).toHaveProperty('description');
    expectTypeOf(mockSuggestion).toHaveProperty('isResolved');
    expectTypeOf(mockSuggestion).toHaveProperty('userId');
    expectTypeOf(mockSuggestion).toHaveProperty('createdAt');
  });
});
