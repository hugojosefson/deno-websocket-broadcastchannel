import { Logger, logger } from "./log.ts";
import { IdUrl } from "./id-url.ts";
import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";
import { LocalMultiplexMessage } from "./multiplex-message.ts";
import { Disposable, Symbol } from "./using.ts";
import { StateMachine } from "./state-machine.ts";
import { getPortNumber } from "./fn.ts";

const log0: Logger = logger(import.meta.url);

export type ClientServerState =
  | "server wannabe"
  | "server starting"
  | "server"
  | "server collision"
  | "server failed"
  | "client wannabe"
  | "client starting"
  | "client"
  | "client failed"
  | "closed";

export class WebSocketClientServer extends EventTarget implements Disposable {
  private readonly log1: Logger;
  readonly channelSets: Map<string, Set<WebSocketBroadcastChannel>> = new Map();
  private readonly state: StateMachine<ClientServerState>;
  private shouldClose = false;
  private listener?: Deno.Listener;
  private readonly clients: Set<WebSocket> = new Set<WebSocket>();
  private ws?: WebSocket;
  private outgoingMessages: LocalMultiplexMessage[] = [];
  readonly url: IdUrl;

  createClientServerStateMachine(): StateMachine<ClientServerState> {
    return new StateMachine<ClientServerState>(
      "server wannabe",
      (transition, createTransition) =>
        this.shouldClose ? createTransition("closed") : transition,
      undefined,
      [
        {
          from: "server wannabe",
          to: "server starting",
          description: "start listening",
          fn: () => {
            const port: number = getPortNumber(this.url);
            try {
              this.listener = Deno.listen({
                port,
                transport: "tcp",
                hostname: this.url.hostname,
              });
            } catch (e) {
              return this.state.transitionTo(
                e instanceof Deno.errors.AddrInUse
                  ? "server collision"
                  : "server failed",
              );
            }
          },
        },
        {
          from: "server starting",
          to: "server collision",
          description: "address in use",
          fn: () => {
            this.listener?.close();
            this.listener = undefined;
            return this.state.transitionTo("client wannabe");
          },
        },
        {
          from: "server starting",
          to: "server",
          description: "listening",
          fn: () => {
            if (!this.listener) {
              return this.state.transitionTo("server failed");
            }
          },
        },
        {
          from: "server",
          to: "server",
          description: "next connection",
          fn: async () => {
            const conn = await this.listener?.accept();
            if (!conn) {
              return this.state.transitionTo("server failed");
            }
            // are we hanging here?
            // can we accept multiple connections? multiple requests?
            const httpConn: Deno.HttpConn = Deno.serveHttp(conn);
            for await (const requestEvent of httpConn) {
              const req = requestEvent.request;
              const upgrade = req.headers.get("upgrade") || "";
              if (upgrade.toLowerCase() !== "websocket") {
                await requestEvent.respondWith(
                  new Response(null, {
                    status: 400,
                  }),
                );
                continue;
              }
              const webSocketUpgrade: Deno.WebSocketUpgrade = Deno
                .upgradeWebSocket(req);
              const ws: WebSocket = webSocketUpgrade.socket;
              ws.addEventListener("open", () => {
                this.clients.add(ws);
              });
              ws.addEventListener("close", () => {
                this.clients.delete(ws);
              });
              await requestEvent.respondWith(webSocketUpgrade.response);
            }
          },
        },
        {
          from: "server starting",
          to: "server failed",
          description: "other error",
        },
        {
          from: "server collision",
          to: "client wannabe",
          description: "!closed",
        },
        {
          from: "server",
          to: "server failed",
          description: "fatal error",
        },
        {
          from: "server failed",
          to: "client wannabe",
          description: "!closed",
        },
        {
          from: "client wannabe",
          to: "client starting",
          description: "start connecting",
        },
        {
          from: "client starting",
          to: "client",
          description: "connected",
        },
        {
          from: "client starting",
          to: "client failed",
          description: "could not",
        },
        {
          from: "client",
          to: "client failed",
          description: "fatal error",
        },
        {
          from: "client failed",
          to: "server wannabe",
          description: "!closed",
        },
        {
          from: "client failed",
          to: "closed",
          description: "should close",
        },
        {
          from: "client starting",
          to: "closed",
          description: "should close",
        },
        {
          from: "client wannabe",
          to: "closed",
          description: "should close",
        },
        {
          from: "client",
          to: "closed",
          description: "should close",
        },
        {
          from: "server collision",
          to: "closed",
          description: "should close",
        },
        {
          from: "server failed",
          to: "closed",
          description: "should close",
        },
        {
          from: "server starting",
          to: "closed",
          description: "should close",
        },
        {
          from: "server wannabe",
          to: "closed",
          description: "should close",
        },
        {
          from: "server",
          to: "closed",
          description: "should close",
        },
        {
          from: "closed",
          to: "closed",
          description: "already closed",
        },
      ],
    );
  }
  constructor(url: IdUrl) {
    super();
    this.log1 = log0.sub(WebSocketClientServer.name).sub(url.toString());
    this.url = url;
    this.state = this.createClientServerStateMachine();
  }

  [Symbol.dispose](): void {
    this.state.transitionTo("closed");
  }

  async runUntilClosed(): Promise<void> {
    const log2: Logger = this.log1.sub(this.runUntilClosed.name);
  }
}
