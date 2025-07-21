// Types for RAG plugin

export interface RagDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embeddings?: number[]; // Vector embeddings
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RagChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[]; // Vector embedding for this chunk
  chunkIndex: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface SearchResult {
  documentId: string;
  chunkId: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface ContextResult {
  context: string;
  sources: Array<{
    id: string;
    metadata: Record<string, any>;
    score: number;
  }>;
  tokenCount: number;
}

export interface EmbeddingResult {
  documentId: string;
  chunks: number;
  success: boolean;
}
