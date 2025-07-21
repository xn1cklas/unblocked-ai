import { describe, expect, it } from 'vitest';
import {
  getTestInstance,
  UNAUTHENTICATED,
} from '../../test-utils/test-instance';

describe('document', () => {
  it('should create a document', async () => {
    const { ai } = await getTestInstance();
    const response = await ai.api.saveDocument({
      body: {
        title: 'Test Document',
        content: 'Test content',
        kind: 'text',
      },
    });

    expect(response).toBeDefined();
    expect(response.document).toBeDefined();
    expect(response.document.title).toBe('Test Document');
    expect(response.document.content).toBe('Test content');
    expect(response.document.kind).toBe('text');
    expect(response.document.id).toBeDefined();
  });

  it('should get a document by ID', async () => {
    const { ai } = await getTestInstance();
    // First create a document
    const createResponse = await ai.api.saveDocument({
      body: {
        title: 'Get Test Document',
        content: 'Content for retrieval',
        kind: 'text',
      },
    });

    // Get the document
    const getResponse = await ai.api.getDocumentById({
      params: {
        id: createResponse.document.id,
      },
    });

    expect(getResponse).toBeDefined();
    expect(getResponse.document).toBeDefined();
    expect(getResponse.document.title).toBe('Get Test Document');
    expect(getResponse.document.content).toBe('Content for retrieval');
    expect(getResponse.document.kind).toBe('text');
  });

  it('should update a document', async () => {
    const { ai } = await getTestInstance();
    // First create a document
    const createResponse = await ai.api.saveDocument({
      body: {
        title: 'Update Test Document',
        content: 'Original content',
        kind: 'text',
      },
    });

    const documentId = createResponse.document.id;

    // Update the document
    const updateResponse = await ai.api.updateDocument({
      params: {
        id: documentId,
      },
      body: {
        title: 'Updated Document Title',
        content: 'Updated content',
      },
    });

    expect(updateResponse).toBeDefined();
    expect(updateResponse.document).toBeDefined();
    expect(updateResponse.document!.title).toBe('Updated Document Title');
    expect(updateResponse.document!.content).toBe('Updated content');
    expect(updateResponse.document!.id).toBe(documentId);
  });

  it('should return 404 for non-existent document', async () => {
    const { ai } = await getTestInstance();
    const response = await ai.api.getDocumentById({
      params: {
        id: 'non-existent-id',
      },
      asResponse: true,
    });

    expect(response.status).toBe(404);
  });

  it('should create documents with different kinds', async () => {
    const { ai } = await getTestInstance();
    const kinds = ['text', 'code', 'image', 'sheet'] as const;

    for (const kind of kinds) {
      const response = await ai.api.saveDocument({
        body: {
          title: `${kind} Document`,
          content: `Content for ${kind}`,
          kind,
        },
      });

      expect(response.document.kind).toBe(kind);
    }
  });

  it('should get documents by ID list', async () => {
    const { ai } = await getTestInstance();
    // Create multiple documents
    const doc1 = await ai.api.saveDocument({
      body: {
        title: 'Doc 1',
        content: 'Content 1',
        kind: 'text',
      },
    });

    const doc2 = await ai.api.saveDocument({
      body: {
        title: 'Doc 2',
        content: 'Content 2',
        kind: 'code',
      },
    });

    // Get documents by IDs
    const response = await ai.api.getDocumentsById({
      query: {
        id: `${doc1.document.id},${doc2.document.id}`,
      },
    });

    expect(response).toBeDefined();
    expect(response.documents).toBeDefined();
    expect(response.documents).toHaveLength(2);

    const ids = response.documents.map((doc: any) => doc.id);
    expect(ids).toContain(doc1.document.id);
    expect(ids).toContain(doc2.document.id);
  });
});

