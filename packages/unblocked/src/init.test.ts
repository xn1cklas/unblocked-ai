import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { init } from './init';

// Auth client imports removed for AI focus
// import { getTestInstance } from "./test-utils/test-instance";

describe('init', async () => {
  const database = new Database(':memory:');

  it('should match config', async () => {
    const res = await init({
      baseURL: 'http://localhost:3000',
      database,
      user: {
        getUser: () => ({ id: 'test-user', name: 'Test User' }),
      },
    });
    expect(res).toMatchSnapshot();
  });

  it('should infer BASE_URL from env', async () => {
    vi.stubEnv('UNBLOCKED_URL', 'http://localhost:5147');
    const res = await init({
      database,
      user: {
        getUser: () => ({ id: 'test-user', name: 'Test User' }),
      },
    });
    expect(res.options.baseURL).toBe('http://localhost:5147');
    expect(res.baseURL).toBe('http://localhost:5147/api/unblocked');
    vi.unstubAllEnvs();
  });

  it('should respect base path', async () => {
    const res = await init({
      database,
      basePath: '/custom-path',
      baseURL: 'http://localhost:5147',
      user: {
        getUser: () => ({ id: 'test-user', name: 'Test User' }),
      },
    });
    expect(res.baseURL).toBe('http://localhost:5147/custom-path');
  });

  it('should execute plugins init', async () => {
    const newBaseURL = 'http://test.test';
    const res = await init({
      baseURL: 'http://localhost:3000',
      database,
      user: {
        getUser: () => ({ id: 'test-user', name: 'Test User' }),
      },
      plugins: [
        {
          id: 'test',
          init: () => {
            return {
              context: {
                baseURL: newBaseURL,
              },
            };
          },
        },
      ],
    });
    expect(res.baseURL).toBe(newBaseURL);
  });

  it('should work with custom path', async () => {
    const customPath = '/custom-path';
    const ctx = await init({
      database,
      basePath: customPath,
      baseURL: 'http://localhost:3000',
      user: {
        getUser: () => ({ id: 'test-user', name: 'Test User' }),
      },
    });
    expect(ctx.baseURL).toBe(`http://localhost:3000${customPath}`);
    // Client test removed - requires handler setup
  });

  it('should allow plugins to set config values', async () => {
    const ctx = await init({
      database,
      baseURL: 'http://localhost:3000',
      user: {
        getUser: () => ({ id: 'test-user', name: 'Test User' }),
      },
      plugins: [
        {
          id: 'test-plugin',
          init(ctx) {
            return {
              context: ctx,
              options: {
                appName: 'Custom AI App',
              },
            };
          },
        },
      ],
    });
    expect(ctx.options.appName).toBe('Custom AI App');
  });

  it('should not allow plugins to set config values if they are set in the main config', async () => {
    const ctx = await init({
      database,
      baseURL: 'http://localhost:3000',
      appName: 'Main AI App',
      user: {
        getUser: () => ({ id: 'test-user', name: 'Test User' }),
      },
      plugins: [
        {
          id: 'test-plugin',
          init(ctx) {
            return {
              context: ctx,
              options: {
                appName: 'Plugin AI App',
              },
            };
          },
        },
      ],
    });
    expect(ctx.options.appName).toBe('Main AI App');
  });
});
