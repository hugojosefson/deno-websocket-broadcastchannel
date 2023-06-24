import {s, safely} from "./fn.ts";
import {Logger, logger} from "./log.ts";

const log0: Logger = logger(import.meta.url);

export interface WebSocketEventData<E extends Event> {
  ws: WebSocket;
  url: string;
  clientEvent: E;
}

export interface WebSocketEvent extends Event {
  data: WebSocketEventData<Event>;
}

export class WebSocketClientEvent<
  T extends
    | "client:open"
    | "client:close"
    | "client:message"
    | "client:error",
  E extends WebSocketEvent = WebSocketEvent,
> extends MessageEvent implements WebSocketEvent {
  constructor(
    type: T,
    ws: WebSocket,
    url: string,
    clientEvent: Event,
  ) {
    super(type, { data: { ws, url, clientEvent } });
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
  readonly clients: Set<WebSocket> = new Set<WebSocket>();
  readonly server: Deno.Listener;
  private listening = false;
  isListening(): boolean {
    return this.listening;
  }

  constructor(    private port: number  ) {
    super();
    const log2: Logger = this.log1.sub("constructor");
    this.addEventListener("open", () => {
      log2("this.open; listening = true");
      this.listening = true;
    });
    this.addEventListener("close", () => {
      log2("this.close; listening = false");
      this.listening = false;
    });
    log2(`creating server for port ${s(port)}...`);
    this.server = Deno.listen({ port });
    log2(`created server for port ${s(port)}...`);

    log2("accepting connections...");
    void this.acceptConnections();
    log2("done")
  }

  private async acceptConnections(): Promise<void> {
    const log2: Logger = this.log1.sub(this.acceptConnections.name);
    log2("dispatching open event...")
    this.dispatchEvent(new MessageEvent("open"));
    log2("dispatched open event")
    log2("for awaiting conns...")
    try {
      for await (const conn of this.server) {
        log2("for awaiting conns; got conn")
        void this.handleConn(conn);
        log2("for awaiting conns; continue")
      }
    } catch (error) {
      log2("for awaiting conns; caught and re-dispatching error", error)
      this.dispatchEvent(new ErrorEvent("error", { error }));
      safely(() => {
        log2("for awaiting conns; closing server")
        this.server.close();
        log2("for awaiting conns; closed server")
      });
    }
    log2("for awaiting conns; done")

    log2("dispatching close event...")
    this.dispatchEvent(new CloseEvent("close"));
    log2("dispatched close event")
  }

  private async handleConn(conn: Deno.Conn): Promise<void> {
    const log2: Logger = this.log1.sub(this.handleConn.name);
    log2("handling conn...")
    const httpConn: Deno.HttpConn = Deno.serveHttp(conn);
    log2("got httpConn")

    log2("for awaiting requestEvents...")
    for await (const requestEvent of httpConn) {
      log2("for awaiting requestEvents; got requestEvent")
      const response = this.handleReq(requestEvent.request);
      log2("for awaiting requestEvents; got response. responding...")
      await requestEvent.respondWith(response);
      log2("for awaiting requestEvents; responded. continue...")
    }
  }

  private handleReq(req: Request): Response {
    const log2: Logger = this.log1.sub(this.handleReq.name);
    log2("handling req...")
    const upgrade = req.headers.get("upgrade") || "";
    log2(`got upgrade header ${s(upgrade)}`);
    if (upgrade.toLowerCase() !== "websocket") {
      const body = "request isn't trying to upgrade to websocket.";
      log2(`upgrade header ${s(upgrade)} isn't websocket; responding with 400 ${s(body)}`);
      return new Response(body, {        status: 400,      });
    }
    log2(`upgrade header ${s(upgrade)} is websocket; upgrading...`);

    const webSocketUpgrade: Deno.WebSocketUpgrade = Deno.upgradeWebSocket(req);
    const ws: WebSocket = webSocketUpgrade.socket;
    log2(`upgraded; got ws`);

    ws.addEventListener("open", (clientEvent: Event) => {
      log2(`ws.open; adding client to set of ${this.clients.size} clients...`)
      this.clients.add(ws);
      log2(`ws.open; added client to set of ${this.clients.size} clients`)
      log2("ws.open; dispatching client:open event...")
      this.dispatchEvent(
        new WebSocketClientEvent("client:open", ws, req.url, clientEvent),
      );
      log2("ws.open; dispatched client:open event")
    });

    ws.addEventListener("close", (clientEvent: Event) => {
      log2(`ws.close; got close event`, clientEvent)
      log2(`ws.close; deleting client from set of ${this.clients.size} clients...`)
      this.clients.delete(ws);
      log2(`ws.close; deleted client from set of ${this.clients.size} clients`)
      log2("ws.close; dispatching client:close event...")
      this.dispatchEvent(
        new WebSocketClientEvent("client:close", ws, req.url, clientEvent),
      );
      log2("ws.close; dispatched client:close event")
    });

    ws.addEventListener("message", (clientEvent: MessageEvent) => {
      log2("ws.message; dispatching client:message event...")
      this.dispatchEvent(
        new WebSocketClientMessageEvent(
          "client:message",
          ws,
          req.url,
          clientEvent,
        ),
      );
      log2("ws.message; dispatched client:message event")
    });

    ws.addEventListener("error", (clientEvent: Event) => {
      log2("ws.error; dispatching client:error event...", clientEvent)
      this.dispatchEvent(
        new WebSocketClientEvent("client:error", ws, req.url, clientEvent),
      );
      log2("ws.error; dispatched client:error event")
    });

    log2("returning webSocketUpgrade.response...")
    return webSocketUpgrade.response;
  }

  close(): void {
    const log2: Logger = this.log1.sub(this.close.name);
    log2("closing server...")
    this.server.close();
    log2("closed server")

    log2(`clearing ${this.clients.size} clients...`)
    this.clients.clear();
    log2(`cleared clients, ${this.clients.size} clients remain`)
  }
}
