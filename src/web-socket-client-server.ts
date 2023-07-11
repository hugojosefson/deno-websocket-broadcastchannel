import { Logger, logger } from "./log.ts";
import { IdUrl } from "./id-url.ts";
import { WebSocketBroadcastChannel } from "./web-socket-broadcast-channel.ts";
import {
  extractAnyMultiplexMessage,
  MultiplexMessage,
} from "./multiplex-message.ts";
import { Disposable, Symbol } from "./using.ts";
import { StateMachine } from "./state-machine.ts";
import { WebSocketServer } from "./web-socket-server.ts";
import { s, ss } from "./fn.ts";
import { IdUrlChannel } from "./id-url-channel.ts";

const log0: Logger = logger(import.meta.url);

type ClientServerState =
  | "server wannabe"
  | "start server"
  | "server"
  | "address in use"
  | "server closed"
  | "client wannabe"
  | "connect client"
  | "client"
  | "client closed"
  | "closed";

/**
 * Owns:
 * - a url for where to listen, or connect to
 * - a state machine (server/client/connecting/closed etc)
 * - an AbortController for when "closed" state is desired or reached
 * - a Set<WebSocketBroadcastChannel>, per channel name
 * - a WebSocketServer (when server)
 * - a WebSocket       (when client)
 * - yet undelivered messages
 *
 * Emits:
 * - "close" when aborted or closed
 *
 * Listens to:
 * - {@link AbortController}: "abort" → state:closed.
 * - {@link WebSocketBroadcastChannel}: "close" → remove from {@link channelSets}, and if empty, abort.
 * - {@link WebSocketBroadcastChannel}: "postMessage" → means a message came from a {@link WebSocketBroadcastChannel}, so it should be sent to the server or clients, depending on the state.
 * - {@link WebSocketServer} when in state:server: "client:open" → {@link sendOutgoingMessages}
 * - {@link WebSocketServer} when in state:server: "client:message" → means a message came from a client, so it should go to all {@link WebSocketBroadcastChannel}s in {@link channelSets} for the message's channel name, and to all {@link server.webSockets}.
 * - {@link WebSocketServer} when in state:server: {@link server.finished} → state:client
 * - {@link WebSocket} when in state:client: "open" → {@link sendOutgoingMessages}
 * - {@link WebSocket} when in state:client: "message" → means a message came from the server, so it should go to all {@link WebSocketBroadcastChannel}s in {@link channelSets} for the message's channel name.
 * - {@link WebSocket} when in state:client: "close" → state:client closed
 * - {@link WebSocket} when in state:client: "error" → state:client closed
 */
export class WebSocketClientServer extends EventTarget implements Disposable {
  private readonly log1: Logger;
  readonly channelSets: Map<string, Set<WebSocketBroadcastChannel>> = new Map();
  private readonly state: StateMachine<ClientServerState>;
  readonly abortController: AbortController = new AbortController();
  private server?: WebSocketServer;
  private ws?: WebSocket;
  private yetUndeliveredMessages: MultiplexMessage[] = [];
  readonly url: IdUrl;

  constructor(url: IdUrl, autoStart = true) {
    super();
    this.log1 = log0.sub(WebSocketClientServer.name).sub(url.toString());
    this.url = url;
    this.state = this.createClientServerStateMachine();
    this.abortController.signal.addEventListener(
      "abort",
      () => {
        this.dispatchEvent(new CloseEvent("close"));
        this.close();
      },
      { once: true },
    );
    if (autoStart) {
      this.state.transitionToNextNonFinalState();
    }
  }

  [Symbol.dispose](): void {
    this.close();
  }

  close(): void {
    if (!this.abortController.signal.aborted) {
      this.abortController.abort();
      return;
    }

    this.cleanup();
    this.state.transitionTo("closed");
  }

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

      this.server.finished.then(() => {
        const log3: Logger = log2.sub("this.server.finished");
        log3("server finished");
        this.state.transitionTo("server closed");
      });

      this.server.addEventListener("client:message", (event: Event) => {
        const log3: Logger = log2.sub("client:message");
        const message: MultiplexMessage = extractAnyMultiplexMessage(event);
        log3(
          `received message ${ss(message)} from ${s(message.from)} on channel ${
            s(message.channel)
          }`,
        );

        log3(WebSocketClientServer.prototype.broadcast.name);
        this.broadcast(message);
      });

