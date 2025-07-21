import { APIError } from 'better-call';
import type { GenericEndpointContext } from '../../types';
import { getHost, getOrigin, getProtocol } from '../../utils/url';
import { wildcardMatch } from '../../utils/wildcard';
import { createUnblockedMiddleware } from '../call';

/**
 * A middleware to validate callbackURL and origin against
 * trustedOrigins.
 */
export const originCheckMiddleware = createUnblockedMiddleware(async (ctx) => {
  if (ctx.request?.method !== 'POST' || !ctx.request) {
    return;
  }
  const { body, query, context } = ctx;
  const originHeader =
    ctx.headers?.get('origin') || ctx.headers?.get('referer') || '';
  // AI-focused middleware - no auth-specific callbacks needed
  const callbackURL = (body as any)?.callbackURL || (query as any)?.callbackURL;
  const trustedOrigins: string[] = Array.isArray(context.options.trustedOrigins)
    ? context.trustedOrigins
    : [
        ...context.trustedOrigins,
        ...((await context.options.trustedOrigins?.(ctx.request)) || []),
      ];
  const usesCookies = ctx.headers?.has('cookie');

  const matchesPattern = (url: string, pattern: string): boolean => {
    if (url.startsWith('/')) {
      return false;
    }
    if (pattern.includes('*')) {
      // For protocol-specific wildcards, match the full origin
      if (pattern.includes('://')) {
        return wildcardMatch(pattern)(getOrigin(url) || url);
      }
      // For host-only wildcards, match just the host
      return wildcardMatch(pattern)(getHost(url));
    }

    const protocol = getProtocol(url);
    return protocol === 'http:' || protocol === 'https:' || !protocol
      ? pattern === getOrigin(url)
      : url.startsWith(pattern);
  };
  const validateURL = (url: string | undefined, label: string) => {
    if (!url) {
      return;
    }
    const isTrustedOrigin = trustedOrigins.some(
      (origin) =>
        matchesPattern(url, origin) ||
        (url?.startsWith('/') &&
          label !== 'origin' &&
          /^\/(?!\/|\\|%2f|%5c)[\w\-.+/@]*(?:\?[\w\-.+/=&%@]*)?$/.test(url))
    );
    if (!isTrustedOrigin) {
      ctx.context.logger.error(`Invalid ${label}: ${url}`);
      ctx.context.logger.info(
        `If it's a valid URL, please add ${url} to trustedOrigins in your auth config\n`,
        `Current list of trustedOrigins: ${trustedOrigins}`
      );
      throw new APIError('FORBIDDEN', { message: `Invalid ${label}` });
    }
  };
  // AI-focused validation - check origin for CSRF protection
  if (usesCookies) {
    validateURL(originHeader, 'origin');
  }
  // Validate callback URL if provided
  callbackURL && validateURL(callbackURL, 'callbackURL');
});

export const originCheck = (
  getValue: (ctx: GenericEndpointContext) => string | string[]
) =>
  createUnblockedMiddleware(async (ctx) => {
    if (!ctx.request) {
      return;
    }
    const { context } = ctx;
    const callbackURL = getValue(ctx);
    const trustedOrigins: string[] = Array.isArray(
      context.options.trustedOrigins
    )
      ? context.trustedOrigins
      : [
          ...context.trustedOrigins,
          ...((await context.options.trustedOrigins?.(ctx.request)) || []),
        ];

    const matchesPattern = (url: string, pattern: string): boolean => {
      if (url.startsWith('/')) {
        return false;
      }
      if (pattern.includes('*')) {
        // For protocol-specific wildcards, match the full origin
        if (pattern.includes('://')) {
          return wildcardMatch(pattern)(getOrigin(url) || url);
        }
        // For host-only wildcards, match just the host
        return wildcardMatch(pattern)(getHost(url));
      }
      const protocol = getProtocol(url);
      return protocol === 'http:' || protocol === 'https:' || !protocol
        ? pattern === getOrigin(url)
        : url.startsWith(pattern);
    };

    const validateURL = (url: string | undefined, label: string) => {
      if (!url) {
        return;
      }
      const isTrustedOrigin = trustedOrigins.some(
        (origin) =>
          matchesPattern(url, origin) ||
          (url?.startsWith('/') &&
            label !== 'origin' &&
            /^\/(?!\/|\\|%2f|%5c)[\w\-.+/@]*(?:\?[\w\-.+/=&%@]*)?$/.test(url))
      );
      if (!isTrustedOrigin) {
        ctx.context.logger.error(`Invalid ${label}: ${url}`);
        ctx.context.logger.info(
          `If it's a valid URL, please add ${url} to trustedOrigins in your auth config\n`,
          `Current list of trustedOrigins: ${trustedOrigins}`
        );
        throw new APIError('FORBIDDEN', { message: `Invalid ${label}` });
      }
    };
    const callbacks = Array.isArray(callbackURL) ? callbackURL : [callbackURL];
    for (const url of callbacks) {
      validateURL(url, 'callbackURL');
    }
  });
