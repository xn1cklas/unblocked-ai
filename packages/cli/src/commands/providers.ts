import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
  outro,
  select,
  text,
} from '@clack/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from 'unblocked';
import { generateSecretHash } from './secret';

type AIProvider = {
  id: string;
  name: string;
  envKey: string;
  description: string;
  website: string;
};

const supportedProviders: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    description: 'GPT-4, GPT-3.5, and other OpenAI models',
    website: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    description: 'Claude models',
    website: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'google',
    name: 'Google AI',
    envKey: 'GOOGLE_AI_API_KEY',
    description: 'Gemini models',
    website: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    envKey: 'MISTRAL_API_KEY',
    description: 'Mistral models',
    website: 'https://console.mistral.ai/api-keys/',
  },
];

export async function providersAction() {
  console.log();
  intro('🤖 Setup AI Providers');

  const selectedProviders = await multiselect({
    message: 'Select AI providers you want to configure:',
    options: supportedProviders.map((provider) => ({
      value: provider.id,
      label: `${provider.name} - ${provider.description}`,
    })),
    required: false,
  });

  if (isCancel(selectedProviders)) {
    cancel('✋ Operation cancelled.');
    process.exit(0);
  }

  if (selectedProviders.length === 0) {
    log.info('No providers selected. You can configure them later.');
    outro('🥳 All Done!');
    process.exit(0);
  }

  log.info('\n📋 Here are your environment variables:\n');

  for (const providerId of selectedProviders) {
    const provider = supportedProviders.find((p) => p.id === providerId)!;
    logger.info(
      `${chalk.cyan(provider.name)}:\n${chalk.gray(
        `# Get your API key from: ${provider.website}`
      )}\n${chalk.green(`${provider.envKey}=your_api_key_here`)}\n`
    );
  }

  const needsSecret = await confirm({
    message: 'Do you also need an UNBLOCKED_SECRET for your application?',
    initialValue: true,
  });

  if (isCancel(needsSecret)) {
    cancel('✋ Operation cancelled.');
    process.exit(0);
  }

  if (needsSecret) {
    const secret = generateSecretHash();
    logger.info(`${chalk.cyan('Application Secret')}:
${chalk.gray('# Random secret for your application')}
${chalk.green(`UNBLOCKED_SECRET=${secret}`)}\n`);
  }

  log.success('🚀 Environment variables generated!');
  log.info(
    chalk.gray(
      '💡 Copy these to your .env file and replace the placeholder values with your actual API keys.'
    )
  );

  outro('🥳 All Done!');
}

export const providers = new Command('providers')
  .description('Setup AI provider API keys')
  .action(providersAction);
