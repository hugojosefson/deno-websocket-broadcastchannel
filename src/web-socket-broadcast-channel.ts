import { extractAnyMultiplexMessage, MultiplexMessage, s } from "./fn.ts";
import { Logger, logger } from "./log.ts";
import { WebSocketClientServer } from "./web-socket-client-server.ts";

const log0: Logger = logger(import.meta.url);
let wscs: WebSocketClientServer | undefined = undefined;

function ensureWscs() {
  const log1: Logger = log0.sub(ensureWscs.name);
  log1("wscs:", !!wscs);
  if (wscs === undefined) {
    log1("wscs === undefined; creating new WebSocketClientServer...");
    wscs = new WebSocketClientServer();

    wscs.addEventListener("close", () => {
      const log = log1.sub("wscs.addEventListener('close', ...)");
      log("wscs closed; dispatching close events to channels...");

      for (const channelSet of channelSets.values()) {
        for (const channel of channelSet) {
          log("dispatching close event to channel:", channel.name);
          channel.dispatchEvent(new CloseEvent("close"));
        }
      }

      log("setting wscs = undefined");
      wscs = undefined;
    });

    wscs.addEventListener("error", (e: Event) => {
      const log = log1.sub("wscs.addEventListener('error', ...)");
      log("wscs error:", e);

      log("dispatching error events to channels...");
      for (const channelSet of channelSets.values()) {
        for (const channel of channelSet) {
          log("dispatching error event to channel:", channel.name);
          channel.dispatchEvent(new ErrorEvent("error", e));
        }
      }
    });

    wscs.addEventListener("message", (e: Event) => {
      const log = log1.sub("wscs.addEventListener('message', ...)");
      if (!(e instanceof MessageEvent)) {
        log(
          "Unexpected non-MessageEvent from wscs:",
          e,
        );
        return;
      }
      const multiplexMessage: MultiplexMessage = extractAnyMultiplexMessage(e);
      log("wscs message is a MultiplexMessage:", multiplexMessage);
      const channels: Set<WebSocketBroadcastChannel> =
        getChannelSetOrDisconnectedEmptySet(multiplexMessage.channel);
      for (const channel of channels) {
        log("dispatching message to channel:", channel.name);
        channel.dispatchEvent(
          new MessageEvent("message", { data: multiplexMessage.message }),
        );
      }
    });
  }
}

function getWscs(): WebSocketClientServer {
  ensureWscs();
  return wscs!;
}

function possiblyUnregisterWscs() {
  const log = log0.sub(possiblyUnregisterWscs.name);
  log("wscs:", !!wscs);
  if (wscs !== undefined) {
    log("wscs !== undefined; checking if it should be unregistered...");
    log("channelSets.size:", channelSets.size);
    if (channelSets.size === 0) {
      log("channelSets.size === 0; closing wscs...");
      wscs.close();
      log("setting wscs = undefined");
      wscs = undefined;
    } else {
      log("channelSets.size !== 0; not closing wscs.");
    }
  }
}

const channelSets: Map<string, Set<WebSocketBroadcastChannel>> = new Map();

function registerChannel(
  channel: WebSocketBroadcastChannel,
): void {
  const log = log0.sub(registerChannel.name);

  ensureWscs();
  channel.addEventListener("close", () => {
    log(
      `channel.addEventListener('close', ...): unregistering channel ${channel?.name}...`,
    );
    unregisterChannel(channel);
  });

  log("adding channel:", channel.name);
  getOrCreateChannelSet(channel.name).add(channel);
}

function unregisterChannel(
  channel: WebSocketBroadcastChannel,
): void {
  const log = log0.sub(unregisterChannel.name);
  log("channel.name:", channel.name);
  const channelSet: undefined | Set<WebSocketBroadcastChannel> = channelSets
    .get(
      channel.name,
    );
  if (channelSet === undefined) {
    log("channelSet === undefined; channel is not registered.");
    return;
  }
  log("deleting channel:", channel.name);
  channelSet.delete(channel);
  log("channelSet.size:", channelSet.size);
  if (channelSet.size === 0) {
    log("channelSet.size === 0; deleting channelSet:", channel.name);
    channelSets.delete(channel.name);
  }
  possiblyUnregisterWscs();
}

function getOrCreateChannelSet(
  name: string,
): Set<WebSocketBroadcastChannel> {
  const log = log0.sub(getOrCreateChannelSet.name);
  log("name:", name);
  log("channelSets.has(name):", channelSets.has(name));
  if (!channelSets.has(name)) {
    channelSets.set(name, new Set());
  }
  return channelSets.get(name)!;
}

function getChannelSetOrDisconnectedEmptySet(
  name: string,
): Set<WebSocketBroadcastChannel> {
  const log = log0.sub(getChannelSetOrDisconnectedEmptySet.name);
  log("name:", name);
  const channelSet = channelSets.get(name);
  log("channelSet:", channelSet);
  return channelSet ?? new Set();
}

export class WebSocketBroadcastChannel extends EventTarget {
  private readonly log: Logger = log0.sub(WebSocketBroadcastChannel.name);
  private closed = false;
  public readonly name: string;
  constructor(name: string) {
    super();
    this.name = name;
    this.log.sub("constructor")(`name: ${s(name)}`);
    registerChannel(this);
  }
  postMessage(message: string): void {
    const log1 = this.log.sub("postMessage");
    log1(`message: ${s(message)}`);
    if (this.closed) {
      log1("channel is closed; not posting message.");
      return;
    }
    const message1: MultiplexMessage = { channel: this.name, message };
    const message2: string = JSON.stringify(message1);
    log1(`getWscs().postMessage(${s(message2)})`);
    getWscs().postMessage(message2);
  }
  close(): void {
    const log1 = this.log.sub("close");
    log1("closing channel...");
    this.closed = true;
    log1("dispatching close event...");
    this.dispatchEvent(new CloseEvent("close"));
  }
}
