import { WebSocketServer } from "./web-socket-server.ts";
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
  private wss?: WebSocketServer;
  private ws?: WebSocket;
  private outgoingMessages: LocalMultiplexMessage[] = [];
  readonly url: IdUrl;

  createClientServerStateMachine(): StateMachine<ClientServerState> {
    return new StateMachine<ClientServerState>(
      "server wannabe",
      [
        {
          from: "server wannabe",
          to: "server starting",
          description: "start listening",
          fn: async () => {
            this.wss = new WebSocketServer(getPortNumber(this.url));

            this.wss.addEventListener("error", (e) => {
              if (
                e instanceof ErrorEvent &&
                e.error instanceof Deno.errors.AddrInUse
              ) {
                this.state.transitionTo("server collision");
              } else {
                this.state.transitionTo("server failed");
              }
            });

            this.wss.addEventListener("open", () => {
              this.state.transitionTo("server");
            });

            for await (const ws of this.wss.server) {
            }
          },
        },
        {
          from: "server starting",
          to: "server collision",
          description: "address in use",
        },
        {
          from: "server starting",
          to: "server",
          description: "listening",
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
