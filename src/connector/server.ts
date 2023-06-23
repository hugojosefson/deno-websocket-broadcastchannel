import { Logger, logger } from "../log.ts";
import {
  BaseConnectorWithUrl,
  DEFAULT_WEBSOCKET_URL,
  MultiplexMessage,
} from "./mod.ts";
import {
  asMultiplexMessageEvent,
  extractAnyMultiplexMessage,
  getPortNumber,
  isNot,
} from "../fn.ts";

const log0: Logger = logger(import.meta.url);

export class Server extends BaseConnectorWithUrl {
  private readonly sockets: Set<WebSocket> = new Set();
  constructor(
    websocketUrl: URL = DEFAULT_WEBSOCKET_URL,
  ) {
    super(websocketUrl);
    void this.run();
  }

  async run(): Promise<void> {
    const log: Logger = log0.sub(Server.name);
    const { websocketUrl } = this;
    log(`Becoming the server at ${websocketUrl}...`);

    let listener: Deno.Listener | undefined = undefined;
    const listenerCloser = () => listener?.close();
    this.addEventListener("close", listenerCloser);
    try {
      listener = Deno.listen({
        port: getPortNumber(this.websocketUrl),
        hostname: this.websocketUrl.hostname,
      });
      log(`Became the server at ${websocketUrl}.`);
      for await (const conn of listener) {
        void this.handleHttp(conn);
      }
    } catch (e) {
      if (e.code === "EADDRINUSE") {
        log(
          "Can't server, because address in use. Try being something else instead...",
        );
        this.close();
      } else {
        log("Unexpected error:", e);
        this.close();
        throw e;
      }
    } finally {
      log(`No longer the server at ${websocketUrl}.`);
    }
  }

  private async handleHttp(conn: Deno.Conn): Promise<void> {
    const log1: Logger = log0.sub(this.handleHttp.name);
    const connCloser = () => conn.close();
    this.addEventListener("close", connCloser);
    try {
      for await (const requestEvent of Deno.serveHttp(conn)) {
        if (requestEvent) {
          const { request }: Deno.RequestEvent = requestEvent;
          const { socket, response }: Deno.WebSocketUpgrade = Deno
            .upgradeWebSocket(request);
          const socketCloser = () => socket.close();
          const log: Logger = log1.sub("webSocket");

          const outgoing: EventListener = (e: Event) => {
            if (!(e instanceof MessageEvent)) {
              return;
            }
            log.sub(outgoing.name)(e.data);
            socket.send(e.data);
          };

          const onSocketOpen = () => {
            log.sub(onSocketOpen.name)("socket is open.");
            this.addEventListener("close", socketCloser);
            this.sockets.add(socket);
            this.addEventListener("outgoing", outgoing);
          };

          const onSocketMessage = (e: MessageEvent) => {
            const log2 = log.sub(onSocketMessage.name);
            if (!(e instanceof MessageEvent)) {
              log2(
                "Unexpected non-MessageEvent from socket:",
                e,
              );
              return;
            }
            const multiplexMessage: MultiplexMessage =
              extractAnyMultiplexMessage(e);
            this.dispatchEvent(asMultiplexMessageEvent(multiplexMessage));
            this.dispatchEvent(
              asMultiplexMessageEvent(multiplexMessage, "incoming"),
            );
            [...this.sockets.values()]
              .filter(isNot(socket))
              .forEach((socket) =>
                socket.send(JSON.stringify(multiplexMessage))
              );
          };

          const onSocketClose = () => {
            log.sub(onSocketClose.name)("socket is closed.");
            this.sockets.delete(socket);
            this.removeEventListener("outgoing", outgoing);
            this.removeEventListener("close", socketCloser);
          };

          socket.addEventListener("open", onSocketOpen);
          socket.addEventListener("message", onSocketMessage);
          socket.addEventListener("close", onSocketClose);

          await requestEvent.respondWith(response);
        }
      }
    } finally {
      this.removeEventListener("close", connCloser);
    }
  }

  postMessage(message: MultiplexMessage): void {
    for (const socket of this.sockets) {
      socket.send(JSON.stringify(message));
    }
  }
}
