import { defu } from 'defu';
// Password utilities removed for AI focus
import { createInternalAdapter, getMigrations } from './db';
import { getAITables } from './db/get-tables';
import { getAdapter } from './db/utils';
import { UnblockedError } from './error';
import type {
  Adapter,
  Models,
  SecondaryStorage,
  UnblockedOptions,
  UnblockedPlugin,
  User,
} from './types';
import type { LiteralUnion } from './types/helper';
// Social providers removed for AI focus
// OAuth removed for AI focus
import { generateId } from './utils';
import { DEFAULT_SECRET } from './utils/constants';
import { env, isProduction } from './utils/env';
// Cookies removed for AI focus
import { createLogger } from './utils/logger';
// Password utils removed for AI focus
import { getBaseURL } from './utils/url';

export const init = async (options: UnblockedOptions) => {
  const adapter = await getAdapter(options);
  const plugins = options.plugins || [];
  const internalPlugins = getInternalPlugins(options);
  const logger = createLogger(options.logger);

  const baseURL = getBaseURL(options.baseURL, options.basePath);

  const secret =
    options.secret || env.UNBLOCKED_SECRET || env.AUTH_SECRET || DEFAULT_SECRET;

  if (secret === DEFAULT_SECRET && isProduction) {
    logger.error(
      'You are using the default secret. Please set `UNBLOCKED_SECRET` in your environment variables or pass `secret` in your Unblocked config.'
    );
  }

  options = {
    ...options,
    secret,
    baseURL: baseURL ? new URL(baseURL).origin : '',
    basePath: options.basePath || '/api/unblocked',
    plugins: plugins.concat(internalPlugins),
  };
  // Cookies removed for AI focus
  const tables = getAITables(options);
  // Social providers removed for AI focus

  const generateIdFunc: UnblockedContext['generateId'] = ({ model, size }) => {
    if (typeof options.advanced?.generateId === 'function') {
      return options.advanced.generateId({ model, size });
    }
    if (typeof options?.advanced?.database?.generateId === 'function') {
      return options.advanced.database.generateId({ model, size });
    }
    return generateId(size);
  };

  const ctx: UnblockedContext = {
    appName: options.appName || 'Unblocked',
    // socialProviders removed for AI focus
    options,
    tables,
    trustedOrigins: getTrustedOrigins(options),
    baseURL: baseURL || '',
    // sessionConfig removed for AI focus
    secret,
    // rateLimit removed for AI focus - handled by AI providers
    // authCookies removed for AI focus
    logger,
    generateId: generateIdFunc,
    secondaryStorage: options.secondaryStorage,
    // Password handling removed for AI focus
    // session management removed for AI focus
    adapter,
    internalAdapter: createInternalAdapter(adapter, {
      options,
      hooks: options.databaseHooks ? [options.databaseHooks] : [],
      generateId: generateIdFunc,
    }),
    // createAuthCookie removed for AI focus
    async runMigrations() {
      //only run migrations if database is provided and it's not an adapter
      if (!options.database || 'updateMany' in options.database) {
        throw new UnblockedError(
          "Database is not provided or it's an adapter. Migrations are only supported with a database instance."
        );
      }
      const { runMigrations } = await getMigrations(options);
      await runMigrations();
    },
    // AI-specific properties
    getUser: async (request: Request) => {
      if (!(options.user && options.user.getUser)) {
        return null;
      }
      const result = await options.user.getUser(request);
      return result;
    },
  };
  const { context } = runPluginInit(ctx);
  return context;
};

export type UnblockedContext = {
  options: UnblockedOptions;
  appName: string;
  baseURL: string;
  trustedOrigins: string[];
  // session management removed for AI focus
  // socialProviders removed for AI focus
  // authCookies removed for AI focus
  logger: ReturnType<typeof createLogger>;
  // rateLimit removed for AI focus - handled by AI providers
  adapter: Adapter;
  internalAdapter: ReturnType<typeof createInternalAdapter>;
  // createAuthCookie removed for AI focus
  secret: string;
  // sessionConfig removed for AI focus
  generateId: (options: {
    model: LiteralUnion<Models, string>;
    size?: number;
  }) => string;
  secondaryStorage: SecondaryStorage | undefined;
  // password utilities removed for AI focus
  tables: ReturnType<typeof getAITables>;
  runMigrations: () => Promise<void>;
  // AI-specific properties
  getUser?: (request: Request) => Promise<User | null>;
  // Allow plugin extensions
  [key: string]: any;
};

function runPluginInit(ctx: UnblockedContext) {
  let options = ctx.options;
  const plugins = options.plugins || [];
  let context: UnblockedContext = ctx;
  const dbHooks: UnblockedOptions['databaseHooks'][] = [];
  for (const plugin of plugins) {
    if (plugin.init) {
      const result = plugin.init(context);
      if (typeof result === 'object') {
        if (result.options) {
          const { databaseHooks, ...restOpts } = result.options;
          if (databaseHooks) {
            dbHooks.push(databaseHooks);
          }
          options = defu(options, restOpts);
        }
        if (result.context) {
          context = {
            ...context,
            ...(result.context as Partial<UnblockedContext>),
          };
        }
      }
    }
  }
  // Add the global database hooks last
  dbHooks.push(options.databaseHooks);
  context.internalAdapter = createInternalAdapter(ctx.adapter, {
    options,
    hooks: dbHooks.filter((u) => u !== undefined),
    generateId: ctx.generateId,
  });
  context.options = options;
  return { context };
}

function getInternalPlugins(options: UnblockedOptions) {
  const plugins: UnblockedPlugin[] = [];
  // crossSubDomainCookies removed for AI focus
  return plugins;
}

function getTrustedOrigins(options: UnblockedOptions) {
  const baseURL = getBaseURL(options.baseURL, options.basePath);
  if (!baseURL) {
    return [];
  }
  const trustedOrigins = [new URL(baseURL).origin];
  if (options.trustedOrigins && Array.isArray(options.trustedOrigins)) {
    trustedOrigins.push(...options.trustedOrigins);
  }
  const envTrustedOrigins = env.UNBLOCKED_TRUSTED_ORIGINS;
  if (envTrustedOrigins) {
    trustedOrigins.push(...envTrustedOrigins.split(','));
  }
  if (trustedOrigins.filter((x) => !x).length) {
    throw new UnblockedError(
      'A provided trusted origin is invalid, make sure your trusted origins list is properly defined.'
    );
  }
  return trustedOrigins;
}
