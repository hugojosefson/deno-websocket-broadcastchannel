import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";
import { defaultWebSocketUrl } from "./default-websocket-url.ts";
import {
  BroadcastChannelIsh,
  GlobalThisWithBroadcastChannel,
} from "./types.ts";
import { IdUrl } from "./id-url.ts";
import { WebSocketClientServer } from "./web-socket-client-server.ts";
import { Logger, logger } from "./log.ts";
import { OneTimeFuse } from "./one-time-fuse.ts";
import { equals } from "./fn.ts";

const log0: Logger = logger(import.meta.url);

/**
 * We want one {@link WebSocketClientServer} per WebSocket url.
 * @private
 */
const clientServers: Map<IdUrl, WebSocketClientServer> = new Map();

/**
 * Owns:
 * - one {@link WebSocketClientServer}, per WebSocket url.
 *
 * Emits:
 * - no events
 *
 * Listens to:
 * - {@link WebSocketClientServer}: "close" → delete it from {@link clientServers}.
 */
export class Manager {
  private static readonly singletonFuse: OneTimeFuse = new OneTimeFuse(
    "Manager already instantiated. You only get one.",
  );
  constructor() {
    Manager.singletonFuse.blow();
  }

  /**
   * Creates a {@link BroadcastChannel} or {@link WebSocketBroadcastChannel}, depending on
   * whether we are running on Deno Deploy or not.
   * @param name The name of the channel.
   * @param url WebSocket url to connect to or listen as, if not on Deno Deploy. Defaults to {@link defaultWebSocketUrl}() if not specified.
   */
  createBroadcastChannel(
    name: string,
    url: string | URL = defaultWebSocketUrl(),
  ): BroadcastChannelIsh {
    if ("BroadcastChannel" in globalThis) {
      const g = globalThis as GlobalThisWithBroadcastChannel;
      // Only use the native BroadcastChannel if it's not the same as our own.
      // Otherwise, fall through to instantiate a WebSocketBroadcastChannel.
      if (!equals({ a: g.BroadcastChannel, b: WebSocketBroadcastChannel })) {
        return new g.BroadcastChannel(name) as BroadcastChannelIsh;
      }
    }

    // Instantiate a WebSocketBroadcastChannel.
    const clientServer: WebSocketClientServer = this.ensureClientServer(
      IdUrl.of(url),
    );
    return clientServer.createBroadcastChannel(name);
  }

  private ensureClientServer(url: IdUrl): WebSocketClientServer {
    const log1: Logger = log0.sub(this.ensureClientServer.name).sub(url.href);

    const existingClientServer: undefined | WebSocketClientServer =
      clientServers.get(url);
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
}
