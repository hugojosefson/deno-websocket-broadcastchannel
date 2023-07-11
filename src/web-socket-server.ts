import { getPortNumber, orSignalController, s, safely } from "./fn.ts";
import { Logger, logger } from "./log.ts";
import { serveWebSocket } from "./serve-web-socket.ts";
import { IdUrl } from "./id-url.ts";

const log0: Logger = logger(import.meta.url);

export interface WebSocketEventData<E extends Event | undefined> {
  ws: WebSocket;
  url: string;
  clientEvent: E;
}

export interface WebSocketEvent extends Event {
  data: WebSocketEventData<Event | undefined>;
}

export class WebSocketClientEvent<
  T extends
    | "client:open"
    | "client:close"
    | "client:message"
    | "client:error",
  E extends (
    T extends "client:message" ? MessageEvent
      : (
        T extends "client:open" ? (undefined | Event)
          : Event
      )
  ),
> extends MessageEvent<WebSocketEventData<E>> implements WebSocketEvent {
  constructor(
    type: T,
    ws: WebSocket,
    url: string,
    clientEvent: E,
  ) {
    super(
      type as string,
      { data: { ws, url, clientEvent } } as MessageEventInit,
    );
  }
}

export class WebSocketClientMessageEvent extends WebSocketClientEvent<
  "client:message",
  MessageEvent
> {
  constructor(
    type: "client:message",
    ws: WebSocket,
    url: string,
    clientEvent: MessageEvent,
  ) {
    super(type, ws, url, clientEvent);
  }
}

export class WebSocketServer extends EventTarget implements Deno.Closer {
  private readonly log1: Logger = log0.sub(WebSocketServer.name);
  readonly webSockets: Set<WebSocket> = new Set<WebSocket>();
  readonly server: Deno.Server;
  readonly abortController: AbortController;
  get finished(): Promise<void> {
    return this.server.finished;
  }

  constructor(private url: IdUrl, signal?: AbortSignal) {
    super();
    const log2: Logger = this.log1.sub("constructor");

    log2(`creating server for ${s(url)}...`);
    this.abortController = orSignalController(signal);
    this.abortController.signal.addEventListener("abort", () => {
      log2("closing webSockets...");
      safely(() => {
        log2(`closing ${this.webSockets.size} webSockets...`);
        for (const ws of this.webSockets) {
          safely(() => {
            log2(`closing webSocket...`);
            ws.close();
            log2(`closed webSocket`);
          });
        }
        log2(`closed clients`);
      });

      log2(`clearing ${this.webSockets.size} clients...`);
      this.webSockets.clear();
      log2(`cleared clients, ${this.webSockets.size} clients remain`);
    });

    this.server = serveWebSocket(
      {
        port: getPortNumber(url),
        hostname: url.hostname,
        signal: this.abortController.signal,
        onListen: ({ hostname, port }) => {
          log2(`server is listening on ${hostname}:${port}`);
        },
      },
      this.handleIncomingWs.bind(this),
    );
    log2(`created server for ${s(url)}.`);
    log2("done");
  }

  broadcast(message: string) {
    const log2: Logger = this.log1.sub(this.broadcast.name);
    log2(`sending message to ${this.webSockets.size} clients...`);
    let count = 0;
    for (const ws of this.webSockets) {
      log2(`sending message to client...`);
      try {
        ws.send(message);
        count++;
        log2(`sent message to client`);
      } catch (error) {
        log2(`failed to send message to client`, error);
        safely(() => ws.close());
        this.webSockets.delete(ws);
      }
    }
    log2(`sent message to ${count} clients`);
  }

  private handleIncomingWs(
    ws: WebSocket,
    req: Request,
    _info: Deno.ServeHandlerInfo,
  ): void {
    const log2: Logger = this.log1.sub(this.handleIncomingWs.name);
    log2("handling ws...");
    log2(`ws.open; adding client to set of ${this.webSockets.size} clients...`);
    this.webSockets.add(ws);
    log2(`ws.open; added client to set of ${this.webSockets.size} clients`);
    log2("ws.open; dispatching client:open event...");
    this.dispatchEvent(
      new WebSocketClientEvent("client:open", ws, req.url, undefined),
    );
    log2("ws.open; dispatched client:open event");

    ws.addEventListener("close", (clientEvent: Event) => {
      log2(`ws.close; got close event`, clientEvent);
      log2(
        `ws.close; deleting client from set of ${this.webSockets.size} clients...`,
      );
      this.webSockets.delete(ws);
      log2(
        `ws.close; deleted client from set of ${this.webSockets.size} clients`,
      );
      log2("ws.close; dispatching client:close event...");
      this.dispatchEvent(
        new WebSocketClientEvent("client:close", ws, req.url, clientEvent),
      );
      log2("ws.close; dispatched client:close event");
    });

    ws.addEventListener("message", (clientEvent: MessageEvent) => {
      log2("ws.message; dispatching client:message event...");
      this.dispatchEvent(
        new WebSocketClientMessageEvent(
          "client:message",
          ws,
          req.url,
          clientEvent,
        ),
      );
      log2("ws.message; dispatched client:message event");
    });

    ws.addEventListener("error", (clientEvent: Event) => {
      log2("ws.error; dispatching client:error event...", clientEvent);
      this.dispatchEvent(
        new WebSocketClientEvent("client:error", ws, req.url, clientEvent),
      );
      log2("ws.error; dispatched client:error event");
    });
  }

  close(): void {
    const log2: Logger = this.log1.sub(this.close.name);
    log2("aborting server...");
    this.abortController.abort();
    log2("aborted server");
  }
}
