import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
  outro,
  select,
  spinner,
  text,
} from '@clack/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import { parse } from 'dotenv';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { format as prettierFormat } from 'prettier';
import semver from 'semver';
import { z } from 'zod';
import { generateAIConfig } from '../generators/ai-config';
import { checkPackageManagers } from '../utils/check-package-managers';
import { formatMilliseconds } from '../utils/format-ms';
import { getPackageInfo } from '../utils/get-package-info';
import { getTsconfigInfo } from '../utils/get-tsconfig-info';
import { installDependencies } from '../utils/install-dependencies';
import { generateSecretHash } from './secret';

/**
 * Should only use any database that is core DBs, and supports the Unblocked AI CLI generate functionality.
 */
const supportedDatabases = [
  // Built-in kysely
  'sqlite',
  'mysql',
  'mssql',
  'postgres',
  // Drizzle
  'drizzle:pg',
  'drizzle:mysql',
  'drizzle:sqlite',
  // Prisma
  'prisma:postgresql',
  'prisma:mysql',
  'prisma:sqlite',
  // Mongo
  'mongodb',
] as const;

export type SupportedDatabases = (typeof supportedDatabases)[number];

export const supportedPlugins = [
  {
    id: 'quota',
    name: 'quota',
    path: 'unblocked/plugins',
    clientName: 'quotaClient',
    clientPath: 'unblocked/client/plugins',
  },
  {
    id: 'rag',
    name: 'rag',
    clientName: 'ragClient',
    path: 'unblocked/plugins',
    clientPath: 'unblocked/client/plugins',
  },
  {
    id: 'analytics',
    name: 'analytics',
    clientName: 'analyticsClient',
    path: 'unblocked/plugins',
    clientPath: 'unblocked/client/plugins',
  },
  {
    id: 'rate-limiting',
    name: 'rateLimiting',
    clientName: 'rateLimitingClient',
    path: 'unblocked/plugins',
    clientPath: 'unblocked/client/plugins',
  },
  {
    id: 'documents',
    name: 'documents',
    clientName: 'documentsClient',
    path: 'unblocked/plugins',
    clientPath: 'unblocked/client/plugins',
  },
] as const;

export type SupportedPlugin = (typeof supportedPlugins)[number];

const defaultFormatOptions = {
  trailingComma: 'all' as const,
  useTabs: false,
  tabWidth: 4,
};

const getDefaultAIConfig = async ({ appName }: { appName?: string }) =>
  await prettierFormat(
    [
      "import { unblocked } from 'unblocked';",
      '',
      'export const ai = unblocked({',
      appName ? `appName: "${appName}",` : '',
      'plugins: [],',
      'user: {',
      '  getUser: async (request: Request) => {',
      '    // Your authentication logic here',
      '    // return await getCurrentUser(request);',
      '    return null;',
      '  }',
      '},',
      '});',
    ].join('\n'),
    {
      filepath: 'ai.ts',
      ...defaultFormatOptions,
    }
  );

type SupportedFrameworks =
  | 'vanilla'
  | 'react'
  | 'vue'
  | 'svelte'
  | 'solid'
  | 'nextjs';

type Import = {
  path: string;
  variables:
    | { asType?: boolean; name: string; as?: string }[]
    | { asType?: boolean; name: string; as?: string };
};

