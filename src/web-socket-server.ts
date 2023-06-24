import { safely } from "./fn.ts";

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
  readonly clients: Set<WebSocket> = new Set<WebSocket>();
  readonly server: Deno.Listener;
  private listening = false;
  isListening(): boolean {
    return this.listening;
  }

  constructor(
    private port: number = 8080,
  ) {
    super();
    this.addEventListener("open", () => {
      this.listening = true;
    });
    this.addEventListener("close", () => {
      this.listening = false;
    });
    this.server = Deno.listen({ port });
    void this.acceptConnections();
  }

  private async acceptConnections(): Promise<void> {
    this.dispatchEvent(new MessageEvent("open"));
    try {
      for await (const conn of this.server) {
        void this.handleConn(conn);
      }
    } catch (error) {
      this.dispatchEvent(new ErrorEvent("error", { error }));
      safely(() => this.server.close());
    }
    this.dispatchEvent(new CloseEvent("close"));
  }

  private async handleConn(conn: Deno.Conn): Promise<void> {
    const httpConn: Deno.HttpConn = Deno.serveHttp(conn);

    for await (const requestEvent of httpConn) {
      await requestEvent.respondWith(this.handleReq(requestEvent.request));
    }
  }

  private handleReq(req: Request): Response {
    const upgrade = req.headers.get("upgrade") || "";
    if (upgrade.toLowerCase() !== "websocket") {
      return new Response("request isn't trying to upgrade to websocket.", {
        status: 400,
      });
    }
    const webSocketUpgrade: Deno.WebSocketUpgrade = Deno.upgradeWebSocket(req);
    const ws: WebSocket = webSocketUpgrade.socket;

    ws.addEventListener("open", (clientEvent: Event) => {
      this.clients.add(ws);
      this.dispatchEvent(
        new WebSocketClientEvent("client:open", ws, req.url, clientEvent),
      );
    });

    ws.addEventListener("close", (clientEvent: Event) => {
      this.clients.delete(ws);
      this.dispatchEvent(
        new WebSocketClientEvent("client:close", ws, req.url, clientEvent),
      );
    });

    ws.addEventListener("message", (clientEvent: MessageEvent) => {
      this.dispatchEvent(
        new WebSocketClientMessageEvent(
          "client:message",
          ws,
          req.url,
          clientEvent,
        ),
      );
    });

    ws.addEventListener("error", (clientEvent: Event) => {
      this.dispatchEvent(
        new WebSocketClientEvent("client:error", ws, req.url, clientEvent),
      );
    });

    return webSocketUpgrade.response;
  }

  close(): void {
    this.server.close();
    this.clients.clear();
  }
}