describe('multi-user document isolation', () => {
  it('should prevent cross-user document access', async () => {
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

    // Alice creates a document
    const aliceDoc = await userAlice.api.saveDocument({
      body: {
        title: "Alice's Private Document",
        content: "Alice's secret content",
        kind: 'text',
      },
    });

    // Bob should not be able to access Alice's document
    const response = await userBob.api.getDocumentById({
      params: { id: aliceDoc.document.id },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Not found for security
  });

  it('should prevent cross-user document updates', async () => {
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

    // Alice creates a document
    const aliceDoc = await userAlice.api.saveDocument({
      body: {
        title: "Alice's Document",
        content: 'Original content',
        kind: 'text',
      },
    });

    // Bob should not be able to update Alice's document
    const response = await userBob.api.updateDocument({
      params: { id: aliceDoc.document.id },
      body: {
        title: "Bob's Modified Title",
        content: "Bob's modified content",
      },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Not found for Bob

    // Verify Alice's document is unchanged
    const aliceCheck = await userAlice.api.getDocumentById({
      params: { id: aliceDoc.document.id },
    });
    expect(aliceCheck.document.title).toBe("Alice's Document");
    expect(aliceCheck.document.content).toBe('Original content');
  });

  it('should prevent cross-user document deletion', async () => {
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

    // Alice creates a document
    const aliceDoc = await userAlice.api.saveDocument({
      body: {
        title: "Alice's Document to Delete",
        content: 'Content to preserve',
        kind: 'text',
      },
    });

    // Bob should not be able to delete Alice's document
    const response = await userBob.api.deleteDocumentsByIdAfterTimestamp({
      params: {
        id: aliceDoc.document.id,
        timestamp: new Date(Date.now() - 1000).toISOString(),
      },
      asResponse: true,
    });

    expect(response.status).toBe(404); // Not found for Bob

    // Verify Alice's document still exists
    const aliceCheck = await userAlice.api.getDocumentById({
      params: { id: aliceDoc.document.id },
    });
    expect(aliceCheck.document).toBeDefined();
  });

  it('should isolate document listings between users', async () => {
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

    // Alice creates documents
    const aliceDoc1 = await userAlice.api.saveDocument({
      body: { title: 'Alice Doc 1', content: 'Content 1', kind: 'text' },
    });
    const aliceDoc2 = await userAlice.api.saveDocument({
      body: { title: 'Alice Doc 2', content: 'Content 2', kind: 'code' },
    });

    // Bob creates documents
    const bobDoc1 = await userBob.api.saveDocument({
      body: { title: 'Bob Doc 1', content: "Bob's content", kind: 'text' },
    });

    // Alice should only access her own documents via batch get
    const aliceResponse = await userAlice.api.getDocumentsById({
      query: {
        id: `${aliceDoc1.document.id},${aliceDoc2.document.id},${bobDoc1.document.id}`,
      },
    });

    // Alice should only get her own documents, Bob's should be filtered out
    expect(aliceResponse.documents).toHaveLength(2);
    const aliceIds = aliceResponse.documents.map((d: any) => d.id);
    expect(aliceIds).toContain(aliceDoc1.document.id);
    expect(aliceIds).toContain(aliceDoc2.document.id);
    expect(aliceIds).not.toContain(bobDoc1.document.id);
  });

  // TODO: Add tests for document sharing/collaboration features when implemented
  // TODO: Add tests for document versioning isolation
});

describe('document error code validation', () => {
  it('should return authentication error codes', async () => {
    const { ai: aiNoUser } = await getTestInstance({}, UNAUTHENTICATED);
    const response = await aiNoUser.api.saveDocument({
      body: { title: 'Unauthorized Doc', content: 'Content', kind: 'text' },
      asResponse: true,
    });

    expect(response.status).toBe(401);
    const error = await response.json();
    expect(error.message).toContain('User is required');
  });

  it('should return document not found error codes', async () => {
    const { ai } = await getTestInstance();
    const response = await ai.api.getDocumentById({
      params: { id: 'non-existent-document-id' },
      asResponse: true,
    });

    expect(response.status).toBe(404);
    const error = await response.json();
    expect(error.message).toContain('not found');
  });

  it('should validate document input format', async () => {
    const { ai } = await getTestInstance();
    const response = await ai.api.saveDocument({
      body: {
        title: '', // Invalid empty title
        content: 'Valid content',
        kind: 'text',
      },
      asResponse: true,
    });

    expect([400, 422]).toContain(response.status);
  });

  // TODO: Add specific document error tests:
  // - DOCUMENT_ACCESS_DENIED scenarios
  // - Invalid document kind validation
  // - Content size limit errors
  // - Versioning conflict errors
});