const getDefaultAIClientConfig = async ({
  ai_config_path,
  framework,
  clientPlugins,
}: {
  framework: SupportedFrameworks;
  ai_config_path: string;
  clientPlugins: {
    id: string;
    name: string;
    contents: string;
    imports: Import[];
  }[];
}) => {
  function groupImportVariables(): Import[] {
    const result: Import[] = [
      {
        path: 'unblocked/client/plugins',
        variables: [{ name: 'inferAdditionalFields' }],
      },
    ];
    for (const plugin of clientPlugins) {
      for (const import_ of plugin.imports) {
        if (Array.isArray(import_.variables)) {
          for (const variable of import_.variables) {
            const existingIndex = result.findIndex(
              (x) => x.path === import_.path
            );
            if (existingIndex !== -1) {
              const vars = result[existingIndex]!.variables;
              if (Array.isArray(vars)) {
                vars.push(variable);
              } else {
                result[existingIndex]!.variables = [vars, variable];
              }
            } else {
              result.push({
                path: import_.path,
                variables: [variable],
              });
            }
          }
        } else {
          const existingIndex = result.findIndex(
            (x) => x.path === import_.path
          );
          if (existingIndex !== -1) {
            const vars = result[existingIndex]!.variables;
            if (Array.isArray(vars)) {
              vars.push(import_.variables);
            } else {
              result[existingIndex]!.variables = [vars, import_.variables];
            }
          } else {
            result.push({
              path: import_.path,
              variables: [import_.variables],
            });
          }
        }
      }
    }
    return result;
  }
  const imports = groupImportVariables();
  let importString = '';
  for (const import_ of imports) {
    if (Array.isArray(import_.variables)) {
      importString += `import { ${import_.variables
        .map(
          (x) =>
            `${x.asType ? 'type ' : ''}${x.name}${x.as ? ` as ${x.as}` : ''}`
        )
        .join(', ')} } from "${import_.path}";\n`;
    } else {
      importString += `import ${import_.variables.asType ? 'type ' : ''}${
        import_.variables.name
      }${import_.variables.as ? ` as ${import_.variables.as}` : ''} from "${
        import_.path
      }";\n`;
    }
  }

  return await prettierFormat(
    [
      `import { createAIClient } from "unblocked/${
        framework === 'nextjs'
          ? 'react'
          : framework === 'vanilla'
            ? 'client'
            : framework
      }";`,
      `import type { ai } from "${ai_config_path}";`,
      importString,
      '',
      'export const aiClient = createAIClient({',
      `baseURL: "http://localhost:3000",`,
      `plugins: [inferAdditionalFields<typeof ai>(),${clientPlugins
        .map((x) => `${x.name}(${x.contents})`)
        .join(', ')}],`,
      '});',
    ].join('\n'),
    {
      filepath: 'ai-client.ts',
      ...defaultFormatOptions,
    }
  );
};

const optionsSchema = z.object({
  cwd: z.string(),
  config: z.string().optional(),
  database: z.enum(supportedDatabases).optional(),
  'skip-db': z.boolean().optional(),
  'skip-plugins': z.boolean().optional(),
  'package-manager': z.string().optional(),
  tsconfig: z.string().optional(),
});

const outroText = '🥳 All Done, Happy Hacking!';

