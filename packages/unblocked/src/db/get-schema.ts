import type { UnblockedOptions } from '../types';
import { type FieldAttribute, getAITables } from '.';

export function getSchema(config: UnblockedOptions) {
  const tables = getAITables(config);
  const schema: Record<
    string,
    {
      fields: Record<string, FieldAttribute>;
      order: number;
    }
  > = {};
  for (const key in tables) {
    const table = tables[key];
    const fields = table.fields;
    const actualFields: Record<string, FieldAttribute> = {};
    Object.entries(fields).forEach(([key, field]) => {
      actualFields[field.fieldName || key] = field;
      if (field.references) {
        const refTable = tables[field.references.model];
        if (refTable) {
          actualFields[field.fieldName || key].references = {
            model: refTable.modelName,
            field: field.references.field,
          };
        }
      }
    });
    if (schema[table.modelName]) {
      schema[table.modelName].fields = {
        ...schema[table.modelName].fields,
        ...actualFields,
      };
      continue;
    }
    schema[table.modelName] = {
      fields: actualFields,
      order: table.order || Number.POSITIVE_INFINITY,
    };
  }
  return schema;
}
