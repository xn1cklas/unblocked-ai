import type { EndpointContext, InputContext } from 'better-call';
import type { UnblockedContext } from '../init';

export type HookEndpointContext = EndpointContext<string, any> &
  Omit<InputContext<string, any>, 'method'> & {
    context: UnblockedContext & {
      returned?: unknown;
      responseHeaders?: Headers;
    };
    headers?: Headers;
  };

export type GenericEndpointContext = EndpointContext<string, any> & {
  context: UnblockedContext;
};

export type ChatContext = GenericEndpointContext & {
  chatId?: string;
  userId: string;
  includeMessages?: boolean;
};

export type MessageContext = GenericEndpointContext & {
  chatId: string;
  userId: string;
  messageId?: string;
};

export type AIProviderContext = GenericEndpointContext & {
  provider: string;
  model: string;
  apiKey?: string;
};
