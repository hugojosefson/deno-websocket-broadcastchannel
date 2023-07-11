import { IdUrl } from "./id-url.ts";
import { WebSocketClientServer } from "./web-socket-client-server.ts";
import { Logger, logger } from "./log.ts";

const log0: Logger = logger(import.meta.url);

/**
 * @module client-servers.ts
 * Owns:
 * - one {@link WebSocketClientServer}, per WebSocket url.
 *
 * Emits:
 * - no events
 *
 * Listens to:
 * - {@link WebSocketClientServer}: "close" → delete it from {@link clientServers}.
 */

/**
 * We want one {@link WebSocketClientServer} per WebSocket url.
 * @private
 */
export const clientServers: Map<IdUrl, WebSocketClientServer> = new Map();

export function ensureClientServer(url: IdUrl): WebSocketClientServer {
  const log1: Logger = log0.sub(ensureClientServer.name).sub(url.href);

  const existingClientServer: undefined | WebSocketClientServer = clientServers
    .get(url);
  log1("!!existingClientServer:", !!existingClientServer);

  if (existingClientServer) {
    return existingClientServer;
  }

  log1(
    "existingClientServer === undefined; creating new WebSocketClientServer...",
  );
  const clientServer = new WebSocketClientServer(url);
  clientServers.set(url, clientServer);
  clientServer.addEventListener("close", () => {
    const log2: Logger = log1.sub("close");
    log2("clientServer closed; deleting from clientServers...");
    clientServers.delete(url);
  }, { once: true });
  return clientServer;
}
