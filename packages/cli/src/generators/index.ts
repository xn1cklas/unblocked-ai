import { type Adapter, logger, type UnblockedOptions } from 'unblocked';
import { generateDrizzleSchema } from './drizzle';
import { generateMigrations } from './kysely';
import { generatePrismaSchema } from './prisma';

export const adapters = {
  prisma: generatePrismaSchema,
  drizzle: generateDrizzleSchema,
  kysely: generateMigrations,
};

export const generateSchema = (opts: {
  adapter: Adapter;
  file?: string;
  options: UnblockedOptions;
}) => {
  const adapter = opts.adapter;
  const generator =
    adapter.id in adapters
      ? adapters[adapter.id as keyof typeof adapters]
      : null;
  if (generator) {
    // generator from the built-in list above
    return generator(opts);
  }
  if (adapter.createSchema) {
    // use the custom adapter's createSchema method
    return adapter
      .createSchema(opts.options, opts.file)
      .then(({ code, path: fileName, overwrite, append }) => ({
        code,
        fileName,
        overwrite,
        append,
      }));
  }

  logger.error(
    `${adapter.id} is not supported. If it is a custom adapter, please request the maintainer to implement createSchema`
  );
  process.exit(1);
};

/**
 * @deprecated getGenerator is a misnomer as this function gets a generator AND uses it to generate
 * and return the schema. Use generateSchema instead
 */
export const getGenerator = generateSchema;
