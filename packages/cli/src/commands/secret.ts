import chalk from 'chalk';
import { Command } from 'commander';
import Crypto from 'crypto';
import { logger } from 'unblocked';

export const generateSecret = new Command('secret').action(() => {
  const secret = generateSecretHash();
  logger.info(`\nAdd the following to your .env file: 
${chalk.gray('# App Secret') + chalk.green(`\nUNBLOCKED_SECRET=${secret}`)}`);
});

export const generateSecretHash = () => {
  return Crypto.randomBytes(32).toString('hex');
};
