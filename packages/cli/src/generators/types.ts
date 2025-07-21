import type { Adapter, UnblockedOptions } from 'unblocked';

export type SchemaGenerator = (opts: {
  file?: string;
  adapter: Adapter;
  options: UnblockedOptions;
}) => Promise<{
  code?: string;
  fileName: string;
  overwrite?: boolean;
  append?: boolean;
}>;
