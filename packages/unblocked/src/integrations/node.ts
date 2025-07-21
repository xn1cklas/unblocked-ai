import { toNodeHandler as toNode } from 'better-call/node';
import type { IncomingHttpHeaders } from 'http';

export const toNodeHandler = (
  ai:
    | {
        handler: (request: Request) => Promise<Response>;
      }
    | ((request: Request) => Promise<Response>)
) => {
  return 'handler' in ai ? toNode(ai.handler) : toNode(ai);
};

export function fromNodeHeaders(nodeHeaders: IncomingHttpHeaders): Headers {
  const webHeaders = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((v) => webHeaders.append(key, v));
      } else {
        webHeaders.set(key, value);
      }
    }
  }
  return webHeaders;
}
