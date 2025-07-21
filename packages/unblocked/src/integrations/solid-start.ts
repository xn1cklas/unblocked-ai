export function toSolidStartHandler(
  ai:
    | {
        handler: (request: Request) => Promise<Response>;
      }
    | ((request: Request) => Promise<Response>)
) {
  const handler = async (event: { request: Request }) => {
    return 'handler' in ai ? ai.handler(event.request) : ai(event.request);
  };
  return {
    GET: handler,
    POST: handler,
  };
}
