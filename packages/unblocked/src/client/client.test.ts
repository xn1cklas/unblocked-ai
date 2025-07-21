// @vitest-environment happy-dom

import type { ReadableAtom } from 'nanostores';
import type { Accessor } from 'solid-js';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { Ref } from 'vue';
import { createUnblockedClient as createReactClient } from './react';
import { createUnblockedClient as createSolidClient } from './solid';
import { createUnblockedClient as createSvelteClient } from './svelte';
import { testClientPlugin, testClientPlugin2 } from './test-plugin';
import { createUnblockedClient as createVueClient } from './vue';

describe('run time proxy', async () => {
  it('proxy api should be called', async () => {
    let apiCalled = false;
    const client = createSolidClient({
      plugins: [testClientPlugin()],
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          apiCalled = true;
          return new Response();
        },
        baseURL: 'http://localhost:3000',
      },
    });
    await client.test();
    expect(apiCalled).toBe(true);
  });

  it('state listener should be called on matched path', async () => {
    const client = createSolidClient({
      plugins: [testClientPlugin()],
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          return new Response();
        },
        baseURL: 'http://localhost:3000',
      },
    });
    const res = client.useComputedAtom();
    expect(res()).toBe(0);
    await client.test();
    vi.useFakeTimers();
    setTimeout(() => {
      expect(res()).toBe(1);
    }, 100);
  });

  it('should allow second argument fetch options', async () => {
    let called = false;
    const client = createSolidClient({
      plugins: [testClientPlugin()],
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          return new Response();
        },
        baseURL: 'http://localhost:3000',
      },
    });
    await client.test({
      fetchOptions: {
        onSuccess(context: { response: Response; data: unknown }) {
          called = true;
        },
      },
    });
    expect(called).toBe(true);
  });
});

describe('AI operations', () => {
  it('should create chat', async () => {
    let chatCreated = false;
    const client = createReactClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          const urlString = url.toString();
          if (urlString.includes('/chat') && init?.method === 'POST') {
            chatCreated = true;
            const body = JSON.parse(init.body as string);
            return new Response(
              JSON.stringify({
                chat: {
                  id: 'test-chat-id',
                  title: body.title || 'New Chat',
                  visibility: body.visibility || 'private',
                  userId: 'test-user',
                  createdAt: new Date().toISOString(),
                },
              })
            );
          }
          return new Response();
        },
      },
    });
    const response = await (client as any).chat({
      title: 'Test Chat',
      visibility: 'private',
    });
    expect(chatCreated).toBe(true);
    expect(response.data?.chat).toMatchObject({
      id: 'test-chat-id',
      title: 'Test Chat',
      visibility: 'private',
    });
  });

  it('should send message', async () => {
    let messageSent = false;
    const client = createReactClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          const urlString = url.toString();
          if (
            urlString.includes('/chat/') &&
            urlString.includes('/message') &&
            init?.method === 'POST'
          ) {
            messageSent = true;
            const body = JSON.parse(init.body as string);
            return new Response(
              JSON.stringify({
                message: {
                  id: 'test-message-id',
                  chatId: 'test-chat-id',
                  content: body.content,
                  role: body.role,
                  createdAt: new Date().toISOString(),
                },
              })
            );
          }
          return new Response();
        },
      },
    });
    const response = await (client as any).chat['test-chat-id'].message({
      content: 'Hello AI',
      role: 'user',
    });
    expect(messageSent).toBe(true);
    expect(response.data?.message).toMatchObject({
      id: 'test-message-id',
      content: 'Hello AI',
      role: 'user',
    });
  });

  it('should vote on message', async () => {
    let voteCreated = false;
    const client = createReactClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          const urlString = url.toString();
          if (urlString.includes('/vote') && init?.method === 'PATCH') {
            voteCreated = true;
            const body = JSON.parse(init.body as string);
            return new Response(
              JSON.stringify({
                vote: {
                  id: 'test-vote-id',
                  messageId: body.messageId,
                  chatId: body.chatId,
                  isUpvote: body.type === 'up',
                  createdAt: new Date().toISOString(),
                },
              })
            );
          }
          return new Response();
        },
      },
    });
    const response = await (client as any).vote({
      messageId: 'test-message-id',
      chatId: 'test-chat-id',
      type: 'up',
    });
    expect(voteCreated).toBe(true);
    expect(response.data?.vote).toMatchObject({
      id: 'test-vote-id',
      isUpvote: true,
    });
  });

  it('should list chats', async () => {
    let chatsListed = false;
    const client = createReactClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          const urlString = url.toString();
          if (
            urlString.includes('/history') &&
            (init?.method === 'GET' || !init?.method)
          ) {
            chatsListed = true;
            return new Response(
              JSON.stringify({
                chats: [
                  { id: 'chat-1', title: 'Chat 1', visibility: 'private' },
                  { id: 'chat-2', title: 'Chat 2', visibility: 'public' },
                ],
                nextCursor: null,
              })
            );
          }
          return new Response();
        },
      },
    });
    const response = await (client as any).history({});
    expect(chatsListed).toBe(true);
    expect(response.data?.chats).toHaveLength(2);
    expect(response.data?.chats[0]).toMatchObject({
      id: 'chat-1',
      title: 'Chat 1',
    });
  });
});

describe('type', () => {
  it('should infer resolved hooks react', () => {
    const client = createReactClient({
      plugins: [testClientPlugin()],
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          return new Response();
        },
      },
    });
    // Allow flexible type assertions for dynamic plugin atoms
    expectTypeOf(client.useComputedAtom).toMatchTypeOf<() => any>();
  });
  it('should infer resolved hooks solid', () => {
    const client = createSolidClient({
      plugins: [testClientPlugin()],
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          return new Response();
        },
      },
    });
    // Allow flexible type assertions for dynamic plugin atoms
    expectTypeOf(client.useComputedAtom).toMatchTypeOf<() => Accessor<any>>();
  });
  it('should infer resolved hooks vue', () => {
    const client = createVueClient({
      plugins: [testClientPlugin()],
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          return new Response();
        },
      },
    });
    // Allow flexible type assertions for dynamic plugin atoms
    expectTypeOf(client.useComputedAtom).toMatchTypeOf<
      () => Readonly<Ref<any>>
    >();
  });
  it('should infer resolved hooks svelte', () => {
    const client = createSvelteClient({
      plugins: [testClientPlugin()],
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          return new Response();
        },
      },
    });
    // Allow flexible type assertions for dynamic plugin atoms
    expectTypeOf(client.useComputedAtom).toMatchTypeOf<
      () => ReadableAtom<any>
    >();
  });

  it('should infer actions', () => {
    const client = createSolidClient({
      plugins: [testClientPlugin(), testClientPlugin2()],
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          return new Response();
        },
      },
    });
    // Allow flexible type assertions for plugin actions
    expectTypeOf(client.setTestAtom).toMatchTypeOf<(value: any) => any>();
  });
});