export async function initAction(opts: any) {
  console.log();
  intro('👋 Initializing Unblocked AI');

  const options = optionsSchema.parse(opts);

  const cwd = path.resolve(options.cwd);
  let packageManagerPreference: 'bun' | 'pnpm' | 'yarn' | 'npm' | undefined;

  let config_path = '';
  let framework: SupportedFrameworks = 'vanilla';

  const format = async (code: string) =>
    await prettierFormat(code, {
      filepath: config_path,
      ...defaultFormatOptions,
    });

  // ===== package.json =====
  let packageInfo: Record<string, any>;
  try {
    packageInfo = getPackageInfo(cwd);
  } catch (error) {
    log.error(`❌ Couldn't read your package.json file. (dir: ${cwd})`);
    log.error(JSON.stringify(error, null, 2));
    process.exit(1);
  }

  // ===== ENV files =====
  const envFiles = await getEnvFiles(cwd);
  if (!envFiles.length) {
    outro('❌ No .env files found. Please create an env file first.');
    process.exit(0);
  }
  let targetEnvFile: string;
  if (envFiles.includes('.env')) targetEnvFile = '.env';
  else if (envFiles.includes('.env.local')) targetEnvFile = '.env.local';
  else if (envFiles.includes('.env.development'))
    targetEnvFile = '.env.development';
  else if (envFiles.length === 1) targetEnvFile = envFiles[0]!;
  else targetEnvFile = 'none';

  // ===== tsconfig.json =====
  let tsconfigInfo: Record<string, any>;
  try {
    const tsconfigPath =
      options.tsconfig !== undefined
        ? path.resolve(cwd, options.tsconfig)
        : path.join(cwd, 'tsconfig.json');

    tsconfigInfo = await getTsconfigInfo(cwd, tsconfigPath);
  } catch (error) {
    log.error(`❌ Couldn't read your tsconfig.json file. (dir: ${cwd})`);
    console.error(error);
    process.exit(1);
  }
  if (
    !(
      'compilerOptions' in tsconfigInfo &&
      'strict' in tsconfigInfo.compilerOptions &&
      tsconfigInfo.compilerOptions.strict === true
    )
  ) {
    log.warn(
      `Unblocked requires your tsconfig.json to have "compilerOptions.strict" set to true.`
    );
    const shouldAdd = await confirm({
      message: `Would you like us to set ${chalk.bold(
        'strict'
      )} to ${chalk.bold('true')}?`,
    });
    if (isCancel(shouldAdd)) {
      cancel('✋ Operation cancelled.');
      process.exit(0);
    }
    if (shouldAdd) {
      try {
        await fs.writeFile(
          path.join(cwd, 'tsconfig.json'),
          await prettierFormat(
            JSON.stringify(
              Object.assign(tsconfigInfo, {
                compilerOptions: {
                  strict: true,
                },
              })
            ),
            { filepath: 'tsconfig.json', ...defaultFormatOptions }
          ),
          'utf-8'
        );
        log.success('🚀 tsconfig.json successfully updated!');
      } catch (error) {
        log.error(
          `Failed to add "compilerOptions.strict" to your tsconfig.json file.`
        );
        console.error(error);
        process.exit(1);
      }
    }
  }

  // ===== install unblocked =====
  const s = spinner({ indicator: 'dots' });
  s.start('Checking unblocked installation');

  let latest_unblocked_version: string;
  try {
    latest_unblocked_version = await getLatestNpmVersion('unblocked');
  } catch (error) {
    log.error(`❌ Couldn't get latest version of unblocked.`);
    console.error(error);
    process.exit(1);
  }

  if (
    !(
      packageInfo.dependencies &&
      Object.keys(packageInfo.dependencies).includes('unblocked')
    )
  ) {
    s.stop('Finished fetching latest version of unblocked.');
    const s2 = spinner({ indicator: 'dots' });
    const shouldInstallUnblockedDep = await confirm({
      message: 'Would you like to install Unblocked AI?',
    });
    if (isCancel(shouldInstallUnblockedDep)) {
      cancel('✋ Operation cancelled.');
      process.exit(0);
    }
    if (packageManagerPreference === undefined) {
      packageManagerPreference = await getPackageManager();
    }
    if (shouldInstallUnblockedDep) {
      s2.start(
        `Installing Unblocked AI using ${chalk.bold(packageManagerPreference)}`
      );
      try {
        const start = Date.now();
        await installDependencies({
          dependencies: ['unblocked@latest'],
          packageManager: packageManagerPreference,
          cwd,
        });
        s2.stop(
          `Unblocked AI installed ${chalk.greenBright(
            'successfully'
          )}! ${chalk.gray(`(${formatMilliseconds(Date.now() - start)})`)}`
        );
      } catch (error: any) {
        s2.stop('Failed to install Unblocked AI:');
        console.error(error);
        process.exit(1);
      }
    }
  } else if (
    packageInfo.dependencies['unblocked'] !== 'workspace:*' &&
    semver.lt(
      semver.coerce(packageInfo.dependencies['unblocked'])?.toString()!,
      semver.clean(latest_unblocked_version)!
    )
  ) {
    s.stop('Finished fetching latest version of unblocked.');
    const shouldInstallUnblockedDep = await confirm({
      message: `Your current Unblocked AI dependency is out-of-date. Would you like to update it? (${chalk.bold(
        packageInfo.dependencies['unblocked']
      )} → ${chalk.bold(`v${latest_unblocked_version}`)})`,
    });
    if (isCancel(shouldInstallUnblockedDep)) {
      cancel('✋ Operation cancelled.');
      process.exit(0);
    }
    if (shouldInstallUnblockedDep) {
      if (packageManagerPreference === undefined) {
        packageManagerPreference = await getPackageManager();
      }
      const s = spinner({ indicator: 'dots' });
      s.start(
        `Updating Unblocked AI using ${chalk.bold(packageManagerPreference)}`
      );
      try {
        const start = Date.now();
        await installDependencies({
          dependencies: ['unblocked@latest'],
          packageManager: packageManagerPreference,
          cwd,
        });
        s.stop(
          `Unblocked AI updated ${chalk.greenBright(
            'successfully'
          )}! ${chalk.gray(`(${formatMilliseconds(Date.now() - start)})`)}`
        );
      } catch (error: any) {
        s.stop('Failed to update Unblocked AI:');
        log.error(error.message);
        process.exit(1);
      }
    }
  } else {
    s.stop(`Unblocked AI dependencies are ${chalk.greenBright('up to date')}!`);
  }

  // ===== appName =====

  const packageJson = getPackageInfo(cwd);
  let appName: string;
  if (packageJson.name) {
    appName = packageJson.name;
  } else {
    const newAppName = await text({
      message: 'What is the name of your application?',
    });
    if (isCancel(newAppName)) {
      cancel('✋ Operation cancelled.');
      process.exit(0);
    }
    appName = newAppName;
  }

  // ===== config path =====

  let possiblePaths = ['ai.ts', 'ai.tsx', 'ai.js', 'ai.jsx'];
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

  if (options.config) {
    config_path = path.join(cwd, options.config);
  } else {
    for (const possiblePath of possiblePaths) {
      const doesExist = existsSync(path.join(cwd, possiblePath));
      if (doesExist) {
        config_path = path.join(cwd, possiblePath);
        break;
      }
    }
  }

  // ===== create auth config =====
  let current_user_config = '';
  let database: SupportedDatabases | null = null;
  let add_plugins: SupportedPlugin[] = [];

  if (config_path) {
    log.message();
    log.success(`Found AI config file. ${chalk.gray(`(${config_path})`)}`);
    log.message();
  } else {
    const shouldCreateAIConfig = await select({
      message: 'Would you like to create an AI config file?',
      options: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ],
    });
    if (isCancel(shouldCreateAIConfig)) {
      cancel('✋ Operation cancelled.');
      process.exit(0);
    }
    if (shouldCreateAIConfig === 'yes') {
      const shouldSetupDb = await confirm({
        message: `Would you like to set up your ${chalk.bold('database')}?`,
        initialValue: true,
      });
      if (isCancel(shouldSetupDb)) {
        cancel('✋ Operating cancelled.');
        process.exit(0);
      }
      if (shouldSetupDb) {
        const prompted_database = await select({
          message: 'Choose a Database Dialect',
          options: supportedDatabases.map((it) => ({ value: it, label: it })),
        });
        if (isCancel(prompted_database)) {
          cancel('✋ Operating cancelled.');
          process.exit(0);
        }
        database = prompted_database;
      }

      if (options['skip-plugins'] !== false) {
        const shouldSetupPlugins = await confirm({
          message: `Would you like to set up ${chalk.bold('plugins')}?`,
        });
        if (isCancel(shouldSetupPlugins)) {
          cancel('✋ Operating cancelled.');
          process.exit(0);
        }
        if (shouldSetupPlugins) {
          const prompted_plugins = await multiselect({
            message: 'Select your new plugins',
            options: supportedPlugins
              .filter((x) => x.id !== 'next-cookies')
              .map((x) => ({ value: x.id, label: x.id })),
            required: false,
          });
          if (isCancel(prompted_plugins)) {
            cancel('✋ Operating cancelled.');
            process.exit(0);
          }
          add_plugins = prompted_plugins.map(
            (x) => supportedPlugins.find((y) => y.id === x)!
          );

          const possible_next_config_paths = [
            'next.config.js',
            'next.config.ts',
            'next.config.mjs',
            '.next/server/next.config.js',
            '.next/server/next.config.ts',
            '.next/server/next.config.mjs',
          ];
          for (const possible_next_config_path of possible_next_config_paths) {
            if (existsSync(path.join(cwd, possible_next_config_path))) {
              framework = 'nextjs';
              break;
            }
          }
          if (framework === 'nextjs') {
            const result = await confirm({
              message: `It looks like you're using NextJS. Do you want to add the next-cookies plugin? ${chalk.bold(
                '(Recommended)'
              )}`,
            });
            if (isCancel(result)) {
              cancel('✋ Operating cancelled.');
              process.exit(0);
            }
            if (result) {
              add_plugins.push(
                supportedPlugins.find((x) => x.id === 'next-cookies')!
              );
            }
          }
        }
      }

      const filePath = path.join(cwd, 'ai.ts');
      config_path = filePath;
      log.info(`Creating AI config file: ${filePath}`);
      try {
        current_user_config = await getDefaultAIConfig({
          appName,
        });
        const { dependencies, envs, generatedCode } = await generateAIConfig({
          current_user_config,
          format,
          //@ts-expect-error
          s,
          plugins: add_plugins,
          database,
        });
        current_user_config = generatedCode;
        await fs.writeFile(filePath, current_user_config);
        config_path = filePath;
        log.success('🚀 AI config file successfully created!');

        if (envs.length !== 0) {
          log.info(
            `There are ${envs.length} environment variables for your database of choice.`
          );
          const shouldUpdateEnvs = await confirm({
            message: 'Would you like us to update your ENV files?',
          });
          if (isCancel(shouldUpdateEnvs)) {
            cancel('✋ Operation cancelled.');
            process.exit(0);
          }
          if (shouldUpdateEnvs) {
            const filesToUpdate = await multiselect({
              message: 'Select the .env files you want to update',
              options: envFiles.map((x) => ({
                value: path.join(cwd, x),
                label: x,
              })),
              required: false,
            });
            if (isCancel(filesToUpdate)) {
              cancel('✋ Operation cancelled.');
              process.exit(0);
            }
            if (filesToUpdate.length === 0) {
              log.info('No .env files to update. Skipping...');
            } else {
              try {
                await updateEnvs({
                  files: filesToUpdate,
                  envs,
                  isCommented: true,
                });
              } catch (error) {
                log.error('Failed to update .env files:');
                log.error(JSON.stringify(error, null, 2));
                process.exit(1);
              }
              log.success('🚀 ENV files successfully updated!');
            }
          }
        }
        if (dependencies.length !== 0) {
          log.info(
            `There are ${
              dependencies.length
            } dependencies to install. (${dependencies
              .map((x) => chalk.green(x))
              .join(', ')})`
          );
          const shouldInstallDeps = await confirm({
            message: 'Would you like us to install dependencies?',
          });
          if (isCancel(shouldInstallDeps)) {
            cancel('✋ Operation cancelled.');
            process.exit(0);
          }
          if (shouldInstallDeps) {
            const s = spinner({ indicator: 'dots' });
            if (packageManagerPreference === undefined) {
              packageManagerPreference = await getPackageManager();
            }
            s.start(
              `Installing dependencies using ${chalk.bold(
                packageManagerPreference
              )}...`
            );
            try {
              const start = Date.now();
              await installDependencies({
                dependencies,
                packageManager: packageManagerPreference,
                cwd,
              });
              s.stop(
                `Dependencies installed ${chalk.greenBright(
                  'successfully'
                )} ${chalk.gray(`(${formatMilliseconds(Date.now() - start)})`)}`
              );
            } catch (error: any) {
              s.stop(
                `Failed to install dependencies using ${packageManagerPreference}:`
              );
              log.error(error.message);
              process.exit(1);
            }
          }
        }
      } catch (error) {
        log.error(`Failed to create auth config file: ${filePath}`);
        console.error(error);
        process.exit(1);
      }
    } else if (shouldCreateAIConfig === 'no') {
      log.info('Skipping AI config file creation.');
    }
  }

  // ===== AI client path =====

  let possibleClientPaths = [
    'ai-client.ts',
    'ai-client.tsx',
    'ai-client.js',
    'ai-client.jsx',
    'client.ts',
    'client.tsx',
    'client.js',
    'client.jsx',
  ];
  possibleClientPaths = [
    ...possibleClientPaths,
    ...possibleClientPaths.map((it) => `lib/server/${it}`),
    ...possibleClientPaths.map((it) => `server/${it}`),
    ...possibleClientPaths.map((it) => `lib/${it}`),
    ...possibleClientPaths.map((it) => `utils/${it}`),
  ];
  possibleClientPaths = [
    ...possibleClientPaths,
    ...possibleClientPaths.map((it) => `src/${it}`),
    ...possibleClientPaths.map((it) => `app/${it}`),
  ];

  let aiClientConfigPath: string | null = null;
  for (const possiblePath of possibleClientPaths) {
    const doesExist = existsSync(path.join(cwd, possiblePath));
    if (doesExist) {
      aiClientConfigPath = path.join(cwd, possiblePath);
      break;
    }
  }

  if (aiClientConfigPath) {
    log.success(
      `Found AI client config file. ${chalk.gray(`(${aiClientConfigPath})`)}`
    );
  } else {
    const choice = await select({
      message: 'Would you like to create an AI client config file?',
      options: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ],
    });
    if (isCancel(choice)) {
      cancel('✋ Operation cancelled.');
      process.exit(0);
    }
    if (choice === 'yes') {
      aiClientConfigPath = path.join(cwd, 'ai-client.ts');
      log.info(`Creating AI client config file: ${aiClientConfigPath}`);
      try {
        const contents = await getDefaultAIClientConfig({
          ai_config_path: (
            './' + path.join(config_path.replace(cwd, ''))
          ).replace('.//', './'),
          clientPlugins: add_plugins
            .filter((x) => x.clientName)
            .map((plugin) => {
              const contents = '';
              return {
                contents,
                id: plugin.id,
                name: plugin.clientName!,
                imports: [
                  {
                    path: 'unblocked/client/plugins',
                    variables: [{ name: plugin.clientName! }],
                  },
                ],
              };
            }),
          framework,
        });
        await fs.writeFile(aiClientConfigPath, contents);
        log.success('🚀 AI client config file successfully created!');
      } catch (error) {
        log.error(
          `Failed to create AI client config file: ${aiClientConfigPath}`
        );
        log.error(JSON.stringify(error, null, 2));
        process.exit(1);
      }
    } else if (choice === 'no') {
      log.info('Skipping AI client config file creation.');
    }
  }

  if (targetEnvFile !== 'none') {
    try {
      const fileContents = await fs.readFile(
        path.join(cwd, targetEnvFile),
        'utf8'
      );
      const parsed = parse(fileContents);
      let isMissingSecret = false;
      let isMissingUrl = false;
      if (parsed.UNBLOCKED_SECRET === undefined) isMissingSecret = true;
      if (parsed.UNBLOCKED_URL === undefined) isMissingUrl = true;
      if (isMissingSecret || isMissingUrl) {
        let txt = '';
        if (isMissingSecret && !isMissingUrl)
          txt = chalk.bold('UNBLOCKED_SECRET');
        else if (!isMissingSecret && isMissingUrl)
          txt = chalk.bold('UNBLOCKED_URL');
        else
          txt =
            chalk.bold.underline('UNBLOCKED_SECRET') +
            ' and ' +
            chalk.bold.underline('UNBLOCKED_URL');
        log.warn(`Missing ${txt} in ${targetEnvFile}`);

        const shouldAdd = await select({
          message: `Do you want to add ${txt} to ${targetEnvFile}?`,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
            { label: 'Choose other file(s)', value: 'other' },
          ],
        });
        if (isCancel(shouldAdd)) {
          cancel('✋ Operation cancelled.');
          process.exit(0);
        }
        const envs: string[] = [];
        if (isMissingSecret) {
          envs.push('UNBLOCKED_SECRET');
        }
        if (isMissingUrl) {
          envs.push('UNBLOCKED_URL');
        }
        if (shouldAdd === 'yes') {
          try {
            await updateEnvs({
              files: [path.join(cwd, targetEnvFile)],
              envs,
              isCommented: false,
            });
          } catch (error) {
            log.error(`Failed to add ENV variables to ${targetEnvFile}`);
            log.error(JSON.stringify(error, null, 2));
            process.exit(1);
          }
          log.success('🚀 ENV variables successfully added!');
          if (isMissingUrl) {
            log.info(
              `Be sure to update your UNBLOCKED_URL according to your app's needs.`
            );
          }
        } else if (shouldAdd === 'no') {
          log.info('Skipping ENV step.');
        } else if (shouldAdd === 'other') {
          if (!envFiles.length) {
            cancel('No env files found. Please create an env file first.');
            process.exit(0);
          }
          const envFilesToUpdate = await multiselect({
            message: 'Select the .env files you want to update',
            options: envFiles.map((x) => ({
              value: path.join(cwd, x),
              label: x,
            })),
            required: false,
          });
          if (isCancel(envFilesToUpdate)) {
            cancel('✋ Operation cancelled.');
            process.exit(0);
          }
          if (envFilesToUpdate.length === 0) {
            log.info('No .env files to update. Skipping...');
          } else {
            try {
              await updateEnvs({
                files: envFilesToUpdate,
                envs,
                isCommented: false,
              });
            } catch (error) {
              log.error('Failed to update .env files:');
              log.error(JSON.stringify(error, null, 2));
              process.exit(1);
            }
            log.success('🚀 ENV files successfully updated!');
          }
        }
      }
    } catch (error) {
      // if fails, ignore, and do not proceed with ENV operations.
    }
  }

  outro(outroText);
  console.log();
  process.exit(0);
}

