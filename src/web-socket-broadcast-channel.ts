import { s } from "./fn.ts";
import { Logger, logger } from "./log.ts";
import { WebSocketClientServer } from "./web-socket-client-server.ts";
import {
  extractAnyMultiplexMessage,
  LocalMultiplexMessage,
  MultiplexMessage,
} from "./multiplex-message.ts";
import { BroadcastChannelIsh } from "./types.ts";
import { defaultWebSocketUrl } from "./default-websocket-url.ts";
import { IdUrl } from "./id-url.ts";
import { Disposable, Symbol } from "./using.ts";
import { OneTimeFuse } from "./one-time-fuse.ts";
import { IdUrlChannel } from "./id-url-channel.ts";

const log0: Logger = logger(import.meta.url);

/**
 * Use this the same way you would use {@link BroadcastChannel} on Deno Deploy,
 * it has the same API, but on a host that is not Deno Deploy.
 *
 * Instead of connecting all instances of the same app together like on Deno
 * Deploy, this implementation uses a {@link WebSocket} to communicate with
 * other instances of this class in the same or other processes, on the same
 * host.
 *
 * Will try to act as a WebSocket server, if no other instance of this class is
 * running on the same host yet. Otherwise, will act as a WebSocket client and
 * connect to the server. Will reconnect and switch roles as needed, if the
 * instance that happens to be the server goes down.
 *
 * When no instances of this class are running in this process (none created
 * yet, or all closed), it stays disconnected. When at least one instance is
 * created, it will keep doing its best to stay connected.
 *
 * @see {@link https://deno.com/deploy/docs/runtime-broadcast-channel}
 */
export class WebSocketBroadcastChannel extends EventTarget
  implements BroadcastChannelIsh, Disposable {
  onmessage: ((ev: Event) => void) | null = null;
  onmessageerror: ((ev: Event) => void) | null = null;
  private readonly log: Logger = log0.sub(WebSocketBroadcastChannel.name);
  private closeFuse = new OneTimeFuse("channel is already closed");
  get name(): string {
    return this.idUrlChannel.channel;
  }
  get url(): string {
    return this.idUrlChannel.url;
  }
  private readonly idUrlChannel: IdUrlChannel;

  /**
   * Creates a {@link WebSocketBroadcastChannel}.
   * @param clientServer The {@link WebSocketClientServer} to use for communicating with other instances.
   * @param name The name of the channel.
   */
  constructor(clientServer: WebSocketClientServer, name: string) {
    super();
    this.log.sub("constructor")(`name: ${s(name)}`);
    this.idUrlChannel = IdUrlChannel.of(url, name);
    this.addEventListener("message", (e: Event) => this.onmessage?.(e));
    this.addEventListener(
      "messageerror",
      (e: Event) => this.onmessageerror?.(e),
    );

    ensureClientServer(this.url).registerChannel(this);
  }
  postMessage(message: string): void {
    const log1 = this.log.sub(
      WebSocketBroadcastChannel.prototype.postMessage.name,
    );
    log1(`message: ${s(message)}`);
    if (this.closeFuse.isBlown()) {
      log1("channel is closed; not posting message.");
      return;
    }

    const localMultiplexMessage = new LocalMultiplexMessage(this, message);
    log1(
      `${ensureClientServer.name}(${
        s(this.url)
      }).${WebSocketClientServer.prototype.postMessage.name}(${
        s(localMultiplexMessage)
      })`,
    );
    ensureClientServer(this.url).postMessage(localMultiplexMessage);
  }
  [Symbol.dispose](): void {
    const log1 = this.log.sub(
      WebSocketBroadcastChannel.prototype[Symbol.dispose].name,
    );
    log1("disposing channel, via close()...");
    this.close();
  }
  close(): void {
    const log1 = this.log.sub(WebSocketBroadcastChannel.prototype.close.name);
    log1("closing channel...");
    this.closeFuse.blow();
    log1("dispatching close event...");
    this.dispatchEvent(new CloseEvent("close"));
  }
}

const clientServers: Map<IdUrl, WebSocketClientServer> = new Map();

function possiblyUnregisterClientServer(clientServer: WebSocketClientServer) {
  const log = log0.sub(possiblyUnregisterClientServer.name);
  log("clientServer:", !!clientServer);
  if (clientServer !== undefined) {
    log("clientServer !== undefined; checking if it should be unregistered...");
    log("clientServer.channelSets.size:", clientServer.channelSets.size);
    if (clientServer.channelSets.size === 0) {
      log("channelSets.size === 0; closing clientServer...");
      clientServer.close();
      log("setting clientServer = undefined");
      clientServers.delete(clientServer.url);
    } else {
      log("channelSets.size !== 0; not closing clientServer.");
    }
  }
}
