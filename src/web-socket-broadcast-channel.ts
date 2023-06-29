import { s } from "./fn.ts";
import { Logger, logger } from "./log.ts";
import { WebSocketClientServer } from "./web-socket-client-server.ts";
import {
  extractAnyMultiplexMessage,
  MultiplexMessage,
} from "./multiplex-message.ts";
import { BroadcastChannelIsh } from "./types.ts";
import { DEFAULT_WEBSOCKET_URL } from "./default-websocket-url.ts";
import { IdUrl } from "./id-url.ts";

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
  implements BroadcastChannelIsh {
  onmessage: ((ev: Event) => void) | null = null;
  onmessageerror: ((ev: Event) => void) | null = null;
  private readonly log: Logger = log0.sub(WebSocketBroadcastChannel.name);
  private closed = false;
  public readonly name: string;
  readonly url: IdUrl;
  constructor(name: string, url: IdUrl | URL | string = DEFAULT_WEBSOCKET_URL) {
    super();
    this.log.sub("constructor")(`name: ${s(name)}`);
    this.name = name;
    this.url = IdUrl.of(url);
    this.addEventListener("message", (e: Event) => this.onmessage?.(e));
    this.addEventListener(
      "messageerror",
      (e: Event) => this.onmessageerror?.(e),
    );

    ensureClientServer(this.url).registerChannel(this);
  }
  postMessage(message: string): void {
    const log1 = this.log.sub("postMessage");
    log1(`message: ${s(message)}`);
    if (this.closed) {
      log1("channel is closed; not posting message.");
      return;
    }
    const message1: MultiplexMessage = { channel: this.name, message };
    const message2: string = JSON.stringify(message1);
    log1(`getClientServer().postMessage(${s(message2)})`);
    ensureClientServer(this.url).postMessage(message2);
  }
  close(): void {
    const log1 = this.log.sub("close");
    log1("closing channel...");
    this.closed = true;
    log1("dispatching close event...");
    this.dispatchEvent(new CloseEvent("close"));
  }
}

const clientServers: Map<IdUrl, WebSocketClientServer> = new Map();

function ensureClientServer(url: IdUrl): WebSocketClientServer {
  const log1: Logger = log0.sub(ensureClientServer.name);
  const existingClientServer: undefined | WebSocketClientServer = clientServers
    .get(url);
  log1("existingClientServer:", existingClientServer);
  if (existingClientServer === undefined) {
    log1(
      "existingClientServer === undefined; creating new WebSocketClientServer...",
    );
    const clientServer = new WebSocketClientServer(url);
    clientServers.set(url, clientServer);

    clientServer.addEventListener("channel:unregistered", () => {
      possiblyUnregisterClientServer(clientServer);
    });

    clientServer.addEventListener("close", () => {
      const log = log1.sub("clientServer.addEventListener('close', ...)");
      log("clientServer closed; dispatching close events to channels...");

      for (const channelSet of clientServer.channelSets.values()) {
        for (const channel of channelSet) {
          log("dispatching close event to channel:", channel.name);
          channel.dispatchEvent(new CloseEvent("close"));
        }
      }

      log("setting clientServer = undefined");
      clientServers.delete(url);
    });

    clientServer.addEventListener("error", (e: Event) => {
      const log = log1.sub("clientServer.addEventListener('error', ...)");
      log("clientServer error:", e);

      log("dispatching error events to channels...");
      for (const channelSet of clientServer.channelSets.values()) {
        for (const channel of channelSet) {
          log("dispatching error event to channel:", channel.name);
          channel.dispatchEvent(new ErrorEvent("error", e));
        }
      }
    });

    clientServer.addEventListener("message", (e: Event) => {
      const log = log1.sub("clientServer.addEventListener('message', ...)");
      if (!(e instanceof MessageEvent)) {
        log(
          "Unexpected non-MessageEvent from clientServer:",
          e,
        );
        return;
      }
      const multiplexMessage: MultiplexMessage = extractAnyMultiplexMessage(e);
      log("clientServer message is a MultiplexMessage:", multiplexMessage);
      const channels: Set<WebSocketBroadcastChannel> = clientServer
        .getChannelSetOrDisconnectedEmptySet(multiplexMessage.channel);
      for (const channel of channels) {
        log("dispatching message to channel:", channel.name);
        channel.dispatchEvent(
          new MessageEvent("message", { data: multiplexMessage.message }),
        );
      }
    });
  }
  return clientServers.get(url)!;
}

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