      return this.state.transitionTo("server");
    } catch (error) {
      const log3: Logger = log2.sub("catch");
      if (error instanceof Deno.errors.AddrInUse) {
        log3("address in use");
        return this.state.transitionTo("server closed");
      }
      log3(`error: ${ss(error)}`);
      return this.state.transitionTo("server closed");
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
      this.state.transitionTo("client closed");
    });

    this.ws.addEventListener("close", () => {
      const log3: Logger = log2.sub("close");
      log3("closed");
      this.state.transitionTo("client closed");
    });

    this.ws.addEventListener("message", (event: Event) => {
      const log3: Logger = log2.sub("message");
      const message: MultiplexMessage = extractAnyMultiplexMessage(event);
      log3(
        `received message ${ss(message)} from ${s(message.from)} on channel ${
          s(message.channel)
        }`,
      );

      log3(WebSocketClientServer.prototype.broadcast.name);
      this.broadcast(message);
    });
  }

  private sendOutgoingMessages() {
    for (const message of this.outgoingMessagesToSend()) {
      this.doSendOutgoingMessage(message);
    }
  }

  private doSendOutgoingMessage(message: MultiplexMessage) {
    const data: string = JSON.stringify(message);
    this.ws?.send(data);
    this.server?.broadcast(data);
  }

  private *outgoingMessagesToSend(): Generator<MultiplexMessage> {
    while (
      !this.abortController.signal.aborted &&
      this.yetUndeliveredMessages.length > 0 &&
      this.state.is("client", "server")
    ) {
      const message = this.yetUndeliveredMessages.shift();
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
          to: "server closed",
          fn: StateMachine.gotoFn(() => this.state, "client wannabe"),
        },
        {
          from: "server",
          to: "server closed",
          fn: StateMachine.gotoFn(() => this.state, "client wannabe"),
        },
        {
          from: "address in use",
          to: "client wannabe",
          fn: StateMachine.gotoFn(() => this.state, "connect client"),
        },
        {
          from: "server closed",
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
          to: "client closed",
          fn: StateMachine.gotoFn(() => this.state, "server wannabe"),
        },
        {
          from: "client",
          to: "client closed",
          fn: StateMachine.gotoFn(() => this.state, "server wannabe"),
        },
        {
          from: "client closed",
          to: "server wannabe",
          fn: StateMachine.gotoFn(() => this.state, "start server"),
        },
        {
          from: "client closed",
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
          from: "server closed",
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

  private ensureChannelSet(
    channelName: string,
  ): Set<WebSocketBroadcastChannel> {
    const existingChannelSet = this.channelSets.get(channelName);
    if (existingChannelSet) {
      return existingChannelSet;
    } else {
      const channelSet = new Set<WebSocketBroadcastChannel>();
      this.channelSets.set(channelName, channelSet);
      return channelSet;
    }
  }

  private getChannelSetOrEmpty(
    channelName: string,
  ): Set<WebSocketBroadcastChannel> {
    return this.channelSets.get(channelName) ??
      new Set<WebSocketBroadcastChannel>();
  }

  private registerChannel(broadcastChannel: WebSocketBroadcastChannel) {
    broadcastChannel.addEventListener("close", () => {
      this.unregisterChannel(broadcastChannel);
    }, { once: true });

    this.ensureChannelSet(broadcastChannel.name).add(broadcastChannel);
  }

  private unregisterChannel(broadcastChannel: WebSocketBroadcastChannel) {
    const channelSetOrEmpty: Set<WebSocketBroadcastChannel> = this
      .getChannelSetOrEmpty(broadcastChannel.name);
    channelSetOrEmpty.delete(broadcastChannel);
    if (channelSetOrEmpty.size === 0) {
      this.channelSets.delete(broadcastChannel.name);
    }
    if (this.channelSets.size === 0) {
      this.close();
    }
  }

  broadcast(message: MultiplexMessage) {
    const log1 = this.log1.sub(
      WebSocketClientServer.prototype.broadcast.name,
    );
    log1(`message: ${ss(message)}`);

    log1(WebSocketClientServer.prototype.postMessageLocal.name);
    this.postMessageLocal(message);

    this.yetUndeliveredMessages.push(message);
    this.sendOutgoingMessages();
  }

  private postMessageLocal(message: MultiplexMessage) {
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

  createBroadcastChannel(name: string): WebSocketBroadcastChannel {
    const broadcastChannel: WebSocketBroadcastChannel =
      new WebSocketBroadcastChannel(IdUrlChannel.of(this.url, name));
    this.registerChannel(broadcastChannel);
    return broadcastChannel;
  }
}
