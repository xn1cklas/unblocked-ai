import { UnblockedError } from '../error';
import { env } from '../utils/env';

function checkHasPath(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname !== '/';
  } catch (error) {
    throw new UnblockedError(
      `Invalid base URL: ${url}. Please provide a valid base URL.`
    );
  }
}

function withPath(url: string, path = '/api/unblocked') {
  const hasPath = checkHasPath(url);
  if (hasPath) {
    return url;
  }
  path = path.startsWith('/') ? path : `/${path}`;
  return `${url.replace(/\/+$/, '')}${path}`;
}

export function getBaseURL(url?: string, path?: string, request?: Request) {
  if (url) {
    return withPath(url, path);
  }

  const fromEnv =
    env.UNBLOCKED_URL ||
    env.NEXT_PUBLIC_UNBLOCKED_URL ||
    env.PUBLIC_UNBLOCKED_URL ||
    env.NUXT_PUBLIC_UNBLOCKED_URL ||
    env.NUXT_PUBLIC_AI_URL ||
    (env.BASE_URL !== '/' ? env.BASE_URL : undefined);

  if (fromEnv) {
    return withPath(fromEnv, path);
  }

  const fromRequest = request?.headers.get('x-forwarded-host');
  const fromRequestProto = request?.headers.get('x-forwarded-proto');
  if (fromRequest && fromRequestProto) {
    return withPath(`${fromRequestProto}://${fromRequest}`, path);
  }

  if (request) {
    const url = getOrigin(request.url);
    if (!url) {
      throw new UnblockedError(
        'Could not get origin from request. Please provide a valid base URL.'
      );
    }
    return withPath(url, path);
  }

  if (typeof window !== 'undefined' && window.location) {
    return withPath(window.location.origin, path);
  }
  return;
}

export function getOrigin(url: string) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.origin;
  } catch (error) {
    return null;
  }
}

export function getProtocol(url: string) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol;
  } catch (error) {
    return null;
  }
}

export function getHost(url: string) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.host;
  } catch (error) {
    return url;
  }
}
