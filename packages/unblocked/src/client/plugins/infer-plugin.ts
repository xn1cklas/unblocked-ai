import type { UnblockedClientPlugin, UnblockedOptions } from '../../types';

export const InferServerPlugin = <
  AuthOrOption extends
    | UnblockedOptions
    | {
        options: UnblockedOptions;
      },
  ID extends string,
>() => {
  type Option = AuthOrOption extends { options: infer O } ? O : AuthOrOption;
  type Plugin = Option['plugins'] extends Array<infer P>
    ? P extends {
        id: ID;
      }
      ? P
      : never
    : never;
  return {
    id: 'infer-server-plugin',
    $InferServerPlugin: {} as Plugin,
  } satisfies UnblockedClientPlugin;
};
