import { describe, expect, it } from 'vitest';
import {
  getTestInstance,
  UNAUTHENTICATED,
} from '../../test-utils/test-instance';

describe('suggestion', () => {
  it('should create suggestions for a document', async () => {
    const { ai } = await getTestInstance();
    // First create a document
    const docResponse = await ai.api.saveDocument({
      body: {
        title: 'Suggestion Test Document',
        content: 'This is original content that needs improvement.',
        kind: 'text',
      },
    });

    const document = docResponse.document;

    // Create suggestions
    const suggestionResponse = (await ai.api.saveSuggestions({
      body: {
        suggestions: [
          {
            documentId: document.id,
            originalText: 'This is original content that needs improvement.',
            suggestedText: 'This is the improved content with better clarity.',
            description: 'Improved clarity and readability',
          },
        ],
      },
    })) as { suggestions: any[] };

    expect(suggestionResponse.suggestions).toBeDefined();
    expect(Array.isArray(suggestionResponse.suggestions)).toBe(true);
    expect(suggestionResponse.suggestions).toHaveLength(1);

    const suggestion = suggestionResponse.suggestions[0];
    expect(suggestion).toBeDefined();
    expect(suggestion.documentId).toBe(document.id);
    expect(suggestion.suggestedText).toBe(
      'This is the improved content with better clarity.'
    );
    expect(suggestion.isResolved).toBe(false);
    expect(suggestion.userId).toBeTruthy();
  });

  it('should update suggestion status', async () => {
    const { ai } = await getTestInstance();
    // First create a document
    const docResponse = await ai.api.saveDocument({
      body: {
        title: 'Status Update Test Document',
        content: 'Original content for status testing.',
        kind: 'text',
      },
    });

    const document = docResponse.document;

    // Create a suggestion
    const suggestionResponse = (await ai.api.saveSuggestions({
      body: {
        suggestions: [
          {
            documentId: document.id,
            originalText: 'Original content for status testing.',
            suggestedText: 'Updated content with improvements.',
            description: 'General improvements',
          },
        ],
      },
    })) as { suggestions: any[] };

    const suggestion = suggestionResponse.suggestions[0];

    // Update the suggestion
    const updateResponse = await ai.api.updateSuggestionStatus({
      params: {
        id: suggestion.id,
      },
      body: {
        isResolved: true,
      },
    });

    expect(updateResponse).toBeDefined();
    expect(updateResponse.suggestion).toBeDefined();
    expect(updateResponse.suggestion!.isResolved).toBe(true);
    expect(updateResponse.suggestion!.id).toBe(suggestion.id);
  });

  it('should create multiple suggestions', async () => {
    const { ai } = await getTestInstance();
    // Create a document
    const docResponse = await ai.api.saveDocument({
      body: {
        title: 'Multiple Suggestions Test',
        content: 'Line 1 needs work. Line 2 is okay. Line 3 needs improvement.',
        kind: 'text',
      },
    });

    const document = docResponse.document;

    // Create multiple suggestions
    const suggestionResponse = (await ai.api.saveSuggestions({
      body: {
        suggestions: [
          {
            documentId: document.id,
            originalText: 'Line 1 needs work.',
            suggestedText: 'Line 1 has been improved.',
            description: 'Improved first line',
          },
          {
            documentId: document.id,
            originalText: 'Line 3 needs improvement.',
            suggestedText: 'Line 3 is now much better.',
            description: 'Enhanced third line',
          },
        ],
      },
    })) as { suggestions: any[] };

    expect(suggestionResponse.suggestions).toHaveLength(2);
    expect(suggestionResponse.suggestions[0].originalText).toBe(
      'Line 1 needs work.'
    );
    expect(suggestionResponse.suggestions[1].originalText).toBe(
      'Line 3 needs improvement.'
    );
  });

  it('should get suggestions for a document', async () => {
    const { ai } = await getTestInstance();
    // Create a document
    const docResponse = await ai.api.saveDocument({
      body: {
        title: 'Get Suggestions Test',
        content: 'Content that will have suggestions.',
        kind: 'text',
      },
    });

    const document = docResponse.document;

    // Create suggestions
    await ai.api.saveSuggestions({
      body: {
        suggestions: [
          {
            documentId: document.id,
            originalText: 'Content that will have suggestions.',
            suggestedText: 'Enhanced content with multiple improvements.',
            description: 'Various improvements',
          },
          {
            documentId: document.id,
            originalText: 'Content that will have suggestions.',
            suggestedText: 'Alternative improvement approach.',
            description: 'Alternative suggestion',
          },
        ],
      },
    });

    // Get suggestions for the document
    const getResponse = await ai.api.getSuggestionsByDocumentId({
      query: {
        documentId: document.id,
      },
    });

    expect(getResponse.suggestions).toBeDefined();
    expect(getResponse.suggestions).toHaveLength(2);
    expect(
      getResponse.suggestions.every((s: any) => s.documentId === document.id)
    ).toBe(true);
  });

  it('should filter suggestions by status', async () => {
    const { ai } = await getTestInstance();
    // Create a document
    const docResponse = await ai.api.saveDocument({
      body: {
        title: 'Filter Test Document',
        content: 'Content for filtering test.',
        kind: 'text',
      },
    });

    const document = docResponse.document;

    // Create suggestions with different statuses
    const suggestionResponse = (await ai.api.saveSuggestions({
      body: {
        suggestions: [
          {
            documentId: document.id,
            originalText: 'Content for filtering test.',
            suggestedText: 'First suggestion.',
            isResolved: false,
          },
          {
            documentId: document.id,
            originalText: 'Content for filtering test.',
            suggestedText: 'Second suggestion.',
            isResolved: true,
          },
          {
            documentId: document.id,
            originalText: 'Content for filtering test.',
            suggestedText: 'Third suggestion.',
            isResolved: false,
          },
        ],
      },
    })) as { suggestions: any[] };

    // Get all suggestions and filter
    const allSuggestions = await ai.api.getSuggestionsByDocumentId({
      query: {
        documentId: document.id,
      },
    });

    const unresolvedSuggestions = allSuggestions.suggestions.filter(
      (s: any) => !s.isResolved
    );
    const resolvedSuggestions = allSuggestions.suggestions.filter(
      (s: any) => s.isResolved
    );

    expect(unresolvedSuggestions).toHaveLength(2);
    expect(unresolvedSuggestions.every((s: any) => !s.isResolved)).toBe(true);

    expect(resolvedSuggestions).toHaveLength(1);
    expect(resolvedSuggestions.every((s: any) => s.isResolved)).toBe(true);
  });

  it('should handle non-existent document', async () => {
    const { ai } = await getTestInstance();
    const response = await ai.api.saveSuggestions({
      body: {
        suggestions: [
          {
            documentId: 'non-existent-id',
            originalText: 'Some text',
            suggestedText: 'Improved text',
          },
        ],
      },
      asResponse: true,
    });

    expect(response.status).toBe(404);
  });

  it('should get suggestion by ID', async () => {
    const { ai } = await getTestInstance();
    // Create a document and suggestion
    const docResponse = await ai.api.saveDocument({
      body: {
        title: 'Get By ID Test',
        content: 'Content for get by ID test.',
        kind: 'text',
      },
    });

    const suggestionResponse = (await ai.api.saveSuggestions({
      body: {
        suggestions: [
          {
            documentId: docResponse.document.id,
            originalText: 'Content for get by ID test.',
            suggestedText: 'Improved content.',
            description: 'Test suggestion',
          },
        ],
      },
    })) as { suggestions: any[] };

    const suggestion = suggestionResponse.suggestions[0];

    // Test removed: getSuggestionById endpoint does not exist
    // The API only provides getSuggestionsByDocumentId for querying suggestions
    // To verify the suggestion was created correctly, we can use getSuggestionsByDocumentId
    const allSuggestions = await ai.api.getSuggestionsByDocumentId({
      query: {
        documentId: docResponse.document.id,
      },
    });

    expect(allSuggestions.suggestions).toHaveLength(1);
    expect(allSuggestions.suggestions[0].id).toBe(suggestion.id);
    expect(allSuggestions.suggestions[0].description).toBe('Test suggestion');
  });

  it('should handle update of non-existent suggestion', async () => {
    const { ai } = await getTestInstance();
    const response = await ai.api.updateSuggestionStatus({
      params: {
        id: 'non-existent-id',
      },
      body: {
        isResolved: true,
      },
      asResponse: true,
    });

    expect(response.status).toBe(404);
  });
});

