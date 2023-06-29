import { IdUrl } from "./id-url.ts";

/**
 * Returns the websocket URL to use. Clients will connect to
 * this URL, and the server will listen on the port specified by this
 * URL.
 * @param port The port to use. Defaults to 51799.
 */
export function defaultWebSocketUrl(port = 51799): IdUrl {
  return IdUrl.of(`ws://localhost:${port}`);
}
