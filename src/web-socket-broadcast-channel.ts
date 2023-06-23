import {
  Connector,
  MultiplexMessage,
  NamedClosableEventTarget,
} from "./connector/mod.ts";
import { LoopingConnector } from "./connector/looping-connector.ts";
import { asMultiplexMessageEvent, extractAnyMultiplexMessage } from "./fn.ts";
import { Logger, logger } from "./log.ts";

const log0: Logger = logger(import.meta.url);
let connector: Connector | undefined = undefined;

function ensureConnector() {
  const log1: Logger = log0.sub(ensureConnector.name);
  log1("connector:", !!connector);
  if (connector === undefined) {
    log1("connector === undefined; creating new LoopingConnector...");
    connector = new LoopingConnector();

    connector.addEventListener("close", () => {
      const log = log1.sub("connector.addEventListener('close', ...)");
      log("connector closed; dispatching close events to channels...");

      for (const channelSet of channelSets.values()) {
        for (const channel of channelSet) {
          log("dispatching close event to channel:", channel.name);
          channel.dispatchEvent(new CloseEvent("close"));

          log("unregistering channel:", channel.name);
          unregisterChannel(channel);
        }
      }

      log("setting connector = undefined");
      connector = undefined;
    });

    connector.addEventListener("error", (e: Event) => {
      const log = log1.sub("connector.addEventListener('error', ...)");
      log("connector error:", e);

      log("dispatching error events to channels...");
      for (const channelSet of channelSets.values()) {
        for (const channel of channelSet) {
          log("dispatching error event to channel:", channel.name);
          channel.dispatchEvent(new ErrorEvent("error", e));

          log("unregistering channel:", channel.name);
          unregisterChannel(channel);
        }
      }
    });

    connector.addEventListener("message", (e: Event) => {
      const log = log1.sub("connector.addEventListener('message', ...)");
      log("connector message:", e);
      if (!(e instanceof MessageEvent)) {
        log(
          "Unexpected non-MessageEvent from connector:",
          e,
        );
        return;
      }
      const multiplexMessage: MultiplexMessage = extractAnyMultiplexMessage(e);
      log("connector message is a MultiplexMessage:", multiplexMessage);
      const channels: Set<WebSocketBroadcastChannel> =
        getChannelSetOrDisconnectedEmptySet(multiplexMessage.channel);
      for (const channel of channels) {
        log("dispatching message to channel:", channel.name);
        channel.dispatchEvent(asMultiplexMessageEvent(multiplexMessage));
      }
    });
  }
}

function getConnector(): Connector {
  ensureConnector();
  return connector!;
}

function possiblyUnregisterConnector() {
  const log = log0.sub(possiblyUnregisterConnector.name);
  log("connector:", !!connector);
  if (connector !== undefined) {
    log("connector !== undefined; checking if it should be unregistered...");
    log("channelSets.size:", channelSets.size);
    if (channelSets.size === 0) {
      log("channelSets.size === 0; closing connector...");
      connector.close();
      log("setting connector = undefined");
      connector = undefined;
    } else {
      log("channelSets.size !== 0; not closing connector.");
    }
  }
}

const channelSets: Map<string, Set<WebSocketBroadcastChannel>> = new Map();

function registerChannel(
  channel: WebSocketBroadcastChannel,
): void {
  const log = log0.sub(registerChannel.name);
  log("channel:", channel);

  ensureConnector();
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
  log("channel:", channel);
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
  possiblyUnregisterConnector();
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

export class WebSocketBroadcastChannel extends NamedClosableEventTarget {
  private readonly log: Logger = log0.sub(WebSocketBroadcastChannel.name);
  constructor(name: string) {
    super(name);
    this.log.sub("constructor")("name:", name);
    registerChannel(this);
  }
  postMessage(message: string): void {
    const log1 = this.log.sub("postMessage");
    log1("message:", message);
    this.assertNotClosed();
    const message1 = { channel: this.name, message };
    log1("getConnector().postMessage(message1):", message1);
    getConnector().postMessage(message1);
  }
}
