import { orSignalController } from "./fn.ts";

/** Will be called when a newly connected WebSocket emits the "open" event. */
export type ServeWebSocketHandler = (
  socket: WebSocket,
  request: Request,
  info: Deno.ServeHandlerInfo,
) => void | Promise<void>;

/**
 * A predicate that determines whether a request should be handled by a
 * {@link ServeWebSocketHandler}.
 * @param request The request to check.
 * @returns Whether the request should be handled by a {@link ServeWebSocketHandler}.
 */
export type WebSocketRequestPredicate = (
  request: Request,
) => boolean | Promise<boolean>;

/**
 * Additional options for {@link serveWebSocket}.
 */
export interface WebSocketSpecificOptions {
  /** A predicate that determines whether a request should be handled by a {@link ServeWebSocketHandler}. */
  predicate?: WebSocketRequestPredicate;
  /** A handler for requests that are not handled by a {@link ServeWebSocketHandler}. */
  handler?: Deno.ServeHandler;
}

/**
 * A default handler for requests that are not handled by a {@link ServeWebSocketHandler}.
 * @returns A response that indicates that the client should have upgraded to a WebSocket.
 */
export function expectOnlyWebSocketUpgrade(): Response {
  return new Response("Expected upgrade to WebSocket, but client didn't.", {
    status: 400,
  });
}

/** Default options for {@link serveWebSocket}. */
export const defaultOptions: Partial<
  ServeWebSocketOptions | ServeWebSocketTlsOptions
> = {
  predicate: anyWebSocketUpgradeRequest,
  handler: expectOnlyWebSocketUpgrade,
  onListen: ({ hostname, port }) => {
    console.error(`Listening on ${hostname}:${port}.`);
  },
};

/**
 * Options for {@link serveWebSocket}.
 * @see {@link Deno.serve}
 * @see {@link WebSocketSpecificOptions}
 */
export type ServeWebSocketOptions =
  & WebSocketSpecificOptions
  & Deno.ServeOptions;

/**
 * Options with TLS for {@link serveWebSocket}.
 * @see {@link Deno.serve}
 * @see {@link WebSocketSpecificOptions}
 */
export type ServeWebSocketTlsOptions =
  & WebSocketSpecificOptions
  & Deno.ServeTlsOptions;

/**
 * Returns whether the given request is a WebSocket upgrade request.
 * Does not care about the method or URL of the request.
 * @param request The request to check.
 */
export function anyWebSocketUpgradeRequest(request: Request): boolean {
  return (
    (
      request.headers.get("Upgrade") ??
        request.headers.get("upgrade")
    )
      ?.toLowerCase() === "websocket"
  );
}

/**
 * Like {@link Deno.serve}, but with a {@link ServeWebSocketHandler} that will
 * be called for any WebSocket that reaches the "open" state.
 * @param options Options for serving.
 * @param webSocketHandler A handler for WebSocket requests.
 * @returns A server.
 * @see {@link Deno.serve}
 */
export function serveWebSocket(
  options: ServeWebSocketOptions | ServeWebSocketTlsOptions,
  webSocketHandler: ServeWebSocketHandler,
): Deno.Server {
  /** Calculate effective options, based on user-supplied and default. */
  const effectiveOptions:
    & Required<WebSocketSpecificOptions>
    & (ServeWebSocketOptions | ServeWebSocketTlsOptions) = {
      ...defaultOptions,
      ...options,
    } as
      & Required<WebSocketSpecificOptions>
      & (ServeWebSocketOptions | ServeWebSocketTlsOptions);

  /** Forward any abort signal from the user-supplied options, and give us power to abort also. */
  const abortController = orSignalController(effectiveOptions.signal);
  effectiveOptions.signal = abortController.signal;

  /** Wrap the user-supplied handler with a predicate that determines whether to handle the request as a WebSocket. */
  const handlerWrappedWithPredicate: Deno.ServeHandler = async (
    request: Request,
    info: Deno.ServeHandlerInfo,
  ): Promise<Response> => {
    if (await effectiveOptions.predicate(request)) {
      const upgrade: Deno.WebSocketUpgrade = Deno.upgradeWebSocket(request);
      upgrade.socket.addEventListener("open", () => {
        void webSocketHandler(upgrade.socket, request, info);
      });
      return upgrade.response;
    } else {
      return effectiveOptions.handler(request, info);
    }
  };

  /** Start the server. */
  return Deno.serve(effectiveOptions, handlerWrappedWithPredicate);
}
