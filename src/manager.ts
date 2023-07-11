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

export class Manager {
  private static readonly singletonFuse: OneTimeFuse = new OneTimeFuse(
    "Manager already instantiated. You only get one.",
  );
  constructor() {
    Manager.singletonFuse.blow();
  }

  /**
   * We want one {@link WebSocketClientServer} per WebSocket url.
   * @private
   */
  private readonly clientServers: Map<IdUrl, WebSocketClientServer> = new Map();

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
    const broadcastChannel = new WebSocketBroadcastChannel(clientServer, name);
    clientServer.registerChannel(broadcastChannel);
    broadcastChannel.addEventListener("close", () => {
      clientServer.unregisterChannel(broadcastChannel);
      if (clientServer.channelSets.size) {
        clientServer.close();
        this.clientServers.delete(clientServer.url);
      }
    });
    return broadcastChannel;
  }

  private ensureClientServer(url: IdUrl): WebSocketClientServer {
    const log1: Logger = log0.sub(this.ensureClientServer.name).sub(url.href);

    const existingClientServer: undefined | WebSocketClientServer = this
      .clientServers.get(url);
    log1("!!existingClientServer:", !!existingClientServer);

    if (existingClientServer) {
      return existingClientServer;
    }

    log1(
      "existingClientServer === undefined; creating new WebSocketClientServer...",
    );
    const clientServer = new WebSocketClientServer(url);
    this.clientServers.set(url, clientServer);
    return clientServer;
  }
}
