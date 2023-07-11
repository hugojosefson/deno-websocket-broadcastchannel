import { s } from "./fn.ts";
import { Logger, logger } from "./log.ts";
import { WebSocketClientServer } from "./web-socket-client-server.ts";
import { LocalMultiplexMessage } from "./multiplex-message.ts";
import { BroadcastChannelIsh } from "./types.ts";
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
  readonly uuid: string = crypto.randomUUID();
  onmessage: ((ev: Event) => void) | null = null;
  onmessageerror: ((ev: Event) => void) | null = null;
  private readonly log: Logger = log0.sub(WebSocketBroadcastChannel.name);
  private readonly clientServer: WebSocketClientServer;
  private closeFuse = new OneTimeFuse("channel is already closed");
  get name(): string {
    return this.idUrlChannel.channel;
  }
  get url(): string {
    return this.idUrlChannel.url.href;
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
    this.idUrlChannel = IdUrlChannel.of(clientServer.url, name);
    this.addEventListener("message", (e: Event) => this.onmessage?.(e));
    this.addEventListener(
      "messageerror",
      (e: Event) => this.onmessageerror?.(e),
    );

    this.clientServer = clientServer;
  }

  postMessage(message: string): void {
    const log1 = this.log.sub(
      this.clientServer.constructor.prototype.postMessage.name,
    );
    log1(`message: ${s(message)}`);
    if (this.closeFuse.isBlown) {
      log1("channel is closed; not posting message.");
      return;
    }

    const localMultiplexMessage = new LocalMultiplexMessage(this, message);
    log1(
      `this.clientServer(${
        s(this.url)
      }).${this.clientServer.constructor.prototype.postMessage.name}(${
        s(localMultiplexMessage)
      })`,
    );
    this.clientServer.postMessage(localMultiplexMessage);
  }
  [Symbol.dispose](): void {
    const log1 = this.log.sub(
      this.constructor.prototype[Symbol.dispose].name,
    );
    log1("disposing channel, via close()...");
    this.close();
  }
  close(): void {
    const log1 = this.log.sub(this.constructor.prototype.close.name);
    if (this.closeFuse.isBlown) {
      log1("channel already closed.");
      return;
    }
    log1("closing channel...");
    this.closeFuse.blow();
    log1("dispatching close event...");
    this.dispatchEvent(new CloseEvent("close"));
  }
}
