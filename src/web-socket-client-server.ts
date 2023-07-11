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
import { s, ss } from "./fn.ts";

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
    const log2: Logger = this.log1.sub(
      WebSocketClientServer.prototype.cleanupAndStartServerAndGotoServer.name,
    );
    log2(WebSocketClientServer.prototype.cleanup.name);
    this.cleanup();

    try {
      log2(`creating new ${WebSocketServer.name} on ${s(this.url)}...`);
      this.server = new WebSocketServer(this.url, this.abortController.signal);

      this.server.addEventListener("client:open", () => {
        const log3: Logger = log2.sub("client:open");
        log3(WebSocketClientServer.prototype.sendOutgoingMessages.name);
        this.sendOutgoingMessages();
      });
      this.server.addEventListener("client:message", (event: Event) => {
        const log3: Logger = log2.sub("client:message");
        if (!(event instanceof WebSocketClientMessageEvent)) {
          throw new Error("Expected WebSocketClientMessageEvent");
        }
        const message: LocalMultiplexMessage = JSON.parse(
          event.data.clientEvent.data,
        );
        log3(`received message ${ss(message)} from ${s(event.data.url)}`);

        log3(WebSocketClientServer.prototype.dispatchEvent.name);
        this.dispatchEvent(new MessageEvent("message", { data: message }));

        log3(WebSocketClientServer.prototype.postMessage.name);
        this.postMessage(message);
      });
      this.server.finished.then(() => {
        const log3: Logger = log2.sub("this.server.finished");
        log3("server finished");
        this.state.transitionTo("server failed");
      });

      return this.state.transitionTo("server");
    } catch (error) {
      const log3: Logger = log2.sub("catch");
      if (error instanceof Deno.errors.AddrInUse) {
        log3("address in use");
        return this.state.transitionTo("server failed");
      }
      throw error;
    }
  }

  private cleanupAndStartConnecting() {
    const log2: Logger = this.log1.sub(
      WebSocketClientServer.prototype.cleanupAndStartConnecting.name,
    );
    log2(WebSocketClientServer.prototype.cleanup.name);
    this.cleanup();

    log2(`connecting to ${s(this.url)}...`);
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener("open", () => {
      const log3: Logger = log2.sub("open");
      log3("connected");
      this.state.transitionTo("client");
    });
    this.ws.addEventListener("error", (event) => {
      const log3: Logger = log2.sub("error");
      log3(`event: ${ss(event)}`);
      this.state.transitionTo("client failed");
    });
    this.ws.addEventListener("close", () => {
      const log3: Logger = log2.sub("close");
      log3("closed");
      this.state.transitionTo("client failed");
    });
    this.ws.addEventListener("message", (event: Event) => {
      const log3: Logger = log2.sub("message");
      if (!(event instanceof MessageEvent)) {
        throw new Error("Expected MessageEvent");
      }
      const message: LocalMultiplexMessage = JSON.parse(event.data);
      log3(`received message ${ss(message)}`);

      log3(WebSocketClientServer.prototype.dispatchEvent.name);
      this.dispatchEvent(new MessageEvent("message", { data: message }));
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
        (this.abortController.signal.aborted || this.state.is("closed"))
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
          fn: this.close.bind(this),
        },
        {
          from: "connect client",
          to: "closed",
          fn: this.close.bind(this),
        },
        {
          from: "client wannabe",
          to: "closed",
          fn: this.close.bind(this),
        },
        {
          from: "client",
          to: "closed",
          fn: this.close.bind(this),
        },
        {
          from: "address in use",
          to: "closed",
          fn: this.close.bind(this),
        },
        {
          from: "server",
          to: "closed",
          fn: this.close.bind(this),
        },
        {
          from: "server failed",
          to: "closed",
          fn: this.close.bind(this),
        },
        {
          from: "start server",
          to: "closed",
          fn: this.close.bind(this),
        },
        {
          from: "server wannabe",
          to: "closed",
          fn: this.close.bind(this),
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
    this.abortController.signal.addEventListener(
      "abort",
      this.close.bind(this),
    );
    if (autoStart) {
      this.state.transitionToNextNonFinalState();
    }
  }

  [Symbol.dispose](): void {
    this.close();
  }

  close(): void {
    this.cleanup();
    this.state.transitionTo("closed");
  }

  ensureChannelSet(channelName: string): Set<WebSocketBroadcastChannel> {
    const existingChannelSet = this.channelSets.get(channelName);
    if (existingChannelSet) {
      return existingChannelSet;
    } else {
      const channelSet = new Set<WebSocketBroadcastChannel>();
      this.channelSets.set(channelName, channelSet);
      return channelSet;
    }
  }

  getChannelSetOrEmpty(channelName: string): Set<WebSocketBroadcastChannel> {
    return this.channelSets.get(channelName) ??
      new Set<WebSocketBroadcastChannel>();
  }

  registerChannel(broadcastChannel: WebSocketBroadcastChannel) {
    this.ensureChannelSet(broadcastChannel.name).add(broadcastChannel);
  }

  unregisterChannel(broadcastChannel: WebSocketBroadcastChannel) {
    this.getChannelSetOrEmpty(broadcastChannel.name).delete(broadcastChannel);
    if (this.getChannelSetOrEmpty(broadcastChannel.name).size === 0) {
      this.channelSets.delete(broadcastChannel.name);
    }
  }

  postMessage(message: LocalMultiplexMessage) {
    const log1 = this.log1.sub(
      WebSocketClientServer.prototype.postMessage.name,
    );
    log1(`message: ${ss(message)}`);

    log1(WebSocketClientServer.prototype.postMessageLocal.name);
    this.postMessageLocal(message);

    this.outgoingMessages.push(message);
    this.sendOutgoingMessages();
  }

  private postMessageLocal(message: LocalMultiplexMessage) {
    const log1 = this.log1.sub(
      WebSocketClientServer.prototype.postMessageLocal.name,
    );
    const channelSet: Set<WebSocketBroadcastChannel> = this
      .getChannelSetOrEmpty(message.channel);
    log1("channelSet.size", channelSet.size);
    for (const channel of channelSet) {
      if (channel.uuid === message.from) {
        log1(`skipping message to self ${s(channel.uuid)}`);
        continue;
      }

      log1(`dispatching message to channel ${s(channel.uuid)}`);
      channel.dispatchEvent(
        new MessageEvent("message", { data: message.message }),
      );
    }
  }
}
