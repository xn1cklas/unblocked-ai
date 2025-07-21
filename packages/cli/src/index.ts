#!/usr/bin/env node

import { Command } from 'commander';
import { generate } from './commands/generate';
import { migrate } from './commands/migrate';
import 'dotenv/config';
import { init } from './commands/init';
import { providers } from './commands/providers';
import { generateSecret } from './commands/secret';
import { getPackageInfo } from './utils/get-package-info';

// handle exit
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

async function main() {
  const program = new Command('unblocked');
  let packageInfo: Record<string, any> = {};
  try {
    packageInfo = await getPackageInfo();
  } catch (error) {
    // it doesn't matter if we can't read the package.json file, we'll just use an empty object
  }
  program
    .addCommand(migrate)
    .addCommand(generate)
    .addCommand(generateSecret)
    .addCommand(providers)
    .addCommand(init)
    .version(packageInfo.version || '1.0.0')
    .description('Unblocked AI CLI');
  program.parse();
}

main();
