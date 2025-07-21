// Error codes with human-readable messages
export const BASE_ERROR_CODES = {
  // User context errors
  USER_NOT_FOUND: 'User not found',
  FAILED_TO_GET_USER: 'Failed to get user from provider',
  USER_REQUIRED: 'User is required for this operation',

  // General errors
  UNAUTHORIZED: 'Access denied',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  INVALID_INPUT: 'Invalid input provided',
  INTERNAL_ERROR: 'Internal server error',

  // Chat/Conversation errors
  CHAT_NOT_FOUND: 'Chat not found',
  FAILED_TO_CREATE_CHAT: 'Failed to create chat',
  FAILED_TO_UPDATE_CHAT: 'Failed to update chat',
  FAILED_TO_DELETE_CHAT: 'Failed to delete chat',
  CHAT_ACCESS_DENIED: 'Access denied to chat',

  // Message errors
  MESSAGE_NOT_FOUND: 'Message not found',
  FAILED_TO_CREATE_MESSAGE: 'Failed to create message',
  FAILED_TO_UPDATE_MESSAGE: 'Failed to update message',
  FAILED_TO_DELETE_MESSAGE: 'Failed to delete message',
  INVALID_MESSAGE_FORMAT: 'Invalid message format',

  // AI Provider errors
  PROVIDER_NOT_FOUND: 'AI provider not found',
  PROVIDER_NOT_CONFIGURED: 'AI provider not configured',
  PROVIDER_API_ERROR: 'AI provider API error',
  PROVIDER_QUOTA_EXCEEDED: 'AI provider quota exceeded',
  PROVIDER_RATE_LIMITED: 'AI provider rate limited',

  // Model errors
  MODEL_NOT_FOUND: 'Model not found',
  MODEL_NOT_SUPPORTED: 'Model not supported by provider',
  MODEL_UNAVAILABLE: 'Model temporarily unavailable',

  // API Key errors
  INVALID_API_KEY: 'Invalid API key',
  API_KEY_EXPIRED: 'API key expired',
  API_KEY_QUOTA_EXCEEDED: 'API key quota exceeded',

  // Document errors
  DOCUMENT_NOT_FOUND: 'Document not found',
  FAILED_TO_CREATE_DOCUMENT: 'Failed to create document',
  FAILED_TO_UPDATE_DOCUMENT: 'Failed to update document',
  DOCUMENT_ACCESS_DENIED: 'Access denied to document',

  // Vote errors
  VOTE_NOT_FOUND: 'Vote not found',

  // Suggestion errors
  SUGGESTION_NOT_FOUND: 'Suggestion not found',
  SUGGESTION_ACCESS_DENIED: 'Access denied to suggestion',

  // File errors
  FILE_NOT_FOUND: 'File not found',
  FILE_ACCESS_DENIED: 'Access denied to file',

  // Streaming errors
  STREAM_NOT_FOUND: 'Stream not found',
  STREAM_ALREADY_ENDED: 'Stream already ended',
  STREAM_CONNECTION_ERROR: 'Stream connection error',

  // General errors
  INVALID_TOKEN: 'Invalid token', // For AI model API tokens or authentication tokens
  INVALID_REQUEST: 'Invalid request',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  DATABASE_ERROR: 'Database error',
  NETWORK_ERROR: 'Network error',
};
