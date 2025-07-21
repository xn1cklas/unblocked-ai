export function toNextJsHandler(
  ai:
    | {
        handler: (request: Request) => Promise<Response>;
      }
    | ((request: Request) => Promise<Response>)
) {
  const handler = async (request: Request) => {
    return 'handler' in ai ? ai.handler(request) : ai(request);
  };
  return {
    GET: handler,
    POST: handler,
  };
}