// ===== Init Command =====

export const init = new Command('init')
  .option('-c, --cwd <cwd>', 'The working directory.', process.cwd())
  .option(
    '--config <config>',
    'The path to the auth configuration file. defaults to the first `auth.ts` file found.'
  )
  .option('--tsconfig <tsconfig>', 'The path to the tsconfig file.')
  .option('--skip-db', 'Skip the database setup.')
  .option('--skip-plugins', 'Skip the plugins setup.')
  .option(
    '--package-manager <package-manager>',
    'The package manager you want to use.'
  )
  .action(initAction);

async function getLatestNpmVersion(packageName: string): Promise<string> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);

    if (!response.ok) {
      throw new Error(`Package not found: ${response.statusText}`);
    }

    const data = await response.json();
    return data['dist-tags'].latest; // Get the latest version from dist-tags
  } catch (error: any) {
    throw error?.message;
  }
}

async function getPackageManager() {
  const { hasBun, hasPnpm } = await checkPackageManagers();
  if (!(hasBun || hasPnpm)) return 'npm';

  const packageManagerOptions: {
    value: 'bun' | 'pnpm' | 'yarn' | 'npm';
    label?: string;
    hint?: string;
  }[] = [];

  if (hasPnpm) {
    packageManagerOptions.push({
      value: 'pnpm',
      label: 'pnpm',
      hint: 'recommended',
    });
  }
  if (hasBun) {
    packageManagerOptions.push({
      value: 'bun',
      label: 'bun',
    });
  }
  packageManagerOptions.push({
    value: 'npm',
    hint: 'not recommended',
  });

  const packageManager = await select({
    message: 'Choose a package manager',
    options: packageManagerOptions,
  });
  if (isCancel(packageManager)) {
    cancel('Operation cancelled.');
    process.exit(0);
  }
  return packageManager;
}

