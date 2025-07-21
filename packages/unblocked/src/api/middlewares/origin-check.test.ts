import { describe, expect } from 'vitest';
import { z } from 'zod';
import { createUnblockedClient } from '../../client';
import { getTestInstance } from '../../test-utils/test-instance';
import { createUnblockedEndpoint } from '../call';
import { originCheck } from './origin-check';

describe('Origin Check', async (it) => {
  const { customFetchImpl, testUser } = await getTestInstance({
    trustedOrigins: [
      'http://localhost:5000',
      'https://trusted.com',
      '*.my-site.com',
      'https://*.protocol-site.com',
    ],
    advanced: {
      disableCSRFCheck: false,
    },
  });

  it('should allow trusted origins', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'http://localhost:3000',
        },
      },
    });
    const res = await client.$fetch('/ok');
    expect(res.data).toMatchObject({ ok: true });
  });

  it('should not allow untrusted origins', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
      },
    });

    const res = await client.$fetch('/chat', {
      method: 'POST',
      headers: {
        origin: 'http://untrusted.com',
        'x-forwarded-host': 'untrusted.com',
        cookie: 'session=test-session',
      },
      body: {
        title: 'Test Chat',
      },
    });
    expect(res.error?.status).toBe(403);
  });

  it('should allow query params in callback url', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'http://localhost:3000',
        },
      },
    });
    // Create a chat which is a safe operation
    const res = await client.$fetch('/chat', {
      method: 'POST',
      body: {
        title: 'Test Chat',
      },
      query: {
        callbackURL: 'http://localhost:3000/callback?test=123',
      },
    });
    expect(res.data).toBeDefined();
  });

  it('should allow plus signs in the callback url', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'http://localhost:3000',
        },
      },
    });
    const res = await client.$fetch('/chat', {
      method: 'POST',
      body: {
        title: 'Test Chat',
      },
      query: {
        callbackURL: 'http://localhost:3000/callback?test=hello+world',
      },
    });
    expect(res.data).toBeDefined();
  });

  it('should reject callback url with double slash', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'http://localhost:3000',
        },
      },
    });
    const res = await client.$fetch('/chat', {
      method: 'POST',
      body: {
        title: 'Test Chat',
      },
      query: {
        callbackURL: '//evil.com',
      },
    });
    expect(res.error?.status).toBe(403);
  });

  it('should reject callback urls with encoded malicious content', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'http://localhost:3000',
        },
      },
    });
    const res = await client.$fetch('/chat', {
      method: 'POST',
      body: {
        title: 'Test Chat',
      },
      query: {
        callbackURL: encodeURIComponent('//evil.com'),
      },
    });
    expect(res.error?.status).toBe(403);
  });

  it('should reject untrusted origin headers', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'http://untrusted.com',
          cookie: 'session=test-session',
        },
      },
    });
    const res = await client.$fetch('/chat', {
      method: 'POST',
      body: {
        title: 'Test Chat',
      },
    });
    expect(res.error?.status).toBe(403);
  });

  it('should reject untrusted origin headers which start with trusted origin', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'http://localhost:5000.evil.com',
          cookie: 'session=test-session',
        },
      },
    });
    const res = await client.$fetch('/chat', {
      method: 'POST',
      body: {
        title: 'Test Chat',
      },
    });
    expect(res.error?.status).toBe(403);
  });

  it('should reject untrusted origin subdomains', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'http://evil.trusted.com',
          cookie: 'session=test-session',
        },
      },
    });
    const res = await client.$fetch('/chat', {
      method: 'POST',
      body: {
        title: 'Test Chat',
      },
    });
    expect(res.error?.status).toBe(403);
  });

  it("should allow untrusted origin if they don't contain cookies", async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl: async (input, init = {}) => {
          const headers = new Headers(init.headers);
          headers.delete('cookie');
          return customFetchImpl(input, {
            ...init,
            headers,
          });
        },
        headers: {
          origin: 'http://untrusted.com',
        },
      },
    });
    const res = await client.$fetch('/ok', {
      method: 'GET',
    });
    expect(res.data).toMatchObject({ ok: true });
  });

  it('should reject untrusted callbackURL', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'http://localhost:3000',
        },
      },
    });
    const res = await client.$fetch('/chat', {
      method: 'POST',
      body: {
        title: 'Test Chat',
      },
      query: {
        callbackURL: 'http://evil.com',
      },
    });
    expect(res.error?.status).toBe(403);
  });

  it('should work with list of trusted origins', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'https://trusted.com',
        },
      },
    });
    const res = await client.$fetch('/ok');
    expect(res.data).toMatchObject({ ok: true });
  });

  it('should work with wildcard trusted origins', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'https://subdomain.my-site.com',
        },
      },
    });
    const res = await client.$fetch('/ok');
    expect(res.data).toMatchObject({ ok: true });
  });

  it('should work with GET requests', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'http://localhost:3000',
        },
      },
    });
    const res = await client.$fetch('/ok', {
      method: 'GET',
    });
    expect(res.data).toMatchObject({ ok: true });
  });

  it('should handle POST requests with proper origin validation', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'http://localhost:3000',
        },
      },
    });
    const res = await client.$fetch('/chat', {
      method: 'POST',
      body: {
        title: 'Test Chat',
      },
    });
    expect(res.data).toBeDefined();
  });

  it('should work with relative callbackURL with query params', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'http://localhost:3000',
        },
      },
    });
    const res = await client.$fetch('/chat', {
      method: 'POST',
      body: {
        title: 'Test Chat',
      },
      query: {
        callbackURL: '/callback?test=123',
      },
    });
    expect(res.data).toBeDefined();
  });

  it('should work with protocol specific wildcard trusted origins', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'https://secure.protocol-site.com',
        },
      },
    });
    const res = await client.$fetch('/ok');
    expect(res.data).toMatchObject({ ok: true });
  });
});

describe('origin check middleware', async (it) => {
  const { customFetchImpl, testUser } = await getTestInstance({
    trustedOrigins: ['http://localhost:3000'],
    plugins: [
      {
        id: 'test',
        endpoints: {
          testOriginCheck: createUnblockedEndpoint(
            '/test-origin-check',
            {
              method: 'POST',
              body: z.object({
                test: z.string(),
              }),
              metadata: {
                openapi: {
                  description: 'Test origin check',
                  responses: {
                    '200': {
                      description: 'Success',
                      content: {
                        'application/json': {
                          schema: {
                            type: 'object',
                            properties: {
                              test: {
                                type: 'string',
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              use: [originCheck],
            },
            async (ctx) => {
              return ctx.json({ test: ctx.body.test });
            }
          ),
        },
      },
    ],
    advanced: {
      disableCSRFCheck: false,
    },
  });

  it('should return invalid origin', async (ctx) => {
    const client = createUnblockedClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: {
        customFetchImpl,
        headers: {
          origin: 'http://untrusted.com',
          cookie: 'session=test-session',
        },
      },
    });
    const res = await client.$fetch('/test-origin-check', {
      method: 'POST',
      body: {
        test: 'test',
      },
    });
    expect(res.error?.status).toBe(403);
    expect(res.error?.message).toBe('Invalid origin');
  });
});
