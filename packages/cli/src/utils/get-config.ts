// @ts-expect-error
import babelPresetReact from '@babel/preset-react';
// @ts-expect-error
import babelPresetTypeScript from '@babel/preset-typescript';
import { loadConfig } from 'c12';
import fs, { existsSync } from 'fs';
import path from 'path';
import type { UnblockedOptions } from 'unblocked';
import { logger, UnblockedError } from 'unblocked';
import { addSvelteKitEnvModules } from './add-svelte-kit-env-modules';
import { getTsconfigInfo } from './get-tsconfig-info';

let possiblePaths = [
  'ai.ts',
  'ai.tsx',
  'ai.js',
  'ai.jsx',
  'ai.server.js',
  'ai.server.ts',
  'unblocked.ts',
  'unblocked.tsx',
  'unblocked.js',
  'unblocked.jsx',
  'unblocked.server.js',
  'unblocked.server.ts',
];

possiblePaths = [
  ...possiblePaths,
  ...possiblePaths.map((it) => `lib/server/${it}`),
  ...possiblePaths.map((it) => `server/${it}`),
  ...possiblePaths.map((it) => `lib/${it}`),
  ...possiblePaths.map((it) => `utils/${it}`),
];
possiblePaths = [
  ...possiblePaths,
  ...possiblePaths.map((it) => `src/${it}`),
  ...possiblePaths.map((it) => `app/${it}`),
];

function getPathAliases(cwd: string): Record<string, string> | null {
  const tsConfigPath = path.join(cwd, 'tsconfig.json');
  if (!fs.existsSync(tsConfigPath)) {
    return null;
  }
  try {
    const tsConfig = getTsconfigInfo(cwd);
    const { paths = {}, baseUrl = '.' } = tsConfig.compilerOptions || {};
    const result: Record<string, string> = {};
    const obj = Object.entries(paths) as [string, string[]][];
    for (const [alias, aliasPaths] of obj) {
      for (const aliasedPath of aliasPaths) {
        const resolvedBaseUrl = path.join(cwd, baseUrl);
        const finalAlias = alias.slice(-1) === '*' ? alias.slice(0, -1) : alias;
        const finalAliasedPath =
          aliasedPath.slice(-1) === '*'
            ? aliasedPath.slice(0, -1)
            : aliasedPath;

        result[finalAlias || ''] = path.join(resolvedBaseUrl, finalAliasedPath);
      }
    }
    addSvelteKitEnvModules(result);
    return result;
  } catch (error) {
    console.error(error);
    throw new UnblockedError('Error parsing tsconfig.json');
  }
}
/**
 * .tsx files are not supported by Jiti.
 */
const jitiOptions = (cwd: string) => {
  const alias = getPathAliases(cwd) || {};
  return {
    transformOptions: {
      babel: {
        presets: [
          [
            babelPresetTypeScript,
            {
              isTSX: true,
              allExtensions: true,
            },
          ],
          [babelPresetReact, { runtime: 'automatic' }],
        ],
      },
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias,
  };
};
export async function getConfig({
  cwd,
  configPath,
  shouldThrowOnError = false,
}: {
  cwd: string;
  configPath?: string;
  shouldThrowOnError?: boolean;
}) {
  try {
    let configFile: UnblockedOptions | null = null;
    if (configPath) {
      let resolvedPath: string = path.join(cwd, configPath);
      if (existsSync(configPath)) resolvedPath = configPath; // If the configPath is a file, use it as is, as it means the path wasn't relative.
      const { config } = await loadConfig<{
        ai: {
          options: UnblockedOptions;
        };
        default?: {
          options: UnblockedOptions;
        };
      }>({
        configFile: resolvedPath,
        dotenv: true,
        jitiOptions: jitiOptions(cwd),
      });
      if (!(config.ai || config.default)) {
        if (shouldThrowOnError) {
          throw new Error(
            `Couldn't read your AI config in ${resolvedPath}. Make sure to default export your AI instance or to export as a variable named ai.`
          );
        }
        logger.error(
          `[#unblocked]: Couldn't read your AI config in ${resolvedPath}. Make sure to default export your AI instance or to export as a variable named ai.`
        );
        process.exit(1);
      }
      configFile = config.ai?.options || config.default?.options || null;
    }

    if (!configFile) {
      for (const possiblePath of possiblePaths) {
        try {
          const { config } = await loadConfig<{
            ai: {
              options: UnblockedOptions;
            };
            default?: {
              options: UnblockedOptions;
            };
          }>({
            configFile: possiblePath,
            jitiOptions: jitiOptions(cwd),
          });
          const hasConfig = Object.keys(config).length > 0;
          if (hasConfig) {
            configFile = config.ai?.options || config.default?.options || null;
            if (!configFile) {
              if (shouldThrowOnError) {
                throw new Error(
                  "Couldn't read your AI config. Make sure to default export your AI instance or to export as a variable named ai."
                );
              }
              logger.error("[#unblocked]: Couldn't read your AI config.");
              console.log('');
              logger.info(
                '[#unblocked]: Make sure to default export your AI instance or to export as a variable named ai.'
              );
              process.exit(1);
            }
            break;
          }
        } catch (e) {
          if (
            typeof e === 'object' &&
            e &&
            'message' in e &&
            typeof e.message === 'string' &&
            e.message.includes(
              'This module cannot be imported from a Client Component module'
            )
          ) {
            if (shouldThrowOnError) {
              throw new Error(
                `Please remove import 'server-only' from your AI config file temporarily. The CLI cannot resolve the configuration with it included. You can re-add it after running the CLI.`
              );
            }
            logger.error(
              `Please remove import 'server-only' from your AI config file temporarily. The CLI cannot resolve the configuration with it included. You can re-add it after running the CLI.`
            );
            process.exit(1);
          }
          if (shouldThrowOnError) {
            throw e;
          }
          logger.error("[#unblocked]: Couldn't read your AI config.", e);
          process.exit(1);
        }
      }
    }
    return configFile;
  } catch (e) {
    if (
      typeof e === 'object' &&
      e &&
      'message' in e &&
      typeof e.message === 'string' &&
      e.message.includes(
        'This module cannot be imported from a Client Component module'
      )
    ) {
      if (shouldThrowOnError) {
        throw new Error(
          `Please remove import 'server-only' from your auth config file temporarily. The CLI cannot resolve the configuration with it included. You can re-add it after running the CLI.`
        );
      }
      logger.error(
        `Please remove import 'server-only' from your auth config file temporarily. The CLI cannot resolve the configuration with it included. You can re-add it after running the CLI.`
      );
      process.exit(1);
    }
    if (shouldThrowOnError) {
      throw e;
    }

    logger.error("Couldn't read your AI config.", e);
    process.exit(1);
  }
}

export { possiblePaths };
