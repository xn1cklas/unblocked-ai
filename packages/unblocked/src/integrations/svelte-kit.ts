import type { UnblockedOptions, UnblockedPlugin } from '../types';

let isBuilding: boolean | undefined;

export const toSvelteKitHandler = (ai: {
  handler: (request: Request) => any;
  options: UnblockedOptions;
}) => {
  return (event: { request: Request }) => ai.handler(event.request);
};

export const svelteKitHandler = async ({
  ai,
  event,
  resolve,
}: {
  ai: {
    handler: (request: Request) => any;
    options: UnblockedOptions;
  };
  event: { request: Request; url: URL };
  resolve: (event: any) => any;
}) => {
  // Only check building state once and cache it
  if (isBuilding === undefined) {
    //@ts-expect-error
    const { building } = await import('$app/environment')
      .catch((e) => {})
      .then((m) => m || {});

    isBuilding = building;
  }

  if (isBuilding) {
    return resolve(event);
  }
  const { request, url } = event;
  if (isUnblockedPath(url.toString(), ai.options)) {
    return ai.handler(request);
  }
  return resolve(event);
};

export function isUnblockedPath(url: string, options: UnblockedOptions) {
  const _url = new URL(url);
  const baseURL = new URL(
    `${options.baseURL || _url.origin}${options.basePath || '/api/unblocked'}`
  );
  if (_url.origin !== baseURL.origin) return false;
  if (
    !_url.pathname.startsWith(
      baseURL.pathname.endsWith('/') ? baseURL.pathname : `${baseURL.pathname}/`
    )
  )
    return false;
  return true;
}
