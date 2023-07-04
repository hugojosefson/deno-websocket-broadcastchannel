import { Logger, logger } from "./log.ts";
import { IdUrl } from "./id-url.ts";
import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";
import { LocalMultiplexMessage } from "./multiplex-message.ts";
import { Disposable, Symbol } from "./using.ts";
import { StateMachine } from "./state-machine.ts";
import { getPortNumber, safely } from "./fn.ts";
import Conn = Deno.Conn;

const log0: Logger = logger(import.meta.url);

type ClientServerState =
  | "server wannabe"
  | "start listening"
  | "accept next connection"
  | "address in use"
  | "server failed"
  | "client wannabe"
  | "connect client"
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

  private startListening() {
    const port: number = getPortNumber(this.url);
    try {
      this.listener = Deno.listen({
        port,
        transport: "tcp",
        hostname: this.url.hostname,
      });
    } catch (e) {
      return this.state.transitionTo(
        e instanceof Deno.errors.AddrInUse ? "address in use" : "server failed",
      );
    }
  }

  private addressInUse() {
    this.listener?.close();
    this.listener = undefined;
    return this.state.transitionTo("client wannabe");
  }

  private readonly handleConnPromises: Set<Promise<void>> = new Set();
  private async acceptNextConnection() {
    const conn: Conn | undefined = await this.listener?.accept();
    if (conn === undefined) {
      return this.state.transitionTo("server failed");
    }
    const connPromise = this.handleConn(conn);
    this.handleConnPromises.add(connPromise.finally(() => {
      this.handleConnPromises.delete(connPromise);
    }));
    return this.state.transitionTo("accept next connection");
  }

  private async handleConn(conn: Conn) {
    const httpConn: Deno.HttpConn = Deno.serveHttp(conn);

    for await (const requestEvent of httpConn) {
      const req = requestEvent.request;

      const upgradeHeader = req.headers.get("upgrade") || "";
      if (upgradeHeader.toLowerCase() !== "websocket") {
        await requestEvent.respondWith(
          new Response(null, {
            status: 400,
          }),
        );
        return this.state.transitionTo("accept next connection");
      }

      const upgrade: Deno.WebSocketUpgrade = Deno.upgradeWebSocket(req);

      const ws: WebSocket = upgrade.socket;
      ws.addEventListener("open", () => {
        this.clients.add(ws);
      });
      ws.addEventListener("close", () => {
        this.clients.delete(ws);
      });

      await requestEvent.respondWith(upgrade.response);
    }
  }

  private async handleRequestEvent(requestEvent: Deno.RequestEvent) {
  }

  private async cleanup() {
    this.listener?.close();
    this.listener = undefined;
    this.ws?.close();
    this.ws = undefined;
    this.clients.forEach((ws) => safely(() => ws.close()));
    this.clients.clear();
    for (const p of this.handleConnPromises) {
      await p.catch(() => undefined);
    }
  }

  private async clientWannabe() {
    await this.cleanup();
    return this.state.transitionTo("connect client");
  }

  private async serverFailed() {
    await this.cleanup();
    return this.state.transitionTo("server failed");
  }

  createClientServerStateMachine(): StateMachine<ClientServerState> {
    return new StateMachine<ClientServerState>(
      "server wannabe",
      (transition, createTransition) =>
        this.shouldClose ? createTransition("closed") : transition,
      undefined,
      [
        {
          from: "server wannabe",
          to: "start listening",
          fn: this.startListening.bind(this),
        },
        {
          from: "start listening",
          to: "address in use",
          fn: this.addressInUse.bind(this),
        },
        {
          from: "start listening",
          to: "accept next connection",
          fn: this.acceptNextConnection.bind(this),
        },
        {
          from: "accept next connection",
          to: "accept next connection",
          fn: this.acceptNextConnection.bind(this),
        },
        {
          from: "start listening",
          to: "server failed",
          description: "other error",
          fn: this.serverFailed.bind(this),
        },
        {
          from: "address in use",
          to: "client wannabe",
          fn: this.clientWannabe.bind(this),
        },
        {
          from: "accept next connection",
          to: "server failed",
          description: "fatal error",
          fn: this.serverFailed.bind(this),
        },
        {
          from: "server failed",
          to: "client wannabe",
          fn: this.clientWannabe.bind(this),
        },
        {
          from: "client wannabe",
          to: "connect client",
          description: "start connecting",
        },
        {
          from: "connect client",
          to: "client",
          description: "connected",
        },
        {
          from: "connect client",
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
        },
        {
          from: "client failed",
          to: "closed",
          description: "should close",
        },
        {
          from: "connect client",
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
          from: "address in use",
          to: "closed",
          description: "should close",
        },
        {
          from: "server failed",
          to: "closed",
          description: "should close",
        },
        {
          from: "start listening",
          to: "closed",
          description: "should close",
        },
        {
          from: "server wannabe",
          to: "closed",
          description: "should close",
        },
        {
          from: "accept next connection",
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
