/**
 * AI Atoms - Core client-side state management
 *
 * Following unblocked's session-atom.ts pattern, this file provides
 * the core AI-related atoms that are built into the client.
 */

import type { BetterFetch } from '@better-fetch/fetch';
import { atom, computed } from 'nanostores';
import type { Chat, Document, Message } from '../types';
import { useAIQuery } from './query';

// Response types for AI operations
export interface CreateChatResponse {
  chatId?: string;
  id?: string;
  chat?: Chat;
}

export interface LoadChatResponse {
  chat: Chat;
  messages: Message[];
}

export interface ModelsResponse {
  models: Array<{
    id: string;
    name: string;
    provider: string;
    capabilities?: string[];
    metadata?: Record<string, any>;
  }>;
}

export interface DocumentsResponse {
  documents: Document[];
}

export interface CreateDocumentResponse {
  documentId?: string;
  id?: string;
  document?: Document;
}

export interface PreferencesResponse {
  preferences: Record<string, any>;
}

export interface AIUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

// Following unblocked's pattern - export a function that creates atoms
export function getAIAtoms($fetch: BetterFetch) {
  // Create signal atoms for triggering queries
  const $chatSignal = atom<boolean>(false);
  const $modelsSignal = atom<boolean>(false);
  const $documentsSignal = atom<boolean>(false);
  const $preferencesSignal = atom<boolean>(false);

  // User state atom
  const $user = atom<AIUser | null>(null);

  // Chat state atoms
  const $currentChatId = atom<string | null>(null);
  const $chatVisibility = atom<'private' | 'public'>('private');
  const $selectedModel = atom<string>('gpt-4o-mini');

  // Use query pattern like unblocked for models
  const models = useAIQuery<ModelsResponse>(
    $modelsSignal,
    '/api/models',
    $fetch,
    {
      method: 'GET',
    }
  );

  // Use query pattern for documents
  const documents = useAIQuery<DocumentsResponse>(
    $documentsSignal,
    '/api/document',
    $fetch,
    {
      method: 'GET',
    }
  );

  // Use query pattern for preferences
  const preferences = useAIQuery<PreferencesResponse>(
    $preferencesSignal,
    '/api/preferences',
    $fetch,
    {
      method: 'GET',
    }
  );

  // Computed atoms
  const $isAuthenticated = computed($user, (user) => !!user);

  const $isReady = computed(
    [$user, models, documents, preferences],
    (user, modelsState, docsState, prefsState) => {
      return (
        !!user &&
        !modelsState.isPending &&
        !docsState.isPending &&
        !prefsState.isPending
      );
    }
  );

  // Computed chat state
  const $chat = computed(
    [$currentChatId, $chatVisibility, $selectedModel],
    (id, visibility, model) => ({
      currentChatId: id,
      visibility,
      selectedModel: model,
    })
  );

  // Computed models state
  const $models = computed(models, (state) => ({
    available: state.data?.models || [],
    loading: state.isPending,
    error: state.error?.message || null,
  }));

  // Computed documents state
  const $documents = computed(documents, (state) => ({
    list: state.data?.documents || [],
    loading: state.isPending,
    error: state.error?.message || null,
  }));

  // Computed preferences state
  const $preferences = computed(preferences, (state) => ({
    data: state.data?.preferences || {},
    loading: state.isPending,
    error: state.error?.message || null,
  }));

  return {
    // Atoms
    user: $user,
    chat: $chat,
    models: $models,
    documents: $documents,
    preferences: $preferences,
    isAuthenticated: $isAuthenticated,
    isReady: $isReady,
    currentChatId: $currentChatId,
    chatVisibility: $chatVisibility,
    selectedModel: $selectedModel,

    // Signals for triggering updates
    $chatSignal,
    $modelsSignal,
    $documentsSignal,
    $preferencesSignal,

    // Query results for direct access
    modelsQuery: models,
    documentsQuery: documents,
    preferencesQuery: preferences,
  };
}

// AI Actions that operate on the atoms
export function createAIActions(
  $fetch: BetterFetch,
  atoms: ReturnType<typeof getAIAtoms>
) {
  // Chat actions
  const createChat = async (options?: {
    title?: string;
    visibility?: 'private' | 'public';
    model?: string;
  }): Promise<string> => {
    const response = await $fetch<CreateChatResponse>('/api/chat', {
      method: 'POST',
      body: {
        title: options?.title,
        visibility: options?.visibility || atoms.chatVisibility.get(),
        model: options?.model || atoms.selectedModel.get(),
      },
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to create chat');
    }

    const chatId =
      response.data?.chatId || response.data?.id || response.data?.chat?.id;
    if (!chatId) {
      throw new Error('Failed to get chat ID from response');
    }

    atoms.currentChatId.set(chatId);
    return chatId;
  };

  const loadChat = async (chatId: string): Promise<void> => {
    const response = await $fetch<LoadChatResponse>(`/api/chat/${chatId}`, {
      method: 'GET',
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to load chat');
    }

    atoms.currentChatId.set(chatId);
  };

  const deleteChat = async (chatId: string): Promise<void> => {
    const response = await $fetch(`/api/chat/${chatId}`, {
      method: 'DELETE',
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to delete chat');
    }

    if (atoms.currentChatId.get() === chatId) {
      atoms.currentChatId.set(null);
    }
  };

  // Model actions
  const refreshModels = async (): Promise<void> => {
    atoms.$modelsSignal.set(!atoms.$modelsSignal.get());
  };

  // Document actions
  const refreshDocuments = async (): Promise<void> => {
    atoms.$documentsSignal.set(!atoms.$documentsSignal.get());
  };

  const createDocument = async (
    content: string,
    title?: string
  ): Promise<string> => {
    const response = await $fetch<CreateDocumentResponse>('/api/document', {
      method: 'POST',
      body: {
        content,
        title,
      },
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to create document');
    }

    const documentId =
      response.data?.documentId ||
      response.data?.id ||
      response.data?.document?.id;
    if (!documentId) {
      throw new Error('Failed to get document ID from response');
    }

    // Refresh documents list
    await refreshDocuments();

    return documentId;
  };

  // Preferences actions
  const updatePreferences = async (
    newPreferences: Record<string, any>
  ): Promise<void> => {
    const response = await $fetch<PreferencesResponse>('/api/preferences', {
      method: 'PATCH',
      body: newPreferences,
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to update preferences');
    }

    // Trigger refresh
    atoms.$preferencesSignal.set(!atoms.$preferencesSignal.get());
  };

  return {
    createChat,
    loadChat,
    deleteChat,
    refreshModels,
    refreshDocuments,
    createDocument,
    updatePreferences,
  };
}
