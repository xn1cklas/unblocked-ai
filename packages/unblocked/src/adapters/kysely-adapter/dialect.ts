import {
  type Dialect,
  Kysely,
  MssqlDialect,
  MysqlDialect,
  PostgresDialect,
  SqliteDialect,
} from 'kysely';
import type { UnblockedOptions } from '../../types';
import type { KyselyDatabaseType } from './types';

function getDatabaseType(
  db: UnblockedOptions['database']
): KyselyDatabaseType | null {
  if (!db) {
    return null;
  }

  // AdapterInstance type check
  if (
    typeof db === 'object' &&
    'id' in db &&
    'create' in db &&
    'update' in db
  ) {
    return null; // AdapterInstance doesn't have a database type
  }

  // Check for explicit type configuration
  if (typeof db === 'object' && 'type' in db) {
    return (db as any).type as KyselyDatabaseType;
  }

  // Check for Kysely instance
  if (
    typeof db === 'object' &&
    'dialect' in db &&
    typeof (db as any).dialect === 'object'
  ) {
    return getDatabaseType((db as any).dialect);
  }

  if (typeof db === 'function') {
    return null; // Function that returns Kysely
  }

  // Direct dialect checks
  if (db instanceof SqliteDialect) {
    return 'sqlite';
  }
  if (db instanceof MysqlDialect) {
    return 'mysql';
  }
  if (db instanceof PostgresDialect) {
    return 'postgres';
  }
  if (db instanceof MssqlDialect) {
    return 'mssql';
  }

  // Database instance checks
  if (typeof db === 'object' && 'aggregate' in db) {
    return 'sqlite';
  }
  if (typeof db === 'object' && 'getConnection' in db) {
    return 'mysql';
  }
  if (typeof db === 'object' && 'connect' in db) {
    return 'postgres';
  }
  if (typeof db === 'object' && 'fileControl' in db) {
    return 'sqlite';
  }

  return null;
}

export const createKyselyAdapter = async (config: UnblockedOptions) => {
  const db = config.database;

  if (!db) {
    return {
      kysely: null,
      databaseType: null,
    };
  }

  // Check if it's already an AdapterInstance
  if (
    typeof db === 'object' &&
    'id' in db &&
    'create' in db &&
    'update' in db
  ) {
    // It's an AdapterInstance, we can't create a Kysely instance from it
    return {
      kysely: null,
      databaseType: null,
    };
  }

  // Check for Kysely configuration with db property
  if (typeof db === 'object' && 'db' in db) {
    const dbConfig = db as any;
    return {
      kysely: dbConfig.db,
      databaseType: dbConfig.type || getDatabaseType(dbConfig.db),
    };
  }

  // Check for Kysely configuration with dialect property
  if (typeof db === 'object' && 'dialect' in db) {
    const dbConfig = db as any;
    return {
      kysely: new Kysely<any>({ dialect: dbConfig.dialect }),
      databaseType: dbConfig.type || getDatabaseType(dbConfig.dialect),
    };
  }

  let dialect: Dialect | undefined;
  const databaseType = getDatabaseType(db);

  // Check if it's already a Dialect
  if (
    db instanceof SqliteDialect ||
    db instanceof MysqlDialect ||
    db instanceof PostgresDialect ||
    db instanceof MssqlDialect
  ) {
    dialect = db;
  }

  // Check for database instances
  if (!dialect && typeof db === 'object') {
    if ('aggregate' in db) {
      dialect = new SqliteDialect({
        database: db as any,
      });
    } else if ('getConnection' in db) {
      // MySQL pool
      dialect = new MysqlDialect(db as any);
    } else if ('connect' in db) {
      // PostgreSQL pool
      dialect = new PostgresDialect({
        pool: db as any,
      });
    }
  }

  if ('fileControl' in db) {
    const { BunSqliteDialect } = await import('./bun-sqlite-dialect');
    dialect = new BunSqliteDialect({
      database: db,
    });
  }

  return {
    kysely: dialect ? new Kysely<any>({ dialect }) : null,
    databaseType,
  };
};
