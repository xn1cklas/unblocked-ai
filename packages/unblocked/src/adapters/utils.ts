import type { FieldAttribute } from '../db';

export function withApplyDefault(
  value: any,
  field: FieldAttribute,
  action: 'create' | 'update'
) {
  if (action === 'update') {
    return value;
  }
  if (
    (value === undefined || value === null) &&
    field.defaultValue !== undefined
  ) {
    if (typeof field.defaultValue === 'function') {
      return field.defaultValue();
    }
    return field.defaultValue;
  }
  return value;
}