async function getEnvFiles(cwd: string) {
  const files = await fs.readdir(cwd);
  return files.filter((x) => x.startsWith('.env'));
}

async function updateEnvs({
  envs,
  files,
  isCommented,
}: {
  /**
   * The ENVs to append to the file
   */
  envs: string[];
  /**
   * Full file paths
   */
  files: string[];
  /**
   * Whether to comment the all of the envs or not
   */
  isCommented: boolean;
}) {
  let previouslyGeneratedSecret: string | null = null;
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const lines = content.split('\n');
    const newLines = envs.map(
      (x) =>
        `${isCommented ? '# ' : ''}${x}=${
          getEnvDescription(x) ?? `"some_value"`
        }`
    );
    newLines.push('');
    newLines.push(...lines);
    await fs.writeFile(file, newLines.join('\n'), 'utf8');
  }

  function getEnvDescription(env: string) {
    if (env === 'DATABASE_HOST') {
      return `"The host of your database"`;
    }
    if (env === 'DATABASE_PORT') {
      return `"The port of your database"`;
    }
    if (env === 'DATABASE_USER') {
      return `"The username of your database"`;
    }
    if (env === 'DATABASE_PASSWORD') {
      return `"The password of your database"`;
    }
    if (env === 'DATABASE_NAME') {
      return `"The name of your database"`;
    }
    if (env === 'DATABASE_URL') {
      return `"The URL of your database"`;
    }
    if (env === 'UNBLOCKED_SECRET') {
      previouslyGeneratedSecret =
        previouslyGeneratedSecret ?? generateSecretHash();
      return `"${previouslyGeneratedSecret}"`;
    }
    if (env === 'UNBLOCKED_URL') {
      return `"http://localhost:3000" # Your APP URL`;
    }
  }
}
