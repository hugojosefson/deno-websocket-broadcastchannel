import { Logger, logger } from "./log.ts";
import { IdUrl } from "./id-url.ts";
import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";
import { LocalMultiplexMessage } from "./multiplex-message.ts";
import { Disposable, Symbol } from "./using.ts";
import { StateMachine } from "./state-machine.ts";
import {
  WebSocketClientMessageEvent,
  WebSocketServer,
} from "./web-socket-server.ts";

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

    this.server.addEventListener("client:open", () => {
      this.sendOutgoingMessages();
    });
    this.server.addEventListener("client:message", (event: Event) => {
      if (!(event instanceof WebSocketClientMessageEvent)) {
        throw new Error("Expected WebSocketClientMessageEvent");
      }
      const message: LocalMultiplexMessage = JSON.parse(
        event.data.clientEvent.data,
      );
      this.dispatchEvent(new MessageEvent("message", { data: message }));
    });
    this.server.finished.then(() => {
      this.state.transitionTo("server failed");
    });

    return this.state.transitionTo("server");
  }

  private cleanupAndStartConnecting() {
    this.cleanup();
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener("open", () => {
      this.state.transitionTo("client");
    });
    this.ws.addEventListener("error", () => {
      this.state.transitionTo("client failed");
    });
    this.ws.addEventListener("close", () => {
      this.state.transitionTo("client failed");
    });
  }

  private sendOutgoingMessages() {
    for (const message of this.outgoingMessagesToSend()) {
      this.doSendOutgoingMessage(message);
    }
  }

  private doSendOutgoingMessage(message: LocalMultiplexMessage) {
    const data: string = JSON.stringify(message);
    this.ws?.send(data);
    this.server?.broadcast(data);
  }

  private *outgoingMessagesToSend(): Generator<LocalMultiplexMessage> {
    while (
      !this.abortController.signal.aborted &&
      this.outgoingMessages.length > 0 &&
      this.state.is("client", "server")
    ) {
      const message = this.outgoingMessages.shift();
      if (message !== undefined) {
        yield message;
      }
    }
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
          fn: this.sendOutgoingMessages.bind(this),
        },
        {
          from: "client wannabe",
          to: "connect client",
          fn: this.cleanupAndStartConnecting.bind(this),
        },
        {
          from: "connect client",
          to: "client",
          fn: this.sendOutgoingMessages.bind(this),
        },
        {
          from: "connect client",
          to: "client failed",
          fn: StateMachine.gotoFn(() => this.state, "server wannabe"),
        },
        {
          from: "client",
          to: "client failed",
          fn: StateMachine.gotoFn(() => this.state, "server wannabe"),
        },
        {
          from: "client failed",
          to: "server wannabe",
          fn: StateMachine.gotoFn(() => this.state, "start server"),
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
    this.abortController.signal.addEventListener("abort", () => {
      this.state.transitionTo("closed");
    });
    if (autoStart) {
      this.state.transitionToNextNonFinalState();
    }
  }

  [Symbol.dispose](): void {
    this.state.transitionTo("closed");
  }
}
