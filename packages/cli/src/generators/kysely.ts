import { getMigrations } from 'unblocked/db';
import type { SchemaGenerator } from './types';

export const generateMigrations: SchemaGenerator = async ({
  options,
  file,
}) => {
  const { compileMigrations } = await getMigrations(options);
  const migrations = await compileMigrations();
  return {
    code: migrations.trim() === ';' ? '' : migrations,
    fileName:
      file ||
      `./unblocked_migrations/${new Date()
        .toISOString()
        .replace(/:/g, '-')}.sql`,
  };
};