describe('multi-user suggestion isolation', async () => {
  // Create separate user contexts
  const { ai: userAlice } = await getTestInstance(
    {},
    {
      user: { id: 'user-alice', email: 'alice@test.com', name: 'Alice' },
    }
  );
  const { ai: userBob } = await getTestInstance(
    {},
    {
      user: { id: 'user-bob', email: 'bob@test.com', name: 'Bob' },
    }
  );

  it('should prevent cross-user suggestion access', async () => {
    // Alice creates a document with suggestions
    const aliceDoc = await userAlice.api.saveDocument({
      body: {
        title: "Alice's Document",
        content: 'Original content needing improvement',
        kind: 'text',
      },
    });

    const aliceSuggestions = await userAlice.api.saveSuggestions({
      body: {
        suggestions: [
          {
            documentId: aliceDoc.document.id,
            originalText: 'Original content needing improvement',
            suggestedText: 'Improved content with better clarity',
            description: "Alice's suggestion",
          },
        ],
      },
    });

    // Bob should not be able to access Alice's suggestions
    const response = await userBob.api.getSuggestionsByDocumentId({
      query: { documentId: aliceDoc.document.id },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Document not found for Bob
  });

  it('should prevent cross-user suggestion updates', async () => {
    // Alice creates a document with suggestions
    const aliceDoc = await userAlice.api.saveDocument({
      body: { title: "Alice's Document", content: 'Content', kind: 'text' },
    });

    const aliceSuggestions = await userAlice.api.saveSuggestions({
      body: {
        suggestions: [
          {
            documentId: aliceDoc.document.id,
            originalText: 'Content',
            suggestedText: 'Better content',
            description: "Alice's suggestion",
          },
        ],
      },
    });

    const suggestionId = aliceSuggestions.suggestions[0].id;

    // Bob should not be able to update Alice's suggestion
    const response = await userBob.api.updateSuggestionStatus({
      params: { id: suggestionId },
      body: { isResolved: true },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Suggestion not found for Bob

    // Verify Alice's suggestion is unchanged
    const aliceCheck = await userAlice.api.getSuggestionsByDocumentId({
      query: { documentId: aliceDoc.document.id },
    });
    expect(aliceCheck.suggestions[0].isResolved).toBe(false);
  });

  it("should prevent suggestions on other users' documents", async () => {
    // Alice creates a document
    const aliceDoc = await userAlice.api.saveDocument({
      body: {
        title: "Alice's Document",
        content: 'Private content',
        kind: 'text',
      },
    });

    // Bob should not be able to create suggestions on Alice's document
    const response = await userBob.api.saveSuggestions({
      body: {
        suggestions: [
          {
            documentId: aliceDoc.document.id,
            originalText: 'Private content',
            suggestedText: "Bob's suggested content",
            description: "Bob's unauthorized suggestion",
          },
        ],
      },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Document not found for Bob
  });

  it('should isolate suggestion filtering between users', async () => {
    // Alice creates a document with suggestions
    const aliceDoc = await userAlice.api.saveDocument({
      body: { title: 'Alice Doc', content: 'Content', kind: 'text' },
    });

    await userAlice.api.saveSuggestions({
      body: {
        suggestions: [
          {
            documentId: aliceDoc.document.id,
            originalText: 'Content',
            suggestedText: 'Better content',
            isResolved: false,
          },
          {
            documentId: aliceDoc.document.id,
            originalText: 'Content',
            suggestedText: 'Alternative content',
            isResolved: true,
          },
        ],
      },
    });

    // Bob creates his own document with suggestions
    const bobDoc = await userBob.api.saveDocument({
      body: { title: 'Bob Doc', content: "Bob's content", kind: 'text' },
    });

    await userBob.api.saveSuggestions({
      body: {
        suggestions: [
          {
            documentId: bobDoc.document.id,
            originalText: "Bob's content",
            suggestedText: "Bob's improved content",
            isResolved: false,
          },
        ],
      },
    });

    // Alice should only see her own suggestions
    const aliceSuggestions = await userAlice.api.getSuggestionsByDocumentId({
      query: { documentId: aliceDoc.document.id },
    });
    expect(aliceSuggestions.suggestions).toHaveLength(2);

    // Filter for unresolved suggestions manually
    const aliceUnresolved = aliceSuggestions.suggestions.filter(
      (s: any) => !s.isResolved
    );
    expect(aliceUnresolved).toHaveLength(1);

    // Bob should only see his own suggestions
    const bobSuggestions = await userBob.api.getSuggestionsByDocumentId({
      query: { documentId: bobDoc.document.id },
    });
    expect(bobSuggestions.suggestions).toHaveLength(1);
    expect(bobSuggestions.suggestions[0].suggestedText).toBe(
      "Bob's improved content"
    );
  });

  // TODO: Add tests for suggestion permissions when document sharing is implemented
  // TODO: Add tests for suggestion workflows with AI tool integration
});

describe('suggestion error code validation', async () => {
  const { ai: aiNoUser } = await getTestInstance({}, UNAUTHENTICATED);

  it('should return authentication error codes', async () => {
    const response = await aiNoUser.api.saveSuggestions({
      body: {
        suggestions: [
          {
            documentId: 'test-doc-id',
            originalText: 'Original',
            suggestedText: 'Suggested',
          },
        ],
      },
      asResponse: true,
    });

    expect(response.status).toBe(401);
    const error = await response.json();
    expect(error.message).toContain('User is required');
  });

  it('should return suggestion not found error codes', async () => {
    const { ai } = await getTestInstance();
    const response = await ai.api.updateSuggestionStatus({
      params: { id: 'non-existent-suggestion-id' },
      body: { isResolved: true },
      asResponse: true,
    });

    expect(response.status).toBe(404);
    const error = await response.json();
    expect(error.message).toContain('not found');
  });

  // TODO: Add specific suggestion error tests:
  // - SUGGESTION_ACCESS_DENIED scenarios
  // - Invalid suggestion format validation
  // - Document reference validation errors
});
