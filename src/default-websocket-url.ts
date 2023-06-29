import { IdUrl } from "./id-url.ts";

/**
 * The default websocket URL to use if none is provided. Clients will connect to
 * this URL by default, and the server will listen on the port specified by this
 * URL by default.
 */
export const DEFAULT_WEBSOCKET_URL = IdUrl.of("ws://localhost:51799");
