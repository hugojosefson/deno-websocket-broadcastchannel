import {
  Connector,
  MultiplexMessage,
  NamedClosableEventTarget,
} from "./connector/mod.ts";
import { LoopingConnector } from "./connector/looping-connector.ts";
import { isMultiplexMessage } from "./fn.ts";

let connector: Connector | undefined = undefined;

function ensureConnector() {
  if (connector === undefined) {
    connector = new LoopingConnector();

    connector.addEventListener("close", () => {
      for (const channelSet of channelSets.values()) {
        for (const channel of channelSet) {
          channel.dispatchEvent(new CloseEvent("close"));
          unregisterChannel(channel);
        }
      }
      connector = undefined;
    });

    connector.addEventListener("error", (e: Event) => {
      for (const channelSet of channelSets.values()) {
        for (const channel of channelSet) {
          channel.dispatchEvent(new ErrorEvent("error", e));
          unregisterChannel(channel);
        }
      }
    });

    connector.addEventListener("message", (e: Event) => {
      if (!(e instanceof MessageEvent)) {
        return;
      }
      if (!(isMultiplexMessage(e.data))) {
        return;
      }
      const { channel: channelName, message }: MultiplexMessage = e.data;
      const channels = getChannelSetOrDisconnectedEmptySet(channelName);
      for (const channel of channels) {
        channel.dispatchEvent(new MessageEvent("message", { data: message }));
      }
    });
  }
}

function getConnector(): Connector {
  ensureConnector();
  return connector!;
}

function possiblyUnregisterConnector() {
  if (connector !== undefined) {
    if (channelSets.size === 0) {
      connector.close();
      connector = undefined;
    }
  }
}

const channelSets: Map<string, Set<WebSocketBroadcastChannel>> = new Map();

function registerChannel(
  channel: WebSocketBroadcastChannel,
): void {
  ensureConnector();
  channel.addEventListener("close", () => unregisterChannel(channel));
  getOrCreateChannelSet(channel.name).add(channel);
}

function unregisterChannel(
  channel: WebSocketBroadcastChannel,
): void {
  const channelSet: Set<WebSocketBroadcastChannel> = channelSets.get(
    channel.name,
  )!;
  channelSet.delete(channel);
  if (channelSet.size === 0) {
    channelSets.delete(channel.name);
  }
  possiblyUnregisterConnector();
}

function getOrCreateChannelSet(
  name: string,
): Set<WebSocketBroadcastChannel> {
  if (!channelSets.has(name)) {
    channelSets.set(name, new Set());
  }
  return channelSets.get(name)!;
}

function getChannelSetOrDisconnectedEmptySet(
  name: string,
): Set<WebSocketBroadcastChannel> {
  return channelSets.get(name) ?? new Set();
}

export class WebSocketBroadcastChannel extends NamedClosableEventTarget {
  constructor(name: string) {
    super(name);
    registerChannel(this);
  }
  postMessage(message: string): void {
    this.assertNotClosed();
    getConnector().postMessage({ channel: this.name, message });
  }
}
