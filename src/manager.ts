import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";
import { defaultWebSocketUrl } from "./default-websocket-url.ts";
import {
  BroadcastChannelIsh,
  GlobalThisWithBroadcastChannel,
} from "./types.ts";
import { isDenoDeploy } from "./fn.ts";
import { IdUrl } from "./id-url.ts";
import { WebSocketClientServer } from "./web-socket-client-server.ts";
import { Logger, logger } from "./log.ts";
import { OneTimeFuse } from "./one-time-fuse.ts";

const log0: Logger = logger(import.meta.url);

export class Manager {
  private static readonly singletonFuse: OneTimeFuse = new OneTimeFuse(
    "Manager already instantiated. You only get one.",
  );
  private readonly clientServers: Map<IdUrl, WebSocketClientServer> = new Map();

  constructor() {
    Manager.singletonFuse.blow();
  }

  /**
   * Creates a {@link BroadcastChannel} or {@link WebSocketBroadcastChannel}, depending on
   * whether we are running on Deno Deploy or not.
   * @param name The name of the channel.
   * @param url WebSocket url to connect to or listen as, if not on Deno Deploy. Defaults to {@link defaultWebSocketUrl}() if not specified.
   */
  async createBroadcastChannel(
    name: string,
    url: string | URL = defaultWebSocketUrl(),
  ): Promise<BroadcastChannelIsh> {
    if (await isDenoDeploy()) {
      const g = globalThis as GlobalThisWithBroadcastChannel;
      return new g.BroadcastChannel(name) as BroadcastChannelIsh;
    }
    const clientServer = this.ensureClientServer(IdUrl.of(url));
    return new WebSocketBroadcastChannel(name, url);
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
