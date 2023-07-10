import { Logger, logger } from "./log.ts";
import { IdUrl } from "./id-url.ts";
import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";
import { LocalMultiplexMessage } from "./multiplex-message.ts";
import { Disposable, Symbol } from "./using.ts";
import { StateMachine } from "./state-machine.ts";
import { WebSocketServer } from "./web-socket-server.ts";

const log0: Logger = logger(import.meta.url);

type ClientServerState =
  | "server wannabe"
  | "start server"
  | "server"
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
  readonly abortController: AbortController = new AbortController();
  private server?: WebSocketServer;
  private ws?: WebSocket;
  private outgoingMessages: LocalMultiplexMessage[] = [];
  readonly url: IdUrl;

  private cleanup() {
    this.server?.close();
    this.server = undefined;
    this.ws?.close();
    this.ws = undefined;
  }

  private cleanupAndStartServerAndGotoServer() {
    this.cleanup();
    this.server = new WebSocketServer(this.url, this.abortController.signal);
    return this.state.transitionTo("server");
  }

  private hookUpServerEventListeners() {
    // TODO: hook up event listeners, handle messages, closing, etc.
  }

  createClientServerStateMachine(): StateMachine<ClientServerState> {
    return new StateMachine<ClientServerState>(
      "server wannabe",
      (transition, createTransition) =>
        this.abortController.signal.aborted
          ? createTransition("closed")
          : transition,
      undefined,
      [
        {
          from: "server wannabe",
          to: "start server",
          fn: this.cleanupAndStartServerAndGotoServer.bind(this),
        },
        {
          from: "start server",
          to: "address in use",
          fn: StateMachine.gotoFn(() => this.state, "client wannabe"),
        },
        {
          from: "start server",
          to: "server failed",
          fn: StateMachine.gotoFn(() => this.state, "client wannabe"),
        },
        {
          from: "server",
          to: "server failed",
          fn: StateMachine.gotoFn(() => this.state, "client wannabe"),
        },
        {
          from: "address in use",
          to: "client wannabe",
          fn: StateMachine.gotoFn(() => this.state, "connect client"),
        },
        {
          from: "server failed",
          to: "client wannabe",
          fn: StateMachine.gotoFn(() => this.state, "connect client"),
        },
        {
          from: "start server",
          to: "server",
          fn: this.hookUpServerEventListeners.bind(this),
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
          fn: StateMachine.gotoFn(() => this.state, "server wannabe"),
        },
        {
          from: "client failed",
          to: "server wannabe",
        },
        {
          from: "client failed",
          to: "closed",
          description: "aborted",
        },
        {
          from: "connect client",
          to: "closed",
          description: "aborted",
        },
        {
          from: "client wannabe",
          to: "closed",
          description: "aborted",
        },
        {
          from: "client",
          to: "closed",
          description: "aborted",
        },
        {
          from: "address in use",
          to: "closed",
          description: "aborted",
        },
        {
          from: "server failed",
          to: "closed",
          description: "aborted",
        },
        {
          from: "start server",
          to: "closed",
          description: "aborted",
        },
        {
          from: "server wannabe",
          to: "closed",
          description: "aborted",
        },
        {
          from: "closed",
          to: "closed",
          description: "already closed",
        },
      ],
    );
  }
  constructor(url: IdUrl, autoStart = true) {
    super();
    this.log1 = log0.sub(WebSocketClientServer.name).sub(url.toString());
    this.url = url;
    this.state = this.createClientServerStateMachine();
    if (autoStart) {
      this.state.transitionToNextNonFinalState();
    }
  }

  [Symbol.dispose](): void {
    this.state.transitionTo("closed");
  }
}
