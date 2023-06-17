import { Connector, NamedClosableEventTarget } from "./connector/mod.ts";
import { LoopingConnector } from "./connector/looping-connector.ts";

let connector: Connector | undefined = undefined;

function ensureConnector() {
  if (connector === undefined) {
    connector = new LoopingConnector();
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
  getChannelSet(channel.name).add(channel);
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

function getChannelSet(
  name: string,
): Set<WebSocketBroadcastChannel> {
  if (!channelSets.has(name)) {
    channelSets.set(name, new Set());
  }
  return channelSets.get(name)!;
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
